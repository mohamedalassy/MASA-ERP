<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * الهيكل التنظيمي للموارد البشرية — الستة جداول المفقودة.
 *
 * بدونها جداول الحضور والرواتب الموجودة عندك معطّلة تمامًا:
 *   hr_attendance_logs   → constrained('hr_employees')
 *   hr_attendance_daily  → constrained('hr_employees')
 *   hr_payrolls          → constrained('hr_employees')
 *
 * لازم يجي قبل 2026_08_29 (هجرات الحضور).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hr_branches', function (Blueprint $table) {
            $table->id();

            $table->string('code', 30)->unique();
            $table->string('name');
            $table->string('name_en')->nullable();

            $table->string('city')->nullable();
            $table->text('address')->nullable();
            $table->string('phone', 30)->nullable();

            // رقم المنشأة في قوى — كل فرع ممكن يكون منشأة منفصلة
            $table->string('establishment_number', 30)->nullable();

            // موقع الفرع — لبصمة الحضور بالموقع الجغرافي
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->unsignedSmallInteger('geofence_meters')->default(200);

            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index('is_active');
        });

        Schema::create('hr_departments', function (Blueprint $table) {
            $table->id();

            $table->string('code', 30)->unique();
            $table->string('name');
            $table->string('name_en')->nullable();

            $table->foreignId('parent_id')
                ->nullable()
                ->constrained('hr_departments')
                ->nullOnDelete();

            $table->foreignId('branch_id')
                ->nullable()
                ->constrained('hr_branches')
                ->nullOnDelete();

            // ربط القسم بمركز التكلفة — عشان مصروف الرواتب ينزل صح
            $table->foreignId('cost_center_id')
                ->nullable()
                ->constrained('cost_centers')
                ->nullOnDelete();

            $table->unsignedBigInteger('manager_id')->nullable();

            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index('parent_id');
            $table->index('branch_id');
        });

        Schema::create('hr_job_titles', function (Blueprint $table) {
            $table->id();

            $table->string('code', 30)->unique();
            $table->string('name');
            $table->string('name_en')->nullable();

            // التصنيف المهني المعتمد في قوى
            $table->string('qiwa_occupation_code', 30)->nullable();

            $table->decimal('min_salary', 15, 2)->nullable();
            $table->decimal('max_salary', 15, 2)->nullable();

            $table->boolean('is_active')->default(true);

            $table->timestamps();
        });

        Schema::create('hr_shifts', function (Blueprint $table) {
            $table->id();

            $table->string('code', 30)->unique();
            $table->string('name');

            // fixed | flexible | split | night
            $table->string('type', 20)->default('fixed');

            $table->time('start_time');
            $table->time('end_time');

            // وردية مقسومة (صباحي + مسائي)
            $table->time('break_start')->nullable();
            $table->time('break_end')->nullable();

            $table->unsignedSmallInteger('work_minutes')->default(480);

            // سماحية التأخير قبل اعتباره تأخيرًا
            $table->unsignedSmallInteger('grace_minutes')->default(10);

            // الوردية المرنة: الحد الأدنى للساعات بدل التوقيت الثابت
            $table->boolean('is_flexible')->default(false);

            /*
             * توقيت رمضان — جسر بيميّز نفسه بده، والنظام السعودي
             * بيقلّل ساعات العمل للمسلمين في رمضان.
             */
            $table->time('ramadan_start_time')->nullable();
            $table->time('ramadan_end_time')->nullable();
            $table->unsignedSmallInteger('ramadan_work_minutes')->nullable();

            // أيام الراحة: [5,6] = الجمعة والسبت
            $table->json('weekend_days')->nullable();

            $table->boolean('is_active')->default(true);

            $table->timestamps();
        });

        Schema::create('hr_employees', function (Blueprint $table) {
            $table->id();

            $table->string('employee_number', 30)->unique();

            // ربط اختياري بحساب مستخدم للخدمة الذاتية
            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            // الاسم
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->string('full_name_en')->nullable();

            // الهوية
            $table->string('national_id', 20)->nullable()->unique();

            // saudi | gcc | expat — مش المُحدِّد الوحيد لنسبة التأمينات
            $table->string('nationality_type', 20)->default('saudi');
            $table->string('nationality')->nullable();

            $table->date('birth_date')->nullable();
            $table->string('gender', 10)->nullable();
            $table->string('marital_status', 20)->nullable();
            $table->string('religion', 20)->nullable();

            // الإقامة والتأشيرة — لمتابعة مقيم
            $table->string('iqama_number', 20)->nullable();
            $table->date('iqama_expiry')->nullable();
            $table->string('passport_number', 30)->nullable();
            $table->date('passport_expiry')->nullable();
            $table->string('visa_number', 30)->nullable();
            $table->string('border_number', 30)->nullable();

            // التواصل
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_phone', 30)->nullable();

            // التنظيم
            $table->foreignId('branch_id')
                ->nullable()
                ->constrained('hr_branches')
                ->nullOnDelete();

            $table->foreignId('department_id')
                ->nullable()
                ->constrained('hr_departments')
                ->nullOnDelete();

            $table->foreignId('job_title_id')
                ->nullable()
                ->constrained('hr_job_titles')
                ->nullOnDelete();

            $table->foreignId('shift_id')
                ->nullable()
                ->constrained('hr_shifts')
                ->nullOnDelete();

            $table->foreignId('manager_id')
                ->nullable()
                ->constrained('hr_employees')
                ->nullOnDelete();

            // التوظيف
            $table->date('hire_date');
            $table->date('probation_end_date')->nullable();

            // active | probation | on_leave | suspended | terminated
            $table->string('status', 30)->default('probation');

            $table->date('termination_date')->nullable();

            // resignation | dismissal | contract_end | retirement | death
            $table->string('termination_reason', 30)->nullable();

            /*
             * ====== التأمينات الاجتماعية ======
             * الفخ اللي بيسقّط أنظمة الرواتب: الجنسية وحدها مش كافية
             * لتحديد النسبة. سعودي مُعيَّن جديد في 2026 يبقى على النظام
             * القديم لو عنده سجل اشتراكات سابق قبل 3 يوليو 2024.
             */
            $table->string('gosi_number', 30)->nullable();

            // أول اشتراك في التأمينات على الإطلاق — مش تاريخ التعيين
            $table->date('gosi_first_registration_date')->nullable();

            // existing | new — يُحسب من التاريخ أعلاه ويُحفظ صريحًا
            $table->string('gosi_scheme', 20)->nullable();

            $table->boolean('gosi_subscribed')->default(true);

            // البنك — لملف حماية الأجور
            $table->string('bank_name')->nullable();
            $table->string('iban', 34)->nullable();

            $table->string('photo_path')->nullable();
            $table->text('notes')->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            $table->index('status');
            $table->index('department_id');
            $table->index('branch_id');
            $table->index(['nationality_type', 'status']);
            $table->index('iqama_expiry');
            $table->index('gosi_scheme');
        });

        Schema::create('hr_employee_contracts', function (Blueprint $table) {
            $table->id();

            $table->foreignId('employee_id')
                ->constrained('hr_employees')
                ->cascadeOnDelete();

            $table->string('contract_number', 50)->unique();

            // fixed_term | unlimited | part_time | temporary
            $table->string('type', 30)->default('fixed_term');

            $table->date('start_date');
            $table->date('end_date')->nullable();

            /*
             * ====== هيكل الأجر ======
             * وعاء التأمينات = الأساسي + بدل السكن فقط، بحد 45,000.
             * وعاء نهاية الخدمة = الأساسي + كل البدلات الثابتة.
             * الاتنين مختلفين — والخطأ في التفرقة بينهم شائع.
             */
            $table->decimal('basic_salary', 15, 2);
            $table->decimal('housing_allowance', 15, 2)->default(0);
            $table->decimal('transport_allowance', 15, 2)->default(0);
            $table->decimal('phone_allowance', 15, 2)->default(0);
            $table->decimal('food_allowance', 15, 2)->default(0);
            $table->decimal('other_allowance', 15, 2)->default(0);

            // بدلات متغيّرة لا تدخل في نهاية الخدمة
            $table->json('variable_allowances')->nullable();

            $table->string('currency', 3)->default('SAR');

            // الإجازة السنوية — ٢١ يوم حد أدنى نظامًا، ٣٠ بعد ٥ سنين
            $table->unsignedSmallInteger('annual_leave_days')->default(21);

            $table->unsignedSmallInteger('notice_period_days')->default(60);

            // توثيق قوى — من ١٥ أبريل ٢٠٢٦ شرط لحساب الموظف في نطاقات
            $table->string('qiwa_contract_number', 50)->nullable();
            $table->date('qiwa_authenticated_at')->nullable();

            // draft | active | expired | terminated | renewed
            $table->string('status', 20)->default('draft');

            $table->foreignId('previous_contract_id')
                ->nullable()
                ->constrained('hr_employee_contracts')
                ->nullOnDelete();

            $table->string('document_path')->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index(['employee_id', 'status']);
            $table->index('end_date');
            $table->index('qiwa_authenticated_at');
        });

        // المدير على القسم — يُضاف بعد إنشاء جدول الموظفين
        Schema::table('hr_departments', function (Blueprint $table) {
            $table->foreign('manager_id')
                ->references('id')
                ->on('hr_employees')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('hr_departments', function (Blueprint $table) {
            $table->dropForeign(['manager_id']);
        });

        Schema::dropIfExists('hr_employee_contracts');
        Schema::dropIfExists('hr_employees');
        Schema::dropIfExists('hr_shifts');
        Schema::dropIfExists('hr_job_titles');
        Schema::dropIfExists('hr_departments');
        Schema::dropIfExists('hr_branches');
    }
};
