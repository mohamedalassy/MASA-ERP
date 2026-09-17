<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * الجدول الأساسي للأصول الثابتة.
 * لازم يجي قبل الهجرة الموجودة عندك:
 *   2026_08_31_150000_add_disposal_fields_to_fixed_assets_table
 * لأنها بتضيف disposal_date و proceeds و type و notes — وهي مكتوبة
 * بشرط hasTable فلو الجدول مش موجود بتخرج بدون ما تعمل حاجة بصمت.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fixed_assets', function (Blueprint $table) {
            $table->id();

            $table->string('code', 50)->unique();
            $table->string('name');
            $table->text('description')->nullable();

            $table->string('category')->nullable();
            $table->string('serial_number')->nullable();
            $table->string('location')->nullable();

            // الحسابات الثلاثة اللازمة لقيد الإهلاك
            $table->foreignId('asset_account_id')
                ->nullable()
                ->constrained('finance_accounts')
                ->nullOnDelete();

            $table->foreignId('depreciation_account_id')
                ->nullable()
                ->constrained('finance_accounts')
                ->nullOnDelete();

            $table->foreignId('expense_account_id')
                ->nullable()
                ->constrained('finance_accounts')
                ->nullOnDelete();

            $table->foreignId('cost_center_id')
                ->nullable()
                ->constrained('cost_centers')
                ->nullOnDelete();

            $table->date('purchase_date');
            $table->decimal('cost', 18, 2);
            $table->decimal('salvage_value', 18, 2)->default(0);

            $table->unsignedSmallInteger('useful_life_months')->default(60);

            // straight_line | declining_balance
            $table->string('depreciation_method', 30)->default('straight_line');

            $table->decimal('accumulated_depreciation', 18, 2)->default(0);
            $table->date('depreciation_start_date')->nullable();
            $table->date('last_depreciation_date')->nullable();

            // active | fully_depreciated | disposed
            $table->string('status', 30)->default('active');

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('status');
            $table->index('category');
        });

        Schema::create('fixed_asset_depreciations', function (Blueprint $table) {
            $table->id();

            $table->foreignId('fixed_asset_id')
                ->constrained('fixed_assets')
                ->cascadeOnDelete();

            $table->foreignId('finance_journal_entry_id')
                ->nullable()
                ->constrained('finance_journal_entries')
                ->nullOnDelete();

            $table->unsignedSmallInteger('period_year');
            $table->unsignedTinyInteger('period_month');

            $table->decimal('amount', 18, 2);
            $table->decimal('accumulated_after', 18, 2);
            $table->decimal('book_value_after', 18, 2);

            $table->timestamps();

            // يمنع ترحيل إهلاك نفس الشهر مرتين
            $table->unique(
                ['fixed_asset_id', 'period_year', 'period_month'],
                'asset_depreciation_period_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fixed_asset_depreciations');
        Schema::dropIfExists('fixed_assets');
    }
};
