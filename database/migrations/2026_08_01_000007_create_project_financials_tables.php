<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * الحقول مستخرجة من استخدامها الفعلي في:
 *   FinanceDashboardController  (direction, status, remaining_amount, due_date)
 *   SuppliersCenterController
 *   ProjectFinancialTransactionController (8 دوال)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_expenses', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            $table->string('title');
            $table->text('description')->nullable();
            $table->string('category')->nullable();

            $table->decimal('amount', 15, 2);
            $table->date('expense_date');

            $table->string('attachment_path')->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('project_id');
            $table->index('expense_date');
        });

        Schema::create('project_financial_transactions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            $table->foreignId('quotation_id')
                ->nullable()
                ->constrained('project_quotations')
                ->nullOnDelete();

            $table->foreignId('purchase_order_id')
                ->nullable()
                ->constrained('purchase_orders')
                ->nullOnDelete();

            $table->foreignId('supplier_id')
                ->nullable()
                ->constrained('suppliers')
                ->nullOnDelete();

            // income | expense — مستخدمة في لوحة المالية
            $table->string('direction', 10);

            // invoice | payment | advance | retention | other
            $table->string('type', 30)->default('invoice');

            $table->string('title');
            $table->string('reference_number')->nullable();
            $table->text('description')->nullable();

            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('tax', 15, 2)->default(0);
            $table->decimal('total', 15, 2)->default(0);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('remaining_amount', 15, 2)->default(0);

            $table->date('transaction_date');
            $table->date('due_date')->nullable();

            /*
             * draft | pending | approved | partially_paid
             * paid | cancelled
             * (اللوحة بتستبعد paid وcancelled من الذمم)
             */
            $table->string('status', 30)->default('draft');

            $table->string('payment_method', 50)->nullable();

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
            $table->index(['direction', 'status']);
            $table->index('due_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_financial_transactions');
        Schema::dropIfExists('project_expenses');
    }
};
