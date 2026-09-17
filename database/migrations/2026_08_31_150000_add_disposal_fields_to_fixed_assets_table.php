<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('fixed_assets')) {
            return;
        }

        Schema::table('fixed_assets', function (Blueprint $table): void {
            if (!Schema::hasColumn('fixed_assets', 'disposal_date')) {
                $table->date('disposal_date')->nullable()->after('status');
            }
            if (!Schema::hasColumn('fixed_assets', 'disposal_proceeds')) {
                $table->decimal('disposal_proceeds', 18, 2)->nullable()->after('disposal_date');
            }
            if (!Schema::hasColumn('fixed_assets', 'disposal_type')) {
                $table->enum('disposal_type', ['sale', 'write_off'])->nullable()->after('disposal_proceeds');
            }
            if (!Schema::hasColumn('fixed_assets', 'disposal_notes')) {
                $table->text('disposal_notes')->nullable()->after('disposal_type');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('fixed_assets')) {
            return;
        }

        Schema::table('fixed_assets', function (Blueprint $table): void {
            foreach (['disposal_date', 'disposal_proceeds', 'disposal_type', 'disposal_notes'] as $column) {
                if (Schema::hasColumn('fixed_assets', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
