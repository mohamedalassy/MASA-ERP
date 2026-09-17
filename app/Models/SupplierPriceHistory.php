<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierPriceHistory extends Model
{
    use HasFactory;

    protected $table = 'supplier_price_history';

    protected $fillable = [
        'supplier_price_id', 'product_id', 'supplier_id',
        'old_price', 'new_price', 'change_amount', 'change_percent',
        'changed_on', 'reason', 'changed_by',
    ];

    protected $casts = [
        'old_price' => 'decimal:2',
        'new_price' => 'decimal:2',
        'change_amount' => 'decimal:2',
        'change_percent' => 'decimal:2',
        'changed_on' => 'date',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function supplierPrice(): BelongsTo
    {
        return $this->belongsTo(SupplierPrice::class, 'supplier_price_id');
    }

    /** يُنشئ سجلًا تاريخيًا ويحسب مقدار ونسبة التغيّر. */
    public static function record(
        SupplierPrice $price,
        ?float $oldPrice,
        ?string $reason = null,
        ?int $userId = null
    ): self {
        $newPrice = (float) $price->price;
        $old = (float) ($oldPrice ?? 0);
        $change = round($newPrice - $old, 2);

        return self::create([
            'supplier_price_id' => $price->id,
            'product_id' => $price->product_id,
            'supplier_id' => $price->supplier_id,
            'old_price' => $oldPrice,
            'new_price' => $newPrice,
            'change_amount' => $change,
            'change_percent' => $old > 0
                ? round(($change / $old) * 100, 2)
                : 0,
            'changed_on' => now()->toDateString(),
            'reason' => $reason,
            'changed_by' => $userId,
        ]);
    }
}
