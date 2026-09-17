<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TaxInvoiceItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'tax_invoice_id', 'quotation_item_id', 'product_id', 'tax_code_id',
        'name', 'description', 'unit', 'quantity', 'unit_price',
        'discount', 'taxable_amount', 'tax_rate', 'tax_amount', 'line_total',
        'source_quantity_snapshot',
        'previously_invoiced_quantity_snapshot',
        'remaining_quantity_before_snapshot',
        'sort_order',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
        'unit_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'taxable_amount' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'line_total' => 'decimal:2',
        'source_quantity_snapshot' => 'decimal:4',
        'previously_invoiced_quantity_snapshot' => 'decimal:4',
        'remaining_quantity_before_snapshot' => 'decimal:4',
        'sort_order' => 'integer',
    ];

    public function taxInvoice(): BelongsTo
    {
        return $this->belongsTo(TaxInvoice::class);
    }

    public function quotationItem(): BelongsTo
    {
        return $this->belongsTo(
            ProjectQuotationItem::class,
            'quotation_item_id'
        );
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /** العلاقة دي مستخدمة بالاسم في TaxInvoiceController::show. */
    public function taxCode(): BelongsTo
    {
        return $this->belongsTo(TaxCode::class, 'tax_code_id');
    }
}
