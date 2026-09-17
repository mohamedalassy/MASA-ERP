<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrEmployee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class HrEmployeeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = HrEmployee::with(['branch:id,code,name','department:id,code,name','jobTitle:id,code,name','shift:id,code,name','manager:id,employee_number,first_name,last_name']);
        foreach (['branch_id','department_id','job_title_id','shift_id','status','employment_type'] as $filter) if ($request->filled($filter)) $q->where($filter,$request->$filter);
        if ($request->filled('search')) { $s=$request->string('search'); $q->where(fn($x)=>$x->where('employee_number','like',"%{$s}%")->orWhere('first_name','like',"%{$s}%")->orWhere('last_name','like',"%{$s}%")->orWhere('national_id','like',"%{$s}%")->orWhere('mobile','like',"%{$s}%")); }
        return response()->json($q->latest()->paginate($request->integer('per_page',20)));
    }

    public function store(Request $request): JsonResponse
    {
        $data=$this->validateData($request); $data['created_by']=$request->user()?->id;
        $employee=DB::transaction(fn()=>HrEmployee::create($data));
        return response()->json($employee->load(['branch','department','jobTitle','shift']),201);
    }

    public function show(HrEmployee $hrEmployee): JsonResponse
    {
        return response()->json($hrEmployee->load(['user','branch','department','jobTitle','shift','manager','contracts','documents']));
    }

    public function update(Request $request,HrEmployee $hrEmployee): JsonResponse
    {
        $data=$this->validateData($request,$hrEmployee->id); $data['updated_by']=$request->user()?->id;
        DB::transaction(fn()=>$hrEmployee->update($data));
        return response()->json($hrEmployee->fresh()->load(['branch','department','jobTitle','shift','manager']));
    }

    public function destroy(HrEmployee $hrEmployee): JsonResponse
    {
        if($hrEmployee->subordinates()->exists()) return response()->json(['message'=>'انقل الموظفين التابعين إلى مدير آخر أولًا.'],422);
        $hrEmployee->delete(); return response()->json(['message'=>'تم أرشفة الموظف بنجاح.']);
    }

    private function validateData(Request $request,?int $id=null): array
    {
        return $request->validate([
            'employee_number'=>['required','string','max:30',Rule::unique('hr_employees','employee_number')->ignore($id)],
            'user_id'=>['nullable','integer','exists:users,id',Rule::unique('hr_employees','user_id')->ignore($id)],
            'first_name'=>['required','string','max:100'],'middle_name'=>['nullable','string','max:100'],'last_name'=>['required','string','max:100'],'name_en'=>['nullable','string','max:255'],
            'national_id'=>['nullable','string','max:30',Rule::unique('hr_employees','national_id')->ignore($id)],'passport_number'=>['nullable','string','max:30',Rule::unique('hr_employees','passport_number')->ignore($id)],
            'nationality'=>['nullable','string','max:60'],'gender'=>['nullable',Rule::in(['male','female'])],'birth_date'=>['nullable','date','before:today'],'marital_status'=>['nullable','string','max:30'],
            'work_email'=>['nullable','email',Rule::unique('hr_employees','work_email')->ignore($id)],'personal_email'=>['nullable','email'],'mobile'=>['nullable','string','max:30'],'emergency_phone'=>['nullable','string','max:30'],
            'address'=>['nullable','string','max:255'],'photo_path'=>['nullable','string','max:255'],'branch_id'=>['nullable','exists:hr_branches,id'],'department_id'=>['nullable','exists:hr_departments,id'],
            'job_title_id'=>['nullable','exists:hr_job_titles,id'],'shift_id'=>['nullable','exists:hr_shifts,id'],'manager_id'=>['nullable','integer','exists:hr_employees,id',Rule::notIn([$id])],
            'biometric_user_id'=>['nullable','string','max:60'],'hire_date'=>['nullable','date'],'probation_end_date'=>['nullable','date','after_or_equal:hire_date'],
            'employment_type'=>['required',Rule::in(['full_time','part_time','contract','temporary','intern'])],'status'=>['required',Rule::in(['draft','active','on_leave','suspended','terminated'])],
            'termination_date'=>['nullable','date'],'termination_reason'=>['nullable','string'],'bank_name'=>['nullable','string','max:255'],'iban'=>['nullable','string','max:40'],
            'is_active'=>['boolean'],'notes'=>['nullable','string'],
        ]);
    }
}

