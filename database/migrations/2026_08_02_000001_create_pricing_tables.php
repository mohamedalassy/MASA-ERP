<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * جداول التسعير. الحقول مستخرجة من validatePayload في:
 *   PricingRuleController · PricingCostingController
 *   SupplierPriceController · PricingPackageController
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pricing_rules', function (Blueprint $table) {
            $table->id();

            $table->string('name');

            // global | product | customer
            // ملاحظة: resolve() بيقبل مُدخل category لكن المطابقة
            // مش بتدعمه — لو عايز نطاق فئة، ضيف 'category' هنا
            // وضيف الفرع المقابل في PricingRuleController::resolve
            $table->string('scope_type', 20)->default('global');
            $table->unsignedBigInteger('scope_id')->nullable();

            $table->decimal('minimum_margin_percent', 5, 2)->default(0);
            $table->decimal('target_margin_percent', 5, 2)->default(0);
            $table->decimal('default_markup_percent', 8, 2)->default(0);
            $table->decimal('maximum_discount_percent', 5, 2)->default(0);

            // البوابة الرقابية — تُقرأ في SuggestedPriceCalculator
            $table->boolean('block_below_minimum_margin')->default(false);
            $table->boolean('require_approval_below_target')->default(false);

            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('priority')->default(100);

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index(['scope_type', 'scope_id']);
            $table->index(['is_active', 'priority']);
        });

        Schema::create('supplier_prices', function (Blueprint $table) {
            $table->id();

            $table->foreignId('product_id')
                ->constrained('products')
                ->cascadeOnDelete();

            $table->foreignId('supplier_id')
                ->constrained('suppliers')
                ->cascadeOnDelete();

            $table->decimal('price', 15, 2);
            $table->string('currency', 3)->default('SAR');

            $table->decimal('minimum_quantity', 12, 2)->default(1);
            $table->unsignedSmallInteger('lead_time_days')->nullable();

            $table->date('valid_from')->nullable();
            $table->date('valid_until')->nullable();

            $table->boolean('is_preferred')->default(false);
            $table->boolean('is_active')->default(true);

            $table->text('notes')->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->unique(['product_id', 'supplier_id']);
            $table->index('is_active');
        });

        Schema::create('supplier_price_history', function (Blueprint $table) {
            $table->id();

            $table->foreignId('supplier_price_id')
                ->nullable()
                ->constrained('supplier_prices')
                ->nullOnDelete();

            $table->foreignId('product_id')
                ->constrained('products')
                ->cascadeOnDelete();

            $table->foreignId('supplier_id')
                ->constrained('suppliers')
                ->cascadeOnDelete();

            $table->decimal('old_price', 15, 2)->nullable();
            $table->decimal('new_price', 15, 2);
            $table->decimal('change_amount', 15, 2)->default(0);
            $table->decimal('change_percent', 8, 2)->default(0);

            $table->date('changed_on');
            $table->string('reason')->nullable();

            $table->foreignId('changed_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index(['product_id', 'changed_on']);
            $table->index('supplier_id');
        });

        Schema::create('product_alternatives', function (Blueprint $table) {
            $table->id();

            $table->foreignId('product_id')
                ->constrained('products')
                ->cascadeOnDelete();

            $table->foreignId('alternative_product_id')
                ->constrained('products')
                ->cascadeOnDelete();

            // equivalent | upgrade | downgrade
            $table->string('relation_type', 20)->default('equivalent');

            $table->unsignedTinyInteger('preference_order')->default(1);
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->unique(
                ['product_id', 'alternative_product_id'],
                'product_alternative_unique'
            );
        });

        Schema::create('pricing_packages', function (Blueprint $table) {
            $table->id();

            $table->string('code', 50)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('category')->nullable();

            $table->decimal('total_cost', 15, 2)->default(0);
            $table->decimal('total_price', 15, 2)->default(0);
            $table->decimal('discount_percent', 5, 2)->default(0);

            $table->boolean('is_active')->default(true);

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('is_active');
        });

        Schema::create('pricing_package_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('pricing_package_id')
                ->constrained('pricing_packages')
                ->cascadeOnDelete();

            $table->foreignId('product_id')
                ->nullable()
                ->constrained('products')
                ->nullOnDelete();

            $table->string('product_name');
            $table->string('sku', 100)->nullable();

            $table->decimal('quantity', 12, 2)->default(1);
            $table->decimal('cost_price', 15, 2)->default(0);
            $table->decimal('unit_price', 15, 2)->default(0);

            $table->unsignedInteger('sort_order')->default(0);

            $table->timestamps();

            $table->index('pricing_package_id');
        });

        Schema::create('pricing_costings', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_id')
                ->nullable()
                ->constrained('projects')
                ->nullOnDelete();

            $table->unsignedBigInteger('quotation_id')->nullable();

            $table->string('title')->default('Project Costing');
            $table->string('currency', 10)->default('SAR');

            $table->decimal('material_cost', 15, 2)->default(0);

            $table->decimal('minimum_margin_percent', 5, 2)->default(15);
            $table->decimal('target_margin_percent', 5, 2)->default(25);
            $table->decimal('tax_rate', 5, 2)->default(15);

            /*
             * مضاف زيادة على الكنترولر الحالي: السعر المعروض على العميل.
             * بدونه أي حساب تكلفة محفوظ بيرجع هامشه الحالي صفرًا دايمًا
             * لأن transform() بينادي calculateSummary بـ current_sale = 0.
             */
            $table->decimal('current_sale', 15, 2)->default(0);

            // draft | approved | archived
            $table->string('status', 20)->default('draft');

            $table->text('notes')->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('project_id');
            $table->index('status');
        });

        Schema::create('pricing_costing_components', function (Blueprint $table) {
            $table->id();

            $table->foreignId('pricing_costing_id')
                ->constrained('pricing_costings')
                ->cascadeOnDelete();

            // labor | transport | installation | overhead | other
            $table->string('type', 50);
            $table->string('label');

            // fixed | percentage
            $table->string('calculation_mode', 20)->default('fixed');

            // materials | running_subtotal
            $table->string('percentage_basis', 20)->default('materials');

            $table->decimal('fixed_amount', 15, 2)->default(0);
            $table->decimal('percentage', 8, 2)->default(0);

            $table->unsignedInteger('sort_order')->default(0);
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index('pricing_costing_id');
            $table->index('sort_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pricing_costing_components');
        Schema::dropIfExists('pricing_costings');
        Schema::dropIfExists('pricing_package_items');
        Schema::dropIfExists('pricing_packages');
        Schema::dropIfExists('product_alternatives');
        Schema::dropIfExists('supplier_price_history');
        Schema::dropIfExists('supplier_prices');
        Schema::dropIfExists('pricing_rules');
    }
};
