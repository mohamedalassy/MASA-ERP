<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * الحقول من $fillable بموديل Project — ما عدا حقول
 * quotation_revision_* لأنها تُضاف في migration موجود عندك بالفعل:
 * 2026_08_28_131211_add_quotation_revision_fields_to_projects_table
 *
 * ملاحظة: FinanceDashboardController بيفلتر بـ where('stage','finance')
 * والعمود الصح هو current_stage — التصحيح في README.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();

            $table->string('project_code', 50)->unique();
            $table->string('name');

            // العميل
            $table->string('customer_name');
            $table->string('customer_code', 50)->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->string('commercial_register', 30)->nullable();
            $table->string('tax_number', 20)->nullable();

            // المسؤولية
            $table->string('project_manager')->nullable();
            $table->string('account_manager')->nullable();

            /*
             * دورة الأقسام:
             * crm | sales | pricing | purchasing | finance | execution | closed
             * (الترتيب معرّف في Project::getNextStage)
             */
            $table->string('current_stage', 30)->default('crm');
            $table->string('status', 30)->default('active');

            // التنفيذ
            $table->string('execution_status', 30)->nullable();
            $table->text('execution_hold_reason')->nullable();
            $table->timestamp('execution_hold_at')->nullable();
            $table->timestamp('execution_resumed_at')->nullable();

            // بيانات المشروع
            $table->string('project_type')->nullable();
            $table->string('priority', 20)->default('normal');
            $table->date('expected_start_date')->nullable();
            $table->date('expected_end_date')->nullable();
            $table->decimal('total_value', 15, 2)->default(0);

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('current_stage');
            $table->index('status');
            $table->index('customer_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
