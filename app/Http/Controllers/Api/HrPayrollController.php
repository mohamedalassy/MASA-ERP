<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrPayrollRun;
use App\Services\PayrollEngine;
use App\Services\WpsFileService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * تشغيل الرواتب.
 *
 * المسارات:
 *   GET  /api/hr/payroll-runs
 *   POST /api/hr/payroll-runs                    إنشاء وحساب
 *   GET  /api/hr/payroll-runs/{run}
 *   POST /api/hr/payroll-runs/{run}/recalculate
 *   POST /api/hr/payroll-runs/{run}/approve
 *   POST /api/hr/payroll-runs/{run}/post         ترحيل القيد
 *   POST /api/hr/payroll-runs/{run}/wps/validate
 *   POST /api/hr/payroll-runs/{run}/wps/generate
 *   GET  /api/hr/payroll-runs/{run}/wps/download
 */
class HrPayrollController extends Controller
{
    public function __construct(
        private readonly PayrollEngine $engine,
        private readonly WpsFileService $wps
    ) {}

    public function index(Request $request)
    {
        $runs = HrPayrollRun::query()
            ->with('branch:id,code,name')
            ->when(
                $request->filled('year'),
                fn ($q) => $q->where('period_year', $request->year)
            )
            ->when(
                $request->filled('status'),
                fn ($q) => $q->where('status', $request->status)
            )
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->get();

        return response()->json([
            'success' => true,
            'summary' => [
                'runs_count' => $runs->count(),
                'posted_count' => $runs->where('status', 'posted')->count(),
                'pending_wps' => $runs
                    ->whereIn('status', ['approved', 'posted'])
                    ->whereNull('wps_submitted_at')
                    ->count(),
                'ytd_gross' => round((float) $runs
                    ->where('period_year', now()->year)
                    ->sum('total_gross'), 2),
                'ytd_gosi_employer' => round((float) $runs
                    ->where('period_year', now()->year)
                    ->sum('total_gosi_employer'), 2),
            ],
            'data' => $runs,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'year' => ['required', 'integer', 'min:2020', 'max:2100'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'branch_id' => ['nullable', 'integer', 'exists:hr_branches,id'],
        ]);

        $run = $this->engine->run(
            (int) $validated['year'],
            (int) $validated['month'],
            $validated['branch_id'] ?? null,
            $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'message' => sprintf(
                'تم حساب رواتب %d موظف بإجمالي صافي %s ريال.',
                $run->employees_count,
                number_format((float) $run->total_net, 2)
            ),
            'data' => $run,
        ], 201);
    }

    public function show(HrPayrollRun $payrollRun)
    {
        $payrollRun->load([
            'branch:id,code,name',
            'journalEntry:id,entry_number,entry_date,status',
            'lines.employee:id,employee_number,first_name,last_name,nationality_type,iban',
            'lines.costCenter:id,code,name',
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                ...$payrollRun->toArray(),

                // إجمالي تكلفة صاحب العمل = الإجمالي + حصته + المخصص
                'employer_cost' => round(
                    (float) $payrollRun->total_gross
                    + (float) $payrollRun->total_gosi_employer
                    + (float) $payrollRun->total_eosb_accrual,
                    2
                ),

                'lines' => $payrollRun->lines->map(fn ($line) => [
                    ...$line->toArray(),
                    'employee_name' => trim(
                        $line->employee->first_name . ' ' .
                        $line->employee->last_name
                    ),
                ]),
            ],
        ]);
    }

    public function recalculate(Request $request, HrPayrollRun $payrollRun)
    {
        if (in_array($payrollRun->status, ['posted', 'paid'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن إعادة حساب تشغيل مُرحَّل.',
            ], 422);
        }

        $payrollRun->update(['status' => 'draft']);

        $run = $this->engine->run(
            (int) $payrollRun->period_year,
            (int) $payrollRun->period_month,
            $payrollRun->branch_id,
            $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'message' => 'تم إعادة الحساب.',
            'data' => $run,
        ]);
    }

    public function approve(Request $request, HrPayrollRun $payrollRun)
    {
        if ($payrollRun->status !== 'calculated') {
            return response()->json([
                'success' => false,
                'message' => 'يجب حساب التشغيل أولًا قبل الاعتماد.',
            ], 422);
        }

        $payrollRun->update([
            'status' => 'approved',
            'approved_by' => $request->user()?->id,
            'approved_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم اعتماد تشغيل الرواتب.',
            'data' => $payrollRun->fresh(),
        ]);
    }

    public function post(Request $request, HrPayrollRun $payrollRun)
    {
        $run = $this->engine->post($payrollRun, $request->user()?->id);

        return response()->json([
            'success' => true,
            'message' => 'تم ترحيل قيد الرواتب.',
            'data' => $run->load('journalEntry'),
        ]);
    }

    public function validateWps(HrPayrollRun $payrollRun)
    {
        $result = $this->wps->validate($payrollRun);

        return response()->json([
            'success' => true,
            'message' => $result['is_valid']
                ? 'الملف جاهز للرفع — مافيش أخطاء.'
                : sprintf('فيه %d خطأ يمنع الرفع.', count($result['errors'])),
            'data' => $result,
        ]);
    }

    public function generateWps(HrPayrollRun $payrollRun)
    {
        $result = $this->wps->generate($payrollRun);

        if (!$result['generated']) {
            return response()->json([
                'success' => false,
                'message' => 'الفحص المسبق فشل — صحّح الأخطاء قبل التوليد.',
                'data' => $result['validation'],
            ], 422);
        }

        return response()->json([
            'success' => true,
            'message' => sprintf(
                'تم توليد ملف حماية الأجور — %d موظف بإجمالي %s ريال.',
                $result['rows'],
                number_format($result['total_net'], 2)
            ),
            'data' => $result,
        ]);
    }

    public function downloadWps(HrPayrollRun $payrollRun)
    {
        if (!$payrollRun->wps_file_path
            || !Storage::disk('local')->exists($payrollRun->wps_file_path)) {
            return response()->json([
                'success' => false,
                'message' => 'الملف غير موجود — ولّده أولًا.',
            ], 404);
        }

        return Storage::disk('local')->download(
            $payrollRun->wps_file_path,
            sprintf(
                'WPS-%d-%02d.csv',
                $payrollRun->period_year,
                $payrollRun->period_month
            )
        );
    }
}
