<?php

namespace Database\Seeders;

use App\Models\HrLeaveType;
use Illuminate\Database\Seeder;

/**
 * أنواع الإجازات حسب نظام العمل السعودي.
 *
 * التشغيل: php artisan db:seed --class=HrLeaveTypesSeeder
 */
class HrLeaveTypesSeeder extends Seeder
{
    public function run(): void
    {
        $types = [
            [
                'code' => 'ANNUAL',
                'name' => 'إجازة سنوية',
                'name_en' => 'Annual Leave',
                // ٢١ يوم حد أدنى، و٣٠ بعد ٥ سنوات خدمة
                'annual_days' => 21,
                'is_paid' => true,
                'deducts_balance' => true,
                'allows_carryover' => true,
                'max_carryover_days' => 21,
                'eligibility' => 'all',
                'min_service_months' => 12,
            ],
            [
                'code' => 'SICK',
                'name' => 'إجازة مرضية',
                'name_en' => 'Sick Leave',
                // ٣٠ يوم كامل الأجر، ٦٠ بثلاثة أرباع، ٣٠ بدون أجر
                'annual_days' => 120,
                'is_paid' => true,
                'deducts_balance' => false,
                'requires_attachment' => true,
                'eligibility' => 'all',
            ],
            [
                'code' => 'MATERNITY',
                'name' => 'إجازة وضع',
                'name_en' => 'Maternity Leave',
                'annual_days' => 70,
                'is_paid' => true,
                'deducts_balance' => false,
                'eligibility' => 'female',
            ],
            [
                'code' => 'PATERNITY',
                'name' => 'إجازة أبوة',
                'name_en' => 'Paternity Leave',
                'annual_days' => 3,
                'is_paid' => true,
                'deducts_balance' => false,
                'eligibility' => 'male',
            ],
            [
                'code' => 'MARRIAGE',
                'name' => 'إجازة زواج',
                'name_en' => 'Marriage Leave',
                'annual_days' => 5,
                'is_paid' => true,
                'deducts_balance' => false,
                'eligibility' => 'all',
            ],
            [
                'code' => 'BEREAVEMENT',
                'name' => 'إجازة وفاة',
                'name_en' => 'Bereavement Leave',
                'annual_days' => 5,
                'is_paid' => true,
                'deducts_balance' => false,
                'eligibility' => 'all',
            ],
            [
                'code' => 'WIDOW',
                'name' => 'إجازة عدة',
                'name_en' => 'Widow Waiting Period',
                'annual_days' => 130,
                'is_paid' => true,
                'deducts_balance' => false,
                'eligibility' => 'female',
            ],
            [
                'code' => 'HAJJ',
                'name' => 'إجازة حج',
                'name_en' => 'Hajj Leave',
                'annual_days' => 10,
                'is_paid' => true,
                'deducts_balance' => false,
                'eligibility' => 'muslim',
                // مرة واحدة بعد سنتين خدمة متصلة
                'min_service_months' => 24,
            ],
            [
                'code' => 'EXAM',
                'name' => 'إجازة اختبارات',
                'name_en' => 'Exam Leave',
                'is_paid' => true,
                'deducts_balance' => false,
                'requires_attachment' => true,
                'eligibility' => 'all',
            ],
            [
                'code' => 'UNPAID',
                'name' => 'إجازة بدون راتب',
                'name_en' => 'Unpaid Leave',
                'is_paid' => false,
                'deducts_balance' => false,
                'eligibility' => 'all',
            ],
        ];

        foreach ($types as $type) {
            HrLeaveType::updateOrCreate(
                ['code' => $type['code']],
                [...$type, 'is_active' => true]
            );
        }
    }
}
