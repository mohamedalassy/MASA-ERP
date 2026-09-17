<?php

namespace App\Services;

use App\Models\GosiRateSchedule;
use App\Models\HrEmployee;
use Carbon\Carbon;

/**
 * حاسبة التأمينات الاجتماعية.
 *
 * النسب بتُقرأ من جدول gosi_rate_schedules بتاريخ سريان — مش
 * مكتوبة في الكود. السبب: نسبة التقاعد في النظام الجديد بترتفع
 * ٠.٥٪ على كل طرف كل يوليو حتى ٢٠٢٨. أي نظام بيكتب النسب في
 * الكود بيحتاج نشر جديد كل سنة.
 *
 * الوعاء: الأساسي + بدل السكن فقط، بحد أقصى ٤٥٬٠٠٠ ريال.
 * (وعاء مختلف تمامًا عن وعاء نهاية الخدمة — راجع EosbCalculator)
 */
class GosiCalculator
{
    /**
     * @return array{
     *   scheme:string, base:float, ceiling:float,
     *   employee:float, employer:float, total:float,
     *   breakdown:array
     * }
     */
    public function calculate(
        HrEmployee $employee,
        float $basicSalary,
        float $housingAllowance,
        ?string $asOfDate = null
    ): array {
        $date = $asOfDate ? Carbon::parse($asOfDate) : now();

        $scheme = $this->resolveScheme($employee);

        if (!$employee->gosi_subscribed) {
            return $this->zero($scheme);
        }

        $rates = $this->ratesFor($scheme, $date);

        if (!$rates) {
            return $this->zero($scheme);
        }

        $ceiling = (float) $rates->wage_ceiling;

        // الوعاء = أساسي + سكن، مقصوصًا عند الحد الأقصى
        $base = min(
            round($basicSalary + $housingAllowance, 2),
            $ceiling
        );

        $pensionEmployee = $this->pct($base, $rates->pension_employee);
        $pensionEmployer = $this->pct($base, $rates->pension_employer);

        $hazards = $this->pct($base, $rates->hazards_employer);

        $sanedEmployee = $this->pct($base, $rates->saned_employee);
        $sanedEmployer = $this->pct($base, $rates->saned_employer);

        $employeeTotal = round($pensionEmployee + $sanedEmployee, 2);
        $employerTotal = round($pensionEmployer + $hazards + $sanedEmployer, 2);

        return [
            'scheme' => $scheme,
            'base' => $base,
            'ceiling' => $ceiling,
            'is_capped' => $basicSalary + $housingAllowance > $ceiling,
            'employee' => $employeeTotal,
            'employer' => $employerTotal,
            'total' => round($employeeTotal + $employerTotal, 2),
            'breakdown' => [
                'pension' => [
                    'employee' => $pensionEmployee,
                    'employer' => $pensionEmployer,
                    'rate_employee' => (float) $rates->pension_employee,
                    'rate_employer' => (float) $rates->pension_employer,
                ],
                'hazards' => [
                    'employer' => $hazards,
                    'rate_employer' => (float) $rates->hazards_employer,
                ],
                'saned' => [
                    'employee' => $sanedEmployee,
                    'employer' => $sanedEmployer,
                    'rate_employee' => (float) $rates->saned_employee,
                    'rate_employer' => (float) $rates->saned_employer,
                ],
            ],
        ];
    }

    /**
     * تحديد النظام المطبَّق.
     *
     * ⚠ الفخ اللي بيسقّط أنظمة الرواتب: الجنسية وحدها مش كافية.
     * سعودي مُعيَّن جديد في ٢٠٢٦ يبقى على النظام القديم لو عنده
     * سجل اشتراكات سابق قبل ٣ يوليو ٢٠٢٤. المُحدِّد هو تاريخ أول
     * اشتراك على الإطلاق — مش تاريخ التعيين عندك.
     */
    public function resolveScheme(HrEmployee $employee): string
    {
        if ($employee->nationality_type === 'expat') {
            return 'expat';
        }

        // لو محفوظ صريحًا، احترمه — ده الأدق
        if ($employee->gosi_scheme) {
            return $employee->gosi_scheme;
        }

        $firstRegistration = $employee->gosi_first_registration_date
            ?? $employee->hire_date;

        if (!$firstRegistration) {
            return 'new';
        }

        // النظام الجديد: من لا سجل له قبل ٣ يوليو ٢٠٢٤
        return Carbon::parse($firstRegistration)
            ->lt(Carbon::parse('2024-07-03'))
                ? 'existing'
                : 'new';
    }

    private function ratesFor(string $scheme, Carbon $date): ?GosiRateSchedule
    {
        return GosiRateSchedule::query()
            ->where('scheme', $scheme)
            ->where('effective_from', '<=', $date->toDateString())
            ->where(function ($q) use ($date) {
                $q->whereNull('effective_to')
                    ->orWhere('effective_to', '>=', $date->toDateString());
            })
            ->orderByDesc('effective_from')
            ->first();
    }

    private function pct(float $base, $rate): float
    {
        return round($base * ((float) $rate / 100), 2);
    }

    private function zero(string $scheme): array
    {
        return [
            'scheme' => $scheme,
            'base' => 0.0,
            'ceiling' => 45000.0,
            'is_capped' => false,
            'employee' => 0.0,
            'employer' => 0.0,
            'total' => 0.0,
            'breakdown' => [],
        ];
    }
}
