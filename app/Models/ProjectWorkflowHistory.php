<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectWorkflowHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id', 'from_stage', 'to_stage', 'reason', 'notes',
        'transferred_by', 'transferred_at', 'received_by', 'received_at',
        'reception_status', 'return_reason',
    ];

    protected $casts = [
        'transferred_at' => 'datetime',
        'received_at' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function transferrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'transferred_by');
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function isPendingReception(): bool
    {
        return $this->reception_status === 'pending';
    }
}
