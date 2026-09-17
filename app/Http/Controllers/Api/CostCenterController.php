<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CostCenter;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CostCenterController extends Controller
{
    public function index(Request $request)
    {
        $query = CostCenter::query()
            ->with('parent:id,code,name');

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere(
                        'name',
                        'like',
                        "%{$search}%"
                    );
            });
        }

        if ($request->filled('active')) {
            $query->where(
                'is_active',
                filter_var(
                    $request->active,
                    FILTER_VALIDATE_BOOLEAN
                )
            );
        }

        $centers = $query
            ->orderBy('code')
            ->get();

        return response()->json([
            'success' => true,
            'count' => $centers->count(),
            'data' => $centers,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:50',
                'unique:cost_centers,code',
            ],

            'name' => [
                'required',
                'string',
                'max:255',
            ],

            'description' => [
                'nullable',
                'string',
            ],

            'parent_id' => [
                'nullable',
                'integer',
                'exists:cost_centers,id',
            ],

            'is_active' => [
                'nullable',
                'boolean',
            ],
        ]);

        $center = CostCenter::create([
            ...$validated,

            'is_active' =>
                $validated['is_active'] ?? true,

            'created_by' =>
                $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'تم إنشاء مركز التكلفة بنجاح.',
            'data' =>
                $center->load('parent'),
        ], 201);
    }

    public function show(CostCenter $costCenter)
    {
        return response()->json([
            'success' => true,
            'data' => $costCenter->load([
                'parent',
                'children',
            ]),
        ]);
    }

    public function update(
        Request $request,
        CostCenter $costCenter
    ) {
        $validated = $request->validate([
            'code' => [
                'sometimes',
                'required',
                'string',
                'max:50',

                Rule::unique(
                    'cost_centers',
                    'code'
                )->ignore($costCenter->id),
            ],

            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],

            'description' => [
                'nullable',
                'string',
            ],

            'parent_id' => [
                'nullable',
                'integer',
                'exists:cost_centers,id',
            ],

            'is_active' => [
                'nullable',
                'boolean',
            ],
        ]);

        if (
            array_key_exists('parent_id', $validated) &&
            (int) ($validated['parent_id'] ?? 0) ===
            (int) $costCenter->id
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن جعل مركز التكلفة تابعًا لنفسه.',
            ], 422);
        }

        $costCenter->update($validated);

        return response()->json([
            'success' => true,
            'message' =>
                'تم تحديث مركز التكلفة بنجاح.',
            'data' =>
                $costCenter
                    ->fresh()
                    ->load('parent'),
        ]);
    }

    public function destroy(CostCenter $costCenter)
    {
        if ($costCenter->children()->exists()) {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن حذف مركز تكلفة يحتوي على مراكز فرعية.',
            ], 422);
        }

        if ($costCenter->journalLines()->exists()) {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن حذف مركز تكلفة مستخدم في قيود.',
            ], 422);
        }

        $costCenter->delete();

        return response()->json([
            'success' => true,
            'message' =>
                'تم حذف مركز التكلفة بنجاح.',
        ]);
    }
}