<?php

namespace App\Services;

use App\Models\HrEmployee;
use Carbon\Carbon;

/**
 * حاسبة مكافأة نهاية الخدمة — المادة ٨٤ من نظام العمل.
 *
 * القاعدة:
 *   نصف شهر (١٥ يوم) لكل سنة في الخمس سنوات الأولى
 *   شهر كامل (٣٠ يوم) لكل سنة بعد الخمس
 *
 * الوعاء: الأجر الأخير شاملًا الأساسي وكل البدلات الثابتة —
 * ⚠ وعاء مختلف عن وعاء التأمينات (أساسي + سكن فقط).
 * الخطأ في التفرقة بين الوعاءين من أشيع أخطاء أنظمة الرواتب.
 *
 * والاستقالة لها نسب استحقاق مخفّضة حسب مدة الخدمة.
 */
class EosbCalculator
{
    /**
     * @param  string  $reason  resignation|dismissal|contract_end|retirement|death|force_majeure
     * @return array{
     *   years:float, wage:float, full_entitlement:float,
     *   entitlement_ratio:float, payable:float, breakdown:array
     * }
     */
    public function calculate(
        HrEmployee $employee,
        float $lastWage,
        string $reason = 'contract_end',
        ?string $endDate = null
    ): array {
        $start = Carbon::parse($employee->hire_date);
        $end = $endDate
            ? Carbon::parse($endDate)
            : ($employee->termination_date
                ? Carbon::parse($employee->termination_date)
                : now());

        // سنوات الخدمة بالكسور — الأشهر والأيام محسوبة
        $days = $start->diffInDays($end);
        $years = round($days / 365.25, 4);

        $dailyWage = round($lastWage / 30, 4);

        // أول ٥ سنين: نصف شهر لكل سنة
        $firstFiveYears = min($years, 5);
        $firstPortion = round($firstFiveYears * 15 * $dailyWage, 2);

        // ما بعد ٥ سنين: شهر كامل لكل سنة
        $beyondFive = max(0, $years - 5);
        $secondPortion = round($beyondFive * 30 * $dailyWage, 2);

        $full = round($firstPortion + $secondPortion, 2);

        $ratio = $this->entitlementRatio($reason, $years);

        return [
            'years' => $years,
            'service_days' => $days,
            'wage' => round($lastWage, 2),
            'daily_wage' => $dailyWage,
            'reason' => $reason,

            'full_entitlement' => $full,
            'entitlement_ratio' => $ratio,
            'payable' => round($full * $ratio, 2),

            'breakdown' => [
                'first_five_years' => [
                    'years' => round($firstFiveYears, 4),
                    'days_per_year' => 15,
                    'amount' => $firstPortion,
                ],
                'beyond_five_years' => [
                    'years' => round($beyondFive, 4),
                    'days_per_year' => 30,
                    'amount' => $secondPortion,
                ],
            ],

            'note' => $this->explainRatio($reason, $years, $ratio),
        ];
    }

    /**
     * المخصص الشهري — يُرحَّل كل شهر مع الرواتب بدل مفاجأة
     * التزام كبير وقت الاستحقاق.
     */
    public function monthlyAccrual(
        HrEmployee $employee,
        float $lastWage,
        ?string $asOfDate = null
    ): float {
        $start = Carbon::parse($employee->hire_date);
        $asOf = $asOfDate ? Carbon::parse($asOfDate) : now();

        $years = $start->diffInDays($asOf) / 365.25;

        // معدل الاستحقاق الحالي: ١٥ يوم/سنة أو ٣٠ بعد الخمس
        $daysPerYear = $years >= 5 ? 30 : 15;

        $dailyWage = $lastWage / 30;

        return round(($daysPerYear * $dailyWage) / 12, 2);
    }

    /**
     * نسبة الاستحقاق حسب سبب انتهاء الخدمة.
     *
     * الاستقالة (المادة ٨٥): أقل من سنتين لا شيء، من ٢ لـ٥ الثلث،
     * من ٥ لـ١٠ الثلثين، وأكثر من ١٠ كامل.
     * الفصل وانتهاء العقد والتقاعد والوفاة: كامل.
     */
    private function entitlementRatio(string $reason, float $years): float
    {
        if ($reason !== 'resignation') {
            return 1.0;
        }

        if ($years < 2) {
            return 0.0;
        }

        if ($years < 5) {
            return 1 / 3;
        }

        if ($years < 10) {
            return 2 / 3;
        }

        return 1.0;
    }

    private function explainRatio(
        string $reason,
        float $years,
        float $ratio
    ): string {
        if ($reason !== 'resignation') {
            return 'استحقاق كامل — انتهاء الخدمة بغير استقالة.';
        }

        if ($ratio === 0.0) {
            return 'لا يستحق مكافأة — استقالة قبل إتمام سنتين خدمة.';
        }

        if ($ratio < 0.4) {
            return 'يستحق الثلث — استقالة بين سنتين وخمس سنوات.';
        }

        if ($ratio < 0.7) {
            return 'يستحق الثلثين — استقالة بين خمس وعشر سنوات.';
        }

        return 'استحقاق كامل — استقالة بعد عشر سنوات خدمة.';
    }
}
