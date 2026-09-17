<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * محرك الرواتب والإجازات والامتثال.
 *
 * أهم جدول هنا: gosi_rate_schedules — نسب التأمينات كـ"بيانات
 * بتواريخ سريان" مش أرقام في الكود، لأنها بترتفع ٠.٥٪ كل يوليو
 * حتى ٢٠٢٨. أي نظام بيكتب النسب في الكود بيحتاج نشر جديد كل سنة.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gosi_rate_schedules', function (Blueprint $table) {
            $table->id();

            // existing | new | expat
            $table->string('scheme', 20);

            $table->date('effective_from');
            $table->date('effective_to')->nullable();

            // فرع التقاعد
            $table->decimal('pension_employer', 6, 3)->default(0);
            $table->decimal('pension_employee', 6, 3)->default(0);

            // الأخطار المهنية — صاحب العمل فقط، للجميع
            $table->decimal('hazards_employer', 6, 3)->default(2);

            // ساند للتعطّل — للسعوديين فقط
            $table->decimal('saned_employer', 6, 3)->default(0);
            $table->decimal('saned_employee', 6, 3)->default(0);

            // الحد الأقصى للوعاء
            $table->decimal('wage_ceiling', 15, 2)->default(45000);

            $table->string('notes')->nullable();

            $table->timestamps();

            $table->index(['scheme', 'effective_from']);
        });

        Schema::create('hr_leave_types', function (Blueprint $table) {
            $table->id();

            $table->string('code', 30)->unique();
            $table->string('name');
            $table->string('name_en')->nullable();

            // عدد الأيام السنوي — فاضي = غير محدود أو محسوب
            $table->unsignedSmallInteger('annual_days')->nullable();

            $table->boolean('is_paid')->default(true);

            // تخصم من رصيد الإجازة السنوية
            $table->boolean('deducts_balance')->default(true);

            // يسمح بالترحيل للسنة التالية
            $table->boolean('allows_carryover')->default(false);
            $table->unsignedSmallInteger('max_carryover_days')->nullable();

            // لمن: all | male | female | muslim | saudi
            $table->string('eligibility', 20)->default('all');

            // الحد الأدنى لمدة الخدمة قبل الاستحقاق
            $table->unsignedSmallInteger('min_service_months')->default(0);

            $table->boolean('requires_attachment')->default(false);
            $table->boolean('is_active')->default(true);

            $table->timestamps();
        });

        Schema::create('hr_leave_balances', function (Blueprint $table) {
            $table->id();

            $table->foreignId('employee_id')
                ->constrained('hr_employees')
                ->cascadeOnDelete();

            $table->foreignId('leave_type_id')
                ->constrained('hr_leave_types')
                ->cascadeOnDelete();

            $table->unsignedSmallInteger('year');

            $table->decimal('entitled_days', 6, 2)->default(0);
            $table->decimal('carried_over_days', 6, 2)->default(0);
            $table->decimal('used_days', 6, 2)->default(0);
            $table->decimal('pending_days', 6, 2)->default(0);

            $table->timestamps();

            $table->unique(
                ['employee_id', 'leave_type_id', 'year'],
                'leave_balance_unique'
            );
        });

        Schema::create('hr_leave_requests', function (Blueprint $table) {
            $table->id();

            $table->foreignId('employee_id')
                ->constrained('hr_employees')
                ->cascadeOnDelete();

            $table->foreignId('leave_type_id')
                ->constrained('hr_leave_types')
                ->restrictOnDelete();

            $table->string('request_number', 50)->unique();

            $table->date('start_date');
            $table->date('end_date');
            $table->decimal('days_count', 6, 2);

            $table->text('reason')->nullable();
            $table->string('attachment_path')->nullable();

            // من يغطّي الموظف أثناء الإجازة
            $table->foreignId('substitute_employee_id')
                ->nullable()
                ->constrained('hr_employees')
                ->nullOnDelete();

            // draft | pending | approved | rejected | cancelled
            $table->string('status', 20)->default('pending');

            $table->foreignId('approved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();

            $table->timestamps();

            $table->index(['employee_id', 'status']);
            $table->index(['start_date', 'end_date']);
        });

        Schema::create('hr_payroll_runs', function (Blueprint $table) {
            $table->id();

            $table->string('run_number', 50)->unique();

            $table->unsignedSmallInteger('period_year');
            $table->unsignedTinyInteger('period_month');

            $table->foreignId('branch_id')
                ->nullable()
                ->constrained('hr_branches')
                ->nullOnDelete();

            // draft | calculated | approved | posted | paid
            $table->string('status', 20)->default('draft');

            $table->unsignedInteger('employees_count')->default(0);

            $table->decimal('total_gross', 18, 2)->default(0);
            $table->decimal('total_deductions', 18, 2)->default(0);
            $table->decimal('total_gosi_employee', 18, 2)->default(0);
            $table->decimal('total_gosi_employer', 18, 2)->default(0);
            $table->decimal('total_net', 18, 2)->default(0);
            $table->decimal('total_eosb_accrual', 18, 2)->default(0);

            // القيد المحاسبي الناتج
            $table->foreignId('finance_journal_entry_id')
                ->nullable()
                ->constrained('finance_journal_entries')
                ->nullOnDelete();

            // ملف حماية الأجور
            $table->string('wps_file_path')->nullable();
            $table->timestamp('wps_generated_at')->nullable();
            $table->timestamp('wps_submitted_at')->nullable();

            // pending | passed | failed
            $table->string('wps_validation_status', 20)->nullable();
            $table->json('wps_validation_errors')->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('approved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('approved_at')->nullable();
            $table->timestamp('posted_at')->nullable();

            $table->text('notes')->nullable();

            $table->timestamps();

            $table->unique(
                ['period_year', 'period_month', 'branch_id'],
                'payroll_period_branch_unique'
            );
            $table->index('status');
        });

        Schema::create('hr_payroll_lines', function (Blueprint $table) {
            $table->id();

            $table->foreignId('payroll_run_id')
                ->constrained('hr_payroll_runs')
                ->cascadeOnDelete();

            $table->foreignId('employee_id')
                ->constrained('hr_employees')
                ->restrictOnDelete();

            $table->foreignId('contract_id')
                ->nullable()
                ->constrained('hr_employee_contracts')
                ->nullOnDelete();

            // لقطة الأجر وقت التشغيل
            $table->decimal('basic_salary', 15, 2)->default(0);
            $table->decimal('housing_allowance', 15, 2)->default(0);
            $table->decimal('other_allowances', 15, 2)->default(0);

            // الإضافي والحوافز
            $table->decimal('overtime_hours', 8, 2)->default(0);
            $table->decimal('overtime_amount', 15, 2)->default(0);
            $table->decimal('bonus', 15, 2)->default(0);
            $table->decimal('commission', 15, 2)->default(0);

            $table->decimal('gross_salary', 15, 2)->default(0);

            // الخصومات
            $table->decimal('absence_days', 6, 2)->default(0);
            $table->decimal('absence_deduction', 15, 2)->default(0);
            $table->decimal('late_minutes', 8, 2)->default(0);
            $table->decimal('late_deduction', 15, 2)->default(0);
            $table->decimal('unpaid_leave_days', 6, 2)->default(0);
            $table->decimal('unpaid_leave_deduction', 15, 2)->default(0);
            $table->decimal('loan_deduction', 15, 2)->default(0);
            $table->decimal('other_deductions', 15, 2)->default(0);

            // التأمينات — باللقطة الكاملة للتدقيق
            $table->string('gosi_scheme', 20)->nullable();
            $table->decimal('gosi_base', 15, 2)->default(0);
            $table->decimal('gosi_employee', 15, 2)->default(0);
            $table->decimal('gosi_employer', 15, 2)->default(0);
            $table->json('gosi_breakdown')->nullable();

            $table->decimal('net_salary', 15, 2)->default(0);

            // مخصص نهاية الخدمة الشهري
            $table->decimal('eosb_accrual', 15, 2)->default(0);

            // مركز التكلفة — لتوزيع مصروف الرواتب
            $table->foreignId('cost_center_id')
                ->nullable()
                ->constrained('cost_centers')
                ->nullOnDelete();

            /*
             * ====== الميزة على جسر ======
             * توزيع تكلفة الموظف على المشاريع من ساعات بصمة الموقع.
             * جسر يعرف إن الموظف اشتغل ٨ ساعات — ومش يعرف على أي مشروع.
             * [{project_id, hours, cost}]
             */
            $table->json('project_allocations')->nullable();

            $table->string('payment_status', 20)->default('unpaid');
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->unique(['payroll_run_id', 'employee_id'], 'payroll_line_unique');
            $table->index('employee_id');
        });

        Schema::create('hr_compliance_alerts', function (Blueprint $table) {
            $table->id();

            /*
             * iqama_expiry · passport_expiry · contract_expiry
             * qiwa_not_authenticated · salary_mismatch
             * wps_deadline · gosi_unregistered · probation_ending
             */
            $table->string('type', 50);

            // info | warning | critical
            $table->string('severity', 20)->default('warning');

            $table->foreignId('employee_id')
                ->nullable()
                ->constrained('hr_employees')
                ->cascadeOnDelete();

            $table->string('title');
            $table->text('description')->nullable();

            $table->date('due_date')->nullable();
            $table->integer('days_remaining')->nullable();

            // الغرامة المحتملة بالريال — الامتثال كرقم مش كورق
            $table->decimal('potential_penalty', 15, 2)->nullable();

            // open | acknowledged | resolved | dismissed
            $table->string('status', 20)->default('open');

            $table->foreignId('resolved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_note')->nullable();

            $table->timestamps();

            $table->index(['status', 'severity']);
            $table->index(['type', 'status']);
            $table->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hr_compliance_alerts');
        Schema::dropIfExists('hr_payroll_lines');
        Schema::dropIfExists('hr_payroll_runs');
        Schema::dropIfExists('hr_leave_requests');
        Schema::dropIfExists('hr_leave_balances');
        Schema::dropIfExists('hr_leave_types');
        Schema::dropIfExists('gosi_rate_schedules');
    }
};
