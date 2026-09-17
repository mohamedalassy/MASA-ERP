<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_quotation_items', function (Blueprint $table) {

            $table->foreignId('quotation_id')
                ->constrained('project_quotations')
                ->cascadeOnDelete();

            $table->foreignId('product_id')
                ->nullable()
                ->constrained('products')
                ->nullOnDelete();

            $table->string('product_name');

            $table->string('sku')->nullable();

            $table->text('description')->nullable();

            $table->decimal('quantity', 12, 2)
                ->default(1);

            $table->decimal('cost_price', 15, 2)
                ->default(0);

            $table->decimal('unit_price', 15, 2)
                ->default(0);

            $table->decimal('discount', 15, 2)
                ->default(0);

            $table->decimal('tax_rate', 5, 2)
                ->default(15);

            $table->decimal('tax_amount', 15, 2)
                ->default(0);

            $table->decimal('line_total', 15, 2)
                ->default(0);

            $table->decimal('profit_amount', 15, 2)
                ->default(0);

            $table->decimal('profit_margin', 7, 2)
                ->default(0);

            $table->unsignedInteger('sort_order')
                ->default(0);

            $table->index('quotation_id');

            $table->index('product_id');

            $table->index('sku');
        });
    }

    public function down(): void
    {
        Schema::table('project_quotation_items', function (Blueprint $table) {

            $table->dropForeign(['quotation_id']);
            $table->dropForeign(['product_id']);

            $table->dropIndex(['quotation_id']);
            $table->dropIndex(['product_id']);
            $table->dropIndex(['sku']);

            $table->dropColumn([
                'quotation_id',
                'product_id',
                'product_name',
                'sku',
                'description',
                'quantity',
                'cost_price',
                'unit_price',
                'discount',
                'tax_rate',
                'tax_amount',
                'line_total',
                'profit_amount',
                'profit_margin',
                'sort_order',
            ]);
        });
    }
};