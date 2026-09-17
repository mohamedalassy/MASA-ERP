<?php

namespace Database\Seeders;

use App\Models\TaxCode;
use Illuminate\Database\Seeder;

/**
 * أكواد الضريبة الأساسية.
 *
 * أكواد أسباب الإعفاء هي الأكواد المعتمدة في الفاتورة الإلكترونية —
 * زاتكا بترفض الفاتورة الصفرية أو المعفاة بدون سبب إعفاء صريح.
 *
 * التشغيل:  php artisan db:seed --class=TaxCodesSeeder
 */
class TaxCodesSeeder extends Seeder
{
    public function run(): void
    {
        $codes = [
            [
                'code' => 'S15',
                'name' => 'خاضع للضريبة 15%',
                'name_en' => 'Standard Rate 15%',
                'rate' => 15,
                'category' => 'standard',
                'exemption_reason_code' => null,
                'exemption_reason' => null,
                'is_default' => true,
            ],
            [
                'code' => 'S05',
                'name' => 'خاضع للضريبة 5%',
                'name_en' => 'Standard Rate 5%',
                'rate' => 5,
                'category' => 'standard',
                'exemption_reason_code' => null,
                'exemption_reason' => null,
                'is_default' => false,
            ],
            [
                'code' => 'Z-VATEX-SA-32',
                'name' => 'صفري — تصدير سلع',
                'name_en' => 'Zero Rated — Export of Goods',
                'rate' => 0,
                'category' => 'zero_rated',
                'exemption_reason_code' => 'VATEX-SA-32',
                'exemption_reason' => 'تصدير السلع من المملكة',
                'is_default' => false,
            ],
            [
                'code' => 'Z-VATEX-SA-33',
                'name' => 'صفري — تصدير خدمات',
                'name_en' => 'Zero Rated — Export of Services',
                'rate' => 0,
                'category' => 'zero_rated',
                'exemption_reason_code' => 'VATEX-SA-33',
                'exemption_reason' => 'تصدير الخدمات خارج المملكة',
                'is_default' => false,
            ],
            [
                'code' => 'E-VATEX-SA-29',
                'name' => 'معفى — خدمات مالية',
                'name_en' => 'Exempt — Financial Services',
                'rate' => 0,
                'category' => 'exempt',
                'exemption_reason_code' => 'VATEX-SA-29',
                'exemption_reason' => 'الخدمات المالية المعفاة',
                'is_default' => false,
            ],
            [
                'code' => 'O-OUT',
                'name' => 'خارج نطاق الضريبة',
                'name_en' => 'Out of Scope',
                'rate' => 0,
                'category' => 'out_of_scope',
                'exemption_reason_code' => 'VATEX-SA-OOS',
                'exemption_reason' => 'التوريد خارج نطاق ضريبة القيمة المضافة',
                'is_default' => false,
            ],
        ];

        foreach ($codes as $code) {
            TaxCode::updateOrCreate(
                ['code' => $code['code']],
                [...$code, 'is_active' => true]
            );
        }
    }
}
