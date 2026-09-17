<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductAlternative extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id', 'alternative_product_id', 'relation_type',
        'preference_order', 'notes', 'is_active', 'created_by',
    ];

    protected $casts = [
        'preference_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function alternative(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'alternative_product_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
