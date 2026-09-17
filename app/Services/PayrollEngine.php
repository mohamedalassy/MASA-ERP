<?php

namespace App\Services;

use App\Models\HrEmployee;
use App\Models\HrPayrollLine;
use App\Models\HrPayrollRun;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * محرك الرواتب.
 *
 * بيسحب الحضور والإجازات من الجداول اليومية الموجودة عندك
 * (hr_attendance_daily) ويحسب الراتب بند بند، ويولّد القيد
 * المحاسبي، ويوزّع التكلفة على المشاريع من بصمات الموقع.
 *
 * ====== الميزة على جسر ======
 * جسر بيحسب الراتب ثم يُصدّره لنظام محاسبي منفصل، وبيعرف إن
 * الموظف اشتغل ٨ ساعات ومش بيعرف على أي مشروع. هنا الاتنين
 * في قاعدة واحدة: القيد آلي، والتكلفة بتنزل على المشروع.
 */
class PayrollEngine
{
    /* أكواد الحسابات — الأفضل نقلها لجدول ربط الحسابات */
    private const SALARY_EXPENSE = '5210';
    private const GOSI_EXPENSE = '5230';
    private const SALARY_PAYABLE = '2130';
    private const GOSI_PAYABLE = '2150';
    private const EOSB_PROVISION = '2220';

    public function __construct(
        private readonly GosiCalculator $gosi,
        private readonly EosbCalculator $eosb,
        private readonly JournalPostingService $posting,
        private readonly DocumentNumberService $sequences
    ) {}

    /** إنشاء تشغيل رواتب وحساب كل الموظفين. */
    public function run(
        int $year,
        int $month,
        ?int $branchId = null,
        ?int $userId = null
    ): HrPayrollRun {
        $existing = HrPayrollRun::query()
            ->where('period_year', $year)
            ->where('period_month', $month)
            ->where('branch_id', $branchId)
            ->first();

        if ($existing && $existing->status !== 'draft') {
            throw ValidationException::withMessages([
                'period' => [
                    'تشغيل رواتب الفترة دي موجود بحالة: ' . $existing->status,
                ],
            ]);
        }

        $employees = HrEmployee::query()
            ->with(['activeContract', 'department.costCenter'])
            ->whereIn('status', ['active', 'probation', 'on_leave'])
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->get()
            ->filter(fn ($e) => $e->activeContract !== null);

        if ($employees->isEmpty()) {
            throw ValidationException::withMessages([
                'employees' => ['لا يوجد موظفون بعقود سارية في الفترة دي.'],
            ]);
        }

        return DB::transaction(function () use (
            $existing,
            $year,
            $month,
            $branchId,
            $employees,
            $userId
        ) {
            $run = $existing ?: HrPayrollRun::create([
                'run_number' => $this->sequences->next('payroll_run', 'PR'),
                'period_year' => $year,
                'period_month' => $month,
                'branch_id' => $branchId,
                'status' => 'draft',
                'created_by' => $userId,
            ]);

            $run->lines()->delete();

            $totals = [
                'gross' => 0, 'deductions' => 0, 'net' => 0,
                'gosi_employee' => 0, 'gosi_employer' => 0, 'eosb' => 0,
            ];

            foreach ($employees as $employee) {
                $line = $this->calculateEmployee($run, $employee, $year, $month);

                $totals['gross'] += $line->gross_salary;
                $totals['net'] += $line->net_salary;
                $totals['gosi_employee'] += $line->gosi_employee;
                $totals['gosi_employer'] += $line->gosi_employer;
                $totals['eosb'] += $line->eosb_accrual;
                $totals['deductions'] +=
                    $line->absence_deduction
                    + $line->late_deduction
                    + $line->unpaid_leave_deduction
                    + $line->loan_deduction
                    + $line->other_deductions
                    + $line->gosi_employee;
            }

            $run->update([
                'status' => 'calculated',
                'employees_count' => $employees->count(),
                'total_gross' => round($totals['gross'], 2),
                'total_deductions' => round($totals['deductions'], 2),
                'total_gosi_employee' => round($totals['gosi_employee'], 2),
                'total_gosi_employer' => round($totals['gosi_employer'], 2),
                'total_net' => round($totals['net'], 2),
                'total_eosb_accrual' => round($totals['eosb'], 2),
            ]);

            return $run->fresh('lines');
        });
    }

    /** حساب موظف واحد. */
    private function calculateEmployee(
        HrPayrollRun $run,
        HrEmployee $employee,
        int $year,
        int $month
    ): HrPayrollLine {
        $contract = $employee->activeContract;

        $basic = (float) $contract->basic_salary;
        $housing = (float) $contract->housing_allowance;

        $otherAllowances = round(
            (float) $contract->transport_allowance
            + (float) $contract->phone_allowance
            + (float) $contract->food_allowance
            + (float) $contract->other_allowance,
            2
        );

        $monthlyWage = round($basic + $housing + $otherAllowances, 2);
        $dailyWage = round($monthlyWage / 30, 4);

        $attendance = $this->attendanceSummary($employee->id, $year, $month);

        // الإضافي: ١٥٠٪ من أجر الساعة نظامًا
        $hourlyWage = round($basic / 30 / 8, 4);
        $overtimeAmount = round(
            $attendance['overtime_hours'] * $hourlyWage * 1.5,
            2
        );

        $absenceDeduction = round($attendance['absence_days'] * $dailyWage, 2);

        // التأخير يُخصم بأجر الدقيقة
        $lateDeduction = round(
            $attendance['late_minutes'] * ($hourlyWage / 60),
            2
        );

        $unpaidLeaveDeduction = round(
            $attendance['unpaid_leave_days'] * $dailyWage,
            2
        );

        $gross = round($monthlyWage + $overtimeAmount, 2);

        $gosi = $this->gosi->calculate(
            $employee,
            $basic,
            $housing,
            Carbon::create($year, $month)->endOfMonth()->toDateString()
        );

        $net = round(
            $gross
            - $absenceDeduction
            - $lateDeduction
            - $unpaidLeaveDeduction
            - $gosi['employee'],
            2
        );

        return HrPayrollLine::create([
            'payroll_run_id' => $run->id,
            'employee_id' => $employee->id,
            'contract_id' => $contract->id,

            'basic_salary' => $basic,
            'housing_allowance' => $housing,
            'other_allowances' => $otherAllowances,

            'overtime_hours' => $attendance['overtime_hours'],
            'overtime_amount' => $overtimeAmount,
            'gross_salary' => $gross,

            'absence_days' => $attendance['absence_days'],
            'absence_deduction' => $absenceDeduction,
            'late_minutes' => $attendance['late_minutes'],
            'late_deduction' => $lateDeduction,
            'unpaid_leave_days' => $attendance['unpaid_leave_days'],
            'unpaid_leave_deduction' => $unpaidLeaveDeduction,

            'gosi_scheme' => $gosi['scheme'],
            'gosi_base' => $gosi['base'],
            'gosi_employee' => $gosi['employee'],
            'gosi_employer' => $gosi['employer'],
            'gosi_breakdown' => $gosi['breakdown'],

            'net_salary' => max(0, $net),

            'eosb_accrual' => $this->eosb->monthlyAccrual(
                $employee,
                $monthlyWage
            ),

            'cost_center_id' => $employee->department?->cost_center_id,

            // توزيع التكلفة على المشاريع من بصمات الموقع
            'project_allocations' => $this->projectAllocations(
                $employee->user_id,
                $monthlyWage,
                $year,
                $month
            ),

            'payment_status' => 'unpaid',
        ]);
    }

    /** ملخص الحضور من hr_attendance_daily الموجود عندك. */
    private function attendanceSummary(
        int $employeeId,
        int $year,
        int $month
    ): array {
        $start = Carbon::create($year, $month, 1)->toDateString();
        $end = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();

        $row = DB::table('hr_attendance_daily')
            ->where('employee_id', $employeeId)
            ->whereBetween('work_date', [$start, $end])
            ->selectRaw("
                COALESCE(SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END), 0) as absence_days,
                COALESCE(SUM(late_minutes), 0) as late_minutes,
                COALESCE(SUM(overtime_minutes), 0) as overtime_minutes
            ")
            ->first();

        $unpaidLeave = (float) DB::table('hr_leave_requests as r')
            ->join('hr_leave_types as t', 't.id', '=', 'r.leave_type_id')
            ->where('r.employee_id', $employeeId)
            ->where('r.status', 'approved')
            ->where('t.is_paid', false)
            ->whereBetween('r.start_date', [$start, $end])
            ->sum('r.days_count');

        return [
            'absence_days' => (float) ($row->absence_days ?? 0),
            'late_minutes' => (float) ($row->late_minutes ?? 0),
            'overtime_hours' => round((float) ($row->overtime_minutes ?? 0) / 60, 2),
            'unpaid_leave_days' => $unpaidLeave,
        ];
    }

    /**
     * ====== توزيع تكلفة العمالة على المشاريع ======
     *
     * ده اللي جسر مش قادر يعمله. بصمات الموقع على المشاريع
     * (project_site_checkins) بتتحوّل لساعات، والساعات لتكلفة،
     * والتكلفة تنزل مصروف على المشروع فتظهر في الهامش الفعلي.
     */
    private function projectAllocations(
        ?int $userId,
        float $monthlyWage,
        int $year,
        int $month
    ): ?array {
        if (!$userId) {
            return null;
        }

        $start = Carbon::create($year, $month, 1);
        $end = $start->copy()->endOfMonth();

        $rows = DB::table('project_site_checkins')
            ->where('user_id', $userId)
            ->whereNotNull('checked_out_at')
            ->whereBetween('checked_in_at', [$start, $end])
            ->groupBy('project_id')
            ->selectRaw('project_id, SUM(duration_minutes) as minutes')
            ->get();

        if ($rows->isEmpty()) {
            return null;
        }

        $totalMinutes = (float) $rows->sum('minutes');

        if ($totalMinutes <= 0) {
            return null;
        }

        // ٨ ساعات × ٢٢ يوم عمل = الطاقة الشهرية المعيارية
        $standardMinutes = 8 * 60 * 22;
        $costPerMinute = $monthlyWage / $standardMinutes;

        return $rows->map(fn ($row) => [
            'project_id' => (int) $row->project_id,
            'minutes' => (int) $row->minutes,
            'hours' => round($row->minutes / 60, 2),
            'cost' => round($row->minutes * $costPerMinute, 2),
            'share_percent' => round(($row->minutes / $totalMinutes) * 100, 2),
        ])->all();
    }

    /**
     * ترحيل القيد المحاسبي.
     *
     *   مدين  الرواتب والأجور        (الإجمالي)
     *   مدين  التأمينات الاجتماعية    (حصة الشركة)
     *   مدين  مخصص نهاية الخدمة
     *   دائن  رواتب مستحقة           (الصافي)
     *   دائن  التأمينات المستحقة      (الحصتين)
     *   دائن  مخصص نهاية الخدمة
     *
     * وبسطر مصروف لكل مركز تكلفة — فتقرير المصروفات بالقسم
     * يطلع صح بدون أي شغل إضافي.
     */
    public function post(HrPayrollRun $run, ?int $userId = null): HrPayrollRun
    {
        if ($run->status !== 'approved') {
            throw ValidationException::withMessages([
                'status' => ['يجب اعتماد تشغيل الرواتب قبل الترحيل.'],
            ]);
        }

        $salaryAccount = $this->posting->requireAccount(
            self::SALARY_EXPENSE,
            'الرواتب والأجور'
        );

        $gosiExpense = $this->posting->requireAccount(
            self::GOSI_EXPENSE,
            'التأمينات الاجتماعية'
        );

        $salaryPayable = $this->posting->requireAccount(
            self::SALARY_PAYABLE,
            'رواتب مستحقة'
        );

        $gosiPayable = $this->posting->requireAccount(
            self::GOSI_PAYABLE,
            'التأمينات المستحقة'
        );

        $eosbProvision = $this->posting->requireAccount(
            self::EOSB_PROVISION,
            'مكافأة نهاية الخدمة'
        );

        $lines = [];

        // مصروف الرواتب بسطر لكل مركز تكلفة
        $byCostCenter = $run->lines
            ->groupBy('cost_center_id')
            ->map(fn ($group) => round((float) $group->sum('gross_salary'), 2));

        foreach ($byCostCenter as $costCenterId => $amount) {
            if ($amount <= 0) {
                continue;
            }

            $lines[] = [
                'account_id' => $salaryAccount->id,
                'debit' => $amount,
                'credit' => 0,
                'description' => 'مصروف رواتب الفترة',
                'cost_center_id' => $costCenterId ?: null,
            ];
        }

        $gosiEmployer = round((float) $run->total_gosi_employer, 2);
        $gosiEmployee = round((float) $run->total_gosi_employee, 2);
        $eosbAccrual = round((float) $run->total_eosb_accrual, 2);

        if ($gosiEmployer > 0) {
            $lines[] = [
                'account_id' => $gosiExpense->id,
                'debit' => $gosiEmployer,
                'credit' => 0,
                'description' => 'حصة الشركة في التأمينات',
            ];
        }

        if ($eosbAccrual > 0) {
            $lines[] = [
                'account_id' => $eosbProvision->id,
                'debit' => $eosbAccrual,
                'credit' => 0,
                'description' => 'مخصص نهاية الخدمة — مصروف الشهر',
            ];

            $lines[] = [
                'account_id' => $eosbProvision->id,
                'debit' => 0,
                'credit' => $eosbAccrual,
                'description' => 'مخصص نهاية الخدمة — التزام',
            ];
        }

        $lines[] = [
            'account_id' => $salaryPayable->id,
            'debit' => 0,
            'credit' => round((float) $run->total_net, 2),
            'description' => 'صافي الرواتب المستحقة للموظفين',
        ];

        if ($gosiEmployer + $gosiEmployee > 0) {
            $lines[] = [
                'account_id' => $gosiPayable->id,
                'debit' => 0,
                'credit' => round($gosiEmployer + $gosiEmployee, 2),
                'description' => 'التأمينات المستحقة — الحصتين',
            ];
        }

        return DB::transaction(function () use ($run, $lines, $userId) {
            $entry = $this->posting->post(
                reference: [
                    'type' => 'payroll_run',
                    'id' => $run->id,
                    'number' => $run->run_number,
                ],
                lines: $lines,
                description: sprintf(
                    'قيد رواتب شهر %02d/%d',
                    $run->period_month,
                    $run->period_year
                ),
                entryDate: Carbon::create(
                    $run->period_year,
                    $run->period_month
                )->endOfMonth()->toDateString(),
                userId: $userId,
                notes: 'قيد آلي ناتج عن ترحيل تشغيل الرواتب.'
            );

            $run->update([
                'status' => 'posted',
                'finance_journal_entry_id' => $entry->id,
                'posted_at' => now(),
            ]);

            return $run->fresh();
        });
    }
}
