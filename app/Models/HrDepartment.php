<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\SoftDeletes;
class HrDepartment extends Model { use HasFactory, SoftDeletes; protected $fillable=['code','name','name_en','parent_id','branch_id','level','cost_center_code','email','phone','is_active','description','notes','created_by','updated_by']; protected $casts=['level'=>'integer','is_active'=>'boolean']; public function parent(){return $this->belongsTo(self::class,'parent_id');} public function children(){return $this->hasMany(self::class,'parent_id');} public function branch(){return $this->belongsTo(HrBranch::class,'branch_id');} public function jobTitles(){return $this->hasMany(HrJobTitle::class,'department_id');} public function employees(){return $this->hasMany(HrEmployee::class,'department_id');} }

