<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinanceAccount;
use App\Models\FinanceJournalEntry;
use App\Models\TaxInvoice;
use App\Models\TaxInvoicePayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TaxInvoicePaymentController extends Controller
{
    public function accounts()
    {
        $cashAccounts = FinanceAccount::query()
            ->where('is_active', true)
            ->where('is_postable', true)
            ->where('is_cash_account', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name', 'name_en']);

        $receivableAccounts = FinanceAccount::query()
            ->where('is_active', true)
            ->where('is_postable', true)
            ->where(function ($query) {
                $query->where('code', '1121')
                    ->orWhere('name', 'like', '%ذمم%عملاء%')
                    ->orWhere('name_en', 'like', '%receivable%');
            })
            ->orderBy('code')
            ->get(['id', 'code', 'name', 'name_en']);

        return response()->json([
            'success' => true,
            'data' => [
                'cash_accounts' => $cashAccounts,
                'receivable_accounts' => $receivableAccounts,
            ],
        ]);
    }

    public function index(Request $request)
    {
        $query = TaxInvoicePayment::query()->with([
            'taxInvoice:id,invoice_number,buyer_name,project_id,total,paid_amount,remaining_amount,payment_status,status',
            'project:id,project_code,name',
            'financeAccount:id,code,name,name_en',
            'receivableAccount:id,code,name,name_en',
            'journalEntry:id,entry_number,status',
            'creator:id,name',
        ]);

        if ($request->filled('tax_invoice_id')) {
            $query->where('tax_invoice_id', $request->integer('tax_invoice_id'));
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->integer('project_id'));
        }

        return response()->json([
            'success' => true,
            'data' => $query->latest('payment_date')->latest('id')->get(),
        ]);
    }

    public function store(Request $request, TaxInvoice $taxInvoice)
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'gt:0'],
            'payment_method' => [
                'required',
                Rule::in(['bank_transfer', 'cash', 'card', 'cheque', 'other']),
            ],
            'payment_date' => ['required', 'date'],
            'reference_number' => ['nullable', 'string', 'max:150'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'deposit_account_id' => ['required', 'integer', 'exists:finance_accounts,id'],
            'receivable_account_id' => ['required', 'integer', 'exists:finance_accounts,id'],
        ]);

        $payment = DB::transaction(function () use ($request, $taxInvoice, $data) {
            $invoice = TaxInvoice::query()
                ->whereKey($taxInvoice->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($invoice->status !== 'issued') {
                throw ValidationException::withMessages([
                    'tax_invoice_id' => ['لا يمكن تسجيل تحصيل إلا على فاتورة صادرة.'],
                ]);
            }

            if ($invoice->document_type !== 'invoice') {
                throw ValidationException::withMessages([
                    'tax_invoice_id' => ['التحصيل المباشر متاح للفواتير فقط.'],
                ]);
            }

            $remaining = round((float) $invoice->remaining_amount, 2);
            $amount = round((float) $data['amount'], 2);

            if ($remaining <= 0.009) {
                throw ValidationException::withMessages([
                    'amount' => ['الفاتورة محصلة بالكامل ولا يوجد رصيد متبقٍ.'],
                ]);
            }

            if ($amount > $remaining) {
                throw ValidationException::withMessages([
                    'amount' => [
                        'مبلغ التحصيل يتجاوز المتبقي (' .
                        number_format($remaining, 2) . ' ر.س).',
                    ],
                ]);
            }

            $depositAccount = FinanceAccount::query()
                ->whereKey($data['deposit_account_id'])
                ->where('is_active', true)
                ->where('is_postable', true)
                ->where('is_cash_account', true)
                ->first();

            $receivableAccount = FinanceAccount::query()
                ->whereKey($data['receivable_account_id'])
                ->where('is_active', true)
                ->where('is_postable', true)
                ->first();

            if (!$depositAccount) {
                throw ValidationException::withMessages([
                    'deposit_account_id' => ['الحساب المختار ليس بنكًا أو صندوقًا فعالًا وقابلًا للترحيل.'],
                ]);
            }

            if (!$receivableAccount) {
                throw ValidationException::withMessages([
                    'receivable_account_id' => ['حساب ذمم العملاء غير صالح أو غير قابل للترحيل.'],
                ]);
            }

            if ($depositAccount->is($receivableAccount)) {
                throw ValidationException::withMessages([
                    'deposit_account_id' => ['حساب الإيداع وحساب الذمم يجب أن يكونا مختلفين.'],
                ]);
            }

            if (!empty($data['reference_number'])) {
                $duplicateReference = TaxInvoicePayment::query()
                    ->where('tax_invoice_id', $invoice->id)
                    ->where('reference_number', $data['reference_number'])
                    ->exists();

                if ($duplicateReference) {
                    throw ValidationException::withMessages([
                        'reference_number' => ['تم استخدام مرجع التحصيل نفسه لهذه الفاتورة من قبل.'],
                    ]);
                }
            }

            $paymentNumber = $this->generatePaymentNumber();
            $entry = FinanceJournalEntry::create([
                'entry_number' => $this->generateJournalEntryNumber(),
                'entry_date' => $data['payment_date'],
                'description' => 'تحصيل فاتورة عميل ' . $invoice->invoice_number,
                'reference_type' => 'customer_payment',
                'reference_id' => $invoice->id,
                'reference_number' => $paymentNumber,
                'project_id' => $invoice->project_id,
                'status' => 'posted',
                'total_debit' => $amount,
                'total_credit' => $amount,
                'created_by' => $request->user()?->id,
                'approved_by' => $request->user()?->id,
                'approved_at' => now(),
                'posted_by' => $request->user()?->id,
                'posted_at' => now(),
                'notes' => 'قيد آلي ناتج عن تحصيل فاتورة عميل.',
            ]);

            $entry->lines()->createMany([
                [
                    'account_id' => $depositAccount->id,
                    'project_id' => $invoice->project_id,
                    'description' => 'تحصيل ' . $invoice->invoice_number,
                    'debit' => $amount,
                    'credit' => 0,
                ],
                [
                    'account_id' => $receivableAccount->id,
                    'project_id' => $invoice->project_id,
                    'description' => 'تخفيض ذمم العميل - ' . $invoice->invoice_number,
                    'debit' => 0,
                    'credit' => $amount,
                ],
            ]);

            $payment = TaxInvoicePayment::create([
                'tax_invoice_id' => $invoice->id,
                'project_id' => $invoice->project_id,
                'finance_account_id' => $depositAccount->id,
                'receivable_account_id' => $receivableAccount->id,
                'finance_journal_entry_id' => $entry->id,
                'payment_number' => $paymentNumber,
                'amount' => $amount,
                'payment_method' => $data['payment_method'],
                'payment_date' => $data['payment_date'],
                'reference_number' => $data['reference_number'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()?->id,
            ]);

            $paidAfter = round((float) $invoice->paid_amount + $amount, 2);
            $remainingAfter = round(max(0, (float) $invoice->total - $paidAfter), 2);

            $invoice->update([
                'paid_amount' => $paidAfter,
                'remaining_amount' => $remainingAfter,
                'payment_status' => $remainingAfter <= 0.009
                    ? 'paid'
                    : 'partially_paid',
            ]);

            return $payment->load([
                'taxInvoice:id,invoice_number,buyer_name,project_id,total,paid_amount,remaining_amount,payment_status,status',
                'project:id,project_code,name',
                'financeAccount:id,code,name,name_en',
                'receivableAccount:id,code,name,name_en',
                'journalEntry.lines.account',
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل التحصيل وترحيل سند القبض محاسبيًا.',
            'data' => $payment,
        ], 201);
    }

    private function generateJournalEntryNumber(): string
    {
        $nextId = (int) (FinanceJournalEntry::query()->max('id') ?? 0) + 1;

        return 'JE-' . now()->format('Y') . '-' .
            str_pad($nextId, 6, '0', STR_PAD_LEFT);
    }

    private function generatePaymentNumber(): string
    {
        $nextId = (int) (TaxInvoicePayment::query()->max('id') ?? 0) + 1;

        return 'RCPT-' . now()->format('Y') . '-' .
            str_pad($nextId, 6, '0', STR_PAD_LEFT);
    }
}
