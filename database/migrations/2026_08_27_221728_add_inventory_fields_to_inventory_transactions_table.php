<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'inventory_transactions',
            function (Blueprint $table) {

                if (
                    !Schema::hasColumn(
                        'inventory_transactions',
                        'product_id'
                    )
                ) {
                    $table->foreignId('product_id')
                        ->nullable()
                        ->after('id')
                        ->constrained('products')
                        ->nullOnDelete();
                }

                if (
                    !Schema::hasColumn(
                        'inventory_transactions',
                        'project_id'
                    )
                ) {
                    $table->foreignId('project_id')
                        ->nullable()
                        ->after('product_id')
                        ->constrained('projects')
                        ->nullOnDelete();
                }

                if (
                    !Schema::hasColumn(
                        'inventory_transactions',
                        'purchase_order_id'
                    )
                ) {
                    $table->foreignId('purchase_order_id')
                        ->nullable()
                        ->after('project_id')
                        ->constrained('purchase_orders')
                        ->nullOnDelete();
                }

                if (
                    !Schema::hasColumn(
                        'inventory_transactions',
                        'purchase_order_item_id'
                    )
                ) {
                    $table->foreignId('purchase_order_item_id')
                        ->nullable()
                        ->after('purchase_order_id')
                        ->constrained('purchase_order_items')
                        ->nullOnDelete();
                }

                if (
                    !Schema::hasColumn(
                        'inventory_transactions',
                        'type'
                    )
                ) {
                    $table->string('type', 30)
                        ->after('purchase_order_item_id');
                }

                if (
                    !Schema::hasColumn(
                        'inventory_transactions',
                        'quantity'
                    )
                ) {
                    $table->decimal(
                        'quantity',
                        12,
                        2
                    )
                        ->default(0)
                        ->after('type');
                }

                if (
                    !Schema::hasColumn(
                        'inventory_transactions',
                        'unit_cost'
                    )
                ) {
                    $table->decimal(
                        'unit_cost',
                        15,
                        2
                    )
                        ->default(0)
                        ->after('quantity');
                }

                if (
                    !Schema::hasColumn(
                        'inventory_transactions',
                        'stock_before'
                    )
                ) {
                    $table->decimal(
                        'stock_before',
                        12,
                        2
                    )
                        ->default(0)
                        ->after('unit_cost');
                }

                if (
                    !Schema::hasColumn(
                        'inventory_transactions',
                        'stock_after'
                    )
                ) {
                    $table->decimal(
                        'stock_after',
                        12,
                        2
                    )
                        ->default(0)
                        ->after('stock_before');
                }

                if (
                    !Schema::hasColumn(
                        'inventory_transactions',
                        'reference'
                    )
                ) {
                    $table->string('reference')
                        ->nullable()
                        ->after('stock_after');
                }

                if (
                    !Schema::hasColumn(
                        'inventory_transactions',
                        'notes'
                    )
                ) {
                    $table->text('notes')
                        ->nullable()
                        ->after('reference');
                }

                if (
                    !Schema::hasColumn(
                        'inventory_transactions',
                        'created_by'
                    )
                ) {
                    $table->foreignId('created_by')
                        ->nullable()
                        ->after('notes')
                        ->constrained('users')
                        ->nullOnDelete();
                }
            }
        );
    }

    public function down(): void
    {
        Schema::table(
            'inventory_transactions',
            function (Blueprint $table) {

                $table->dropForeign([
                    'product_id',
                ]);

                $table->dropForeign([
                    'project_id',
                ]);

                $table->dropForeign([
                    'purchase_order_id',
                ]);

                $table->dropForeign([
                    'purchase_order_item_id',
                ]);

                $table->dropForeign([
                    'created_by',
                ]);

                $table->dropColumn([
                    'product_id',
                    'project_id',
                    'purchase_order_id',
                    'purchase_order_item_id',
                    'type',
                    'quantity',
                    'unit_cost',
                    'stock_before',
                    'stock_after',
                    'reference',
                    'notes',
                    'created_by',
                ]);
            }
        );
    }
};