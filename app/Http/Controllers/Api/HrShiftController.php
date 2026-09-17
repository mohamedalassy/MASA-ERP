<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrShift;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HrShiftController extends Controller
{
    public function index(Request $request): JsonResponse { $q=HrShift::withCount('employees'); if($request->filled('search')){$s=$request->string('search');$q->where(fn($x)=>$x->where('name','like',"%{$s}%")->orWhere('code','like',"%{$s}%"));} return response()->json($q->orderBy('start_time')->paginate($request->integer('per_page',20))); }
    public function store(Request $request): JsonResponse { $data=$this->validateData($request); $data['created_by']=$request->user()?->id; return response()->json(HrShift::create($data),201); }
    public function show(HrShift $hrShift): JsonResponse { return response()->json($hrShift->loadCount('employees')); }
    public function update(Request $request,HrShift $hrShift): JsonResponse { $data=$this->validateData($request,$hrShift->id);$data['updated_by']=$request->user()?->id;$hrShift->update($data);return response()->json($hrShift->fresh()); }
    public function destroy(HrShift $hrShift): JsonResponse { if($hrShift->employees()->exists())return response()->json(['message'=>'لا يمكن حذف وردية مرتبطة بموظفين.'],422);$hrShift->delete();return response()->json(['message'=>'تم حذف الوردية.']); }
    private function validateData(Request $request,?int $id=null): array { return $request->validate([
        'code'=>['required','string','max:30',Rule::unique('hr_shifts','code')->ignore($id)], 'name'=>['required','string','max:255'], 'name_en'=>['nullable','string','max:255'],
        'start_time'=>['required','date_format:H:i'], 'end_time'=>['required','date_format:H:i'], 'crosses_midnight'=>['boolean'], 'required_minutes'=>['required','integer','min:1','max:1440'],
        'late_grace_minutes'=>['integer','min:0'], 'early_leave_grace_minutes'=>['integer','min:0'], 'break_minutes'=>['integer','min:0'], 'is_flexible'=>['boolean'],
        'overtime_allowed'=>['boolean'], 'overtime_after_minutes'=>['integer','min:0'], 'working_days'=>['nullable','array'], 'working_days.*'=>['integer','between:0,6'],
        'is_active'=>['boolean'], 'notes'=>['nullable','string'],
    ]); }
}

