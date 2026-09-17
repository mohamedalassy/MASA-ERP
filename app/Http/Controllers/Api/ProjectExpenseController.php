<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectExpense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectExpenseController extends Controller
{
    public function index(Project $project): JsonResponse
    {
        $expenses = ProjectExpense::query()
            ->where('project_id', $project->id)
            ->with('creator')
            ->latest('expense_date')
            ->latest('id')
            ->get();

        return response()->json([
            'success' => true,
            'count' => $expenses->count(),
            'total' => round((float) $expenses->sum('amount'), 2),
            'data' => $expenses,
        ]);
    }

    public function store(
        Request $request,
        Project $project
    ): JsonResponse {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'category' => ['nullable', 'string', 'max:100'],
            'amount' => ['required', 'numeric', 'min:0'],
            'expense_date' => ['required', 'date'],
            'attachment_path' => ['nullable', 'string', 'max:500'],
        ]);

        $expense = ProjectExpense::create([
            'project_id' => $project->id,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'category' => $validated['category'] ?? null,
            'amount' => $validated['amount'],
            'expense_date' => $validated['expense_date'],
            'attachment_path' => $validated['attachment_path'] ?? null,
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Project expense created successfully.',
            'data' => $expense->load('creator'),
        ], 201);
    }

    public function destroy(
        Project $project,
        ProjectExpense $expense
    ): JsonResponse {
        if ($expense->project_id !== $project->id) {
            abort(404);
        }

        $expense->delete();

        return response()->json([
            'success' => true,
            'message' => 'Project expense deleted successfully.',
        ]);
    }
}