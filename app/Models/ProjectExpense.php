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
            'total' => round(
                (float) $expenses->sum('amount'),
                2
            ),
           