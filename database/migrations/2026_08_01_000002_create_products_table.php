<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/* الحقول مستخرجة من $fillable و$casts بموديل Product. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();

            $table->string('sku', 100)->unique();
            $table->string('name');

            $table->string('category')->nullable();
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            $table->text('description')->nullable();
            $table->string('unit', 30)->default('قطعة');

            $table->decimal('cost_price', 15, 2)->default(0);
            $table->decimal('default_sale_price', 15, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(15);

            $table->decimal('stock_quantity', 15, 2)->default(0);
            $table->decimal('minimum_stock', 15, 2)->default(0);

            $table->string('default_supplier')->nullable();
            $table->string('barcode', 100)->nullable();
            $table->string('image_path')->nullable();

            $table->boolean('is_active')->default(true);

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('category');
            $table->index('is_active');
            $table->index('barcode');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
