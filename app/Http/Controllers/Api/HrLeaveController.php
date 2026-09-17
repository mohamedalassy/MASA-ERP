<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrEmployee;
use App\Models\HrLeaveBalance;
use App\Models\HrLeaveRequest;
use App\Models\HrLeaveType;
use App\Services\DocumentNumberService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * الإجازات — الطلبات والأرصدة.
 *
 * المسارات:
 *   GET  /api/hr/leave-types
 *   GET  /api/hr/leave-requests
 *   POST /api/hr/leave-requests
 *   POST /api/hr/leave-requests/{request}/decide
 *   GET  /api/hr/employees/{employee}/leave-balances
 */
class HrLeaveController extends Controller
{
    public function __construct(
        private readonly DocumentNumberService $sequences
    ) {}

    public function types()
    {
        return response()->json([
            'success' => true,
            'data' => HrLeaveType::where('is_active', true)
                ->orderBy('code')
                ->get(),
        ]);
    }

    public function index(Request $request)
    {
        $requests = HrLeaveRequest::query()
            ->with([
                'employee:id,employee_number,first_name,last_name,department_id',
                'leaveType:id,code,name,is_paid',
            ])
            ->when(
                $request->filled('status'),
                fn ($q) => $q->where('status', $request->status)
            )
            ->when(
                $request->filled('employee_id'),
                fn ($q) => $q->where('employee_id', $request->employee_id)
            )
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'summary' => [
                'pending' => $requests->where('status', 'pending')->count(),
                'approved_days' => round(
                    (float) $requests->where('status', 'approved')->sum('days_count'),
                    2
                ),
            ],
            'data' => $requests->map(fn ($row) => [
                ...$row->toArray(),
                'employee_name' => trim(
                    $row->employee->first_name . ' ' . $row->employee->last_name
                ),
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:hr_employees,id'],
            'leave_type_id' => ['required', 'integer', 'exists:hr_leave_types,id'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'reason' => ['nullable', 'string', 'max:2000'],
            'attachment_path' => ['nullable', 'string', 'max:255'],
            'substitute_employee_id' => [
                'nullable',
                'integer',
                'exists:hr_employees,id',
                'different:employee_id',
            ],
        ]);

        $employee = HrEmployee::findOrFail($validated['employee_id']);
        $type = HrLeaveType::findOrFail($validated['leave_type_id']);

        $days = $this->countDays(
            $validated['start_date'],
            $validated['end_date']
        );

        $this->assertEligible($employee, $type);
        $this->assertNoOverlap($employee->id, $validated);

        if ($type->requires_attachment && empty($validated['attachment_path'])) {
            throw ValidationException::withMessages([
                'attachment_path' => [
                    'نوع الإجازة ده بيتطلب مرفقًا.',
                ],
            ]);
        }

        if ($type->deducts_balance) {
            $this->assertSufficientBalance($employee->id, $type->id, $days);
        }

        return DB::transaction(function () use ($validated, $days, $type, $employee) {
            $leaveRequest = HrLeaveRequest::create([
                ...$validated,
                'request_number' => $this->sequences->next('leave_request', 'LV'),
                'days_count' => $days,
                'status' => 'pending',
            ]);

            if ($type->deducts_balance) {
                $this->balanceFor($employee->id, $type->id)
                    ->increment('pending_days', $days);
            }

            return response()->json([
                'success' => true,
                'message' => sprintf(
                    'تم تقديم طلب إجازة %s يوم.',
                    rtrim(rtrim(number_format($days, 1), '0'), '.')
                ),
                'data' => $leaveRequest,
            ], 201);
        });
    }

    public function decide(Request $request, HrLeaveRequest $leaveRequest)
    {
        if ($leaveRequest->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' => 'الطلب تم البت فيه بالفعل.',
            ], 422);
        }

        $validated = $request->validate([
            'approve' => ['required', 'boolean'],
            'rejection_reason' => [
                'nullable',
                'required_if:approve,false',
                'string',
                'max:1000',
            ],
        ], [
            'rejection_reason.required_if' => 'سبب الرفض إلزامي.',
        ]);

        $approved = (bool) $validated['approve'];
        $type = $leaveRequest->leaveType;
        $days = (float) $leaveRequest->days_count;

        return DB::transaction(function () use (
            $leaveRequest,
            $validated,
            $approved,
            $type,
            $days,
            $request
        ) {
            $leaveRequest->update([
                'status' => $approved ? 'approved' : 'rejected',
                'approved_by' => $request->user()?->id,
                'approved_at' => now(),
                'rejection_reason' => $approved
                    ? null
                    : $validated['rejection_reason'],
            ]);

            if ($type->deducts_balance) {
                $balance = $this->balanceFor(
                    $leaveRequest->employee_id,
                    $type->id
                );

                $balance->decrement('pending_days', $days);

                if ($approved) {
                    $balance->increment('used_days', $days);
                }
            }

            return response()->json([
                'success' => true,
                'message' => $approved
                    ? 'تم اعتماد الإجازة.'
                    : 'تم رفض الطلب.',
                'data' => $leaveRequest->fresh(),
            ]);
        });
    }

    public function balances(HrEmployee $employee)
    {
        $year = (int) now()->year;

        $balances = HrLeaveBalance::query()
            ->with('leaveType:id,code,name,annual_days,is_paid')
            ->where('employee_id', $employee->id)
            ->where('year', $year)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'employee' => $employee->only([
                    'id', 'employee_number', 'first_name', 'last_name', 'hire_date',
                ]),
                'year' => $year,
                'balances' => $balances->map(fn ($balance) => [
                    'leave_type' => $balance->leaveType,
                    'entitled_days' => (float) $balance->entitled_days,
                    'carried_over_days' => (float) $balance->carried_over_days,
                    'used_days' => (float) $balance->used_days,
                    'pending_days' => (float) $balance->pending_days,
                    'available_days' => round(
                        (float) $balance->entitled_days
                        + (float) $balance->carried_over_days
                        - (float) $balance->used_days
                        - (float) $balance->pending_days,
                        2
                    ),
                ]),
            ],
        ]);
    }

    private function countDays(string $start, string $end): float
    {
        return \Carbon\Carbon::parse($start)
            ->diffInDays(\Carbon\Carbon::parse($end)) + 1;
    }

    /** الاستحقاق حسب النوع والجنس والخدمة. */
    private function assertEligible(HrEmployee $employee, HrLeaveType $type): void
    {
        $months = \Carbon\Carbon::parse($employee->hire_date)
            ->diffInMonths(now());

        if ($months < (int) $type->min_service_months) {
            throw ValidationException::withMessages([
                'leave_type_id' => [
                    sprintf(
                        'نوع الإجازة ده بيتطلب %d شهر خدمة — الموظف عنده %d.',
                        $type->min_service_months,
                        $months
                    ),
                ],
            ]);
        }

        $eligible = match ($type->eligibility) {
            'male' => $employee->gender === 'male',
            'female' => $employee->gender === 'female',
            'muslim' => $employee->religion === 'muslim',
            'saudi' => $employee->nationality_type !== 'expat',
            default => true,
        };

        if (!$eligible) {
            throw ValidationException::withMessages([
                'leave_type_id' => ['الموظف غير مستحق لنوع الإجازة ده.'],
            ]);
        }
    }

    private function assertNoOverlap(int $employeeId, array $data): void
    {
        $overlaps = HrLeaveRequest::query()
            ->where('employee_id', $employeeId)
            ->whereIn('status', ['pending', 'approved'])
            ->where(function ($q) use ($data) {
                $q->whereBetween('start_date', [$data['start_date'], $data['end_date']])
                    ->orWhereBetween('end_date', [$data['start_date'], $data['end_date']])
                    ->orWhere(function ($inner) use ($data) {
                        $inner->where('start_date', '<=', $data['start_date'])
                            ->where('end_date', '>=', $data['end_date']);
                    });
            })
            ->exists();

        if ($overlaps) {
            throw ValidationException::withMessages([
                'start_date' => ['فيه إجازة متعارضة في نفس الفترة.'],
            ]);
        }
    }

    private function assertSufficientBalance(
        int $employeeId,
        int $typeId,
        float $days
    ): void {
        $balance = $this->balanceFor($employeeId, $typeId);

        $available = (float) $balance->entitled_days
            + (float) $balance->carried_over_days
            - (float) $balance->used_days
            - (float) $balance->pending_days;

        if ($days - $available > 0.01) {
            throw ValidationException::withMessages([
                'days_count' => [
                    sprintf(
                        'الرصيد المتاح %s يوم فقط.',
                        rtrim(rtrim(number_format($available, 1), '0'), '.')
                    ),
                ],
            ]);
        }
    }

    private function balanceFor(int $employeeId, int $typeId): HrLeaveBalance
    {
        $type = HrLeaveType::find($typeId);

        return HrLeaveBalance::firstOrCreate(
            [
                'employee_id' => $employeeId,
                'leave_type_id' => $typeId,
                'year' => (int) now()->year,
            ],
            [
                'entitled_days' => $type?->annual_days ?? 0,
            ]
        );
    }
}
