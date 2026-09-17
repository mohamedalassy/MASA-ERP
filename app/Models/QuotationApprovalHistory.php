<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuotationApprovalHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'quotation_id', 'action', 'from_status', 'to_status',
        'reason', 'notes', 'total_snapshot', 'profit_margin_snapshot',
        'acted_by',
    ];

    protected $casts = [
        'total_snapshot' => 'decimal:2',
        'profit_margin_snapshot' => 'decimal:2',
    ];

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(ProjectQuotation::class, 'quotation_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'acted_by');
    }
}
