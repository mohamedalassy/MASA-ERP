<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinanceAccount extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'name_en',
        'type',
        'parent_id',
        'level',
        'normal_balance',
        'is_postable',
        'is_cash_account',
        'cash_flow_category',
        'is_active',
        'description',
        'created_by',
    ];

    protected $casts = [
        'level' => 'integer',
        'is_postable' => 'boolean',
        'is_cash_account' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function parent(): BelongsTo
    {
        return $this->belongsTo(
            FinanceAccount::class,
            'parent_id'
        );
    }

    public function children(): HasMany
    {
        return $this->hasMany(
            FinanceAccount::class,
            'parent_id'
        )->orderBy('code');
    }

    public function journalLines(): HasMany
    {
        return $this->hasMany(
            FinanceJournalLine::class,
            'account_id'
        );
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'created_by'
        );
    }
}
