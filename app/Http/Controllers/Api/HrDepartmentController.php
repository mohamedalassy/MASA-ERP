<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrDepartment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HrDepartmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = HrDepartment::with(['branch:id,code,name', 'parent:id,code,name'])->withCount(['children', 'employees']);
        if ($request->filled('branch_id')) $query->where('branch_id', $request->branch_id);
        if ($request->filled('parent_id')) $query->where('parent_id', $request->parent_id);
        if ($request->boolean('roots_only')) $query->whereNull('parent_id');
        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('code', 'like', "%{$search}%"));
        }
        return response()->json($query->orderBy('level')->orderBy('name')->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        $data['level'] = $data['parent_id'] ? (HrDepartment::findOrFail($data['parent_id'])->level + 1) : 1;
        $data['created_by'] = $request->user()?->id;
        return response()->json(HrDepartment::create($data), 201);
    }

    public function show(HrDepartment $hrDepartment): JsonResponse
    {
        return response()->json($hrDepartment->load(['branch', 'parent', 'children'])->loadCount('employees'));
    }

    public function update(Request $request, HrDepartment $hrDepartment): JsonResponse
    {
        $data = $this->validateData($request, $hrDepartment->id);
        if (($data['parent_id'] ?? null) === $hrDepartment->id) return response()->json(['message' => 'لا يمكن جعل القسم تابعًا لنفسه.'], 422);
        $data['level'] = !empty($data['parent_id']) ? (HrDepartment::findOrFail($data['parent_id'])->level + 1) : 1;
        $data['updated_by'] = $request->user()?->id;
        $hrDepartment->update($data);
        return response()->json($hrDepartment->fresh()->load(['branch', 'parent']));
    }

    public function destroy(HrDepartment $hrDepartment): JsonResponse
    {
        if ($hrDepartment->children()->exists() || $hrDepartment->employees()->exists()) {
            return response()->json(['message' => 'لا يمكن حذف قسم مرتبط بأقسام فرعية أو موظفين.'], 422);
        }
        $hrDepartment->delete();
        return response()->json(['message' => 'تم حذف القسم بنجاح.']);
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:30', Rule::unique('hr_departments', 'code')->ignore($id)],
            'name' => ['required', 'string', 'max:255'], 'name_en' => ['nullable', 'string', 'max:255'],
            'parent_id' => ['nullable', 'integer', 'exists:hr_departments,id'], 'branch_id' => ['nullable', 'integer', 'exists:hr_branches,id'],
            'cost_center_code' => ['nullable', 'string', 'max:50'], 'email' => ['nullable', 'email'],
            'phone' => ['nullable', 'string', 'max:30'], 'is_active' => ['boolean'],
            'description' => ['nullable', 'string'], 'notes' => ['nullable', 'string'],
        ]);
    }
}

