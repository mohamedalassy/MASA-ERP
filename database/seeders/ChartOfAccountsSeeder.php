<?php

namespace Database\Seeders;

use App\Models\FinanceAccount;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * شجرة الحسابات — seeder إلزامي، مش تحسين.
 *
 * الكود بيبحث عن حسابات بأكوادها الحرفية ويرفض العملية كلها لو مالقاهاش:
 *
 *   1121  الذمم المدينة - العملاء        TaxInvoiceController::issue
 *   4110  إيرادات المشاريع                TaxInvoiceController::issue
 *   2120  ضريبة القيمة المضافة المستحقة   TaxInvoiceController::issue
 *   1140  المخزون                         SupplierInvoicePostingService
 *   1160  ضريبة القيمة المضافة المدخلة    SupplierInvoicePostingService
 *   2110  الذمم الدائنة - الموردون        SupplierInvoicePostingService
 *   5310  مصروف الإهلاك                   FixedAssetController
 *   1290  مجمّع إهلاك الأصول              FixedAssetController
 *
 * وكذلك بيعلّم حسابات الصندوق والبنوك بـ is_cash_account = true —
 * بدون كده قائمة التدفقات النقدية والتسوية البنكية وقوائم حسابات
 * الدفع والتحصيل تفضل فاضية.
 *
 * التشغيل:  php artisan db:seed --class=ChartOfAccountsSeeder
 */
class ChartOfAccountsSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            foreach ($this->accounts() as $account) {
                $this->create($account);
            }
        });
    }

    /**
     * كل صف: [code, name, name_en, type, normal_balance, level,
     *          parent_code, is_postable, is_cash_account, cash_flow_category]
     */
    private function accounts(): array
    {
        return [
            // ============ ١ الأصول ============
            ['1000', 'الأصول', 'Assets', 'asset', 'debit', 1, null, false],
            ['1100', 'الأصول المتداولة', 'Current Assets', 'asset', 'debit', 2, '1000', false],

            ['1110', 'النقدية وما يعادلها', 'Cash and Equivalents', 'asset', 'debit', 3, '1100', false],
            ['1111', 'الصندوق', 'Cash on Hand', 'asset', 'debit', 4, '1110', true, true, 'operating'],
            ['1112', 'البنك الأهلي — الحساب الجاري', 'NCB Current Account', 'asset', 'debit', 4, '1110', true, true, 'operating'],
            ['1113', 'بنك الراجحي — الحساب الجاري', 'Rajhi Current Account', 'asset', 'debit', 4, '1110', true, true, 'operating'],

            ['1120', 'الذمم المدينة', 'Receivables', 'asset', 'debit', 3, '1100', false],
            ['1121', 'الذمم المدينة - العملاء', 'Accounts Receivable - Customers', 'asset', 'debit', 4, '1120', true],
            ['1122', 'أوراق قبض', 'Notes Receivable', 'asset', 'debit', 4, '1120', true],
            ['1123', 'مخصص الديون المشكوك فيها', 'Allowance for Doubtful Debts', 'asset', 'credit', 4, '1120', true],

            ['1130', 'الأعمال تحت التنفيذ', 'Work in Progress', 'asset', 'debit', 3, '1100', true],
            ['1140', 'المخزون', 'Inventory', 'asset', 'debit', 3, '1100', true],
            ['1150', 'مصروفات مقدمة', 'Prepaid Expenses', 'asset', 'debit', 3, '1100', true],
            ['1160', 'ضريبة القيمة المضافة المدخلة', 'Input VAT', 'asset', 'debit', 3, '1100', true],
            ['1170', 'دفعات مقدمة للموردين', 'Advances to Suppliers', 'asset', 'debit', 3, '1100', true],

            ['1200', 'الأصول غير المتداولة', 'Non-Current Assets', 'asset', 'debit', 2, '1000', false],
            ['1210', 'الأراضي', 'Land', 'asset', 'debit', 3, '1200', true, false, 'investing'],
            ['1220', 'المباني', 'Buildings', 'asset', 'debit', 3, '1200', true, false, 'investing'],
            ['1230', 'المركبات', 'Vehicles', 'asset', 'debit', 3, '1200', true, false, 'investing'],
            ['1240', 'الآلات والمعدات', 'Machinery and Equipment', 'asset', 'debit', 3, '1200', true, false, 'investing'],
            ['1250', 'الأثاث والتجهيزات', 'Furniture and Fixtures', 'asset', 'debit', 3, '1200', true, false, 'investing'],
            ['1260', 'أجهزة الحاسب', 'Computer Equipment', 'asset', 'debit', 3, '1200', true, false, 'investing'],
            ['1290', 'مجمّع إهلاك الأصول', 'Accumulated Depreciation', 'asset', 'credit', 3, '1200', true],

            // ============ ٢ الالتزامات ============
            ['2000', 'الالتزامات', 'Liabilities', 'liability', 'credit', 1, null, false],
            ['2100', 'الالتزامات المتداولة', 'Current Liabilities', 'liability', 'credit', 2, '2000', false],

            ['2110', 'الذمم الدائنة - الموردون', 'Accounts Payable - Suppliers', 'liability', 'credit', 3, '2100', true],
            ['2120', 'ضريبة القيمة المضافة المستحقة', 'Output VAT Payable', 'liability', 'credit', 3, '2100', true],
            ['2130', 'رواتب مستحقة', 'Accrued Salaries', 'liability', 'credit', 3, '2100', true],
            ['2140', 'مصروفات مستحقة', 'Accrued Expenses', 'liability', 'credit', 3, '2100', true],
            ['2150', 'التأمينات الاجتماعية المستحقة', 'GOSI Payable', 'liability', 'credit', 3, '2100', true],
            ['2160', 'دفعات مقدمة من العملاء', 'Customer Advances', 'liability', 'credit', 3, '2100', true],
            ['2170', 'محتجزات ضمان', 'Retention Payable', 'liability', 'credit', 3, '2100', true],

            ['2200', 'الالتزامات غير المتداولة', 'Non-Current Liabilities', 'liability', 'credit', 2, '2000', false],
            ['2210', 'قروض طويلة الأجل', 'Long-Term Loans', 'liability', 'credit', 3, '2200', true, false, 'financing'],
            ['2220', 'مكافأة نهاية الخدمة', 'End of Service Benefits', 'liability', 'credit', 3, '2200', true],

            // ============ ٣ حقوق الملكية ============
            ['3000', 'حقوق الملكية', 'Equity', 'equity', 'credit', 1, null, false],
            ['3110', 'رأس المال', 'Capital', 'equity', 'credit', 2, '3000', true, false, 'financing'],
            ['3120', 'الاحتياطي النظامي', 'Statutory Reserve', 'equity', 'credit', 2, '3000', true],
            ['3130', 'الأرباح المبقاة', 'Retained Earnings', 'equity', 'credit', 2, '3000', true],
            ['3140', 'المسحوبات', 'Drawings', 'equity', 'debit', 2, '3000', true, false, 'financing'],

            // ============ ٤ الإيرادات ============
            ['4000', 'الإيرادات', 'Revenue', 'revenue', 'credit', 1, null, false],
            ['4110', 'إيرادات المشاريع', 'Project Revenue', 'revenue', 'credit', 2, '4000', true],
            ['4120', 'إيرادات التوريد', 'Supply Revenue', 'revenue', 'credit', 2, '4000', true],
            ['4130', 'إيرادات الصيانة والخدمات', 'Maintenance and Services Revenue', 'revenue', 'credit', 2, '4000', true],
            ['4190', 'إيرادات أخرى', 'Other Revenue', 'revenue', 'credit', 2, '4000', true],
            ['4200', 'خصم مسموح به', 'Sales Discounts', 'revenue', 'debit', 2, '4000', true],
            ['4210', 'ربح استبعاد أصول', 'Gain on Asset Disposal', 'revenue', 'credit', 2, '4000', true],

            // ============ ٥ المصروفات ============
            ['5000', 'المصروفات', 'Expenses', 'expense', 'debit', 1, null, false],

            ['5100', 'تكلفة الإيرادات', 'Cost of Revenue', 'expense', 'debit', 2, '5000', false],
            ['5110', 'تكلفة المواد', 'Material Cost', 'expense', 'debit', 3, '5100', true],
            ['5120', 'تكلفة العمالة المباشرة', 'Direct Labor Cost', 'expense', 'debit', 3, '5100', true],
            ['5130', 'تكلفة المقاولين', 'Subcontractor Cost', 'expense', 'debit', 3, '5100', true],
            ['5140', 'مصروفات نقل وشحن', 'Freight and Transport', 'expense', 'debit', 3, '5100', true],
            ['5150', 'مصروفات تركيب', 'Installation Cost', 'expense', 'debit', 3, '5100', true],

            ['5200', 'مصروفات إدارية وعمومية', 'General and Administrative', 'expense', 'debit', 2, '5000', false],
            ['5210', 'الرواتب والأجور', 'Salaries and Wages', 'expense', 'debit', 3, '5200', true],
            ['5220', 'بدلات ومكافآت', 'Allowances and Bonuses', 'expense', 'debit', 3, '5200', true],
            ['5230', 'التأمينات الاجتماعية', 'GOSI Expense', 'expense', 'debit', 3, '5200', true],
            ['5240', 'الإيجارات', 'Rent', 'expense', 'debit', 3, '5200', true],
            ['5250', 'الكهرباء والمياه', 'Utilities', 'expense', 'debit', 3, '5200', true],
            ['5260', 'الاتصالات والإنترنت', 'Communications', 'expense', 'debit', 3, '5200', true],
            ['5270', 'مصروفات مكتبية', 'Office Supplies', 'expense', 'debit', 3, '5200', true],
            ['5280', 'أتعاب مهنية', 'Professional Fees', 'expense', 'debit', 3, '5200', true],
            ['5290', 'مصروفات سيارات ووقود', 'Vehicle and Fuel', 'expense', 'debit', 3, '5200', true],

            ['5300', 'مصروفات غير نقدية', 'Non-Cash Expenses', 'expense', 'debit', 2, '5000', false],
            ['5310', 'مصروف الإهلاك', 'Depreciation Expense', 'expense', 'debit', 3, '5300', true],
            ['5320', 'مخصص ديون مشكوك فيها', 'Doubtful Debt Provision', 'expense', 'debit', 3, '5300', true],
            ['5330', 'خسارة استبعاد أصول', 'Loss on Asset Disposal', 'expense', 'debit', 3, '5300', true],

            ['5400', 'مصروفات تمويلية', 'Finance Costs', 'expense', 'debit', 2, '5000', false],
            ['5410', 'عمولات ومصروفات بنكية', 'Bank Charges', 'expense', 'debit', 3, '5400', true, false, 'financing'],
            ['5420', 'فوائد قروض', 'Loan Interest', 'expense', 'debit', 3, '5400', true, false, 'financing'],
        ];
    }

    private function create(array $row): void
    {
        [$code, $name, $nameEn, $type, $normalBalance, $level, $parentCode] = $row;

        $isPostable = $row[7] ?? true;
        $isCashAccount = $row[8] ?? false;
        $cashFlowCategory = $row[9] ?? null;

        $parentId = $parentCode
            ? FinanceAccount::where('code', $parentCode)->value('id')
            : null;

        FinanceAccount::updateOrCreate(
            ['code' => $code],
            [
                'name' => $name,
                'name_en' => $nameEn,
                'type' => $type,
                'parent_id' => $parentId,
                'level' => $level,
                'normal_balance' => $normalBalance,
                'is_postable' => $isPostable,
                'is_cash_account' => $isCashAccount,
                'cash_flow_category' => $cashFlowCategory,
                'is_active' => true,
            ]
        );
    }
}
