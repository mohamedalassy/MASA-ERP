<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_code',
        'name',
        'customer_name',
        'customer_code',
        'phone',
        'email',
        'address',
        'commercial_register',
        'tax_number',
        'project_manager',
        'account_manager',
        'current_stage',
        'status',

        // Execution
        'execution_status',
        'execution_hold_reason',
        'execution_hold_at',
        'execution_resumed_at',

        // Project information
        'project_type',
        'priority',
        'expected_start_date',
        'expected_end_date',
        'total_value',
        'created_by',

        // Quotation Revision
        'quotation_revision_required',
        'quotation_revision_reason',
        'quotation_revision_requested_at',
    ];

    protected $casts = [
        'expected_start_date' => 'date',
        'expected_end_date' => 'date',

        'total_value' => 'decimal:2',

        'execution_hold_at' => 'datetime',
        'execution_resumed_at' => 'datetime',

        'quotation_revision_required' => 'boolean',
        'quotation_revision_requested_at' => 'datetime',
    ];

    /*
    |--------------------------------------------------------------------------
    | Relationships
    |--------------------------------------------------------------------------
    */

    public function creator()
    {
        return $this->belongsTo(
            User::class,
            'created_by'
        );
    }

    public function workflowHistory()
    {
        return $this->hasMany(
            ProjectWorkflowHistory::class
        )->latest('transferred_at');
    }

    public function notes()
    {
        return $this->hasMany(
            ProjectNote::class
        )->latest();
    }

    public function attachments()
    {
        return $this->hasMany(
            ProjectAttachment::class
        )->latest();
    }

    public function quotations()
    {
        return $this->hasMany(
            ProjectQuotation::class
        )->latest();
    }

    public function purchaseOrders()
    {
        return $this->hasMany(
            PurchaseOrder::class
        )->latest();
    }

    public function financialTransactions()
    {
        return $this->hasMany(
            ProjectFinancialTransaction::class
        )->latest();
    }

    /*
    |--------------------------------------------------------------------------
    | Workflow Helpers
    |--------------------------------------------------------------------------
    */

    public function getNextStage(): ?string
    {
        $stages = [
            'crm',
            'sales',
            'pricing',
            'purchasing',
            'finance',
            'execution',
            'closed',
        ];

        $currentIndex = array_search(
            $this->current_stage,
            $stages,
            true
        );

        if ($currentIndex === false) {
            return null;
        }

        return $stages[$currentIndex + 1] ?? null;
    }

    public function canMoveToNextStage(): bool
    {
        return $this->getNextStage() !== null;
    }

    public function getPreviousStage(): ?string
    {
        $stages = [
            'crm',
            'sales',
            'pricing',
            'purchasing',
            'finance',
            'execution',
            'closed',
        ];

        $currentIndex = array_search(
            $this->current_stage,
            $stages,
            true
        );

        if (
            $currentIndex === false ||
            $currentIndex === 0
        ) {
            return null;
        }

        return $stages[$currentIndex - 1];
    }

    public function canMoveToPreviousStage(): bool
    {
        return $this->getPreviousStage() !== null;
    }
}