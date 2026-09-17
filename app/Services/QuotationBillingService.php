<?php

namespace App\Services;

use App\Models\ProjectQuotation;
use App\Models\TaxInvoice;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * رقابة الفوترة على عرض السعر — كانت مفقودة من الحزمة المستعادة.
 *
 * دي أهم خدمة رقابية في المشروع: هي اللي تمنع فوترة أكبر من العرض
 * المعتمد. TaxInvoiceController بيستوردها في الـ constructor وبينادي
 * ٥ دوال منها بالاسم.
 *
 * ملاحظة محاسبية مهمة: net_invoiced لازم يخصم إشعارات الدائن، وإلا
 * الرقابة تتفكّ — لأن إشعار دائن بيقلّل المفوتر فعليًا.
 */
class QuotationBillingService
{
    /** الحالات اللي بتُحسب ضمن "المفوتر". */
    private const COUNTED_STATUSES = ['issued', 'paid', 'partially_paid'];

    public function assertApproved(ProjectQuotation $quotation): void
    {
        if ($quotation->status !== 'approved') {
            throw ValidationException::withMessages([
                'quotation_id' => [
                    'لا يمكن الفوترة إلا على عرض سعر معتمد.',
                ],
            ]);
        }
    }

    public function assertProjectMatches(
        ProjectQuotation $quotation,
        ?int $projectId
    ): void {
        if ($projectId === null) {
            return;
        }

        if ((int) $quotation->project_id !== (int) $projectId) {
            throw ValidationException::withMessages([
                'project_id' => [
                    'عرض السعر لا ينتمي إلى المشروع المحدد.',
                ],
            ]);
        }
    }

    /**
     * ملخّص الفوترة. المفاتيح دي مستخدمة بالاسم في الكنترولر:
     * quotation_total | net_invoiced | remaining_to_invoice
     *
     * @return array<string,float>
     */
    public function summary(ProjectQuotation $quotation): array
    {
        $quotationTotal = round((float) $quotation->total, 2);

        $invoiced = (float) TaxInvoice::query()
            ->where('quotation_id', $quotation->id)
            ->whereIn('status', self::COUNTED_STATUSES)
            ->whereIn('document_type', ['tax_invoice', 'debit_note'])
            ->sum('total');

        // إشعارات الدائن تُخصم من المفوتر.
        $credited = (float) TaxInvoice::query()
            ->where('quotation_id', $quotation->id)
            ->whereIn('status', self::COUNTED_STATUSES)
            ->where('document_type', 'credit_note')
            ->sum('total');

        $netInvoiced = round($invoiced - $credited, 2);

        return [
            'quotation_total' => $quotationTotal,
            'invoiced' => round($invoiced, 2),
            'credited' => round($credited, 2),
            'net_invoiced' => $netInvoiced,
            'remaining_to_invoice' => round(
                max(0, $quotationTotal - $netInvoiced),
                2
            ),
            'billing_percentage' => $quotationTotal > 0
                ? round(($netInvoiced / $quotationTotal) * 100, 4)
                : 0.0,
        ];
    }

    /**
     * يرفض أي فاتورة تخلي المفوتر أكبر من إجمالي العرض.
     * التجاوز متاح بعلم صريح فقط ($allowOverride) — والكنترولر سايبه
     * كـ flag في الطلب، فالمفروض يُحمى بصلاحية لاحقًا.
     */
    public function assertAmountWithinRemaining(
        ProjectQuotation $quotation,
        float $amount,
        bool $allowOverride = false
    ): void {
        if ($allowOverride) {
            return;
        }

        $summary = $this->summary($quotation);
        $remaining = (float) $summary['remaining_to_invoice'];

        // فرق مقبول بمقدار هللة لتجنّب رفض فاتورة صحيحة بفرق تقريب.
        if (round($amount, 2) - $remaining > 0.01) {
            throw ValidationException::withMessages([
                'items' => [
                    'إجمالي الفاتورة ' . number_format($amount, 2) .
                    ' يتجاوز المتبقي المسموح بالفوترة ' .
                    number_format($remaining, 2) . '.',
                ],
            ]);
        }
    }

    /**
     * الكمية المفوترة سابقًا لبند معيّن من عرض السعر.
     * تُستخدم لوقف الكمية عند المتبقي لكل بند، مش عند الكمية الأصلية.
     */
    public function previouslyInvoicedQuantity(
        int $quotationId,
        int $quotationItemId
    ): float {
        $sum = DB::table('tax_invoice_items as ti')
            ->join('tax_invoices as t', 't.id', '=', 'ti.tax_invoice_id')
            ->where('t.quotation_id', $quotationId)
            ->whereIn('t.status', self::COUNTED_STATUSES)
            ->where('ti.quotation_item_id', $quotationItemId)
            ->selectRaw("
                COALESCE(SUM(
                    CASE
                        WHEN t.document_type = 'credit_note'
                        THEN -ti.quantity
                        ELSE ti.quantity
                    END
                ), 0) as qty
            ")
            ->value('qty');

        return round(max(0, (float) $sum), 4);
    }
}
