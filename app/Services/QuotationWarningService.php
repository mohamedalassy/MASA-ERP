<?php

namespace App\Services;

use App\Models\ProjectQuotation;
use Illuminate\Support\Facades\DB;

/**
 * تحذيرات قبل إرسال عرض السعر.
 *
 * أودو بيحذّر قبل الإرسال لعملاء معيّنين أو منتجات معيّنة. كل
 * مدخلات التحذيرات دي موجودة عندك بالفعل — المطلوب تجميعها في
 * فحص واحد يشتغل قبل الإرسال.
 *
 * التحذيرات مش بتمنع — بتُعرض للمندوب ليقرر. إلا بوابة الهامش
 * (block_below_minimum_margin) وهي اللي بتمنع فعلاً.
 */
class QuotationWarningService
{
    /**
     * @return array{count:int,blocking:int,warnings:array}
     */
    public function check(ProjectQuotation $quotation): array
    {
        $quotation->load(['project', 'items']);

        $warnings = array_merge(
            $this->customerOverdue($quotation),
            $this->customerTaxProfile($quotation),
            $this->stalePrices($quotation),
            $this->stockAvailability($quotation),
            $this->marginGate($quotation),
            $this->validity($quotation)
        );

        return [
            'count' => count($warnings),
            'blocking' => count(array_filter(
                $warnings,
                fn ($w) => $w['is_blocking']
            )),
            'warnings' => $warnings,
        ];
    }

    /** العميل عليه متأخرات — الرقم من الفواتير الضريبية. */
    private function customerOverdue(ProjectQuotation $quotation): array
    {
        $customerCode = $quotation->project?->customer_code;

        if (!$customerCode) {
            return [];
        }

        $row = DB::table('tax_invoices as t')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->where('p.customer_code', $customerCode)
            ->whereIn('t.status', ['issued', 'partially_paid'])
            ->where('t.remaining_amount', '>', 0.01)
            ->whereNotNull('t.due_date')
            ->where('t.due_date', '<', now()->toDateString())
            ->selectRaw('
                COUNT(*) as invoices,
                COALESCE(SUM(t.remaining_amount), 0) as amount,
                MIN(t.due_date) as oldest_due
            ')
            ->first();

        if (!$row || (int) $row->invoices === 0) {
            return [];
        }

        $daysLate = now()->startOfDay()->diffInDays($row->oldest_due);

        return [[
            'type' => 'customer_overdue',
            'severity' => $daysLate > 90 ? 'critical' : 'warning',
            'is_blocking' => false,
            'title' => 'العميل عليه متأخرات',
            'message' => sprintf(
                '%s ريال متأخرة على %d فاتورة — أقدمها متأخرة %d يوم.',
                number_format((float) $row->amount, 2),
                (int) $row->invoices,
                $daysLate
            ),
        ]];
    }

    /** الملف الضريبي ناقص — مش هتقدر تفوتر بعد الاعتماد. */
    private function customerTaxProfile(ProjectQuotation $quotation): array
    {
        $customerCode = $quotation->project?->customer_code;

        if (!$customerCode) {
            return [[
                'type' => 'no_customer_code',
                'severity' => 'warning',
                'is_blocking' => false,
                'title' => 'العميل بدون كود',
                'message' => 'الملف الضريبي بيتربط بكود العميل — بدونه الفوترة هتحتاج إدخال يدوي.',
            ]];
        }

        $profile = DB::table('customer_tax_profiles')
            ->where('customer_code', $customerCode)
            ->first();

        if (!$profile) {
            return [[
                'type' => 'missing_tax_profile',
                'severity' => 'warning',
                'is_blocking' => false,
                'title' => 'مافيش ملف ضريبي للعميل',
                'message' => 'لن تقدر تصدر فاتورة ضريبية بعد الاعتماد قبل إنشاء الملف.',
            ]];
        }

        $missing = [];

        if (empty($profile->vat_number)) {
            $missing[] = 'الرقم الضريبي';
        }

        if (empty($profile->building_number) || empty($profile->street_name)
            || empty($profile->district) || empty($profile->city)
            || empty($profile->postal_code)) {
            $missing[] = 'العنوان الزاتكوي';
        }

        if (empty($missing)) {
            return [];
        }

        return [[
            'type' => 'incomplete_tax_profile',
            'severity' => 'warning',
            'is_blocking' => false,
            'title' => 'الملف الضريبي ناقص',
            'message' => 'الناقص: ' . implode(' · ', $missing) .
                ' — مطلوب لإصدار فاتورة ضريبية.',
        ]];
    }

    /** أسعار موردين قديمة — من سجل الأسعار. */
    private function stalePrices(ProjectQuotation $quotation): array
    {
        $productIds = $quotation->items
            ->pluck('product_id')
            ->filter()
            ->unique();

        if ($productIds->isEmpty()) {
            return [];
        }

        $stale = DB::table('supplier_prices')
            ->whereIn('product_id', $productIds)
            ->where('is_active', true)
            ->where('updated_at', '<', now()->subDays(90))
            ->count();

        if ($stale === 0) {
            return [];
        }

        return [[
            'type' => 'stale_supplier_prices',
            'severity' => 'warning',
            'is_blocking' => false,
            'title' => 'أسعار موردين قديمة',
            'message' => sprintf(
                '%d سعر مورد مالوش تحديث أكتر من ٩٠ يوم — التكلفة في العرض ممكن تكون غلط.',
                $stale
            ),
        ]];
    }

    /** بنود غير متوفرة في المخزون. */
    private function stockAvailability(ProjectQuotation $quotation): array
    {
        $warnings = [];

        foreach ($quotation->items as $item) {
            if (!$item->product_id) {
                continue;
            }

            $product = DB::table('products')
                ->where('id', $item->product_id)
                ->first(['name', 'stock_quantity']);

            if (!$product) {
                continue;
            }

            $shortage = (float) $item->quantity - (float) $product->stock_quantity;

            if ($shortage <= 0) {
                continue;
            }

            $warnings[] = [
                'type' => 'stock_shortage',
                'severity' => 'info',
                'is_blocking' => false,
                'title' => 'نقص مخزون: ' . $product->name,
                'message' => sprintf(
                    'مطلوب %s والمتاح %s — الناقص %s يحتاج توريد.',
                    rtrim(rtrim(number_format((float) $item->quantity, 2), '0'), '.'),
                    rtrim(rtrim(number_format((float) $product->stock_quantity, 2), '0'), '.'),
                    rtrim(rtrim(number_format($shortage, 2), '0'), '.')
                ),
            ];
        }

        return $warnings;
    }

    /**
     * بوابة الهامش — التحذير الوحيد اللي بيمنع فعلاً.
     * دي ميزتك على أودو: مافيش نظام بيع بيغلق العرض على الهامش.
     */
    private function marginGate(ProjectQuotation $quotation): array
    {
        $cost = (float) $quotation->items->sum(
            fn ($item) => (float) $item->quantity * (float) $item->cost_price
        );

        if ($cost <= 0) {
            return [];
        }

        $net = round(
            (float) $quotation->subtotal - (float) $quotation->discount,
            2
        );

        if ($net <= 0) {
            return [];
        }

        $margin = (($net - $cost) / $net) * 100;

        $rule = DB::table('pricing_rules')
            ->where('is_active', true)
            ->orderBy('priority')
            ->first();

        if (!$rule) {
            return [];
        }

        $minimum = (float) $rule->minimum_margin_percent;
        $target = (float) $rule->target_margin_percent;

        if ($margin < $minimum) {
            return [[
                'type' => 'margin_below_minimum',
                'severity' => 'critical',
                'is_blocking' => (bool) $rule->block_below_minimum_margin,
                'title' => 'الهامش أقل من الحد الأدنى',
                'message' => sprintf(
                    'الهامش %s%% والحد الأدنى %s%%.%s',
                    number_format($margin, 1),
                    number_format($minimum, 1),
                    $rule->block_below_minimum_margin
                        ? ' قاعدة التسعير تمنع الإرسال.'
                        : ''
                ),
            ]];
        }

        if ($margin < $target && $rule->require_approval_below_target) {
            return [[
                'type' => 'margin_below_target',
                'severity' => 'warning',
                'is_blocking' => false,
                'title' => 'الهامش أقل من المستهدف',
                'message' => sprintf(
                    'الهامش %s%% والمستهدف %s%% — يحتاج موافقة.',
                    number_format($margin, 1),
                    number_format($target, 1)
                ),
            ]];
        }

        return [];
    }

    private function validity(ProjectQuotation $quotation): array
    {
        if (!$quotation->valid_until) {
            return [[
                'type' => 'no_validity',
                'severity' => 'info',
                'is_blocking' => false,
                'title' => 'مافيش تاريخ صلاحية',
                'message' => 'العرض بدون تاريخ انتهاء — يُنصح بتحديده لحماية السعر.',
            ]];
        }

        if (now()->gt($quotation->valid_until)) {
            return [[
                'type' => 'expired',
                'severity' => 'critical',
                'is_blocking' => true,
                'title' => 'العرض منتهي الصلاحية',
                'message' => 'حدّث تاريخ الصلاحية قبل الإرسال.',
            ]];
        }

        return [];
    }
}
