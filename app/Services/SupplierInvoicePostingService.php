<?php

namespace App\Services;

use App\Models\FinanceJournalEntry;
use App\Models\SupplierInvoice;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * ترحيل فاتورة المورد — كانت مفقودة من الحزمة المستعادة.
 *
 * القيد:
 *   مدين   المخزون أو المصروف     (الوعاء بدون ضريبة)
 *   مدين   الضريبة المدخلة         (قابلة للاستقطاع)
 *   دائن   الذمم الدائنة - الموردون (إجمالي الفاتورة)
 */
class SupplierInvoicePostingService
{
    /*
     * أكواد الحسابات. الأفضل استبدالها بجدول ربط حسابات
     * (finance_account_mappings) بدل ما تكون مكتوبة في الكود.
     */
    private const INVENTORY_ACCOUNT = '1140';
    private const INPUT_VAT_ACCOUNT = '1160';
    private const PAYABLE_ACCOUNT = '2110';

    public function __construct(
        private readonly JournalPostingService $posting
    ) {}

    public function post(
        SupplierInvoice $invoice,
        ?int $userId = null
    ): FinanceJournalEntry {
        if (!in_array($invoice->status, ['approved', 'posted'], true)) {
            throw ValidationException::withMessages([
                'status' => ['يجب اعتماد الفاتورة قبل الترحيل.'],
            ]);
        }

        $existing = $this->posting->findExisting(
            'supplier_invoice',
            $invoice->id
        );

        if ($existing) {
            return $existing;
        }

        $total = round((float) $invoice->total, 2);
        $tax = round((float) $invoice->tax, 2);
        $net = round($total - $tax, 2);

        if ($total <= 0) {
            throw ValidationException::withMessages([
                'accounting' => [
                    'لا يمكن ترحيل فاتورة بإجمالي صفر أو أقل.',
                ],
            ]);
        }

        if ($net < 0) {
            throw ValidationException::withMessages([
                'accounting' => ['قيمة الفاتورة بدون ضريبة غير صالحة.'],
            ]);
        }

        $inventory = $this->posting->requireAccount(
            self::INVENTORY_ACCOUNT,
            'المخزون'
        );

        $payable = $this->posting->requireAccount(
            self::PAYABLE_ACCOUNT,
            'الذمم الدائنة - الموردون'
        );

        $lines = [
            [
                'account_id' => $inventory->id,
                'debit' => $net,
                'credit' => 0,
                'description' => 'قيمة فاتورة المورد بدون ضريبة',
                'project_id' => $invoice->project_id,
            ],
        ];

        if ($tax > 0) {
            $inputVat = $this->posting->requireAccount(
                self::INPUT_VAT_ACCOUNT,
                'ضريبة القيمة المضافة المدخلة'
            );

            $lines[] = [
                'account_id' => $inputVat->id,
                'debit' => $tax,
                'credit' => 0,
                'description' => 'ضريبة مدخلة قابلة للاستقطاع',
                'project_id' => $invoice->project_id,
            ];
        }

        $lines[] = [
            'account_id' => $payable->id,
            'debit' => 0,
            'credit' => $total,
            'description' => 'التزام تجاه المورد',
            'project_id' => $invoice->project_id,
        ];

        return DB::transaction(function () use ($invoice, $lines, $userId) {
            $entry = $this->posting->post(
                reference: [
                    'type' => 'supplier_invoice',
                    'id' => $invoice->id,
                    'number' => $invoice->invoice_number,
                ],
                lines: $lines,
                description: 'ترحيل فاتورة مورد ' . $invoice->invoice_number,
                entryDate: $invoice->invoice_date
                    ? $invoice->invoice_date->toDateString()
                    : null,
                projectId: $invoice->project_id,
                userId: $userId,
                notes: 'قيد آلي ناتج عن ترحيل فاتورة المورد.'
            );

            $invoice->update([
                'status' => 'posted',
                'posted_at' => now(),
            ]);

            return $entry;
        });
    }
}
