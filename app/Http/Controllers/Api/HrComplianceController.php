<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrComplianceAlert;
use App\Services\ComplianceMonitorService;
use Illuminate\Http\Request;

/**
 * لوحة الامتثال.
 *
 * المسارات:
 *   GET  /api/hr/compliance
 *   POST /api/hr/compliance/scan
 *   GET  /api/hr/compliance/alerts
 *   POST /api/hr/compliance/alerts/{alert}/resolve
 */
class HrComplianceController extends Controller
{
    public function __construct(
        private readonly ComplianceMonitorService $monitor
    ) {}

    public function dashboard()
    {
        return response()->json([
            'success' => true,
            'data' => $this->monitor->dashboard(),
        ]);
    }

    public function scan()
    {
        $result = $this->monitor->scan();

        return response()->json([
            'success' => true,
            'message' => sprintf(
                'تم المسح — %d تنبيه.',
                $result['total']
            ),
            'data' => $result,
        ]);
    }

    public function alerts(Request $request)
    {
        $alerts = HrComplianceAlert::query()
            ->with('employee:id,employee_number,first_name,last_name')
            ->when(
                $request->filled('severity'),
                fn ($q) => $q->where('severity', $request->severity)
            )
            ->when(
                $request->filled('type'),
                fn ($q) => $q->where('type', $request->type)
            )
            ->when(
                $request->filled('status'),
                fn ($q) => $q->where('status', $request->status),
                fn ($q) => $q->where('status', 'open')
            )
            ->orderByRaw("
                CASE severity
                    WHEN 'critical' THEN 1
                    WHEN 'warning' THEN 2
                    ELSE 3
                END
            ")
            ->orderBy('days_remaining')
            ->get();

        return response()->json([
            'success' => true,
            'count' => $alerts->count(),
            'financial_exposure' => round(
                (float) $alerts->sum('potential_penalty'),
                2
            ),
            'data' => $alerts->map(fn ($alert) => [
                ...$alert->toArray(),
                'employee_name' => $alert->employee
                    ? trim(
                        $alert->employee->first_name . ' ' .
                        $alert->employee->last_name
                    )
                    : null,
            ]),
        ]);
    }

    public function resolve(Request $request, HrComplianceAlert $alert)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:acknowledged,resolved,dismissed'],
            'resolution_note' => [
                'nullable',
                'required_if:status,dismissed',
                'string',
                'max:1000',
            ],
        ], [
            'resolution_note.required_if' =>
                'سبب تجاهل التنبيه إلزامي.',
        ]);

        $alert->update([
            'status' => $validated['status'],
            'resolved_by' => $request->user()?->id,
            'resolved_at' => now(),
            'resolution_note' => $validated['resolution_note'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث التنبيه.',
            'data' => $alert->fresh(),
        ]);
    }
}
