<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * اعتماد العميل على عرض السعر — منفصل عن الاعتماد الداخلي.
 *
 * مهم: الاعتماد الخارجي لا يُرحَّل مباشرة. بيسجّل قرار العميل
 * وبيسيب الاعتماد الداخلي لدورة الموافقات، عشان بوابة الهامش
 * تفضل شغّالة وميبقاش فيه طريق يتخطاها.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_quotations', function (Blueprint $table) {
            if (!Schema::hasColumn('project_quotations', 'customer_approved_at')) {
                $table->timestamp('customer_approved_at')->nullable();
                $table->string('customer_approved_by')->nullable();
            }

            if (!Schema::hasColumn('project_quotations', 'quotation_template_id')) {
                $table->unsignedBigInteger('quotation_template_id')->nullable();
            }

            if (!Schema::hasColumn('project_quotations', 'opportunity_id')) {
                $table->unsignedBigInteger('opportunity_id')->nullable();
            }

            /* الطبقة التجارية — من القالب */
            if (!Schema::hasColumn('project_quotations', 'payment_terms')) {
                $table->text('payment_terms')->nullable();
                $table->string('delivery_period')->nullable();
                $table->string('warranty_period')->nullable();
                $table->text('exclusions')->nullable();
                $table->text('general_terms')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('project_quotations', function (Blueprint $table) {
            $table->dropColumn([
                'customer_approved_at',
                'customer_approved_by',
                'quotation_template_id',
                'opportunity_id',
                'payment_terms',
                'delivery_period',
                'warranty_period',
                'exclusions',
                'general_terms',
            ]);
        });
    }
};
