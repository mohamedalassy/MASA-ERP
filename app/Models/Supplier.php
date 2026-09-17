<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    use HasFactory;

    protected $fillable = [
        'code', 'name', 'name_en', 'contact_person', 'phone', 'email',
        'address', 'city', 'vat_number', 'commercial_register',
        'payment_terms', 'credit_days', 'category', 'rating',
        'is_active', 'notes', 'created_by',
    ];

    protected $casts = [
        'credit_days' => 'integer',
        'rating' => 'decimal:1',
        'is_active' => 'boolean',
    ];

    public function purchaseOrders(): HasMany
    {
        return $this->hasMany(PurchaseOrder::class, 'supplier_id')->latest();
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(SupplierInvoice::class, 'supplier_id')->latest();
    }

    public function prices(): HasMany
    {
        return $this->hasMany(SupplierPrice::class, 'supplier_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
