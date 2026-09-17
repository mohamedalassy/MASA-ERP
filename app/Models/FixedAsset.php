<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FixedAsset extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'name', 'description', 'category', 'serial_number',
        'location', 'asset_account_id', 'depreciation_account_id',
        'expense_account_id', 'cost_center_id',
        'purchase_date', 'cost', 'salvage_value', 'useful_life_months',
        'depreciation_method', 'accumulated_depreciation',
        'depreciation_start_date', 'last_depreciation_date', 'status',
        // حقول الاستبعاد من الهجرة الموجودة 2026_08_31_150000
        'disposal_date', 'disposal_proceeds', 'disposal_type', 'disposal_notes',
        'created_by',
    ];

    protected $casts = [
        'purchase_date' => 'date',
        'cost' => 'decimal:2',
        'salvage_value' => 'decimal:2',
        'useful_life_months' => 'integer',
        'accumulated_depreciation' => 'decimal:2',
        'depreciation_start_date' => 'date',
        'last_depreciation_date' => 'date',
        'disposal_date' => 'date',
        'disposal_proceeds' => 'decimal:2',
    ];

    public function assetAccount(): BelongsTo
    {
        return $this->belongsTo(FinanceAccount::class, 'asset_account_id');
    }

    public function depreciationAccount(): BelongsTo
    {
        return $this->belongsTo(FinanceAccount::class, 'depreciation_account_id');
    }

    public function expenseAccount(): BelongsTo
    {
        return $this->belongsTo(FinanceAccount::class, 'expense_account_id');
    }

    public function costCenter(): BelongsTo
    {
        return $this->belongsTo(CostCenter::class);
    }

    public function depreciations(): HasMany
    {
        return $this->hasMany(FixedAssetDepreciation::class)
            ->orderByDesc('period_year')
            ->orderByDesc('period_month');
    }

    /** القيمة الدفترية = التكلفة − الإهلاك المتراكم. */
    public function getBookValueAttribute(): float
    {
        return round(
            (float) $this->cost - (float) $this->accumulated_depreciation,
            2
        );
    }

    /** القيمة القابلة للإهلاك = التكلفة − القيمة التخريدية. */
    public function getDepreciableBaseAttribute(): float
    {
        return round(
            max(0, (float) $this->cost - (float) $this->salvage_value),
            2
        );
    }

    /**
     * قسط الإهلاك الشهري.
     *
     * القسط الأخير يُقصّ عند المتبقي بالظبط، عشان الإهلاك المتراكم
     * ما يتعداش القيمة القابلة للإهلاك بفرق هللة.
     */
    public function monthlyDepreciation(): float
    {
        if ($this->status !== 'active' || $this->useful_life_months <= 0) {
            return 0;
        }

        $base = $this->depreciable_base;

        $installment = $this->depreciation_method === 'declining_balance'
            ? $this->book_value * (2 / $this->useful_life_months)
            : $base / $this->useful_life_months;

        $remaining = round(
            $base - (float) $this->accumulated_depreciation,
            2
        );

        return round(max(0, min($installment, $remaining)), 2);
    }

    public function isFullyDepreciated(): bool
    {
        return round(
            $this->depreciable_base - (float) $this->accumulated_depreciation,
            2
        ) <= 0;
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
