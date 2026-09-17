<?php

namespace Database\Seeders;

use App\Models\ProjectStageRequirement;
use Illuminate\Database\Seeder;

/**
 * شروط الانتقال بين الأقسام.
 *
 * دي اللي بتحوّل زر «إرسال للقسم التالي» من نقل فوري إلى بوابة.
 * الفحوص الآلية بتقرأ من الداتا الموجودة — مش محتاجة إدخال يدوي.
 *
 * التشغيل: php artisan db:seed --class=StageRequirementsSeeder
 */
class StageRequirementsSeeder extends Seeder
{
    public function run(): void
    {
        $requirements = [
            // ===== CRM → التسعير =====
            [
                'from_stage' => 'crm',
                'code' => 'customer_data_complete',
                'label' => 'بيانات العميل مكتملة',
                'note' => 'الاسم والهاتف ومسؤول العميل',
                'check_mode' => 'manual',
                'is_mandatory' => true,
            ],
            [
                'from_stage' => 'crm',
                'code' => 'scope_documented',
                'label' => 'نطاق العمل موثّق',
                'note' => 'وصف المشروع أو جدول كميات مرفق',
                'check_mode' => 'manual',
                'is_mandatory' => true,
            ],

            // ===== التسعير → المشتريات =====
            [
                'from_stage' => 'pricing',
                'code' => 'approved_quotation',
                'label' => 'عرض سعر معتمد',
                'note' => 'لا يمكن الشراء بدون عرض معتمد',
                'check_mode' => 'automatic',
                'handler' => 'approved_quotation',
                'is_mandatory' => true,
                'is_overridable' => false,
            ],
            [
                'from_stage' => 'pricing',
                'code' => 'customer_po_received',
                'label' => 'أمر شراء العميل مستلم',
                'note' => 'أمر الشراء أو العقد الموقّع مرفوع',
                'check_mode' => 'manual',
                'is_mandatory' => true,
            ],
            [
                'from_stage' => 'pricing',
                'code' => 'tax_profile_ready',
                'label' => 'الملف الضريبي للعميل مكتمل',
                'note' => 'مطلوب لإصدار فاتورة ضريبية لاحقًا',
                'check_mode' => 'manual',
                'is_mandatory' => false,
            ],

            // ===== المشتريات → التنفيذ =====
            [
                'from_stage' => 'purchasing',
                'code' => 'purchase_orders_received',
                'label' => 'أوامر الشراء مستلمة بالكامل',
                'note' => 'لا يوجد أمر شراء معلّق أو مستلم جزئيًا',
                'check_mode' => 'automatic',
                'handler' => 'purchase_orders_received',
                'is_mandatory' => true,
            ],
            [
                'from_stage' => 'purchasing',
                'code' => 'no_pending_supplier_invoices',
                'label' => 'فواتير الموردين مراجَعة',
                'note' => 'لا توجد فاتورة مورد في المسودة أو قيد المراجعة',
                'check_mode' => 'automatic',
                'handler' => 'no_pending_supplier_invoices',
                'is_mandatory' => false,
            ],
            [
                'from_stage' => 'purchasing',
                'code' => 'site_ready',
                'label' => 'الموقع جاهز للتنفيذ',
                'note' => 'تصاريح الدخول وموقع التنفيذ محدد',
                'check_mode' => 'manual',
                'is_mandatory' => true,
            ],

            // ===== التنفيذ → المالية =====
            [
                'from_stage' => 'execution',
                'code' => 'has_signed_handover',
                'label' => 'محضر تسليم نهائي موقّع',
                'note' => 'يُرفع كمرفق بتصنيف handover',
                'check_mode' => 'automatic',
                'handler' => 'has_signed_handover',
                'is_mandatory' => true,
            ],
            [
                'from_stage' => 'execution',
                'code' => 'execution_manager_approval',
                'label' => 'موافقة مدير التنفيذ',
                'note' => 'إقرار باكتمال الأعمال فنيًا',
                'check_mode' => 'approval',
                'approver_role' => 'execution_manager',
                'is_mandatory' => true,
            ],
            [
                'from_stage' => 'execution',
                'code' => 'inventory_issued',
                'label' => 'صرف المخزون مسجّل',
                'note' => 'حركات الصرف على المشروع مكتملة',
                'check_mode' => 'manual',
                'is_mandatory' => false,
            ],

            // ===== المالية → الإغلاق =====
            [
                'from_stage' => 'finance',
                'code' => 'fully_invoiced',
                'label' => 'المشروع مفوتر بالكامل',
                'note' => 'المفوتر يساوي إجمالي العرض المعتمد',
                'check_mode' => 'automatic',
                'handler' => 'fully_invoiced',
                'is_mandatory' => true,
            ],
            [
                'from_stage' => 'finance',
                'code' => 'fully_collected',
                'label' => 'التحصيل مكتمل',
                'note' => 'لا توجد فاتورة بمبلغ متبقٍ',
                'check_mode' => 'automatic',
                'handler' => 'fully_collected',
                'is_mandatory' => true,
            ],
            [
                'from_stage' => 'finance',
                'code' => 'project_profit_reviewed',
                'label' => 'مراجعة ربحية المشروع',
                'note' => 'مقارنة الهامش المخطط بالفعلي',
                'check_mode' => 'manual',
                'is_mandatory' => false,
            ],
        ];

        foreach ($requirements as $index => $requirement) {
            ProjectStageRequirement::updateOrCreate(
                [
                    'from_stage' => $requirement['from_stage'],
                    'to_stage' => $requirement['to_stage'] ?? null,
                    'code' => $requirement['code'],
                ],
                [
                    'label' => $requirement['label'],
                    'note' => $requirement['note'] ?? null,
                    'check_mode' => $requirement['check_mode'],
                    'handler' => $requirement['handler'] ?? null,
                    'approver_role' => $requirement['approver_role'] ?? null,
                    'is_mandatory' => $requirement['is_mandatory'] ?? true,
                    'is_overridable' => $requirement['is_overridable'] ?? true,
                    'sort_order' => $index,
                    'is_active' => true,
                ]
            );
        }
    }
}
