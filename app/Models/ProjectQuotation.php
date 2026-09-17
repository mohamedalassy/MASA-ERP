<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProjectQuotation extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'quotation_number',
        'status',
        'subtotal',
        'discount',
        'tax',
        'total',
        'version',
        'parent_quotation_id',
        'revision_reason',
        'valid_until',
        'created_by',
        'approved_by',
        'approved_at',
        'notes',
    ];

    protected $casts = [
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'total' => 'decimal:2',
        'version' => 'integer',
        'valid_until' => 'date',
        'approved_at' => 'datetime',
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function items()
    {
        return $this->hasMany(
            ProjectQuotationItem::class,
            'quotation_id'
        )->orderBy('sort_order');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function financialTransactions()
    {
        return $this->hasMany(
            ProjectFinancialTransaction::class,
            'quotation_id'
        );
    }

    public function parentQuotation()
    {
        return $this->belongsTo(
            ProjectQuotation::class,
            'parent_quotation_id'
        );
    }

    public function revisions()
    {
        return $this->hasMany(
            ProjectQuotation::class,
            'parent_quotation_id'
        )->orderByDesc('version');
    }
}
