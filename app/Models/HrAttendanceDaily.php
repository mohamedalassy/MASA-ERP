<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrAttendanceDaily extends Model
{
    use HasFactory;

    protected $table = 'hr_attendance_daily';

    protected $fillable = [
        'employee_id', 'attendance_date', 'shift_id', 'branch_id',
        'first_in_at', 'last_out_at', 'scheduled_start_at', 'scheduled_end_at',
        'worked_minutes', 'late_minutes', 'early_leave_minutes',
        'overtime_minutes', 'break_minutes', 'status', 'source', 'notes',
        'calculated_at', 'updated_by',
    ];

    protected $casts = [
        'attendance_date' => 'date',
        'first_in_at' => 'datetime',
        'last_out_at' => 'datetime',
        'scheduled_start_at' => 'datetime',
        'scheduled_end_at' => 'datetime',
        'worked_minutes' => 'integer',
        'late_minutes' => 'integer',
        'early_leave_minutes' => 'integer',
        'overtime_minutes' => 'integer',
        'break_minutes' => 'integer',
        'calculated_at' => 'datetime',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(HrEmployee::class, 'employee_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(HrShift::class, 'shift_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(HrBranch::class, 'branch_id');
    }
}
