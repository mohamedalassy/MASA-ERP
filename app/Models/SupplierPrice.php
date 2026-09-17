<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierPrice extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id', 'supplier_id', 'price', 'currency',
        'minimum_quantity', 'lead_time_days', 'valid_from', 'valid_until',
        'is_preferred', 'is_active', 'notes', 'created_by',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'minimum_quantity' => 'decimal:2',
        'lead_time_days' => 'integer',
        'valid_from' => 'date',
        'valid_until' => 'date',
        'is_preferred' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function history(): HasMany
    {
        return $this->hasMany(SupplierPriceHistory::class, 'supplier_price_id')
            ->latest('changed_on');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function isExpired(): bool
    {
        return $this->valid_until && $this->valid_until->isPast();
    }
}
