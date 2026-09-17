<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaxCode extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'name', 'name_en', 'rate', 'category',
        'exemption_reason_code', 'exemption_reason',
        'is_default', 'is_active',
    ];

    protected $casts = [
        'rate' => 'decimal:2',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function invoiceItems(): HasMany
    {
        return $this->hasMany(TaxInvoiceItem::class, 'tax_code_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /** الإعفاء والصفري يتطلبان سبب إعفاء زاتكويًا. */
    public function requiresExemptionReason(): bool
    {
        return in_array(
            $this->category,
            ['zero_rated', 'exempt', 'out_of_scope'],
            true
        );
    }
}
