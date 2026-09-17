<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * المصادقة على منصة فاتورة بتستخدم Basic Auth بـ CSID كاسم مستخدم
 * وسرّ مرتبط بيه كلمة مرور. الاتنين بيرجعوا من نداء التوافق
 * (compliance) عند ربط النظام لأول مرة.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_tax_profiles', function (Blueprint $table) {
            if (!Schema::hasColumn('company_tax_profiles', 'zatca_secret')) {
                $table->text('zatca_secret')
                    ->nullable()
                    ->after('zatca_csid');
            }

            if (!Schema::hasColumn('company_tax_profiles', 'zatca_onboarded_at')) {
                $table->timestamp('zatca_onboarded_at')
                    ->nullable()
                    ->after('zatca_environment');
            }
        });
    }

    public function down(): void
    {
        Schema::table('company_tax_profiles', function (Blueprint $table) {
            $table->dropColumn(['zatca_secret', 'zatca_onboarded_at']);
        });
    }
};
