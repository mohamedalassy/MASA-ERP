<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'finance_journal_lines',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId(
                    'journal_entry_id'
                )
                    ->constrained(
                        'finance_journal_entries'
                    )
                    ->cascadeOnDelete();

                $table->foreignId('account_id')
                    ->constrained(
                        'finance_accounts'
                    )
                    ->restrictOnDelete();

                $table->foreignId(
                    'cost_center_id'
                )
                    ->nullable()
                    ->constrained(
                        'cost_centers'
                    )
                    ->nullOnDelete();

                $table->foreignId('project_id')
                    ->nullable()
                    ->constrained('projects')
                    ->nullOnDelete();

                $table->text('description')
                    ->nullable();

                $table->decimal(
                    'debit',
                    15,
                    2
                )->default(0);

                $table->decimal(
                    'credit',
                    15,
                    2
                )->default(0);

                $table->timestamps();

                $table->index(
                    'journal_entry_id'
                );

                $table->index('account_id');

                $table->index(
                    'cost_center_id'
                );

                $table->index('project_id');
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_journal_lines'
        );
    }
};