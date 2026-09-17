<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrBranch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HrBranchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = HrBranch::query()->withCount(['departments', 'employees']);
        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")
                ->orWhere('name_en', 'like', "%{$search}%")
                ->orWhere('code', 'like', "%{$search}%"));
        }
        if ($request->has('is_active')) $query->where('is_active', $request->boolean('is_active'));
        return response()->json($query->latest()->paginate($request->integer('per_page', 15)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        $data['created_by'] = $request->user()?->id;
        return response()->json(HrBranch::create($data), 201);
    }

    public function show(HrBranch $hrBranch): JsonResponse
    {
        return response()->json($hrBranch->loadCount(['departments', 'employees']));
    }

    public function update(Request $request, HrBranch $hrBranch): JsonResponse
    {
        $data = $this->validateData($request, $hrBranch->id);
        $data['updated_by'] = $request->user()?->id;
        $hrBranch->update($data);
        return response()->json($hrBranch->fresh());
    }

    public function destroy(HrBranch $hrBranch): JsonResponse
    {
        if ($hrBranch->employees()->exists() || $hrBranch->departments()->exists()) {
            return response()->json(['message' => 'لا يمكن حذف فرع مرتبط بأقسام أو موظفين.'], 422);
        }
        $hrBranch->delete();
        return response()->json(['message' => 'تم حذف الفرع بنجاح.']);
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:30', Rule::unique('hr_branches', 'code')->ignore($id)],
            'name' => ['required', 'string', 'max:255'], 'name_en' => ['nullable', 'string', 'max:255'],
            'country' => ['nullable', 'string', 'max:100'], 'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'], 'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'], 'timezone' => ['nullable', 'timezone'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'], 'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'attendance_radius' => ['nullable', 'integer', 'min:1'], 'is_head_office' => ['boolean'],
            'is_active' => ['boolean'], 'notes' => ['nullable', 'string'],
        ]);
    }
}

