<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_attendance_devices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->nullable()->constrained('hr_branches')->nullOnDelete();
            $table->string('code', 30)->unique();
            $table->string('name');
            $table->enum('provider', ['hikvision', 'zkteco', 'suprema', 'dahua', 'other']);
            $table->string('model')->nullable();
            $table->string('serial_number', 100)->nullable()->unique();
            $table->string('ip_address', 45)->nullable();
            $table->unsignedSmallInteger('port')->default(80);
            $table->enum('protocol', ['http', 'https', 'adms', 'push', 'sdk'])->default('http');
            $table->string('username')->nullable();
            $table->text('password')->nullable();
            $table->string('api_url')->nullable();
            $table->text('api_token')->nullable();
            $table->string('timezone')->default('Asia/Riyadh');
            $table->string('location')->nullable();
            $table->enum('status', ['offline', 'online', 'error', 'maintenance'])->default('offline');
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('last_sync_at')->nullable();
            $table->unsignedSmallInteger('sync_interval_minutes')->default(5);
            $table->boolean('auto_sync')->default(true);
            $table->boolean('is_active')->default(true);
            $table->json('settings')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['provider', 'status']);
            $table->index(['branch_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_attendance_devices');
    }
};
