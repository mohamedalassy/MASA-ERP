<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('tax_invoice_payments', 'finance_account_id')) {
            Schema::table('tax_invoice_payments', function (Blueprint $table) {
                $table->foreignId('finance_account_id')
                    ->nullable()
                    ->after('project_id')
                    ->constrained('finance_accounts')
                    ->nullOnDelete();
            });
        }

        if (!Schema::hasColumn('tax_invoice_payments', 'receivable_account_id')) {
            Schema::table('tax_invoice_payments', function (Blueprint $table) {
                $table->foreignId('receivable_account_id')
                    ->nullable()
                    ->after('finance_account_id')
                    ->constrained('finance_accounts')
                    ->nullOnDelete();
            });
        }

        if (!Schema::hasColumn('tax_invoice_payments', 'finance_journal_entry_id')) {
            Schema::table('tax_invoice_payments', function (Blueprint $table) {
                $table->foreignId('finance_journal_entry_id')
                    ->nullable()
                    ->after('receivable_account_id')
                    ->constrained('finance_journal_entries')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('tax_invoice_payments', 'finance_journal_entry_id')) {
            Schema::table('tax_invoice_payments', function (Blueprint $table) {
                $table->dropConstrainedForeignId('finance_journal_entry_id');
            });
        }

        if (Schema::hasColumn('tax_invoice_payments', 'receivable_account_id')) {
            Schema::table('tax_invoice_payments', function (Blueprint $table) {
                $table->dropConstrainedForeignId('receivable_account_id');
            });
        }

        if (Schema::hasColumn('tax_invoice_payments', 'finance_account_id')) {
            Schema::table('tax_invoice_payments', function (Blueprint $table) {
                $table->dropConstrainedForeignId('finance_account_id');
            });
        }
    }
};
