<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * الجداول الثلاثة اللي موديل Project بيعمل hasMany عليها:
 *   workflowHistory() → project_workflow_histories (latest('transferred_at'))
 *   notes()           → project_notes
 *   attachments()     → project_attachments
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_workflow_histories', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            $table->string('from_stage', 30)->nullable();
            $table->string('to_stage', 30);

            $table->text('reason')->nullable();
            $table->text('notes')->nullable();

            // تسليم واستلام بين الأقسام
            $table->foreignId('transferred_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('transferred_at')->useCurrent();

            $table->foreignId('received_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('received_at')->nullable();

            // accepted | returned | pending
            $table->string('reception_status', 20)->default('pending');
            $table->text('return_reason')->nullable();

            $table->timestamps();

            $table->index('project_id');
            $table->index('transferred_at');
        });

        Schema::create('project_notes', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            $table->text('body');
            $table->string('stage', 30)->nullable();
            $table->boolean('is_internal')->default(true);

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('project_id');
        });

        Schema::create('project_attachments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            $table->string('title')->nullable();
            $table->string('file_path');
            $table->string('file_name');
            $table->string('mime_type', 100)->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->string('category')->nullable();

            $table->foreignId('uploaded_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('project_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_attachments');
        Schema::dropIfExists('project_notes');
        Schema::dropIfExists('project_workflow_histories');
    }
};
