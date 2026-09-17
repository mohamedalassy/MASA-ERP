<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectStageRequirement;
use App\Services\StageGateService;
use Illuminate\Http\Request;

/**
 * بوابة الانتقال بين الأقسام.
 *
 * المسارات:
 *   GET  /api/projects/{project}/stage-gate
 *   POST /api/projects/{project}/stage-gate/{requirement}/satisfy
 *   POST /api/projects/{project}/stage-gate/{requirement}/waive
 */
class ProjectStageGateController extends Controller
{
    public function __construct(
        private readonly StageGateService $gate
    ) {}

    public function show(Request $request, Project $project)
    {
        $gate = $this->gate->evaluate(
            $project,
            $request->input('to_stage')
        );

        return response()->json([
            'success' => true,
            'data' => [
                'current_stage' => $project->current_stage,
                'next_stage' => $project->getNextStage(),
                ...$gate,
            ],
        ]);
    }

    public function satisfy(
        Request $request,
        Project $project,
        ProjectStageRequirement $requirement
    ) {
        $validated = $request->validate([
            'evidence' => ['nullable', 'string', 'max:2000'],
        ]);

        $check = $this->gate->satisfy(
            $project,
            $requirement,
            $validated['evidence'] ?? null,
            $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'message' => 'تم استيفاء الشرط.',
            'data' => [
                'check' => $check,
                'gate' => $this->gate->evaluate($project),
            ],
        ]);
    }

    public function waive(
        Request $request,
        Project $project,
        ProjectStageRequirement $requirement
    ) {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:1000'],
        ], [
            'reason.required' => 'سبب التجاوز إلزامي.',
            'reason.min' => 'اكتب سببًا واضحًا للتجاوز (١٠ أحرف على الأقل).',
        ]);

        $check = $this->gate->waive(
            $project,
            $requirement,
            $validated['reason'],
            $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تجاوز الشرط وتسجيل السبب في سجل المشروع.',
            'data' => [
                'check' => $check,
                'gate' => $this->gate->evaluate($project),
            ],
        ]);
    }
}
