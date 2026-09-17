# MASA ERP — حزمة الإكمال

حزمة كود جاهزة للنسخ في مشروعك. كل ملف في مساره الصحيح تحت `backend/`.

**مبني على:** Laravel 11 + MySQL 8. كل الحقول مستخرجة من `$fillable` و`$casts`
وقواعد التحقق في الكود المستعاد بتاعك — مش تخمين.

---

## ١. الهجرات — الترتيب إلزامي

تواريخ الملفات مختارة بعناية عشان تتداخل صح مع الـ ١٥ هجرة الموجودة عندك.
**متغيّرش الأسماء.**

| # | الملف | ليه التاريخ كده |
|---|---|---|
| ١ | `2026_08_01_000001_create_suppliers_table` | `purchase_orders` و`supplier_invoices` بيعملوا constrained عليه |
| ٢ | `2026_08_01_000002_create_products_table` | `inventory_transactions` (2026_08_27) بيعتمد عليه |
| ٣ | `2026_08_01_000003_create_projects_table` | نصف جداول المشروع بتربط عليه |
| ٤ | `2026_08_01_000004_create_project_side_tables` | notes · attachments · workflow_histories |
| ٥ | `2026_08_01_000005_create_purchase_orders_tables` | + البنود بعمود `received_quantity` للمطابقة الثلاثية |
| ٦ | `2026_08_01_000006_create_project_quotations_tables` | ⚠️ راجع التحذير تحت |
| ٧ | `2026_08_01_000007_create_project_financials_tables` | expenses + financial_transactions |
| ٨ | `2026_08_02_000001_create_pricing_tables` | ٨ جداول التسعير |
| ٩ | `2026_08_03_000001_create_tax_tables` | لازم **قبل** `2026_08_31_010000` |
| ١٠ | `2026_08_04_000001_create_fixed_assets_table` | لازم **قبل** `2026_08_31_150000` |
| ١١ | `2026_08_28_000002_create_cost_centers_table` | لازم **قبل** `2026_08_29_003003` (سطور القيد) |
| ١٢ | `2026_09_16_000001_add_cash_flow_fields_to_finance_accounts` | العمودان المفقودان |
| ١٣ | `2026_09_16_000002_create_document_sequences_table` | ترقيم آمن |

### ⚠️ تحذيران مهمان

**١. `project_quotation_items` يُنشأ فاضي بالتصميم** — `id` و`timestamps` بس.
كل أعمدته بتُضاف في هجرتك الموجودة `2026_08_28_121554_rebuild_project_quotation_items_columns`.
لو أضفت الأعمدة في الاتنين، الهجرة هتفشل بتعارض أسماء.

**٢. `fixed_assets` و`tax_invoice_payments`** — هجرتك القديمة لـ`fixed_assets` مكتوبة
بشرط `hasTable`، يعني لو الجدول مش موجود بتخرج **بصمت بدون ما تعمل حاجة**.
فلو رتّبتها غلط، حقول الاستبعاد الأربعة مش هتتضاف وإنت مش هتلاحظ.

### جدول `users`

لسه محتاج جدول `users` قياسي بتاريخ **أقدم من `2026_08_01`**. لو مش موجود:

```bash
php artisan make:migration create_users_table
```

وارجّع تاريخه لـ`2026_07_01_000000`. كل الجداول عندها `created_by` بيربط عليه.

---

## ٢. الخدمات — `app/Services/`

| الملف | الحالة |
|---|---|
| `TaxInvoiceCalculator.php` | **كان مفقودًا** — بدونه TaxInvoiceController مش بيتكوّن أصلاً |
| `QuotationBillingService.php` | **كان مفقودًا** — رقابة تجاوز الفوترة (٥ دوال) |
| `SupplierInvoicePostingService.php` | **كان مفقودًا** |
| `SupplierInvoicePaymentService.php` | **كان مفقودًا** |
| `DocumentNumberService.php` | جديد — يحل مشكلة `max('id')+1` |
| `JournalPostingService.php` | جديد — طبقة ترحيل موحّدة |

### ملاحظات على الخدمات

- `QuotationBillingService::summary()` **بيخصم إشعارات الدائن** من المفوتر.
  ده ضروري وإلا الرقابة على تجاوز الفوترة تتفكّ.
- `JournalPostingService` بيمنع الترحيل المزدوج بفحص `reference_type`+`reference_id`،
  وبيقارن التوازن بفرق `0.01` مش `!==` على float.
- `SupplierInvoicePostingService` بيستخدم أكواد حسابات مكتوبة في الكود
  (`1140`, `1160`, `2110`) — نفس أسلوب كودك الحالي. الأفضل استبدالها
  بجدول `finance_account_mappings` لاحقًا.

---

## ٣. المسارات

`routes/bank-reconciliation-routes.php` — ٩ مسارات للتسوية البنكية.
الكنترولر عندك كامل بـ٩ دوال لكن **مافيش ولا route واحد له**،
فالشاشة بترجع 404 على كل نداء.

```php
// في routes/api.php
require __DIR__ . '/bank-reconciliation-routes.php';
```

---

## ٤. تصحيحات يدوية — ٧ سطور

| الملف | من | إلى |
|---|---|---|
| `FinanceDashboardController` | `where('stage','finance')` | `where('current_stage','finance')` |
| `FinanceJournalEntryController` | `$debit !== $credit` | `abs($debit - $credit) >= 0.01` |
| `FinanceJournalEntryController` | `generateEntryNumber()` | `DocumentNumberService::next('journal_entry')` |
| `PricingRuleController` | `max($targetPrice, $markupPrice)` | `max($minimumPrice, $targetPrice, $markupPrice)` |
| `PricingRuleController` | `$row->fresh('creator:id,name')` | `$row->fresh()->load('creator:id,name')` |
| `api.php` | `post` على supplier-invoices مسجّل مرتين | امسح واحد |
| `Sidebar.jsx` | `.brand` / `.brand-logo` / `.brand-text` | `.sidebar-brand*` (اللي في master.css) |

---

## ٥. التشغيل

```bash
php artisan migrate
```

بعدها **إلزاميًا** — الكود بيبحث عن الحسابات دي بأكوادها الحرفية ويرفض العملية لو مالقاهاش:

| الكود | الحساب | مستخدم في |
|---|---|---|
| `1121` | الذمم المدينة — العملاء | إصدار الفاتورة الضريبية + التحصيل |
| `4110` | إيرادات المشاريع | إصدار الفاتورة الضريبية |
| `2120` | ضريبة القيمة المضافة المستحقة | إصدار الفاتورة الضريبية |
| `1140` | المخزون | ترحيل فاتورة المورد |
| `1160` | ضريبة القيمة المضافة المدخلة | ترحيل فاتورة المورد |
| `2110` | الذمم الدائنة — الموردون | ترحيل فاتورة المورد + دفعاتها |

وكذلك: علّم حسابات الصندوق والبنوك بـ`is_cash_account = true` وحدّد
`cash_flow_category` للحسابات الرئيسية — بدون كده قائمة التدفقات النقدية
والتسوية البنكية وقوائم حسابات الدفع تفضل فاضية.

---

## ٦. ملاحظة

راجع `PATCHES.md` — فيه ١١ تعديل على ملفاتك الموجودة بالكود «من / إلى».


---

## ٧. الكنترولرات الجديدة — `app/Http/Controllers/Api/`

| الملف | الحالة |
|---|---|
| `CompanyTaxProfileController.php` | كان مفقودًا — ٣ مسارات معرّفة بلا كنترولر |
| `CustomerTaxProfileController.php` | كان مفقودًا — ٤ مسارات |
| `TaxCodeController.php` | كان مفقودًا — ٣ مسارات |
| `QuotationBillingController.php` | كان مفقودًا — مصدر بيانات شاشة إنشاء الفاتورة |
| `FinanceProjectBillingController.php` | كان مفقودًا — مسارَان |
| `FinanceProjectsBillingController.php` | كان مفقودًا — دفتر فوترة المشاريع |
| `ProductAlternativeController.php` | كان مفقودًا — ٥ مسارات |
| `FixedAssetController.php` | **جديد بالكامل** — الوحدة كلها كانت غير موجودة |

### ملاحظات

- **التحقق من الرقم الضريبي** مضاف بـ regex: ١٥ رقمًا يبدأ وينتهي بـ`3`.
  الرقم إلزامي للشركة، واختياري للمشتري (الأفراد والجهات غير المسجّلة).
- **`TaxCodeController`** بيفرض سبب إعفاء إلزامي مع الصفري والمعفى
  وخارج النطاق — زاتكا بترفض الفاتورة بدونه.
- **`FinanceProjectsBillingController`** بيحسب بـ٣ استعلامات مجمّعة
  بدل استعلام لكل مشروع، والمفوتر بيخصم إشعارات الدائن.
- **`FixedAssetController::runDepreciation`** بيولّد **قيدًا واحدًا مجمّعًا**
  بسطر مصروف لكل أصل (عشان التوزيع على مراكز التكلفة) وسطر واحد
  لمجمّع الإهلاك. محمي من الترحيل المزدوج بقيد unique على
  `(fixed_asset_id, period_year, period_month)`.
- **قسط الإهلاك الأخير** بيُقصّ عند المتبقي بالظبط، فالمتراكم مستحيل
  يتعدى القيمة القابلة للإهلاك بفرق هللة.

---

## ٨. الـ seeders — `database/seeders/`

```bash
php artisan db:seed --class=ChartOfAccountsSeeder
php artisan db:seed --class=TaxCodesSeeder
```

`ChartOfAccountsSeeder` فيه **٧٠ حساب** بشجرة ٤ مستويات، وبيعمل ٣ حاجات
ضرورية للتشغيل:

1. بيوفّر الحسابات الثمانية اللي الكود بيبحث عنها بأكوادها الحرفية
   (`1121`, `4110`, `2120`, `1140`, `1160`, `2110`, `5310`, `1290`).
2. بيعلّم الصندوق والبنوك بـ`is_cash_account = true` — بدونه قائمة
   التدفقات النقدية والتسوية البنكية وقوائم حسابات الدفع فاضية.
3. بيحدد `cash_flow_category` للحسابات الاستثمارية والتمويلية، فتصنيف
   التدفقات يطلع صح مش كله "تشغيلي".

الـ seeder بيستخدم `updateOrCreate` على الكود، فتشغيله أكثر من مرة آمن.

---

## ٩. المسارات الجديدة

```php
// في routes/api.php
require __DIR__ . '/bank-reconciliation-routes.php';
require __DIR__ . '/additional-routes.php';
```

---

## ١٠. الباقي بعد الحزمة دي

- `QuotationBuilder.jsx` — أكبر شغل متبقي في الفرونت
- ٥ شاشات مالية (مصمّمة عندك في `شاشات المالية الناقصة`)
- خدمة زاتكا: XML · الهاش · QR · التوقيع
- المصادقة والصلاحيات (راجع `PATCHES.md` بند ١١)
- منظومة الباقات: قاعدة بيانات لكل مشترك · ٣ باقات
