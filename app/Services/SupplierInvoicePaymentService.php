<?php

namespace App\Services;

use App\Models\FinanceAccount;
use App\Models\SupplierInvoice;
use App\Models\SupplierInvoicePayment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * تسجيل دفعة مورد — كانت مفقودة من الحزمة المستعادة.
 *
 * القيد:
 *   مدين   الذمم الدائنة - الموردون
 *   دائن   البنك أو الصندوق
 *
 * ومعاه تحديث المدفوع والمتبقي وحالة الفاتورة.
 */
class SupplierInvoicePaymentService
{
    private const PAYABLE_ACCOUNT = '2110';

    public function __construct(
        private readonly JournalPostingService $posting,
        private readonly DocumentNumberService $sequences
    ) {}

    /**
     * @param  array{finance_account_id:int,amount:float,payment_date:string,payment_method?:string,reference_number?:string,notes?:string}  $data
     */
    public function record(
        SupplierInvoice $invoice,
        array $data,
        ?int $userId = null
    ): SupplierInvoicePayment {
        if (!in_array($invoice->status, ['posted', 'partially_paid'], true)) {
            throw ValidationException::withMessages([
                'status' => [
                    'يجب ترحيل الفاتورة قبل تسجيل الدفعات.',
                ],
            ]);
        }

        $amount = round((float) $data['amount'], 2);
        $remaining = round((float) $invoice->remaining_amount, 2);

        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'amount' => ['قيمة الدفعة يجب أن تكون أكبر من صفر.'],
            ]);
        }

        if ($amount - $remaining > 0.01) {
            throw ValidationException::withMessages([
                'amount' => [
                    'قيمة الدفعة تتجاوز المتبقي على الفاتورة (' .
                    number_format($remaining, 2) . ').',
                ],
            ]);
        }

        $cashAccount = FinanceAccount::query()
            ->whereKey($data['finance_account_id'])
            ->where('is_cash_account', true)
            ->where('is_active', true)
            ->where('is_postable', true)
            ->first();

        if (!$cashAccount) {
            throw ValidationException::withMessages([
                'finance_account_id' => [
                    'الحساب المحدد ليس حساب بنك أو صندوق صالحًا للصرف.',
                ],
            ]);
        }

        $payable = $this->posting->requireAccount(
            self::PAYABLE_ACCOUNT,
            'الذمم الدائنة - الموردون'
        );

        return DB::transaction(function () use (
            $invoice,
            $data,
            $amount,
            $remaining,
            $cashAccount,
            $payable,
            $userId
        ) {
            $paymentNumber = $this->sequences->next('payment_voucher');

            $entry = $this->posting->post(
                reference: [
                    'type' => 'supplier_invoice_payment',
                    'id' => 0, // يُحدَّث بعد إنشاء الدفعة
                    'number' => $paymentNumber,
                ],
                lines: [
                    [
                        'account_id' => $payable->id,
                        'debit' => $amount,
                        'credit' => 0,
                        'description' => 'سداد للمورد',
                        'project_id' => $invoice->project_id,
                    ],
                    [
                        'account_id' => $cashAccount->id,
                        'debit' => 0,
                        'credit' => $amount,
                        'description' => 'صرف من ' . $cashAccount->name,
                        'project_id' => $invoice->project_id,
                    ],
                ],
                description: 'دفعة مورد ' . $paymentNumber .
                    ' على فاتورة ' . $invoice->invoice_number,
                entryDate: $data['payment_date'],
                projectId: $invoice->project_id,
                userId: $userId,
                notes: 'قيد آلي ناتج عن تسجيل دفعة مورد.'
            );

            $payment = SupplierInvoicePayment::create([
                'supplier_invoice_id' => $invoice->id,
                'project_id' => $invoice->project_id,
                'payment_number' => $paymentNumber,
                'amount' => $amount,
                'payment_date' => $data['payment_date'],
                'payment_method' => $data['payment_method'] ?? 'bank_transfer',
                'reference_number' => $data['reference_number'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $userId,
            ]);

            $entry->update([
                'reference_id' => $payment->id,
            ]);

            $paid = round((float) $invoice->paid_amount + $amount, 2);
            $newRemaining = round(max(0, $remaining - $amount), 2);

            $invoice->update([
                'paid_amount' => $paid,
                'remaining_amount' => $newRemaining,
                'status' => $newRemaining < 0.01
                    ? 'paid'
                    : 'partially_paid',
            ]);

            return $payment;
        });
    }
}
