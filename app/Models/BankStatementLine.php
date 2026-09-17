<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BankStatementLine extends Model
{
    use HasFactory;

    protected $fillable = [
        'bank_reconciliation_id', 'transaction_date', 'description',
        'reference_number', 'debit', 'credit', 'amount',
        'match_status', 'finance_journal_line_id',
        'matched_by', 'matched_at',
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'debit' => 'decimal:2',
        'credit' => 'decimal:2',
        'amount' => 'decimal:2',
        'matched_at' => 'datetime',
    ];

    public function reconciliation(): BelongsTo
    {
        return $this->belongsTo(
            BankReconciliation::class,
            'bank_reconciliation_id'
        );
    }

    public function journalLine(): BelongsTo
    {
        return $this->belongsTo(
            FinanceJournalLine::class,
            'finance_journal_line_id'
        );
    }

    public function matcher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'matched_by');
    }

    public function isMatched(): bool
    {
        return $this->match_status === 'matched';
    }
}
