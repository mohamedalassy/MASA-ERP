<?php

namespace App\Services;

use App\Models\HrComplianceAlert;
use App\Models\HrEmployee;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * مراقب الامتثال — يترجم الامتثال من "شغل ورق" إلى رقم مخاطرة بالريال.
 *
 * جسر بيوعد بـ«تنبيهات فورية على مخاطر المخالفة قبل الرفع» وده أذكى
 * حاجة في منتجه. كل المدخلات موجودة عندك، فالتنبيهات دي قابلة
 * للتنفيذ بالكامل.
 *
 * يُشغَّل يوميًا بـ scheduler:
 *   $schedule->call(fn () => app(ComplianceMonitorService::class)->scan())
 *       ->dailyAt('06:00');
 */
class ComplianceMonitorService
{
    /** غرامة تأخّر ملف الأجور لكل موظف شهريًا. */
    private const WPS_PENALTY_PER_EMPLOYEE = 3000;

    /** موعد رفع ملف الأجور — يوم من الشهر التالي. */
    private const WPS_DEADLINE_DAY = 15;

    public function scan(): array
    {
        $generated = [
            'iqama_expiry' => $this->scanIqamaExpiry(),
            'passport_expiry' => $this->scanPassportExpiry(),
            'contract_expiry' => $this->scanContractExpiry(),
            'qiwa_not_authenticated' => $this->scanQiwaAuthentication(),
            'salary_mismatch' => $this->scanSalaryMismatch(),
            'probation_ending' => $this->scanProbationEnding(),
            'gosi_unregistered' => $this->scanGosiRegistration(),
            'wps_deadline' => $this->scanWpsDeadline(),
        ];

        return [
            'scanned_at' => now()->toDateTimeString(),
            'generated' => $generated,
            'total' => array_sum($generated),
        ];
    }

    /** ملخص اللوحة — بالمخاطرة المالية. */
    public function dashboard(): array
    {
        $alerts = HrComplianceAlert::query()
            ->where('status', 'open')
            ->get();

        $employees = HrEmployee::query()
            ->whereIn('status', ['active', 'probation'])
            ->get(['id', 'nationality_type']);

        $total = $employees->count();
        $saudis = $employees->where('nationality_type', '!=', 'expat')->count();

        return [
            'alerts' => [
                'critical' => $alerts->where('severity', 'critical')->count(),
                'warning' => $alerts->where('severity', 'warning')->count(),
                'info' => $alerts->where('severity', 'info')->count(),
                'total' => $alerts->count(),
            ],

            // إجمالي المخاطرة المالية المفتوحة بالريال
            'financial_exposure' => round(
                (float) $alerts->sum('potential_penalty'),
                2
            ),

            'by_type' => $alerts
                ->groupBy('type')
                ->map(fn ($group) => [
                    'count' => $group->count(),
                    'penalty' => round((float) $group->sum('potential_penalty'), 2),
                ]),

            'saudization' => [
                'total_employees' => $total,
                'saudi_employees' => $saudis,
                'percentage' => $total > 0
                    ? round(($saudis / $total) * 100, 2)
                    : 0,

                /*
                 * ⚠ من ١٥ أبريل ٢٠٢٦: الموظف السعودي لا يُحسب في
                 * نطاقات إلا لو عقده موثّق ومصدَّق إلكترونيًا على قوى.
                 * فالنسبة المحسوبة فوق تفاؤلية — دي النسبة الحقيقية.
                 */
                'countable_saudi_employees' => $this->countableSaudis(),
                'uncounted_reason' => 'عقود غير موثّقة في قوى',
            ],

            'wps' => $this->wpsStatus(),
        ];
    }

    private function scanIqamaExpiry(): int
    {
        $count = 0;

        $employees = HrEmployee::query()
            ->whereIn('status', ['active', 'probation', 'on_leave'])
            ->whereNotNull('iqama_expiry')
            ->where('iqama_expiry', '<=', now()->addDays(90))
            ->get();

        foreach ($employees as $employee) {
            $days = now()->startOfDay()->diffInDays(
                Carbon::parse($employee->iqama_expiry),
                false
            );

            $this->upsert([
                'type' => 'iqama_expiry',
                'employee_id' => $employee->id,
                'severity' => $days < 0 ? 'critical' : ($days <= 30 ? 'critical' : 'warning'),
                'title' => $days < 0
                    ? 'إقامة منتهية'
                    : "إقامة تنتهي خلال {$days} يوم",
                'description' => sprintf(
                    'الموظف %s — رقم الإقامة %s — تاريخ الانتهاء %s.%s',
                    $employee->employee_number,
                    $employee->iqama_number ?: '—',
                    $employee->iqama_expiry,
                    $days < 0
                        ? ' انتهاء الإقامة يوقف الرواتب ونقل الكفالة والتعيينات.'
                        : ''
                ),
                'due_date' => $employee->iqama_expiry,
                'days_remaining' => $days,
            ]);

            $count++;
        }

        return $count;
    }

    private function scanPassportExpiry(): int
    {
        $count = 0;

        $employees = HrEmployee::query()
            ->whereIn('status', ['active', 'probation', 'on_leave'])
            ->whereNotNull('passport_expiry')
            ->where('passport_expiry', '<=', now()->addDays(180))
            ->get();

        foreach ($employees as $employee) {
            $days = now()->startOfDay()->diffInDays(
                Carbon::parse($employee->passport_expiry),
                false
            );

            $this->upsert([
                'type' => 'passport_expiry',
                'employee_id' => $employee->id,
                'severity' => $days <= 60 ? 'warning' : 'info',
                'title' => "جواز سفر ينتهي خلال {$days} يوم",
                'description' => 'تجديد الإقامة بيتطلب جواز ساري لمدة كافية.',
                'due_date' => $employee->passport_expiry,
                'days_remaining' => $days,
            ]);

            $count++;
        }

        return $count;
    }

    private function scanContractExpiry(): int
    {
        $count = 0;

        $contracts = DB::table('hr_employee_contracts as c')
            ->join('hr_employees as e', 'e.id', '=', 'c.employee_id')
            ->where('c.status', 'active')
            ->whereNotNull('c.end_date')
            ->where('c.end_date', '<=', now()->addDays(60))
            ->select('c.id', 'c.employee_id', 'c.end_date', 'c.notice_period_days', 'e.employee_number')
            ->get();

        foreach ($contracts as $contract) {
            $days = now()->startOfDay()->diffInDays(
                Carbon::parse($contract->end_date),
                false
            );

            $noticePeriod = (int) ($contract->notice_period_days ?: 60);

            $this->upsert([
                'type' => 'contract_expiry',
                'employee_id' => $contract->employee_id,
                'severity' => $days <= $noticePeriod ? 'critical' : 'warning',
                'title' => $days < 0
                    ? 'عقد منتهي'
                    : "عقد ينتهي خلال {$days} يوم",
                'description' => sprintf(
                    'الموظف %s — مهلة الإشعار %d يوم. %s',
                    $contract->employee_number,
                    $noticePeriod,
                    $days <= $noticePeriod
                        ? 'دخلنا مهلة الإشعار — التجديد أو الإشعار مطلوب الآن.'
                        : ''
                ),
                'due_date' => $contract->end_date,
                'days_remaining' => $days,
            ]);

            $count++;
        }

        return $count;
    }

    /**
     * العقود غير الموثّقة في قوى.
     *
     * من ١٥ أبريل ٢٠٢٦ الموظف السعودي لا يُحسب في نطاقات إلا لو
     * عقده موثّق ومصدَّق إلكترونيًا — التسجيل في التأمينات وحده
     * مابقاش كافي.
     */
    private function scanQiwaAuthentication(): int
    {
        $count = 0;

        $rows = DB::table('hr_employee_contracts as c')
            ->join('hr_employees as e', 'e.id', '=', 'c.employee_id')
            ->where('c.status', 'active')
            ->whereNull('c.qiwa_authenticated_at')
            ->whereIn('e.status', ['active', 'probation'])
            ->select('c.employee_id', 'e.employee_number', 'e.nationality_type')
            ->get();

        foreach ($rows as $row) {
            $isSaudi = $row->nationality_type !== 'expat';

            $this->upsert([
                'type' => 'qiwa_not_authenticated',
                'employee_id' => $row->employee_id,
                'severity' => $isSaudi ? 'critical' : 'warning',
                'title' => 'عقد غير موثّق في قوى',
                'description' => sprintf(
                    'الموظف %s — %s',
                    $row->employee_number,
                    $isSaudi
                        ? 'موظف سعودي بعقد غير موثّق: لا يُحسب في نطاقات (سارٍ من ١٥ أبريل ٢٠٢٦).'
                        : 'توثيق العقد مطلوب نظامًا.'
                ),
            ]);

            $count++;
        }

        return $count;
    }

    /**
     * تعارض الراتب بين النظام والعقد.
     * ده بالتحديد اللي بيجمّد خدمات مقيم عبر السلسلة.
     */
    private function scanSalaryMismatch(): int
    {
        $count = 0;

        $rows = DB::table('hr_payroll_lines as l')
            ->join('hr_payroll_runs as r', 'r.id', '=', 'l.payroll_run_id')
            ->join('hr_employee_contracts as c', 'c.id', '=', 'l.contract_id')
            ->join('hr_employees as e', 'e.id', '=', 'l.employee_id')
            ->whereIn('r.status', ['calculated', 'approved'])
            ->selectRaw('
                l.employee_id,
                e.employee_number,
                (l.basic_salary + l.housing_allowance + l.other_allowances) as payroll_wage,
                (c.basic_salary + c.housing_allowance + c.transport_allowance
                 + c.phone_allowance + c.food_allowance + c.other_allowance) as contract_wage
            ')
            ->get()
            ->filter(fn ($row) => abs(
                (float) $row->payroll_wage - (float) $row->contract_wage
            ) >= 0.01);

        foreach ($rows as $row) {
            $this->upsert([
                'type' => 'salary_mismatch',
                'employee_id' => $row->employee_id,
                'severity' => 'critical',
                'title' => 'تعارض بين راتب المسيّر وراتب العقد',
                'description' => sprintf(
                    'الموظف %s — المسيّر %s والعقد %s. التعارض ده بيرفض ملف مدد وبيجمّد خدمات مقيم.',
                    $row->employee_number,
                    number_format((float) $row->payroll_wage, 2),
                    number_format((float) $row->contract_wage, 2)
                ),
            ]);

            $count++;
        }

        return $count;
    }

    private function scanProbationEnding(): int
    {
        $count = 0;

        $employees = HrEmployee::query()
            ->where('status', 'probation')
            ->whereNotNull('probation_end_date')
            ->where('probation_end_date', '<=', now()->addDays(14))
            ->get();

        foreach ($employees as $employee) {
            $days = now()->startOfDay()->diffInDays(
                Carbon::parse($employee->probation_end_date),
                false
            );

            $this->upsert([
                'type' => 'probation_ending',
                'employee_id' => $employee->id,
                'severity' => 'warning',
                'title' => $days < 0
                    ? 'فترة تجربة منتهية بدون قرار'
                    : "فترة تجربة تنتهي خلال {$days} يوم",
                'description' => 'مطلوب قرار التثبيت أو إنهاء الخدمة قبل انتهاء المدة.',
                'due_date' => $employee->probation_end_date,
                'days_remaining' => $days,
            ]);

            $count++;
        }

        return $count;
    }

    private function scanGosiRegistration(): int
    {
        $count = 0;

        $employees = HrEmployee::query()
            ->whereIn('status', ['active', 'probation'])
            ->where('gosi_subscribed', true)
            ->whereNull('gosi_number')
            ->get();

        foreach ($employees as $employee) {
            $this->upsert([
                'type' => 'gosi_unregistered',
                'employee_id' => $employee->id,
                'severity' => 'critical',
                'title' => 'موظف بدون رقم تأمينات',
                'description' => sprintf(
                    'الموظف %s مشترك في التأمينات بدون رقم مسجّل — بيرفض ملف مدد.',
                    $employee->employee_number
                ),
            ]);

            $count++;
        }

        return $count;
    }

    /**
     * موعد رفع ملف الأجور — والغرامة المحتملة بالريال.
     *
     * ٣٠٠٠ ريال لكل موظف شهريًا، والمخالفة بتأثّر على نطاقات كذلك.
     * على ٥٠ موظف ده ١٥٠ ألف ريال في شهر واحد.
     */
    private function scanWpsDeadline(): int
    {
        $lastMonth = now()->subMonth();

        $run = DB::table('hr_payroll_runs')
            ->where('period_year', $lastMonth->year)
            ->where('period_month', $lastMonth->month)
            ->first();

        $deadline = now()->startOfMonth()->addDays(self::WPS_DEADLINE_DAY - 1);
        $daysRemaining = now()->startOfDay()->diffInDays($deadline, false);

        // مرفوع بالفعل — لا تنبيه
        if ($run && $run->wps_submitted_at) {
            return 0;
        }

        $employeesCount = (int) ($run->employees_count ?? HrEmployee::query()
            ->whereIn('status', ['active', 'probation'])
            ->count());

        $penalty = $employeesCount * self::WPS_PENALTY_PER_EMPLOYEE;

        $this->upsert([
            'type' => 'wps_deadline',
            'employee_id' => null,
            'severity' => $daysRemaining < 0
                ? 'critical'
                : ($daysRemaining <= 5 ? 'critical' : 'warning'),
            'title' => $daysRemaining < 0
                ? 'ملف حماية الأجور متأخر'
                : "موعد رفع ملف حماية الأجور خلال {$daysRemaining} يوم",
            'description' => sprintf(
                'ملف أجور %02d/%d %s. الغرامة المحتملة: %s ريال (%d موظف × %s ريال شهريًا).',
                $lastMonth->month,
                $lastMonth->year,
                $run ? 'محسوب وغير مرفوع' : 'لم يُنشأ بعد',
                number_format($penalty, 0),
                $employeesCount,
                number_format(self::WPS_PENALTY_PER_EMPLOYEE, 0)
            ),
            'due_date' => $deadline->toDateString(),
            'days_remaining' => $daysRemaining,
            'potential_penalty' => $penalty,
        ]);

        return 1;
    }

    private function countableSaudis(): int
    {
        return (int) DB::table('hr_employees as e')
            ->join('hr_employee_contracts as c', function ($join) {
                $join->on('c.employee_id', '=', 'e.id')
                    ->where('c.status', '=', 'active');
            })
            ->whereIn('e.status', ['active', 'probation'])
            ->where('e.nationality_type', '!=', 'expat')
            ->whereNotNull('c.qiwa_authenticated_at')
            ->count();
    }

    private function wpsStatus(): array
    {
        $lastMonth = now()->subMonth();

        $run = DB::table('hr_payroll_runs')
            ->where('period_year', $lastMonth->year)
            ->where('period_month', $lastMonth->month)
            ->first();

        $deadline = now()->startOfMonth()->addDays(self::WPS_DEADLINE_DAY - 1);

        return [
            'period' => sprintf('%02d/%d', $lastMonth->month, $lastMonth->year),
            'run_exists' => (bool) $run,
            'run_status' => $run->status ?? null,
            'validation_status' => $run->wps_validation_status ?? null,
            'generated_at' => $run->wps_generated_at ?? null,
            'submitted_at' => $run->wps_submitted_at ?? null,
            'deadline' => $deadline->toDateString(),
            'days_remaining' => now()->startOfDay()->diffInDays($deadline, false),
            'is_overdue' => now()->gt($deadline) && !($run->wps_submitted_at ?? null),
        ];
    }

    /** تنبيه واحد مفتوح لكل (نوع + موظف) — ما يتكرّرش كل مسح. */
    private function upsert(array $data): void
    {
        HrComplianceAlert::updateOrCreate(
            [
                'type' => $data['type'],
                'employee_id' => $data['employee_id'] ?? null,
                'status' => 'open',
            ],
            $data
        );
    }
}
