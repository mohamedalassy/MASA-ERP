<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * بوابات الانتقال بين الأقسام.
 *
 * دلوقتي الانتقال زر واحد بينقل المرحلة بدون أي شرط. الجدولان دول
 * بيخلّوه بوابة: شروط معرَّفة لكل انتقال، وحالة كل شرط لكل مشروع،
 * والتجاوز مسجَّل بمين أجازه وليه.
 *
 * project_stage_requirements = تعريف الشروط (إعداد لمرة واحدة)
 * project_stage_gate_checks  = حالة كل شرط على كل مشروع
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_stage_requirements', function (Blueprint $table) {
            $table->id();

            // المرحلة المطلوب مغادرتها
            $table->string('from_stage', 30);

            // المرحلة المقصودة — فاضي = أي مرحلة تالية
            $table->string('to_stage', 30)->nullable();

            $table->string('code', 50);
            $table->string('label');
            $table->string('note')->nullable();

            /*
             * طريقة التحقق:
             *   manual     = يعلّمه مستخدم يدويًا
             *   automatic  = النظام يفحصه (له معالج في StageGateService)
             *   approval   = يحتاج موافقة دور معيّن
             */
            $table->string('check_mode', 20)->default('manual');

            // اسم الفحص الآلي: approved_quotation | po_fully_received …
            $table->string('handler', 100)->nullable();

            // الدور المطلوب للموافقة
            $table->string('approver_role', 50)->nullable();

            // إلزامي = يمنع الانتقال · غير إلزامي = تحذير فقط
            $table->boolean('is_mandatory')->default(true);

            // هل يمكن تجاوزه بصلاحية عليا
            $table->boolean('is_overridable')->default(true);

            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->unique(['from_stage', 'to_stage', 'code'], 'stage_requirement_unique');
            $table->index(['from_stage', 'is_active']);
        });

        Schema::create('project_stage_gate_checks', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            $table->foreignId('requirement_id')
                ->constrained('project_stage_requirements')
                ->cascadeOnDelete();

            // pending | satisfied | waived | failed
            $table->string('status', 20)->default('pending');

            $table->foreignId('satisfied_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('satisfied_at')->nullable();

            $table->text('evidence')->nullable();

            // التجاوز — مسجَّل دائمًا بمن أجازه والسبب
            $table->foreignId('waived_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('waived_at')->nullable();
            $table->text('waiver_reason')->nullable();

            $table->timestamps();

            $table->unique(['project_id', 'requirement_id'], 'project_gate_check_unique');
            $table->index(['project_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_stage_gate_checks');
        Schema::dropIfExists('project_stage_requirements');
    }
};
