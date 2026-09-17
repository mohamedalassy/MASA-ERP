<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PricingCosting extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id', 'quotation_id', 'title', 'currency',
        'material_cost', 'minimum_margin_percent', 'target_margin_percent',
        'tax_rate', 'current_sale', 'status', 'notes', 'created_by',
    ];

    protected $casts = [
        'material_cost' => 'decimal:2',
        'minimum_margin_percent' => 'decimal:2',
        'target_margin_percent' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'current_sale' => 'decimal:2',
    ];

    public function components(): HasMany
    {
        return $this->hasMany(
            PricingCostingComponent::class,
            'pricing_costing_id'
        )->orderBy('sort_order');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(ProjectQuotation::class, 'quotation_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isEditable(): bool
    {
        return $this->status === 'draft';
    }
}
