<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * إضافات صفحة المشروع — السجل الموحّد والأنشطة.
 *
 * project_events   = السجل الموحّد (chatter): تعليقات + أحداث النظام
 * project_activities = المهام المجدولة على المشروع
 * project_event_mentions = إشعارات @mention
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_events', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            /*
             * message   = تعليق كتبه مستخدم
             * note      = ملاحظة داخلية (لا تظهر للعميل)
             * stage     = انتقال بين الأقسام
             * approval  = موافقة أو رفض
             * site      = زيارة موقع / بصمة
             * finance   = فاتورة أو تحصيل
             * purchase  = أمر شراء أو استلام
             * inventory = صرف أو مرتجع مخزون
             * system    = تغيير حالة أو حقل
             */
            $table->string('category', 20);

            // نص الحدث كما يُعرض
            $table->text('body');

            // سطر السياق الصغير أسفل الحدث (المبلغ، المرجع، النتيجة)
            $table->string('meta')->nullable();

            /*
             * ربط الحدث بالمستند الذي أنشأه — يسمح بالانتقال من
             * السجل إلى الفاتورة أو أمر الشراء مباشرة.
             */
            $table->string('reference_type', 50)->nullable();
            $table->unsignedBigInteger('reference_id')->nullable();

            // الأحداث الآلية لا يمكن تعديلها أو حذفها
            $table->boolean('is_system')->default(false);

            // الملاحظات الداخلية لا تُصدَّر في تقارير العميل
            $table->boolean('is_internal')->default(false);

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index(['project_id', 'created_at']);
            $table->index(['project_id', 'category']);
            $table->index(['reference_type', 'reference_id']);
        });

        Schema::create('project_event_mentions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_event_id')
                ->constrained('project_events')
                ->cascadeOnDelete();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            $table->timestamp('read_at')->nullable();

            $table->timestamps();

            $table->unique(['project_event_id', 'user_id'], 'event_mention_unique');
            $table->index(['user_id', 'read_at']);
        });

        Schema::create('project_activities', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            $table->string('title');
            $table->text('description')->nullable();

            // call | meeting | site_visit | document | follow_up | other
            $table->string('type', 30)->default('follow_up');

            $table->date('due_date');

            // low | normal | high
            $table->string('priority', 20)->default('normal');

            // open | done | cancelled
            $table->string('status', 20)->default('open');

            $table->foreignId('assigned_to')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('completed_at')->nullable();

            $table->foreignId('completed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->text('completion_note')->nullable();

            $table->timestamps();

            $table->index(['project_id', 'status']);
            $table->index(['assigned_to', 'status', 'due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_activities');
        Schema::dropIfExists('project_event_mentions');
        Schema::dropIfExists('project_events');
    }
};
