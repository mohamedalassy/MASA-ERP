<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * منظومة المبيعات — الفرص وأسباب الخسارة وقوالب العروض
 * وبوابة اعتماد العميل.
 *
 * الفكرة المعمارية: دلوقتي أول كيان في النظام هو "مشروع" — يعني
 * لازم تكون كسبت الصفقة عشان تسجّلها. الفرصة بتسبق المشروع،
 * والفرصة المكسوبة بتتحوّل لمشروع.
 */
return new class extends Migration
{
    public function up(): void
    {
        /* ===== مراحل خط الأنابيب — قابلة للتخصيص ===== */
        Schema::create('sales_stages', function (Blueprint $table) {
            $table->id();

            $table->string('code', 30)->unique();
            $table->string('name');

            $table->unsignedInteger('sort_order')->default(0);

            // الاحتمالية الافتراضية للمرحلة — أساس الترجيح
            $table->unsignedTinyInteger('default_probability')->default(10);

            // مرحلة نهائية: won | lost | null
            $table->string('is_final', 10)->nullable();

            // لون الكارت في اللوحة
            $table->string('color', 20)->default('#6557f5');

            // تنبيه لو الفرصة وقفت في المرحلة أكتر من كده
            $table->unsignedSmallInteger('stale_after_days')->nullable();

            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index(['is_active', 'sort_order']);
        });

        /* ===== أسباب الخسارة — معرَّفة مش نص حر ===== */
        Schema::create('sales_loss_reasons', function (Blueprint $table) {
            $table->id();

            $table->string('code', 30)->unique();
            $table->string('name');

            /*
             * التصنيف — عليه يتبنى التحليل:
             * price | specification | lead_time | payment_terms
             * competitor | customer_cancelled | no_response | other
             */
            $table->string('category', 30);

            // هل يتطلب ملاحظة نصية إلزامية
            $table->boolean('requires_note')->default(false);

            $table->boolean('is_active')->default(true);

            $table->timestamps();
        });

        /* ===== الفرص ===== */
        Schema::create('sales_opportunities', function (Blueprint $table) {
            $table->id();

            $table->string('opportunity_number', 50)->unique();
            $table->string('title');

            /* العميل — قد يكون جديدًا غير مسجّل */
            $table->string('customer_name');
            $table->string('customer_code', 50)->nullable();
            $table->string('contact_person')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();
            $table->string('city')->nullable();

            /*
             * المصدر — لتحليل أي قناة بتجيب شغل فعلاً:
             * referral | website | walk_in | tender | existing_customer
             * exhibition | cold_call | social | other
             */
            $table->string('source', 30)->nullable();

            $table->foreignId('stage_id')
                ->constrained('sales_stages')
                ->restrictOnDelete();

            // القيمة التقديرية والاحتمالية — القيمة المرجَّحة تُحسب منهما
            $table->decimal('estimated_value', 15, 2)->default(0);
            $table->unsignedTinyInteger('probability')->default(10);

            // هل المستخدم عدّل الاحتمالية يدويًا (فلا تُستبدل بقيمة المرحلة)
            $table->boolean('probability_overridden')->default(false);

            $table->date('expected_close_date')->nullable();

            $table->string('project_type')->nullable();
            $table->text('description')->nullable();

            /* التخصيص */
            $table->foreignId('owner_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            /* النتيجة */
            // open | won | lost
            $table->string('status', 20)->default('open');

            $table->foreignId('loss_reason_id')
                ->nullable()
                ->constrained('sales_loss_reasons')
                ->nullOnDelete();

            $table->text('loss_note')->nullable();
            $table->decimal('competitor_price', 15, 2)->nullable();
            $table->string('competitor_name')->nullable();

            $table->timestamp('closed_at')->nullable();

            /* التحوّل لمشروع — الفرصة المكسوبة بتولّد مشروعًا */
            $table->foreignId('project_id')
                ->nullable()
                ->constrained('projects')
                ->nullOnDelete();

            /* تتبّع مدة البقاء في المرحلة — لكشف عنق الزجاجة */
            $table->timestamp('stage_entered_at')->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index(['status', 'stage_id']);
            $table->index('owner_id');
            $table->index('expected_close_date');
            $table->index('source');
        });

        /* ===== سجل انتقال المراحل ===== */
        Schema::create('sales_opportunity_stage_history', function (Blueprint $table) {
            $table->id();

            $table->foreignId('opportunity_id')
                ->constrained('sales_opportunities')
                ->cascadeOnDelete();

            $table->foreignId('from_stage_id')
                ->nullable()
                ->constrained('sales_stages')
                ->nullOnDelete();

            $table->foreignId('to_stage_id')
                ->constrained('sales_stages')
                ->restrictOnDelete();

            // المدة في المرحلة السابقة — بالأيام
            $table->unsignedInteger('days_in_previous_stage')->nullable();

            $table->foreignId('moved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('opportunity_id');
        });

        /* ===== قوالب العروض — باقة بنود + طبقة شروط ===== */
        Schema::create('quotation_templates', function (Blueprint $table) {
            $table->id();

            $table->string('code', 50)->unique();
            $table->string('name');
            $table->text('description')->nullable();

            // الباقة اللي بتجيب البنود
            $table->foreignId('pricing_package_id')
                ->nullable()
                ->constrained('pricing_packages')
                ->nullOnDelete();

            /* الطبقة التجارية — وهي اللي ناقصة في الباقات حاليًا */
            $table->text('payment_terms')->nullable();
            $table->string('delivery_period')->nullable();
            $table->string('warranty_period')->nullable();
            $table->text('exclusions')->nullable();
            $table->text('general_terms')->nullable();
            $table->text('notes')->nullable();

            $table->unsignedSmallInteger('validity_days')->default(30);

            $table->boolean('is_active')->default(true);

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();
        });

        /* ===== بوابة العميل — اعتماد العرض أونلاين ===== */
        Schema::create('quotation_portal_tokens', function (Blueprint $table) {
            $table->id();

            $table->foreignId('quotation_id')
                ->constrained('project_quotations')
                ->cascadeOnDelete();

            // التوكن في الرابط — عشوائي وطويل
            $table->string('token', 64)->unique();

            $table->timestamp('expires_at')->nullable();

            /* التتبّع — إثبات الاستلام */
            $table->timestamp('first_viewed_at')->nullable();
            $table->timestamp('last_viewed_at')->nullable();
            $table->unsignedInteger('view_count')->default(0);

            /* قرار العميل */
            // pending | approved | changes_requested
            $table->string('decision', 30)->default('pending');
            $table->timestamp('decided_at')->nullable();

            // إثبات الاعتماد — لازم قانونيًا
            $table->string('decided_by_name')->nullable();
            $table->string('decided_ip', 45)->nullable();
            $table->text('decided_user_agent')->nullable();

            $table->text('customer_note')->nullable();

            $table->boolean('is_revoked')->default(false);

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('quotation_id');
            $table->index('decision');
        });

        /* ===== أهداف المندوبين ===== */
        Schema::create('sales_targets', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // monthly | quarterly | yearly
            $table->string('period_type', 20)->default('monthly');

            $table->unsignedSmallInteger('period_year');
            $table->unsignedTinyInteger('period_month')->nullable();
            $table->unsignedTinyInteger('period_quarter')->nullable();

            $table->decimal('revenue_target', 15, 2)->default(0);

            // هدف الهامش — لمنع تحقيق الهدف بخصومات كبيرة
            $table->decimal('margin_target_percent', 5, 2)->nullable();

            /*
             * شرائح العمولة على الهامش:
             * [{min_margin: 20, rate: 1.5}, {min_margin: 30, rate: 2.5}]
             * العمولة على الربح مش على الإيراد — وده اللي يمنع
             * المندوب يبيع بخصم كبير عشان يحقق هدفه.
             */
            $table->json('commission_tiers')->nullable();

            $table->timestamps();

            $table->unique(
                ['user_id', 'period_type', 'period_year', 'period_month', 'period_quarter'],
                'sales_target_period_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_targets');
        Schema::dropIfExists('quotation_portal_tokens');
        Schema::dropIfExists('quotation_templates');
        Schema::dropIfExists('sales_opportunity_stage_history');
        Schema::dropIfExists('sales_opportunities');
        Schema::dropIfExists('sales_loss_reasons');
        Schema::dropIfExists('sales_stages');
    }
};
