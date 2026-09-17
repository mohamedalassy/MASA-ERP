<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrAttendanceDaily;
use App\Models\HrAttendanceDevice;
use App\Models\HrEmployee;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HrAttendanceSummaryController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $date = Carbon::parse($request->input('date', now()->toDateString()))->toDateString();
        $branchId = $request->integer('branch_id') ?: null;

        $daily = HrAttendanceDaily::query()->whereDate('attendance_date', $date);
        $employees = HrEmployee::query()->where('status', 'active');

        if ($branchId) {
            $daily->where('branch_id', $branchId);
            $employees->where('branch_id', $branchId);
        }

        $activeEmployees = $employees->count();
        $present = (clone $daily)->whereIn('status', ['present', 'late', 'incomplete'])->count();
        $late = (clone $daily)->where('late_minutes', '>', 0)->count();
        $absentRecorded = (clone $daily)->where('status', 'absent')->count();

        return response()->json([
            'date' => $date,
            'today' => [
                'active_employees' => $activeEmployees,
                'present' => $present,
                'on_time' => max(0, $present - $late),
                'late' => $late,
                'absent' => max($absentRecorded, $activeEmployees - $present),
                'incomplete' => (clone $daily)->where('status', 'incomplete')->count(),
                'worked_minutes' => (int) (clone $daily)->sum('worked_minutes'),
                'overtime_minutes' => (int) (clone $daily)->sum('overtime_minutes'),
            ],
            'devices' => [
                'total' => HrAttendanceDevice::where('is_active', true)->count(),
                'online' => HrAttendanceDevice::where('is_active', true)->where('status', 'online')->count(),
                'offline' => HrAttendanceDevice::where('is_active', true)->where('status', 'offline')->count(),
                'error' => HrAttendanceDevice::where('is_active', true)->where('status', 'error')->count(),
            ],
        ]);
    }
}
