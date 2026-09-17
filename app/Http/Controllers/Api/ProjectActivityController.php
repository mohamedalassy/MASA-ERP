<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectActivity;
use App\Services\ProjectEventService;
use Illuminate\Http\Request;

/**
 * الأنشطة المجدولة على المشروع.
 *
 * المسارات:
 *   GET   /api/projects/{project}/activities
 *   POST  /api/projects/{project}/activities
 *   PUT   /api/projects/{project}/activities/{activity}
 *   POST  /api/projects/{project}/activities/{activity}/complete
 *   GET   /api/my-activities
 */
class ProjectActivityController extends Controller
{
    public function __construct(
        private readonly ProjectEventService $events
    ) {}

    public function index(Request $request, Project $project)
    {
        $activities = ProjectActivity::query()
            ->with(['assignee:id,name'])
            ->where('project_id', $project->id)
            ->when(
                $request->filled('status'),
                fn ($q) => $q->where('status', $request->status),
                fn ($q) => $q->where('status', 'open')
            )
            ->orderBy('due_date')
            ->get()
            ->map(fn ($activity) => $this->transform($activity));

        return response()->json([
            'success' => true,
            'summary' => [
                'open' => $activities->where('status', 'open')->count(),
                'overdue' => $activities->where('is_overdue', true)->count(),
                'due_today' => $activities->where('is_due_today', true)->count(),
            ],
            'data' => $activities->values(),
        ]);
    }

    /** أنشطة المستخدم الحالي عبر كل المشاريع — لوحة "مهامي". */
    public function mine(Request $request)
    {
        $activities = ProjectActivity::query()
            ->with(['project:id,project_code,name'])
            ->where('assigned_to', $request->user()?->id)
            ->where('status', 'open')
            ->orderBy('due_date')
            ->get()
            ->map(fn ($activity) => [
                ...$this->transform($activity),
                'project' => $activity->project,
            ]);

        return response()->json([
            'success' => true,
            'count' => $activities->count(),
            'overdue_count' => $activities->where('is_overdue', true)->count(),
            'data' => $activities->values(),
        ]);
    }

    public function store(Request $request, Project $project)
    {
        $validated = $this->validatePayload($request);

        $activity = ProjectActivity::create([
            ...$validated,
            'project_id' => $project->id,
            'status' => 'open',
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم جدولة النشاط.',
            'data' => $this->transform($activity->load('assignee:id,name')),
        ], 201);
    }

    public function update(
        Request $request,
        Project $project,
        ProjectActivity $activity
    ) {
        $validated = $this->validatePayload($request);

        $activity->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث النشاط.',
            'data' => $this->transform($activity->fresh()->load('assignee:id,name')),
        ]);
    }

    public function complete(
        Request $request,
        Project $project,
        ProjectActivity $activity
    ) {
        $validated = $request->validate([
            'completion_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $activity->update([
            'status' => 'done',
            'completed_at' => now(),
            'completed_by' => $request->user()?->id,
            'completion_note' => $validated['completion_note'] ?? null,
        ]);

        $this->events->log(
            $project,
            'system',
            'إنجاز النشاط: ' . $activity->title,
            meta: $validated['completion_note'] ?? null,
            referenceType: 'project_activity',
            referenceId: $activity->id,
            userId: $request->user()?->id,
            isSystem: true
        );

        return response()->json([
            'success' => true,
            'message' => 'تم إنجاز النشاط.',
            'data' => $this->transform($activity->fresh()),
        ]);
    }

    private function transform(ProjectActivity $activity): array
    {
        $due = $activity->due_date;
        $today = now()->startOfDay();

        $isOverdue = $activity->status === 'open'
            && $due
            && $due->lt($today);

        $daysLate = $isOverdue ? $due->diffInDays($today) : 0;

        return [
            'id' => $activity->id,
            'title' => $activity->title,
            'description' => $activity->description,
            'type' => $activity->type,
            'priority' => $activity->priority,
            'status' => $activity->status,
            'due_date' => $due?->toDateString(),
            'assignee' => $activity->assignee?->name,
            'assigned_to' => $activity->assigned_to,

            'is_overdue' => $isOverdue,
            'days_late' => $daysLate,
            'is_due_today' => $activity->status === 'open'
                && $due
                && $due->isSameDay($today),

            // النص اللي الواجهة بتعرضه مباشرة
            'due_label' => $this->dueLabel($activity, $isOverdue, $daysLate),
        ];
    }

    private function dueLabel(
        ProjectActivity $activity,
        bool $isOverdue,
        int $daysLate
    ): string {
        if ($activity->status === 'done') {
            return 'منجز';
        }

        if ($isOverdue) {
            return 'متأخر ' . $daysLate . ' ' . ($daysLate === 1 ? 'يوم' : 'أيام');
        }

        $due = $activity->due_date;

        if (!$due) {
            return 'بدون موعد';
        }

        if ($due->isToday()) {
            return 'اليوم';
        }

        if ($due->isTomorrow()) {
            return 'غدًا';
        }

        $days = now()->startOfDay()->diffInDays($due);

        return 'بعد ' . $days . ' ' . ($days === 1 ? 'يوم' : 'أيام');
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'type' => [
                'nullable',
                'in:call,meeting,site_visit,document,follow_up,other',
            ],
            'due_date' => ['required', 'date'],
            'priority' => ['nullable', 'in:low,normal,high'],
            'assigned_to' => ['nullable', 'integer', 'exists:users,id'],
        ]);
    }
}
