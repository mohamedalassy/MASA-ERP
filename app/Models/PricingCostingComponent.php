<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PricingCostingComponent extends Model
{
    use HasFactory;

    protected $fillable = [
        'pricing_costing_id', 'type', 'label',
        'calculation_mode', 'percentage_basis',
        'fixed_amount', 'percentage', 'sort_order', 'notes',
    ];

    protected $casts = [
        'fixed_amount' => 'decimal:2',
        'percentage' => 'decimal:2',
        'sort_order' => 'integer',
    ];

    public function costing(): BelongsTo
    {
        return $this->belongsTo(PricingCosting::class, 'pricing_costing_id');
    }

    /**
     * أساس النسبة مهم: running_subtotal معناه إن ترتيب المكوّنات
     * بيغيّر الرقم النهائي فعلاً — فـ sort_order ليه معنى حسابي
     * مش مجرد ترتيب عرض.
     */
    public function isPercentageOfRunningSubtotal(): bool
    {
        return $this->calculation_mode === 'percentage'
            && $this->percentage_basis === 'running_subtotal';
    }
}
