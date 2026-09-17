<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ZatcaDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'tax_invoice_id', 'uuid', 'submission_type', 'status',
        'xml', 'invoice_hash', 'previous_invoice_hash', 'qr_code',
        'signature', 'counter_value', 'response_payload',
        'response_message', 'submitted_at',
    ];

    protected $casts = [
        'response_payload' => 'array',
        'counter_value' => 'integer',
        'submitted_at' => 'datetime',
    ];

    /** الـ XML والتوقيع ضخمان — يُستبعدان من الردود العادية. */
    protected $hidden = ['xml', 'signature'];

    public function taxInvoice(): BelongsTo
    {
        return $this->belongsTo(TaxInvoice::class);
    }

    public function isSubmitted(): bool
    {
        return in_array($this->status, ['submitted', 'cleared', 'reported'], true);
    }
}
