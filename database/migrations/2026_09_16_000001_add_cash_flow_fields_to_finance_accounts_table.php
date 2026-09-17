<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * العمودان دول مستخدمان فعليًا في:
 *   - FinanceLedgerController::cashFlow()
 *   - BankReconciliationController::accounts()
 *   - SupplierInvoiceController::cashAccounts()
 *   - TaxInvoicePaymentController::accounts()
 * وموجودان في $fillable بموديل FinanceAccount — لكن مش في أي migration.
 * بدونهما قائمة التدفقات النقدية ترجع أصفارًا والتسوية البنكية تفضل فاضية.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('finance_accounts', function (Blueprint $table) {
            if (!Schema::hasColumn('finance_accounts', 'is_cash_account')) {
                $table->boolean('is_cash_account')
                    ->default(false)
                    ->after('is_postable');
            }

            if (!Schema::hasColumn('finance_accounts', 'cash_flow_category')) {
                /*
                 * operating | investing | financing
                 * فاضي = النظام يستنتج التصنيف من نوع الحساب المقابل.
                 */
                $table->string('cash_flow_category', 20)
                    ->nullable()
                    ->after('is_cash_account');
            }
        });

        Schema::table('finance_accounts', function (Blueprint $table) {
            $table->index('is_cash_account');
        });
    }

    public function down(): void
    {
        Schema::table('finance_accounts', function (Blueprint $table) {
            $table->dropIndex(['is_cash_account']);
            $table->dropColumn(['is_cash_account', 'cash_flow_category']);
        });
    }
};
