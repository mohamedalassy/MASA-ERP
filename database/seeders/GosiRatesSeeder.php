<?php

namespace Database\Seeders;

use App\Models\GosiRateSchedule;
use Illuminate\Database\Seeder;

/**
 * جدول نسب التأمينات بتواريخ سريان.
 *
 * ⚠ النسب دي من مصادر منشورة بتواريخ ٢٠٢٦ — راجعها على موقع
 * التأمينات الرسمي قبل التشغيل على بيانات حقيقية، لأن نسبة
 * التقاعد في النظام الجديد بترتفع ٠.٥٪ على كل طرف كل يوليو
 * حتى ٢٠٢٨.
 *
 * وده بالتحديد سبب وجود الجدول: إضافة صف جديد كل سنة أرخص
 * وأأمن من تعديل الكود ونشر نسخة جديدة.
 *
 * الوعاء: الأساسي + بدل السكن، بحد أقصى ٤٥٬٠٠٠ ريال.
 *
 * التشغيل: php artisan db:seed --class=GosiRatesSeeder
 */
class GosiRatesSeeder extends Seeder
{
    public function run(): void
    {
        $schedules = [
            /*
             * النظام القديم — المسجَّلون قبل ٣ يوليو ٢٠٢٤.
             * نسب ثابتة: إجمالي ٢١.٥٪ (صاحب العمل ١١.٧٥ + الموظف ٩.٧٥)
             */
            [
                'scheme' => 'existing',
                'effective_from' => '2024-07-03',
                'effective_to' => null,
                'pension_employer' => 9.0,
                'pension_employee' => 9.0,
                'hazards_employer' => 2.0,
                'saned_employer' => 0.75,
                'saned_employee' => 0.75,
                'wage_ceiling' => 45000,
                'notes' => 'النظام القديم — نسب ثابتة، إجمالي 21.5%',
            ],

            /*
             * النظام الجديد — من لا سجل اشتراكات له قبل ٣ يوليو ٢٠٢٤.
             * التقاعد بيرتفع ٠.٥٪ على كل طرف كل يوليو حتى ٢٠٢٨.
             */
            [
                'scheme' => 'new',
                'effective_from' => '2024-07-03',
                'effective_to' => '2025-07-02',
                'pension_employer' => 9.0,
                'pension_employee' => 9.0,
                'hazards_employer' => 2.0,
                'saned_employer' => 0.75,
                'saned_employee' => 0.75,
                'wage_ceiling' => 45000,
                'notes' => 'النظام الجديد — السنة الأولى، إجمالي 21.5%',
            ],
            [
                'scheme' => 'new',
                'effective_from' => '2025-07-03',
                'effective_to' => '2026-07-02',
                'pension_employer' => 9.5,
                'pension_employee' => 9.5,
                'hazards_employer' => 2.0,
                'saned_employer' => 0.75,
                'saned_employee' => 0.75,
                'wage_ceiling' => 45000,
                'notes' => 'الخطوة الأولى — إجمالي 22.5%',
            ],
            [
                'scheme' => 'new',
                'effective_from' => '2026-07-03',
                'effective_to' => '2027-07-02',
                'pension_employer' => 10.0,
                'pension_employee' => 10.0,
                'hazards_employer' => 2.0,
                'saned_employer' => 0.75,
                'saned_employee' => 0.75,
                'wage_ceiling' => 45000,
                'notes' => 'الخطوة الثانية — إجمالي 23.5% (12.75 + 10.75)',
            ],
            [
                'scheme' => 'new',
                'effective_from' => '2027-07-03',
                'effective_to' => '2028-07-02',
                'pension_employer' => 10.5,
                'pension_employee' => 10.5,
                'hazards_employer' => 2.0,
                'saned_employer' => 0.75,
                'saned_employee' => 0.75,
                'wage_ceiling' => 45000,
                'notes' => 'الخطوة الثالثة — إجمالي 24.5% (تقديري، راجعه)',
            ],
            [
                'scheme' => 'new',
                'effective_from' => '2028-07-03',
                'effective_to' => null,
                'pension_employer' => 11.0,
                'pension_employee' => 11.0,
                'hazards_employer' => 2.0,
                'saned_employer' => 0.75,
                'saned_employee' => 0.75,
                'wage_ceiling' => 45000,
                'notes' => 'النسبة النهائية — إجمالي 25.5% (تقديري، راجعه)',
            ],

            /*
             * غير السعوديين — أخطار مهنية فقط، على صاحب العمل.
             * لا تقاعد ولا ساند.
             */
            [
                'scheme' => 'expat',
                'effective_from' => '2000-01-01',
                'effective_to' => null,
                'pension_employer' => 0,
                'pension_employee' => 0,
                'hazards_employer' => 2.0,
                'saned_employer' => 0,
                'saned_employee' => 0,
                'wage_ceiling' => 45000,
                'notes' => 'غير سعودي — أخطار مهنية 2% على صاحب العمل فقط',
            ],
        ];

        foreach ($schedules as $schedule) {
            GosiRateSchedule::updateOrCreate(
                [
                    'scheme' => $schedule['scheme'],
                    'effective_from' => $schedule['effective_from'],
                ],
                $schedule
            );
        }
    }
}
