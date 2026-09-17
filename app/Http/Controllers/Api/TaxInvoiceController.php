<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProjectQuotation;
use App\Models\CustomerTaxProfile;
use App\Models\FinanceAccount;
use App\Models\FinanceJournalEntry;
use App\Models\TaxInvoice;
use App\Models\ZatcaDocument;
use App\Services\QuotationBillingService;
use App\Services\TaxInvoiceCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TaxInvoiceController extends Controller
{
    public function __construct(
        private readonly TaxInvoiceCalculator $calculator,
        private readonly QuotationBillingService $billingService
    ) {}

    public function index(Request $request)
    {
        $query = TaxInvoice::query()
            ->with([
                'companyTaxProfile:id,legal_name_ar,vat_number',
                'project:id,project_code,name',
                'quotation:id,quotation_number,total,status,project_id',
            ]);

        foreach (['status', 'zatca_status', 'invoice_type', 'document_type', 'billing_type'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->{$filter});
            }
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->filled('quotation_id')) {
            $query->where('quotation_id', $request->quotation_id);
        }

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhere('buyer_name', 'like', "%{$search}%")
                    ->orWhere('buyer_vat_number', 'like', "%{$search}%");
            });
        }

        if ($request->filled('from')) {
            $query->whereDate('issue_date', '>=', $request->from);
        }

        if ($request->filled('to')) {
            $query->whereDate('issue_date', '<=', $request->to);
        }

        return response()->json([
            'success' => true,
            'data' => $query
                ->latest('issue_date')
                ->latest('id')
                ->paginate((int) $request->integer('per_page', 25)),
        ]);
    }

    public function show(TaxInvoice $taxInvoice)
    {
        return response()->json([
            'success' => true,
            'data' => $taxInvoice->load([
                'items.taxCode',
                'companyTaxProfile',
                'project',
                'quotation',
                'originalInvoice:id,invoice_number',
                'zatcaDocument',
                'creator:id,name',
                'issuer:id,name',
                'payments.financeAccount:id,code,name,name_en',
                'payments.receivableAccount:id,code,name,name_en',
                'payments.journalEntry:id,entry_number,status',
                'payments.creator:id,name',
            ]),
        ]);
    }

    /**
     * Finance creates the draft manually.
     * Approval of a quotation NEVER auto-creates a tax invoice.
     */
    public function store(Request $request)
    {
        $data = $this->validatePayload($request);
        $calculation = $this->calculator->calculate($data['items']);

        $quotation = null;
        $billingSummary = null;

        if (!empty($data['quotation_id'])) {
            $quotation = ProjectQuotation::findOrFail($data['quotation_id']);

            $this->billingService->assertApproved($quotation);
            $this->billingService->assertProjectMatches($quotation, $data['project_id'] ?? null);

            $billingSummary = $this->billingService->summary($quotation);

            // Override is deliberately explicit and can later be protected by permission middleware.
            $allowOverride = (bool) ($data['allow_overbilling_override'] ?? false);

            $this->billingService->assertAmountWithinRemaining(
                $quotation,
                (float) $calculation['totals']['total'],
                $allowOverride
            );
        }

        $invoice = DB::transaction(function () use (
            $request,
            $data,
            $calculation,
            $quotation,
            $billingSummary
        ) {
            $payload = collect($data)
                ->except(['items', 'allow_overbilling_override'])
                ->all();

            $invoiceTotal = (float) $calculation['totals']['total'];
            $quotationTotal = $billingSummary['quotation_total'] ?? null;

            $invoice = TaxInvoice::create([
                ...$payload,
                'invoice_number' => $this->generateInvoiceNumber($data['document_type']),
                'uuid' => null,
                'quotation_total_snapshot' => $quotationTotal,
                'invoiced_before_snapshot' => $billingSummary['net_invoiced'] ?? 0,
                'remaining_before_snapshot' => $billingSummary['remaining_to_invoice'] ?? null,
                'billing_percentage' => $quotationTotal && $quotationTotal > 0
                    ? round(($invoiceTotal / $quotationTotal) * 100, 4)
                    : null,
                ...$calculation['totals'],
                'paid_amount' => 0,
                'remaining_amount' => $invoiceTotal,
                'payment_status' => 'unpaid',
                'status' => 'draft',
                'zatca_status' => 'not_submitted',
                'created_by' => $request->user()?->id,
            ]);

            $items = collect($calculation['items'])->map(function ($item) use ($quotation) {
                if (!$quotation || empty($item['quotation_item_id'])) {
                    return $item;
                }

                $sourceItem = $quotation->items()->find($item['quotation_item_id']);

                if (!$sourceItem) {
                    throw ValidationException::withMessages([
                        'items' => ['أحد البنود لا ينتمي إلى عرض السعر المحدد.'],
                    ]);
                }

                $sourceQty = round((float) $sourceItem->quantity, 4);
                $previousQty = $this->billingService->previouslyInvoicedQuantity(
                    $quotation->id,
                    $sourceItem->id
                );
                $remainingQty = round(max(0, $sourceQty - $previousQty), 4);
                $newQty = round((float) $item['quantity'], 4);

                if ($newQty > $remainingQty) {
                    throw ValidationException::withMessages([
                        'items' => [
                            "الكمية المطلوبة للبند رقم {$sourceItem->id} تتجاوز الكمية المتبقية للفوترة."
                        ],
                    ]);
                }

                return [
                    ...$item,
                    'source_quantity_snapshot' => $sourceQty,
                    'previously_invoiced_quantity_snapshot' => $previousQty,
                    'remaining_quantity_before_snapshot' => $remainingQty,
                ];
            })->all();

            $invoice->items()->createMany($items);

            return $invoice;
        });

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء مسودة الفاتورة بواسطة المالية. لم يتم إصدارها أو إرسالها إلى ZATCA بعد.',
            'data' => $invoice->load('items.taxCode', 'quotation'),
        ], 201);
    }

    public function update(Request $request, TaxInvoice $taxInvoice)
    {
        if (!$taxInvoice->isEditable()) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن تعديل الفاتورة بعد إصدارها.',
            ], 422);
        }

        $data = $this->validatePayload($request);
        $calculation = $this->calculator->calculate($data['items']);

        $quotation = !empty($data['quotation_id'])
            ? ProjectQuotation::findOrFail($data['quotation_id'])
            : null;

        if ($quotation) {
            $this->billingService->assertApproved($quotation);
            $this->billingService->assertProjectMatches($quotation, $data['project_id'] ?? null);

            $summary = $this->billingService->summary($quotation);

            $allowOverride = (bool) ($data['allow_overbilling_override'] ?? false);
            $this->billingService->assertAmountWithinRemaining(
                $quotation,
                (float) $calculation['totals']['total'],
                $allowOverride
            );
        }

        DB::transaction(function () use ($taxInvoice, $data, $calculation, $quotation) {
            $taxInvoice->update([
                ...collect($data)->except(['items', 'allow_overbilling_override'])->all(),
                ...$calculation['totals'],
                'remaining_amount' => round(
                    $calculation['totals']['total'] - (float) $taxInvoice->paid_amount,
                    2
                ),
            ]);

            $taxInvoice->items()->delete();

            $items = collect($calculation['items'])->map(function ($item) use ($quotation) {
                if (!$quotation || empty($item['quotation_item_id'])) {
                    return $item;
                }

                $sourceItem = $quotation->items()->find($item['quotation_item_id']);

                if (!$sourceItem) {
                    throw ValidationException::withMessages([
                        'items' => ['أحد البنود لا ينتمي إلى عرض السعر المحدد.'],
                    ]);
                }

                $sourceQty = round((float) $sourceItem->quantity, 4);
                $previousQty = $this->billingService->previouslyInvoicedQuantity(
                    $quotation->id,
                    $sourceItem->id
                );

                return [
                    ...$item,
                    'source_quantity_snapshot' => $sourceQty,
                    'previously_invoiced_quantity_snapshot' => $previousQty,
                    'remaining_quantity_before_snapshot' => round(
                        max(0, $sourceQty - $previousQty),
                        4
                    ),
                ];
            })->all();

            $taxInvoice->items()->createMany($items);
        });

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث مسودة الفاتورة بنجاح.',
            'data' => $taxInvoice->fresh()->load('items.taxCode', 'quotation'),
        ]);
    }

    /**
     * Refresh buyer tax snapshot while the invoice is still a draft.
     * Issued invoices remain immutable.
     */
    public function refreshBuyer(TaxInvoice $taxInvoice)
    {
        if (!$taxInvoice->isEditable()) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن تحديث بيانات المشتري بعد إصدار الفاتورة.',
            ], 422);
        }

        $taxInvoice->loadMissing('project');

        if (!$taxInvoice->project) {
            return response()->json([
                'success' => false,
                'message' => 'الفاتورة غير مرتبطة بمشروع.',
            ], 422);
        }

        $customerCode = trim((string) ($taxInvoice->project->customer_code ?? ''));
        $buyerName = trim((string) ($taxInvoice->buyer_name ?? ''));

        $profileQuery = CustomerTaxProfile::query()
            ->where('is_active', true);

        $matchedBy = null;

        if ($customerCode !== '') {
            $profile = (clone $profileQuery)
                ->where('customer_code', $customerCode)
                ->latest('id')
                ->first();

            if ($profile) {
                $matchedBy = 'customer_code';
            }
        } else {
            $profile = null;
        }

        // Fallback for older projects/customers that do not yet have customer_code.
        if (!$profile && $buyerName !== '') {
            $profile = (clone $profileQuery)
                ->where(function ($q) use ($buyerName) {
                    $q->where('legal_name_ar', $buyerName)
                      ->orWhere('legal_name_en', $buyerName);
                })
                ->latest('id')
                ->first();

            if ($profile) {
                $matchedBy = 'buyer_name';
            }
        }

        if (!$profile) {
            return response()->json([
                'success' => false,
                'message' => $customerCode !== ''
                    ? 'لا يوجد ملف ضريبي نشط مرتبط بكود العميل: ' . $customerCode
                    : 'لا يوجد ملف ضريبي نشط مطابق لاسم المشتري الحالي.',
                'debug' => [
                    'customer_code' => $customerCode ?: null,
                    'buyer_name' => $buyerName ?: null,
                ],
            ], 404);
        }

        $taxInvoice->update([
            'buyer_name' => $profile->legal_name_ar,
            'buyer_vat_number' => $profile->is_vat_registered
                ? $profile->vat_number
                : null,
            'buyer_commercial_register' => $profile->commercial_register,
            'buyer_building_number' => $profile->building_number,
            'buyer_street_name' => $profile->street_name,
            'buyer_district' => $profile->district,
            'buyer_city' => $profile->city,
            'buyer_postal_code' => $profile->postal_code,
            'buyer_country_code' => $profile->country_code ?: 'SA',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات المشتري من الملف الضريبي للعميل.',
            'matched_by' => $matchedBy,
            'customer_tax_profile_id' => $profile->id,
            'data' => $taxInvoice->fresh()->load([
                'items.taxCode',
                'companyTaxProfile',
                'project',
                'quotation',
                'originalInvoice:id,invoice_number',
                'zatcaDocument',
                'creator:id,name',
                'issuer:id,name',
            ]),
        ]);
    }

    public function issue(Request $request, TaxInvoice $taxInvoice)
    {
        if (!$taxInvoice->isEditable()) {
            return response()->json([
                'success' => false,
                'message' => 'الفاتورة ليست في حالة تسمح بالإصدار.',
            ], 422);
        }

        if ($taxInvoice->items()->count() === 0) {
            throw ValidationException::withMessages([
                'items' => ['لا يمكن إصدار فاتورة بدون بنود.'],
            ]);
        }

        if ($taxInvoice->quotation_id) {
            $quotation = ProjectQuotation::findOrFail($taxInvoice->quotation_id);
            $this->billingService->assertApproved($quotation);

            // Re-check at issue time, because another Finance user may have issued an invoice
            // against the same quotation while this draft was being edited.
            $this->billingService->assertAmountWithinRemaining(
                $quotation,
                (float) $taxInvoice->total,
                false
            );

            foreach ($taxInvoice->items as $line) {
                if (!$line->quotation_item_id) {
                    continue;
                }

                $sourceItem = $quotation->items()->find($line->quotation_item_id);
                if (!$sourceItem) {
                    throw ValidationException::withMessages([
                        'items' => ['أحد بنود الفاتورة لم يعد موجودًا في عرض السعر.'],
                    ]);
                }

                $sourceQty = round((float) $sourceItem->quantity, 4);
                $previousQty = $this->billingService->previouslyInvoicedQuantity(
                    $quotation->id,
                    $sourceItem->id
                );
                $remainingQty = round(max(0, $sourceQty - $previousQty), 4);

                if ((float) $line->quantity > $remainingQty) {
                    throw ValidationException::withMessages([
                        'items' => ['تمت فوترة جزء من الكمية بواسطة فاتورة أخرى. حدّث المسودة قبل الإصدار.'],
                    ]);
                }
            }
        }

        $taxInvoice = DB::transaction(function () use ($request, $taxInvoice) {
            $uuid = (string) Str::uuid();

            $effectiveDueDate = $taxInvoice->due_date
                ? $taxInvoice->due_date->toDateString()
                : (
                    $taxInvoice->issue_date
                        ? $taxInvoice->issue_date->toDateString()
                        : now()->toDateString()
                );

            $taxInvoice->update([
                'uuid' => $uuid,
                'status' => 'issued',
                'zatca_status' => 'pending',
                'issued_by' => $request->user()?->id,
                'issued_at' => now(),
            ]);

            ZatcaDocument::updateOrCreate(
                ['tax_invoice_id' => $taxInvoice->id],
                [
                    'uuid' => $uuid,
                    'submission_type' => $taxInvoice->invoice_type === 'tax_invoice'
                        ? 'clearance'
                        : 'reporting',
                    'status' => 'not_generated',
                ]
            );

            $existingJournal = FinanceJournalEntry::query()
                ->where('reference_type', 'tax_invoice')
                ->where('reference_id', $taxInvoice->id)
                ->first();

            if (!$existingJournal) {
                $receivableAccount = FinanceAccount::query()
                    ->where('code', '1121')
                    ->where('is_active', true)
                    ->where('is_postable', true)
                    ->first();

                $revenueAccount = FinanceAccount::query()
                    ->where('code', '4110')
                    ->where('is_active', true)
                    ->where('is_postable', true)
                    ->first();

                $outputVatAccount = FinanceAccount::query()
                    ->where('code', '2120')
                    ->where('is_active', true)
                    ->where('is_postable', true)
                    ->first();

                if (!$receivableAccount) {
                    throw ValidationException::withMessages([
                        'accounting' => ['الحساب 1121 - الذمم المدينة - العملاء غير موجود أو غير قابل للترحيل.'],
                    ]);
                }

                if (!$revenueAccount) {
                    throw ValidationException::withMessages([
                        'accounting' => ['الحساب 4110 - إيرادات المشاريع غير موجود أو غير قابل للترحيل.'],
                    ]);
                }

                if (!$outputVatAccount) {
                    throw ValidationException::withMessages([
                        'accounting' => ['الحساب 2120 - ضريبة القيمة المضافة المستحقة غير موجود أو غير قابل للترحيل.'],
                    ]);
                }

                $invoiceTotal = round((float) $taxInvoice->total, 2);

                // Resolve VAT from the invoice snapshot first, then safely fall back
                // to the item snapshots. This also supports older schema field names.
                $taxAmount = $this->resolveInvoiceTaxAmount($taxInvoice);

                $revenueAmount = round($invoiceTotal - $taxAmount, 2);

                if ($invoiceTotal <= 0) {
                    throw ValidationException::withMessages([
                        'accounting' => ['لا يمكن إنشاء قيد محاسبي لفاتورة بإجمالي صفر أو أقل.'],
                    ]);
                }

                if ($revenueAmount < 0) {
                    throw ValidationException::withMessages([
                        'accounting' => ['قيمة الإيراد المحاسبي المحسوبة غير صالحة.'],
                    ]);
                }

                $journal = FinanceJournalEntry::create([
                    'entry_number' => $this->generateJournalEntryNumber(),
                    'entry_date' => $taxInvoice->issue_date ?: now()->toDateString(),
                    'description' => 'إصدار فاتورة ' . $taxInvoice->invoice_number,
                    'reference_type' => 'tax_invoice',
                    'reference_id' => $taxInvoice->id,
                    'reference_number' => $taxInvoice->invoice_number,
                    'project_id' => $taxInvoice->project_id,
                    'status' => 'posted',
                    'total_debit' => $invoiceTotal,
                    'total_credit' => $invoiceTotal,
                    'created_by' => $request->user()?->id,
                    'approved_by' => $request->user()?->id,
                    'approved_at' => now(),
                    'posted_by' => $request->user()?->id,
                    'posted_at' => now(),
                    'notes' => 'قيد آلي ناتج عن إصدار الفاتورة الضريبية.',
                ]);

                $lines = [
                    [
                        'account_id' => $receivableAccount->id,
                        'project_id' => $taxInvoice->project_id,
                        'description' => 'ذمم العميل - ' . $taxInvoice->invoice_number,
                        'debit' => $invoiceTotal,
                        'credit' => 0,
                    ],
                ];

                if ($revenueAmount > 0) {
                    $lines[] = [
                        'account_id' => $revenueAccount->id,
                        'project_id' => $taxInvoice->project_id,
                        'description' => 'إيراد المشروع - ' . $taxInvoice->invoice_number,
                        'debit' => 0,
                        'credit' => $revenueAmount,
                    ];
                }

                if ($taxAmount > 0) {
                    $lines[] = [
                        'account_id' => $outputVatAccount->id,
                        'project_id' => $taxInvoice->project_id,
                        'description' => 'ضريبة القيمة المضافة المستحقة - ' . $taxInvoice->invoice_number,
                        'debit' => 0,
                        'credit' => $taxAmount,
                    ];
                }

                $journal->lines()->createMany($lines);
            }

            return $taxInvoice->fresh();
        });

        return response()->json([
            'success' => true,
            'message' => 'تم إصدار الفاتورة وتجهيزها لمرحلة ZATCA.',
            'data' => $taxInvoice->load('items.taxCode', 'zatcaDocument'),
        ]);
    }

    public function destroy(TaxInvoice $taxInvoice)
    {
        if (!$taxInvoice->isEditable()) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن حذف فاتورة تم إصدارها.',
            ], 422);
        }

        $taxInvoice->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف مسودة الفاتورة.',
        ]);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'invoice_type' => ['required', Rule::in(['tax_invoice', 'simplified_tax_invoice'])],
            'document_type' => ['required', Rule::in(['invoice', 'credit_note', 'debit_note'])],
            'billing_type' => ['required', Rule::in(['full', 'partial', 'progress'])],
            'company_tax_profile_id' => ['required', 'exists:company_tax_profiles,id'],
            'project_id' => ['nullable', 'exists:projects,id'],
            'quotation_id' => ['nullable', 'exists:project_quotations,id'],
            'original_invoice_id' => ['nullable', 'exists:tax_invoices,id'],
            'customer_id' => ['nullable', 'integer'],
            'buyer_name' => ['required', 'string', 'max:255'],
            'buyer_vat_number' => ['nullable', 'string', 'max:32'],
            'buyer_commercial_register' => ['nullable', 'string', 'max:64'],
            'buyer_building_number' => ['nullable', 'string', 'max:16'],
            'buyer_street_name' => ['nullable', 'string', 'max:255'],
            'buyer_district' => ['nullable', 'string', 'max:255'],
            'buyer_city' => ['nullable', 'string', 'max:255'],
            'buyer_postal_code' => ['nullable', 'string', 'max:16'],
            'buyer_country_code' => ['nullable', 'string', 'size:2'],
            'issue_date' => ['required', 'date'],
            'issue_time' => ['nullable', 'date_format:H:i'],
            'supply_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:issue_date'],
            'currency' => ['required', 'string', 'size:3'],
            'notes' => ['nullable', 'string'],
            'terms' => ['nullable', 'string'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'allow_overbilling_override' => ['nullable', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.quotation_item_id' => ['nullable', 'integer'],
            'items.*.product_id' => ['nullable', 'integer'],
            'items.*.item_code' => ['nullable', 'string', 'max:100'],
            'items.*.description' => ['required', 'string', 'max:1000'],
            'items.*.unit' => ['nullable', 'string', 'max:50'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax_code_id' => ['required', 'exists:tax_codes,id'],
            'items.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ]);
    }

    private function generateJournalEntryNumber(): string
    {
        $lastId = FinanceJournalEntry::query()->max('id') ?? 0;

        return 'JE-' .
            now()->format('Y') .
            '-' .
            str_pad($lastId + 1, 6, '0', STR_PAD_LEFT);
    }

    private function resolveInvoiceTaxAmount(TaxInvoice $taxInvoice): float
    {
        $invoiceTaxFields = [
            'tax',
            'tax_amount',
            'vat_amount',
            'tax_total',
            'total_tax',
        ];

        $invoiceAttributes = $taxInvoice->getAttributes();

        foreach ($invoiceTaxFields as $field) {
            if (!array_key_exists($field, $invoiceAttributes)) {
                continue;
            }

            $value = round((float) $invoiceAttributes[$field], 2);

            if ($value > 0) {
                return $value;
            }
        }

        $taxInvoice->loadMissing('items');

        $itemTaxFields = [
            'tax_amount',
            'tax',
            'vat_amount',
            'tax_total',
        ];

        $itemTax = $taxInvoice->items->sum(function ($item) use ($itemTaxFields) {
            $attributes = $item->getAttributes();

            foreach ($itemTaxFields as $field) {
                if (array_key_exists($field, $attributes)) {
                    return (float) $attributes[$field];
                }
            }

            return 0;
        });

        return round((float) $itemTax, 2);
    }

    private function generateInvoiceNumber(string $documentType): string
    {
        $prefix = match ($documentType) {
            'credit_note' => 'TCN',
            'debit_note' => 'TDN',
            default => 'TINV',
        };

        $date = now()->format('Ym');

        $last = TaxInvoice::query()
            ->where('invoice_number', 'like', "{$prefix}-{$date}-%")
            ->lockForUpdate()
            ->latest('id')
            ->value('invoice_number');

        $next = $last
            ? ((int) substr($last, strrpos($last, '-') + 1)) + 1
            : 1;

        return sprintf('%s-%s-%05d', $prefix, $date, $next);
    }
}
