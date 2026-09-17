<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectWorkflowHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Project::query()
            ->withCount([
                'quotations',
                'purchaseOrders',
                'financialTransactions',
            ])
            ->latest();

        if ($request->filled('stage')) {
            $query->where('current_stage', $request->stage);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('execution_status')) {
            $query->where(
                'execution_status',
                $request->execution_status
            );
        }

        if ($request->filled('search')) {
            $search = trim($request->search);

            $query->where(function ($q) use ($search) {
                $q->where('project_code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('customer_name', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%");
            });
        }

        $perPage = max(
            1,
            min((int) $request->input('per_page', 20), 100)
        );

        return response()->json(
            $query->paginate($perPage)
        );
    }

    public function show(Project $project): JsonResponse
    {
        $project->load([
            'creator',
            'workflowHistory',
            'notes',
            'attachments',
            'quotations',
            'purchaseOrders',
            'financialTransactions',
        ]);

        return response()->json($project);
    }

    public function moveToNextStage(
        Request $request,
        Project $project
    ): JsonResponse {
        $nextStage = $project->getNextStage();

        if (!$nextStage) {
            return response()->json([
                'message' => 'Project cannot move to the next stage.',
            ], 422);
        }

        return $this->moveToStage(
            $request,
            $project,
            $nextStage
        );
    }

    public function moveToPreviousStage(
        Request $request,
        Project $project
    ): JsonResponse {
        $previousStage = $project->getPreviousStage();

        if (!$previousStage) {
            return response()->json([
                'message' => 'Project cannot move to the previous stage.',
            ], 422);
        }

        return $this->moveToStage(
            $request,
            $project,
            $previousStage
        );
    }

    public function returnToStage(
        Request $request,
        Project $project
    ): JsonResponse {
        $data = $request->validate([
            'stage' => [
                'required',
                'string',
                'in:crm,sales,pricing,purchasing,finance,execution,closed',
            ],
            'reason' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        if ($data['stage'] === $project->current_stage) {
            return response()->json([
                'message' => 'Project is already in this stage.',
            ], 422);
        }

        return $this->moveToStage(
            $request,
            $project,
            $data['stage']
        );
    }

    public function updateExecutionStatus(
        Request $request,
        Project $project
    ): JsonResponse {
        $data = $request->validate([
            'execution_status' => [
                'required',
                'string',
                'max:100',
            ],
        ]);

        $project->update([
            'execution_status' => $data['execution_status'],
        ]);

        return response()->json([
            'message' => 'Execution status updated successfully.',
            'project' => $project->fresh(),
        ]);
    }

    public function holdExecution(
        Request $request,
        Project $project
    ): JsonResponse {
        $data = $request->validate([
            'reason' => [
                'required',
                'string',
                'max:2000',
            ],
        ]);

        $project->update([
            'execution_status' => 'on_hold',
            'execution_hold_reason' => $data['reason'],
            'execution_hold_at' => now(),
        ]);

        return response()->json([
            'message' => 'Project execution placed on hold.',
            'project' => $project->fresh(),
        ]);
    }

    public function resumeExecution(
        Project $project
    ): JsonResponse {
        $project->update([
            'execution_status' => 'in_progress',
            'execution_hold_reason' => null,
            'execution_resumed_at' => now(),
        ]);

        return response()->json([
            'message' => 'Project execution resumed.',
            'project' => $project->fresh(),
        ]);
    }

    private function moveToStage(
        Request $request,
        Project $project,
        string $targetStage
    ): JsonResponse {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);

        return DB::transaction(
            function () use (
                $request,
                $project,
                $targetStage,
                $data
            ) {
                $fromStage = $project->current_stage;

                ProjectWorkflowHistory::create([
                    'project_id' => $project->id,
                    'from_stage' => $fromStage,
                    'to_stage' => $targetStage,
                    'reason' => $data['reason'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'transferred_by' => $request->user()?->id,
                    'transferred_at' => now(),
                    'reception_status' => 'pending',
                ]);

                $project->update([
                    'current_stage' => $targetStage,
                ]);

                return response()->json([
                    'message' => 'Project stage updated successfully.',
                    'project' => $project->fresh([
                        'workflowHistory',
                    ]),
                ]);
            }
        );
    }
}