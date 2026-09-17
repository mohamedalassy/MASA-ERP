<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * مهم جدًا: جدول project_quotation_items يُنشأ هنا "فاضي" (id + timestamps)
 * فقط، لأن كل أعمدته بتُضاف في migration موجود عندك بالفعل:
 *   2026_08_28_121554_rebuild_project_quotation_items_columns
 * لو أضفت الأعمدة هنا، الهجرة دي هتفشل بتعارض أسماء أعمدة.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_quotations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            $table->string('quotation_number', 50)->unique();

            /*
             * draft | pending | approved | rejected | changes_requested
             * (الحالات مستخرجة من ProjectQuotationController)
             */
            $table->string('status', 30)->default('draft');

            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount', 15, 2)->default(0);
            $table->decimal('tax', 15, 2)->default(0);
            $table->decimal('total', 15, 2)->default(0);

            // المراجعات
            $table->unsignedInteger('version')->default(1);

            $table->foreignId('parent_quotation_id')
                ->nullable()
                ->constrained('project_quotations')
                ->nullOnDelete();

            $table->text('revision_reason')->nullable();

            $table->date('valid_until')->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('approved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('approved_at')->nullable();

            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index('project_id');
            $table->index('status');
            $table->index('parent_quotation_id');
        });

        // فاضي بالتصميم — راجع التعليق أعلى الملف.
        Schema::create('project_quotation_items', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
        });

        Schema::create('quotation_approval_histories', function (Blueprint $table) {
            $table->id();

            $table->foreignId('quotation_id')
                ->constrained('project_quotations')
                ->cascadeOnDelete();

            // submitted | approved | rejected | changes_requested | revised
            $table->string('action', 30);

            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30)->nullable();

            $table->text('reason')->nullable();
            $table->text('notes')->nullable();

            $table->decimal('total_snapshot', 15, 2)->nullable();
            $table->decimal('profit_margin_snapshot', 7, 2)->nullable();

            $table->foreignId('acted_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('quotation_id');
            $table->index('action');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotation_approval_histories');
        Schema::dropIfExists('project_quotation_items');
        Schema::dropIfExists('project_quotations');
    }
};
