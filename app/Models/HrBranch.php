<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\SoftDeletes;
class HrBranch extends Model { use HasFactory, SoftDeletes; protected $fillable=['code','name','name_en','country','city','address','phone','email','timezone','latitude','longitude','attendance_radius','is_head_office','is_active','notes','created_by','updated_by']; protected $casts=['latitude'=>'decimal:7','longitude'=>'decimal:7','is_head_office'=>'boolean','is_active'=>'boolean']; public function departments(){return $this->hasMany(HrDepartment::class,'branch_id');} public function employees(){return $this->hasMany(HrEmployee::class,'branch_id');} }

