<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HrEmployeeContract extends Model
{
    use HasFactory;

    protected $fillable = [
        'hr_employee_id', 'contract_number', 'contract_type',
        'start_date', 'end_date', 'probation_end_date',
        'basic_salary', 'housing_allowance', 'transport_allowance',
        'other_allowances', 'annual_leave_days',
        'working_hours_per_day', 'status', 'notes', 'document_path',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'probation_end_date' => 'date',
        'basic_salary' => 'decimal:2',
        'housing_allowance' => 'decimal:2',
        'transport_allowance' => 'decimal:2',
        'other_allowances' => 'decimal:2',
        'annual_leave_days' => 'integer',
        'working_hours_per_day' => 'decimal:2',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(HrEmployee::class, 'hr_employee_id');
    }

    /** إجمالي الأجر الشهري — أساس احتساب الراتب. */
    public function getGrossSalaryAttribute(): float
    {
        return round(
            (float) $this->basic_salary
            + (float) $this->housing_allowance
            + (float) $this->transport_allowance
            + (float) $this->other_allowances,
            2
        );
    }

    public function isActive(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }

        return !$this->end_date || $this->end_date->isFuture();
    }

    public function isExpiringWithin(int $days = 60): bool
    {
        return $this->end_date
            && $this->end_date->isFuture()
            && $this->end_date->diffInDays(now()) <= $days;
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
