<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectSiteCheckin;
use App\Services\SiteCheckinService;
use Illuminate\Http\Request;

/**
 * بصمة المهندس من صفحة المشروع.
 *
 * المسارات:
 *   GET  /api/projects/{project}/site-checkins
 *   POST /api/projects/{project}/site-checkins/check-in
 *   POST /api/projects/{project}/site-checkins/{checkin}/check-out
 *   POST /api/projects/{project}/site-checkins/{checkin}/approve
 */
class ProjectSiteCheckinController extends Controller
{
    public function __construct(
        private readonly SiteCheckinService $checkins
    ) {}

    public function index(Request $request, Project $project)
    {
        $rows = ProjectSiteCheckin::query()
            ->with('user:id,name')
            ->where('project_id', $project->id)
            ->orderByDesc('checked_in_at')
            ->limit((int) $request->input('limit', 30))
            ->get();

        $userId = $request->user()?->id;

        $openForMe = $rows->firstWhere(
            fn ($row) => $row->status === 'open' && $row->user_id === $userId
        );

        $totalMinutes = (int) $rows->sum('duration_minutes');

        return response()->json([
            'success' => true,
            'site' => [
                'address' => $project->site_address,
                'latitude' => $project->site_latitude,
                'longitude' => $project->site_longitude,
                'geofence_meters' => $project->site_geofence_meters,
                'requires_photo' => (bool) $project->site_requires_photo,
                'is_configured' => $project->site_latitude !== null,
            ],
            'summary' => [
                'visits_count' => $rows->whereNotNull('checked_out_at')->count(),
                'total_hours' => round($totalMinutes / 60, 1),
                'open_checkin_id' => $openForMe?->id,
                'needs_approval_count' => $rows
                    ->where('verification_status', '!=', 'verified')
                    ->where('status', 'closed')
                    ->count(),
            ],
            'data' => $rows->map(fn ($row) => [
                'id' => $row->id,
                'engineer' => $row->user?->name,
                'checked_in_at' => $row->checked_in_at,
                'checked_out_at' => $row->checked_out_at,
                'duration_minutes' => $row->duration_minutes,
                'duration_label' => $this->durationLabel($row),
                'distance_meters' => $row->checkin_distance_meters,
                'verification_status' => $row->verification_status,
                'status' => $row->status,
                'work_summary' => $row->work_summary,
                'photo_path' => $row->checkin_photo_path,
            ]),
        ]);
    }

    public function checkIn(Request $request, Project $project)
    {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'photo_path' => ['nullable', 'string', 'max:255'],
        ]);

        $checkin = $this->checkins->checkIn(
            $project,
            $request->user()?->id ?? 0,
            $validated
        );

        return response()->json([
            'success' => true,
            'message' => $checkin->verification_status === 'verified'
                ? 'تم تسجيل الحضور — داخل نطاق الموقع.'
                : 'تم تسجيل الحضور، لكنه يحتاج اعتماد مشرف.',
            'data' => $checkin,
        ], 201);
    }

    public function checkOut(
        Request $request,
        Project $project,
        ProjectSiteCheckin $checkin
    ) {
        $validated = $request->validate([
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'work_summary' => ['nullable', 'string', 'max:2000'],
        ]);

        $updated = $this->checkins->checkOut($checkin, $validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الانصراف. المدة ' . $this->durationLabel($updated),
            'data' => $updated,
        ]);
    }

    public function approve(
        Request $request,
        Project $project,
        ProjectSiteCheckin $checkin
    ) {
        $validated = $request->validate([
            'approve' => ['required', 'boolean'],
            'rejection_reason' => [
                'nullable',
                'required_if:approve,false',
                'string',
                'max:1000',
            ],
        ]);

        $approved = (bool) $validated['approve'];

        $checkin->update([
            'status' => $approved ? 'approved' : 'rejected',
            'approved_by' => $request->user()?->id,
            'approved_at' => now(),
            'rejection_reason' => $approved
                ? null
                : $validated['rejection_reason'],
        ]);

        return response()->json([
            'success' => true,
            'message' => $approved
                ? 'تم اعتماد سجل الحضور.'
                : 'تم رفض سجل الحضور.',
            'data' => $checkin->fresh(),
        ]);
    }

    private function durationLabel(ProjectSiteCheckin $checkin): string
    {
        $minutes = (int) $checkin->duration_minutes;

        if ($minutes <= 0) {
            return $checkin->status === 'open' ? 'جاري' : '—';
        }

        $hours = intdiv($minutes, 60);
        $rest = $minutes % 60;

        return $hours > 0 ? "{$hours}:" . str_pad((string) $rest, 2, '0', STR_PAD_LEFT) : "{$rest} د";
    }
}
