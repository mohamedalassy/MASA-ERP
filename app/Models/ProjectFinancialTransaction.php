<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectFinancialTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id', 'quotation_id', 'purchase_order_id', 'supplier_id',
        'direction', 'type', 'title', 'reference_number', 'description',
        'subtotal', 'tax', 'total', 'paid_amount', 'remaining_amount',
        'transaction_date', 'due_date', 'status', 'payment_method',
        'created_by', 'approved_by', 'approved_at', 'notes',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'remaining_amount' => 'decimal:2',
        'transaction_date' => 'date',
        'due_date' => 'date',
        'approved_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(ProjectQuotation::class, 'quotation_id');
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class, 'purchase_order_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class, 'supplier_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** الذمم المفتوحة — اللوحة بتستبعد paid وcancelled. */
    public function scopeOpen($query)
    {
        return $query->whereNotIn('status', ['paid', 'cancelled']);
    }

    public function isOverdue(): bool
    {
        return $this->due_date
            && $this->due_date->isPast()
            && !in_array($this->status, ['paid', 'cancelled'], true);
    }
}
