<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class HrAttendanceDevice extends Model
{
    use HasFactory;

    protected $fillable = [
        'branch_id', 'code', 'name', 'provider', 'model', 'serial_number',
        'ip_address', 'port', 'protocol', 'username', 'password', 'api_url',
        'api_token', 'timezone', 'location', 'status', 'last_seen_at',
        'last_sync_at', 'sync_interval_minutes', 'auto_sync', 'is_active',
        'settings', 'notes', 'created_by', 'updated_by',
    ];

    protected $hidden = ['password', 'api_token'];

    protected $casts = [
        'password' => 'encrypted',
        'api_token' => 'encrypted',
        'last_seen_at' => 'datetime',
        'last_sync_at' => 'datetime',
        'sync_interval_minutes' => 'integer',
        'auto_sync' => 'boolean',
        'is_active' => 'boolean',
        'settings' => 'array',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(HrBranch::class, 'branch_id');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(HrAttendanceLog::class, 'device_id');
    }
}
