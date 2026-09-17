<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * ترقيم آمن للمستندات.
 *
 * بيستخدم lockForUpdate داخل ترانزاكشن، فمستحيل رقمان متطابقان
 * حتى مع مستخدمين متزامنين، والحذف مش بيأثر على التسلسل.
 *
 * الاستخدام:
 *   $number = $sequences->next('journal_entry', 'JE');   // JE-2026-000123
 *   $number = $sequences->next('tax_invoice', 'INV');    // INV-2026-000045
 */
class DocumentNumberService
{
    /** البادئات الافتراضية لكل نوع مستند. */
    private const PREFIXES = [
        'journal_entry' => 'JE',
        'tax_invoice' => 'INV',
        'credit_note' => 'CN',
        'debit_note' => 'DN',
        'receipt_voucher' => 'RV',
        'payment_voucher' => 'PV',
        'supplier_invoice' => 'SINV',
        'purchase_order' => 'PO',
        'quotation' => 'QT',
    ];

    public function next(
        string $documentType,
        ?string $prefix = null,
        ?int $year = null
    ): string {
        $year = $year ?? (int) now()->format('Y');

        $prefix = $prefix
            ?? self::PREFIXES[$documentType]
            ?? strtoupper(substr($documentType, 0, 3));

        return DB::transaction(function () use ($documentType, $prefix, $year) {
            $row = DB::table('document_sequences')
                ->where('document_type', $documentType)
                ->where('year', $year)
                ->lockForUpdate()
                ->first();

            if (!$row) {
                DB::table('document_sequences')->insert([
                    'document_type' => $documentType,
                    'year' => $year,
                    'prefix' => $prefix,
                    'current_number' => 1,
                    'padding' => 6,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return $this->format($prefix, $year, 1, 6);
            }

            $next = (int) $row->current_number + 1;

            DB::table('document_sequences')
                ->where('id', $row->id)
                ->update([
                    'current_number' => $next,
                    'updated_at' => now(),
                ]);

            return $this->format(
                $row->prefix ?: $prefix,
                $year,
                $next,
                (int) $row->padding
            );
        });
    }

    private function format(
        string $prefix,
        int $year,
        int $number,
        int $padding
    ): string {
        return sprintf(
            '%s-%d-%s',
            $prefix,
            $year,
            str_pad((string) $number, $padding, '0', STR_PAD_LEFT)
        );
    }
}
