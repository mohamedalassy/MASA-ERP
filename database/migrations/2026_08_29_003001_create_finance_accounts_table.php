<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('finance_accounts', function (Blueprint $table) {
            $table->id();

            $table->string('code', 50)->unique();

            $table->string('name');

            $table->string('name_en')
                ->nullable();

            /*
             * asset
             * liability
             * equity
             * revenue
             * expense
             */
            $table->string('type', 30);

            $table->foreignId('parent_id')
                ->nullable()
                ->constrained('finance_accounts')
                ->nullOnDelete();

            $table->unsignedInteger('level')
                ->default(1);

            /*
             * debit
             * credit
             */
            $table->string(
                'normal_balance',
                10
            );

            /*
             * الحساب التجميعي:
             * is_postable = false
             *
             * الحساب الذي يقبل القيود:
             * is_postable = true
             */
            $table->boolean('is_postable')
                ->default(true);

            $table->boolean('is_active')
                ->default(true);

            $table->text('description')
                ->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('type');
            $table->index('parent_id');
            $table->index('is_active');
            $table->index('is_postable');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'finance_accounts'
        );
    }
};