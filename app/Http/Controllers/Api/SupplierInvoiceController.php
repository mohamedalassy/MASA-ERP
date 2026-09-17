<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\SupplierInvoice;
use App\Models\SupplierInvoiceItem;
use App\Models\FinanceAccount;
use App\Services\SupplierInvoiceMatchingService;
use App\Services\SupplierInvoicePaymentService;
use App\Services\SupplierInvoicePostingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SupplierInvoiceController extends Controller
{
    public function __construct(
        private readonly SupplierInvoiceMatchingService $matchingService,
        private readonly SupplierInvoicePostingService $postingService,
        private readonly SupplierInvoicePaymentService $paymentService
    ) {}

    public function index(Request $request)
    {
        $query = SupplierInvoice::query()->with([
            'supplier',
            'project:id,name,project_code',
            'purchaseOrder:id,po_number,status,total',
            'payments.financeAccount:id,code,name',
        ]);

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhere('supplier_invoice_number', 'like', "%{$search}%");
            });
        }
        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->integer('supplier_id'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        if ($request->filled('match_status')) {
            $query->where('match_status', $request->match_status);
        }

        $invoices = $query->latest('id')->get();

        return response()->json([
            'success' => true,
            'count' => $invoices->count(),
            'data' => $invoices,
        ]);
    }

    public function purchaseOrders(Request $request)
    {
        $query = PurchaseOrder::query()
            ->whereIn('status', ['approved', 'completed'])
            ->whereNotNull('supplier_id')
            ->with([
                'supplier',
                'project:id,name,project_code',
                'items.product',
            ]);

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('po_number', 'like', "%{$search}%");
            });
        }

        $orders = $query->latest('id')->get()->map(function ($order) {
            $order->items->transform(function ($item) {
                $invoicedQuantity = (float) SupplierInvoiceItem::query()
                    ->where('purchase_order_item_id', $item->id)
                    ->whereHas('supplierInvoice', function ($query) {
                        $query->whereNotIn('status', ['draft', 'rejected', 'cancelled']);
                    })
                    ->sum('quantity');

                $item->setAttribute('invoiced_quantity', round($invoicedQuantity, 2));
                $item->setAttribute(
                    'available_to_invoice',
                    round(max(0, (float) $item->received_quantity - $invoicedQuantity), 2)
                );

                return $item;
            });

            $order->setAttribute(
                'available_items_count',
                $order->items->where('available_to_invoice', '>', 0)->count()
            );

            return $order;
        })->filter(fn ($order) => $order->available_items_count > 0)->values();

        return response()->json([
            'success' => true,
            'count' => $orders->count(),
            'data' => $orders,
        ]);
    }

    public function store(Request $request)
    {
        $validationPurchaseOrder = PurchaseOrder::query()
            ->find($request->input('purchase_order_id'));

        $validated = $request->validate([
            'purchase_order_id' => ['required', 'integer', 'exists:purchase_orders,id'],
            'supplier_invoice_number' => [
                'required', 'string', 'max:100',
                Rule::unique('supplier_invoices', 'supplier_invoice_number')
                    ->where(fn ($query) => $query->where(
                        'supplier_id',
                        $validationPurchaseOrder?->supplier_id
                    )),
            ],
            'invoice_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:invoice_date'],
            'currency' => ['nullable', 'string', 'size:3'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'items' => ['nullable', 'array'],
            'items.*.purchase_order_item_id' => [
                'required_with:items', 'integer', 'exists:purchase_order_items,id',
            ],
            'items.*.quantity' => ['required_with:items', 'numeric', 'gt:0'],
            'items.*.unit_cost' => ['required_with:items', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0'],
            'items.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $invoice = DB::transaction(function () use ($request, $validated) {
            $purchaseOrder = PurchaseOrder::query()
                ->with(['items.product'])
                ->lockForUpdate()
                ->findOrFail($validated['purchase_order_id']);

            if (!$purchaseOrder->supplier_id) {
                throw ValidationException::withMessages([
                    'purchase_order_id' => 'أمر الشراء غير مرتبط بمورد.',
                ]);
            }
            if (!in_array($purchaseOrder->status, ['approved', 'completed'], true)) {
                throw ValidationException::withMessages([
                    'purchase_order_id' => 'يجب اعتماد أمر الشراء قبل تسجيل فاتورة المورد.',
                ]);
            }

            $lastId = (int) (SupplierInvoice::query()->max('id') ?? 0) + 1;
            $invoice = SupplierInvoice::create([
                'supplier_id' => $purchaseOrder->supplier_id,
                'purchase_order_id' => $purchaseOrder->id,
                'project_id' => $purchaseOrder->project_id,
                'invoice_number' => 'SINV-' . now()->format('Y') . '-' .
                    str_pad($lastId, 6, '0', STR_PAD_LEFT),
                'supplier_invoice_number' => $validated['supplier_invoice_number'],
                'invoice_date' => $validated['invoice_date'],
                'due_date' => $validated['due_date'] ?? null,
                'currency' => strtoupper($validated['currency'] ?? 'SAR'),
                'status' => 'draft',
                'match_status' => 'pending',
                'notes' => $validated['notes'] ?? null,
                'created_by' => $request->user()?->id,
            ]);

            $requestedItems = collect($validated['items'] ?? []);
            if ($requestedItems->isEmpty()) {
                $requestedItems = $purchaseOrder->items
                    ->map(function ($item) {
                        $invoicedQuantity = (float) SupplierInvoiceItem::query()
                            ->where('purchase_order_item_id', $item->id)
                            ->whereHas('supplierInvoice', function ($query) {
                                $query->whereNotIn(
                                    'status',
                                    ['draft', 'rejected', 'cancelled']
                                );
                            })
                            ->sum('quantity');
                        $available = max(
                            0,
                            (float) $item->received_quantity - $invoicedQuantity
                        );

                        return [
                            'purchase_order_item_id' => $item->id,
                            'quantity' => $available,
                            'unit_cost' => (float) $item->unit_cost,
                            'discount' => 0,
                            'tax_rate' => (float) $item->tax_rate,
                        ];
                    })
                    ->filter(fn ($item) => $item['quantity'] > 0)
                    ->values();
            }

            if ($requestedItems->isEmpty()) {
                throw ValidationException::withMessages([
                    'items' => 'لا توجد كميات مستلمة يمكن إنشاء فاتورة مورد لها.',
                ]);
            }

            $subtotal = $discountTotal = $taxTotal = 0.0;
            foreach ($requestedItems as $index => $requestedItem) {
                $poItem = $purchaseOrder->items->firstWhere(
                    'id',
                    (int) $requestedItem['purchase_order_item_id']
                );
                if (!$poItem) {
                    throw ValidationException::withMessages([
                        'items' => 'أحد البنود لا يتبع أمر الشراء المحدد.',
                    ]);
                }

                $quantity = (float) $requestedItem['quantity'];
                $unitCost = (float) $requestedItem['unit_cost'];
                $discount = (float) ($requestedItem['discount'] ?? 0);
                $taxRate = (float) ($requestedItem['tax_rate'] ?? $poItem->tax_rate);
                $gross = $quantity * $unitCost;
                $net = max(0, $gross - $discount);
                $taxAmount = $net * ($taxRate / 100);
                $lineTotal = $net + $taxAmount;

                $invoice->items()->create([
                    'purchase_order_item_id' => $poItem->id,
                    'product_id' => $poItem->product_id,
                    'product_name' => $poItem->product_name,
                    'sku' => $poItem->sku,
                    'description' => $poItem->description,
                    'quantity' => round($quantity, 2),
                    'unit_cost' => round($unitCost, 2),
                    'discount' => round($discount, 2),
                    'tax_rate' => round($taxRate, 2),
                    'tax_amount' => round($taxAmount, 2),
                    'line_total' => round($lineTotal, 2),
                    'sort_order' => $index,
                ]);

                $subtotal += $gross;
                $discountTotal += $discount;
                $taxTotal += $taxAmount;
            }

            $total = $subtotal - $discountTotal + $taxTotal;
            $invoice->update([
                'subtotal' => round($subtotal, 2),
                'discount' => round($discountTotal, 2),
                'tax' => round($taxTotal, 2),
                'total' => round($total, 2),
                'remaining_amount' => round($total, 2),
            ]);

            return $this->matchingService->match($invoice);
        });

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء فاتورة المورد وتنفيذ المطابقة الثلاثية.',
            'data' => $invoice,
        ], 201);
    }

    public function show(SupplierInvoice $supplierInvoice)
    {
        return response()->json([
            'success' => true,
            'data' => $supplierInvoice->load([
                'supplier', 'project', 'purchaseOrder.items',
                'items.purchaseOrderItem',
                'payments.financeAccount:id,code,name,name_en',
                'payments.journalEntry:id,entry_number,status',
                'payments.creator:id,name',
            ]),
        ]);
    }

    public function rematch(SupplierInvoice $supplierInvoice)
    {
        if (!in_array($supplierInvoice->status, ['draft', 'pending'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن إعادة مطابقة فاتورة معتمدة أو مرحلة.',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث نتيجة المطابقة الثلاثية.',
            'data' => $this->matchingService->match($supplierInvoice),
        ]);
    }

    public function submit(SupplierInvoice $supplierInvoice)
    {
        if ($supplierInvoice->status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن إرسال الفواتير المسودة فقط للمراجعة.',
            ], 422);
        }

        $supplierInvoice = $this->matchingService->match($supplierInvoice);
        if ($supplierInvoice->match_status !== 'matched') {
            return response()->json([
                'success' => false,
                'message' => 'تعذر الإرسال بسبب وجود فروق في المطابقة الثلاثية.',
                'data' => $supplierInvoice,
            ], 422);
        }

        $supplierInvoice->update(['status' => 'pending']);

        return response()->json([
            'success' => true,
            'message' => 'تم إرسال فاتورة المورد للمراجعة.',
            'data' => $supplierInvoice->fresh(['items', 'purchaseOrder']),
        ]);
    }

    public function approve(Request $request, SupplierInvoice $supplierInvoice)
    {
        if ($supplierInvoice->status !== 'pending' ||
            $supplierInvoice->match_status !== 'matched') {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن اعتماد الفاتورة قبل اكتمال المطابقة دون فروق.',
            ], 422);
        }

        $entry = DB::transaction(function () use ($request, $supplierInvoice) {
            $supplierInvoice->update([
                'status' => 'approved',
                'approved_by' => $request->user()?->id,
                'approved_at' => now(),
            ]);

            return $this->postingService->post(
                $supplierInvoice,
                $request->user()?->id
            );
        });

        return response()->json([
            'success' => true,
            'message' => 'تم اعتماد فاتورة المورد وترحيل قيدها المحاسبي بنجاح.',
            'data' => $supplierInvoice->fresh(['supplier', 'items', 'purchaseOrder']),
            'journal_entry' => $entry,
        ]);
    }

    public function post(Request $request, SupplierInvoice $supplierInvoice)
    {
        $entry = $this->postingService->post(
            $supplierInvoice,
            $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'message' => 'تم ترحيل فاتورة المورد محاسبيًا بنجاح.',
            'data' => $supplierInvoice->fresh(['supplier', 'items', 'purchaseOrder']),
            'journal_entry' => $entry,
        ]);
    }

    public function cashAccounts()
    {
        $accounts = FinanceAccount::query()
            ->where('is_active', true)
            ->where('is_postable', true)
            ->where('is_cash_account', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name', 'name_en']);

        return response()->json([
            'success' => true,
            'data' => $accounts,
        ]);
    }

    public function recordPayment(Request $request, SupplierInvoice $supplierInvoice)
    {
        $validated = $request->validate([
            'finance_account_id' => ['required', 'integer', 'exists:finance_accounts,id'],
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_date' => ['required', 'date'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $payment = $this->paymentService->record(
            $supplierInvoice,
            $validated,
            $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل دفعة المورد وترحيل سند الصرف محاسبيًا.',
            'data' => $payment,
            'invoice' => $supplierInvoice->fresh(['supplier', 'payments.financeAccount']),
        ], 201);
    }
}
