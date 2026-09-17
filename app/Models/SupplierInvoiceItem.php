<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierInvoiceItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'supplier_invoice_id',
        'purchase_order_item_id',
        'product_id',
        'product_name',
        'sku',
        'description',
        'quantity',
        'unit_cost',
        'discount',
        'tax_rate',
        'tax_amount',
        'line_total',
        'ordered_quantity_snapshot',
        'received_quantity_snapshot',
        'ordered_unit_cost_snapshot',
        'quantity_variance',
        'price_variance',
        'line_variance',
        'match_status',
        'sort_order',
    ];

    protected $casts = [
        'quantity' => 'decimal:2',
        'unit_cost' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'line_total' => 'decimal:2',
        'ordered_quantity_snapshot' => 'decimal:2',
        'received_quantity_snapshot' => 'decimal:2',
        'ordered_unit_cost_snapshot' => 'decimal:2',
        'quantity_variance' => 'decimal:2',
        'price_variance' => 'decimal:2',
        'line_variance' => 'decimal:2',
        'sort_order' => 'integer',
    ];

    public function supplierInvoice(): BelongsTo
    {
        return $this->belongsTo(SupplierInvoice::class);
    }

    public function purchaseOrderItem(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrderItem::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
