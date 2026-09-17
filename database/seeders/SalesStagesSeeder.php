<?php

namespace Database\Seeders;

use App\Models\SalesLossReason;
use App\Models\SalesStage;
use Illuminate\Database\Seeder;

/**
 * مراحل خط الأنابيب وأسباب الخسارة.
 *
 * المراحل مبنية على دورة شركة توريد وتركيب — زيارة الموقع مرحلة
 * مستقلة لأنها بتاخد وقت وبتفرق في الإغلاق.
 *
 * التشغيل: php artisan db:seed --class=SalesStagesSeeder
 */
class SalesStagesSeeder extends Seeder
{
    public function run(): void
    {
        $stages = [
            [
                'code' => 'inquiry',
                'name' => 'استفسار',
                'default_probability' => 10,
                'color' => '#9ba1ae',
                'stale_after_days' => 7,
            ],
            [
                'code' => 'qualified',
                'name' => 'مؤهّل',
                'default_probability' => 25,
                'color' => '#4f7df3',
                'stale_after_days' => 10,
            ],
            [
                'code' => 'site_visit',
                'name' => 'زيارة موقع',
                'default_probability' => 40,
                'color' => '#24b7c6',
                'stale_after_days' => 14,
            ],
            [
                'code' => 'quoted',
                'name' => 'عرض مُرسل',
                'default_probability' => 60,
                'color' => '#6557f5',
                'stale_after_days' => 10,
            ],
            [
                'code' => 'negotiation',
                'name' => 'تفاوض',
                'default_probability' => 80,
                'color' => '#f3a13b',
                'stale_after_days' => 14,
            ],
            [
                'code' => 'won',
                'name' => 'مكسوبة',
                'default_probability' => 100,
                'color' => '#1fb57c',
                'is_final' => 'won',
            ],
            [
                'code' => 'lost',
                'name' => 'مخسورة',
                'default_probability' => 0,
                'color' => '#e45d68',
                'is_final' => 'lost',
            ],
        ];

        foreach ($stages as $index => $stage) {
            SalesStage::updateOrCreate(
                ['code' => $stage['code']],
                [
                    ...$stage,
                    'sort_order' => $index,
                    'is_active' => true,
                ]
            );
        }

        /*
         * أسباب الخسارة معرَّفة مش نص حر — عشان بعد ٣٠ أو ٤٠ صفقة
         * يبقى فيه جواب على: إحنا بنخسر بالسعر ولا بحاجة تانية؟
         */
        $reasons = [
            [
                'code' => 'price_high',
                'name' => 'السعر أعلى من المنافس',
                'category' => 'price',
                'requires_note' => false,
            ],
            [
                'code' => 'budget',
                'name' => 'ميزانية العميل أقل',
                'category' => 'price',
                'requires_note' => false,
            ],
            [
                'code' => 'spec_mismatch',
                'name' => 'المواصفة مش مطابقة للمطلوب',
                'category' => 'specification',
                'requires_note' => true,
            ],
            [
                'code' => 'lead_time',
                'name' => 'مدة التنفيذ طويلة',
                'category' => 'lead_time',
                'requires_note' => false,
            ],
            [
                'code' => 'payment_terms',
                'name' => 'شروط السداد غير مقبولة',
                'category' => 'payment_terms',
                'requires_note' => false,
            ],
            [
                'code' => 'competitor_relationship',
                'name' => 'علاقة سابقة مع منافس',
                'category' => 'competitor',
                'requires_note' => false,
            ],
            [
                'code' => 'customer_cancelled',
                'name' => 'العميل ألغى المشروع',
                'category' => 'customer_cancelled',
                'requires_note' => false,
            ],
            [
                'code' => 'no_response',
                'name' => 'العميل مارّدش',
                'category' => 'no_response',
                'requires_note' => false,
            ],
            [
                'code' => 'other',
                'name' => 'سبب آخر',
                'category' => 'other',
                'requires_note' => true,
            ],
        ];

        foreach ($reasons as $reason) {
            SalesLossReason::updateOrCreate(
                ['code' => $reason['code']],
                [...$reason, 'is_active' => true]
            );
        }
    }
}
