<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'sku',
        'name',
        'category',
        'brand',
        'model',
        'description',
        'unit',
        'cost_price',
        'default_sale_price',
        'tax_rate',
        'stock_quantity',
        'minimum_stock',
        'default_supplier',
        'barcode',
        'image_path',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'cost_price' => 'decimal:2',
        'default_sale_price' => 'decimal:2',
        'tax_rate' => 'decimal:2',
        'stock_quantity' => 'decimal:2',
        'minimum_stock' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function creator()
    {
        return $this->belongsTo(
            User::class,
            'created_by'
        );
    }

    public function quotationItems()
    {
        return $this->hasMany(
            ProjectQuotationItem::class,
            'product_id'
        );
    }

    public function purchaseOrderItems()
    {
        return $this->hasMany(
            PurchaseOrderItem::class,
            'product_id'
        );
    }

    public function inventoryTransactions()
    {
        return $this->hasMany(
            InventoryTransaction::class,
            'product_id'
        );
    }

    public function isLowStock(): bool
    {
        return (float) $this->stock_quantity <=
            (float) $this->minimum_stock;
    }

    public function getProfitPerUnitAttribute(): float
    {
        return (float) $this->default_sale_price
            - (float) $this->cost_price;
    }

    public function getProfitMarginAttribute(): float
    {
        $salePrice = (float) $this->default_sale_price;

        if ($salePrice <= 0) {
            return 0;
        }

        return round(
            (
                ($salePrice - (float) $this->cost_price)
                / $salePrice
            ) * 100,
            2
        );
    }
}
