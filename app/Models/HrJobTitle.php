<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\SoftDeletes;
class HrJobTitle extends Model { use HasFactory, SoftDeletes; protected $fillable=['code','name','name_en','department_id','grade','min_experience_years','min_salary','max_salary','description','responsibilities','requirements','is_active','created_by','updated_by']; protected $casts=['min_salary'=>'decimal:2','max_salary'=>'decimal:2','is_active'=>'boolean']; public function department(){return $this->belongsTo(HrDepartment::class,'department_id');} public function employees(){return $this->hasMany(HrEmployee::class,'job_title_id');} }

