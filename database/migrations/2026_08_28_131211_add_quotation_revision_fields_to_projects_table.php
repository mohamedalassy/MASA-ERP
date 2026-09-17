<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_quotations', function (Blueprint $table) {
            if (!Schema::hasColumn('project_quotations', 'target_margin')) {
                $table->decimal('target_margin', 7, 2)
                    ->default(25)
                    ->after('total');
            }

            if (!Schema::hasColumn('project_quotations', 'header_tax_rate')) {
                $table->decimal('header_tax_rate', 5, 2)
                    ->default(15)
                    ->after('target_margin');
            }

            if (!Schema::hasColumn('project_quotations', 'extra_costs')) {
                $table->json('extra_costs')
                    ->nullable()
                    ->after('header_tax_rate');
            }
        });

        Schema::table('project_quotation_items', function (Blueprint $table) {
            if (!Schema::hasColumn('project_quotation_items', 'unit')) {
                $table->string('unit', 100)
                    ->nullable()
                    ->after('description');
            }

            if (!Schema::hasColumn('project_quotation_items', 'section')) {
                $table->string('section', 150)
                    ->nullable()
                    ->after('unit');
            }

            if (!Schema::hasColumn('project_quotation_items', 'item_type')) {
                $table->string('item_type', 50)
                    ->default('inventory')
                    ->after('section');
            }
        });
    }

    public function down(): void
    {
        Schema::table('project_quotation_items', function (Blueprint $table) {
            $columns = [];

            foreach (['unit', 'section', 'item_type'] as $column) {
                if (Schema::hasColumn('project_quotation_items', $column)) {
                    $columns[] = $column;
                }
            }

            if ($columns) {
                $table->dropColumn($columns);
            }
        });

        Schema::table('project_quotations', function (Blueprint $table) {
            $columns = [];

            foreach (['target_margin', 'header_tax_rate', 'extra_costs'] as $column) {
                if (Schema::hasColumn('project_quotations', $column)) {
                    $columns[] = $column;
                }
            }

            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }
};
