<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaxInvoicePayment extends Model
{
    protected $fillable = [
        'tax_invoice_id',
        'project_id',
        'finance_account_id',
        'receivable_account_id',
        'finance_journal_entry_id',
        'payment_number',
        'amount',
        'payment_method',
        'payment_date',
        'reference_number',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'payment_date' => 'date',
    ];

    public function taxInvoice(): BelongsTo
    {
        return $this->belongsTo(TaxInvoice::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function financeAccount(): BelongsTo
    {
        return $this->belongsTo(FinanceAccount::class, 'finance_account_id');
    }

    public function receivableAccount(): BelongsTo
    {
        return $this->belongsTo(FinanceAccount::class, 'receivable_account_id');
    }

    public function journalEntry(): BelongsTo
    {
        return $this->belongsTo(
            FinanceJournalEntry::class,
            'finance_journal_entry_id'
        );
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
