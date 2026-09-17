<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class TaxInvoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'invoice_number', 'uuid', 'invoice_type', 'document_type', 'billing_type',
        'company_tax_profile_id', 'project_id', 'quotation_id', 'original_invoice_id',
        'customer_id', 'buyer_name', 'buyer_vat_number', 'buyer_commercial_register',
        'buyer_building_number', 'buyer_street_name', 'buyer_district', 'buyer_city',
        'buyer_postal_code', 'buyer_country_code', 'issue_date', 'issue_time',
        'supply_date', 'due_date', 'currency', 'quotation_total_snapshot',
        'invoiced_before_snapshot', 'remaining_before_snapshot', 'billing_percentage',
        'subtotal', 'discount_total', 'taxable_amount', 'tax_total', 'total',
        'paid_amount', 'remaining_amount', 'payment_status', 'status', 'zatca_status',
        'notes', 'terms', 'reference_number', 'created_by', 'issued_by', 'issued_at',
    ];

    protected $casts = [
        'issue_date' => 'date', 'supply_date' => 'date', 'due_date' => 'date',
        'quotation_total_snapshot' => 'decimal:2', 'invoiced_before_snapshot' => 'decimal:2',
        'remaining_before_snapshot' => 'decimal:2', 'billing_percentage' => 'decimal:4',
        'subtotal' => 'decimal:2', 'discount_total' => 'decimal:2',
        'taxable_amount' => 'decimal:2', 'tax_total' => 'decimal:2',
        'total' => 'decimal:2', 'paid_amount' => 'decimal:2',
        'remaining_amount' => 'decimal:2', 'issued_at' => 'datetime',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(TaxInvoiceItem::class)->orderBy('sort_order');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(TaxInvoicePayment::class)
            ->orderByDesc('payment_date')
            ->orderByDesc('id');
    }

    public function companyTaxProfile(): BelongsTo
    {
        return $this->belongsTo(CompanyTaxProfile::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(ProjectQuotation::class, 'quotation_id');
    }

    public function originalInvoice(): BelongsTo
    {
        return $this->belongsTo(self::class, 'original_invoice_id');
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(self::class, 'original_invoice_id');
    }

    public function zatcaDocument(): HasOne
    {
        return $this->hasOne(ZatcaDocument::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    public function isEditable(): bool
    {
        return $this->status === 'draft';
    }
}
