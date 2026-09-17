<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('bank_reconciliations')) {
            Schema::create('bank_reconciliations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('finance_account_id')->constrained('finance_accounts')->restrictOnDelete();
                $table->date('period_from');
                $table->date('period_to');
                $table->decimal('statement_opening_balance', 18, 2)->default(0);
                $table->decimal('statement_closing_balance', 18, 2)->default(0);
                $table->decimal('system_closing_balance', 18, 2)->default(0);
                $table->decimal('difference', 18, 2)->default(0);
                $table->enum('status', ['draft', 'completed'])->default('draft');
                $table->text('notes')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();
                $table->index(
                    ['finance_account_id', 'period_from', 'period_to'],
                    'bank_rec_account_period_idx'
                );
            });
        }

        if (!Schema::hasTable('bank_statement_lines')) {
            Schema::create('bank_statement_lines', function (Blueprint $table) {
                $table->id();
                $table->foreignId('bank_reconciliation_id')
                    ->constrained('bank_reconciliations')
                    ->cascadeOnDelete();
                $table->date('transaction_date');
                $table->string('description')->nullable();
                $table->string('reference_number', 150)->nullable();
                $table->decimal('debit', 18, 2)->default(0);
                $table->decimal('credit', 18, 2)->default(0);
                $table->decimal('amount', 18, 2);
                $table->enum('match_status', ['unmatched', 'matched', 'ignored'])
                    ->default('unmatched');
                $table->foreignId('finance_journal_line_id')
                    ->nullable()
                    ->constrained('finance_journal_lines')
                    ->nullOnDelete();
                $table->foreignId('matched_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();
                $table->timestamp('matched_at')->nullable();
                $table->timestamps();
                $table->index(
                    ['bank_reconciliation_id', 'match_status'],
                    'bank_line_status_idx'
                );
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_statement_lines');
        Schema::dropIfExists('bank_reconciliations');
    }
};
