<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory; use Illuminate\Database\Eloquent\Model; use Illuminate\Database\Eloquent\SoftDeletes;
class HrShift extends Model { use HasFactory, SoftDeletes; protected $fillable=['code','name','name_en','start_time','end_time','crosses_midnight','required_minutes','late_grace_minutes','early_leave_grace_minutes','break_minutes','is_flexible','overtime_allowed','overtime_after_minutes','working_days','is_active','notes','created_by','updated_by']; protected $casts=['crosses_midnight'=>'boolean','is_flexible'=>'boolean','overtime_allowed'=>'boolean','working_days'=>'array','is_active'=>'boolean']; public function employees(){return $this->hasMany(HrEmployee::class,'shift_id');} }

