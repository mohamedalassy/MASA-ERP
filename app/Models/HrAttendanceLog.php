<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class HrAttendanceLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'device_id', 'employee_id', 'biometric_user_id', 'event_uid',
        'punched_at', 'punch_type', 'verification_mode', 'direction',
        'raw_payload', 'processed_at', 'processing_status', 'error_message',
    ];

    protected $casts = [
        'punched_at' => 'datetime',
        'processed_at' => 'datetime',
        'raw_payload' => 'array',
    ];

    public function device(): BelongsTo
    {
        return $this->belongsTo(HrAttendanceDevice::class, 'device_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(HrEmployee::class, 'employee_id');
    }
}
