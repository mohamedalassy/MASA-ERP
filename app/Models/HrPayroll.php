<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HrPayroll extends Model
{
    use HasFactory;

    protected $fillable = [
        'hr_employee_id', 'period_year', 'period_month',
        'basic_salary', 'housing_allowance', 'transport_allowance',
        'other_allowances', 'overtime_amount',
        'absence_deduction', 'late_deduction', 'loan_deduction',
        'gosi_deduction', 'other_deductions',
        'gross_salary', 'total_deductions', 'net_salary',
        'worked_days', 'absent_days', 'overtime_hours',
        'status', 'notes',
        'created_by', 'approved_by', 'approved_at', 'paid_at',
    ];

    protected $casts = [
        'period_year' => 'integer',
        'period_month' => 'integer',
        'basic_salary' => 'decimal:2',
        'housing_allowance' => 'decimal:2',
        'transport_allowance' => 'decimal:2',
        'other_allowances' => 'decimal:2',
        'overtime_amount' => 'decimal:2',
        'absence_deduction' => 'decimal:2',
        'late_deduction' => 'decimal:2',
        'loan_deduction' => 'decimal:2',
        'gosi_deduction' => 'decimal:2',
        'other_deductions' => 'decimal:2',
        'gross_salary' => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'net_salary' => 'decimal:2',
        'worked_days' => 'decimal:2',
        'absent_days' => 'decimal:2',
        'overtime_hours' => 'decimal:2',
        'approved_at' => 'datetime',
        'paid_at' => 'datetime',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(HrEmployee::class, 'hr_employee_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isEditable(): bool
    {
        return in_array($this->status, ['draft', 'pending'], true);
    }
}
