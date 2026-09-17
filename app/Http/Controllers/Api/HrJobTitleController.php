<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrJobTitle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HrJobTitleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = HrJobTitle::with('department:id,code,name')->withCount('employees');
        if ($request->filled('department_id')) $query->where('department_id', $request->department_id);
        if ($request->filled('search')) { $s = $request->string('search'); $query->where(fn($q) => $q->where('name','like',"%{$s}%")->orWhere('code','like',"%{$s}%")); }
        return response()->json($query->orderBy('name')->paginate($request->integer('per_page', 20)));
    }
    public function store(Request $request): JsonResponse { $data=$this->validateData($request); $data['created_by']=$request->user()?->id; return response()->json(HrJobTitle::create($data),201); }
    public function show(HrJobTitle $hrJobTitle): JsonResponse { return response()->json($hrJobTitle->load('department')->loadCount('employees')); }
    public function update(Request $request, HrJobTitle $hrJobTitle): JsonResponse { $data=$this->validateData($request,$hrJobTitle->id); $data['updated_by']=$request->user()?->id; $hrJobTitle->update($data); return response()->json($hrJobTitle->fresh()->load('department')); }
    public function destroy(HrJobTitle $hrJobTitle): JsonResponse { if($hrJobTitle->employees()->exists()) return response()->json(['message'=>'لا يمكن حذف مسمى مرتبط بموظفين.'],422); $hrJobTitle->delete(); return response()->json(['message'=>'تم حذف المسمى الوظيفي.']); }
    private function validateData(Request $request, ?int $id=null): array { return $request->validate([
        'code'=>['required','string','max:30',Rule::unique('hr_job_titles','code')->ignore($id)], 'name'=>['required','string','max:255'],
        'name_en'=>['nullable','string','max:255'], 'department_id'=>['nullable','exists:hr_departments,id'], 'grade'=>['nullable','string','max:30'],
        'min_experience_years'=>['integer','min:0'], 'min_salary'=>['nullable','numeric','min:0'], 'max_salary'=>['nullable','numeric','gte:min_salary'],
        'description'=>['nullable','string'], 'responsibilities'=>['nullable','string'], 'requirements'=>['nullable','string'], 'is_active'=>['boolean'],
    ]); }
}

