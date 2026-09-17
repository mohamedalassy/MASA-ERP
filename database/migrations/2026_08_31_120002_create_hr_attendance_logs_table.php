<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_attendance_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('device_id')->nullable()->constrained('hr_attendance_devices')->nullOnDelete();
            $table->foreignId('employee_id')->nullable()->constrained('hr_employees')->nullOnDelete();
            $table->string('biometric_user_id', 60)->nullable()->index();
            $table->string('event_uid', 191)->unique();
            $table->dateTime('punched_at')->index();
            $table->enum('punch_type', ['check_in', 'check_out', 'break_in', 'break_out', 'unknown'])->default('unknown');
            $table->string('verification_mode', 50)->nullable();
            $table->enum('direction', ['in', 'out', 'unknown'])->default('unknown');
            $table->json('raw_payload')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->enum('processing_status', ['pending', 'processed', 'ignored', 'error'])->default('pending');
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->index(['employee_id', 'punched_at']);
            $table->index(['device_id', 'punched_at']);
            $table->index(['processing_status', 'punched_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_attendance_logs');
    }
};
