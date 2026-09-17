<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectEvent;
use App\Services\ProjectEventService;
use Illuminate\Http\Request;

/**
 * السجل الموحّد للمشروع — الأحداث والمحادثة.
 *
 * المسارات:
 *   GET    /api/projects/{project}/events
 *   POST   /api/projects/{project}/events
 *   DELETE /api/projects/{project}/events/{event}
 */
class ProjectEventController extends Controller
{
    public function __construct(
        private readonly ProjectEventService $events
    ) {}

    public function index(Request $request, Project $project)
    {
        $query = ProjectEvent::query()
            ->with('author:id,name')
            ->where('project_id', $project->id);

        // فلاتر الشاشة: الكل · محادثة · انتقالات · موافقات · موقع · مالية · مشتريات
        if ($request->filled('category') && $request->category !== 'all') {
            $categories = $request->category === 'message'
                ? ['message', 'note']
                : [$request->category];

            $query->whereIn('category', $categories);
        }

        if ($request->boolean('exclude_internal')) {
            $query->where('is_internal', false);
        }

        $events = $query
            ->orderByDesc('created_at')
            ->limit((int) $request->input('limit', 80))
            ->get();

        return response()->json([
            'success' => true,
            'counts' => ProjectEvent::query()
                ->where('project_id', $project->id)
                ->selectRaw('category, COUNT(*) as total')
                ->groupBy('category')
                ->pluck('total', 'category'),
            'data' => $events->map(fn ($event) => [
                'id' => $event->id,
                'category' => $event->category,
                'body' => $event->body,
                'meta' => $event->meta,
                'reference_type' => $event->reference_type,
                'reference_id' => $event->reference_id,
                'is_system' => (bool) $event->is_system,
                'is_internal' => (bool) $event->is_internal,
                'actor' => $event->author?->name ?? 'النظام',
                'created_at' => $event->created_at,
            ]),
        ]);
    }

    public function store(Request $request, Project $project)
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'is_internal' => ['nullable', 'boolean'],
        ]);

        $event = $this->events->comment(
            $project,
            $validated['body'],
            $request->user()?->id,
            (bool) ($validated['is_internal'] ?? false)
        );

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة التعليق.',
            'data' => $event->load('author:id,name'),
        ], 201);
    }

    /** أحداث النظام لا تُحذف — السجل لازم يبقى كامل للتدقيق. */
    public function destroy(Project $project, ProjectEvent $event)
    {
        if ($event->is_system) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن حذف أحداث النظام.',
            ], 422);
        }

        $event->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف التعليق.',
        ]);
    }
}
