<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PricingRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'scope_type', 'scope_id',
        'minimum_margin_percent', 'target_margin_percent',
        'default_markup_percent', 'maximum_discount_percent',
        'block_below_minimum_margin', 'require_approval_below_target',
        'is_active', 'priority', 'created_by',
    ];

    protected $casts = [
        'minimum_margin_percent' => 'decimal:2',
        'target_margin_percent' => 'decimal:2',
        'default_markup_percent' => 'decimal:2',
        'maximum_discount_percent' => 'decimal:2',
        'block_below_minimum_margin' => 'boolean',
        'require_approval_below_target' => 'boolean',
        'is_active' => 'boolean',
        'priority' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * درجة التخصيص — الأعلى يكسب.
     *
     * الكنترولر الحالي بياخد أول قاعدة بالأولوية، فقاعدة عامة بأولوية ١
     * بتتغلب على قاعدة منتج بأولوية ٥. الأصح محاسبيًا إن الأخص يكسب،
     * والأولوية تفصل بين المتساويين في التخصيص:
     *
     *   $rules->sortByDesc(fn ($r) => [$r->specificity(), -$r->priority])
     */
    public function specificity(): int
    {
        return match ($this->scope_type) {
            'customer' => 3,
            'product' => 2,
            'category' => 1,
            default => 0,
        };
    }
}
