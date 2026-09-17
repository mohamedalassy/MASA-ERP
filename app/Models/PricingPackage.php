<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PricingPackage extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'name', 'description', 'category',
        'total_cost', 'total_price', 'discount_percent',
        'is_active', 'created_by',
    ];

    protected $casts = [
        'total_cost' => 'decimal:2',
        'total_price' => 'decimal:2',
        'discount_percent' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(PricingPackageItem::class, 'pricing_package_id')
            ->orderBy('sort_order');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /** يعيد حساب إجمالي التكلفة والسعر من البنود. */
    public function recalculateTotals(): void
    {
        $this->loadMissing('items');

        $cost = 0;
        $price = 0;

        foreach ($this->items as $item) {
            $cost += (float) $item->cost_price * (float) $item->quantity;
            $price += (float) $item->unit_price * (float) $item->quantity;
        }

        $discount = (float) $this->discount_percent;

        $this->update([
            'total_cost' => round($cost, 2),
            'total_price' => round($price * (1 - ($discount / 100)), 2),
        ]);
    }

    public function getProfitMarginAttribute(): float
    {
        $price = (float) $this->total_price;

        if ($price <= 0) {
            return 0;
        }

        return round((($price - (float) $this->total_cost) / $price) * 100, 2);
    }
}
