# تعديلات على ملفات موجودة عندك

الملفات دي موجودة في مشروعك بالفعل — التعديل يدوي، سطر أو اتنين لكل واحد.

---

## ١. FinanceJournalLine.php — علاقة مفقودة

`BankReconciliationController::autoMatch()` بينادي:

```php
->whereDoesntHave('bankStatementLines')
```

والعلاقة دي **مش موجودة** في الموديل، فالمطابقة التلقائية هترمي استثناء. ضيف:

```php
public function bankStatementLines(): HasMany
{
    return $this->hasMany(
        BankStatementLine::class,
        'finance_journal_line_id'
    );
}
```

---

## ٢. FinanceJournalEntry.php — تأكيد الدوال

الكنترولر بينادي `isBalanced()` و `lines()` و `poster`. لو ناقصين:

```php
public function lines(): HasMany
{
    return $this->hasMany(FinanceJournalLine::class, 'journal_entry_id');
}

public function poster(): BelongsTo
{
    return $this->belongsTo(User::class, 'posted_by');
}

public function isBalanced(): bool
{
    // فرق مقبول بمقدار هللة — مش === على float
    return abs(
        (float) $this->total_debit - (float) $this->total_credit
    ) < 0.01;
}
```

---

## ٣. ProjectQuotationItem.php + Product.php — علاقات جديدة

```php
// ProjectQuotationItem
public function taxInvoiceItems(): HasMany
{
    return $this->hasMany(TaxInvoiceItem::class, 'quotation_item_id');
}

// Product
public function supplierPrices(): HasMany
{
    return $this->hasMany(SupplierPrice::class, 'product_id');
}

public function alternatives(): HasMany
{
    return $this->hasMany(ProductAlternative::class, 'product_id')
        ->orderBy('preference_order');
}
```

---

## ٤. FinanceJournalEntryController.php

**أ. مقارنة التوازن** — في `validateAccountingLines()`:

```php
// من
if ($debit !== $credit) {

// إلى
if (abs($debit - $credit) >= 0.01) {
```

**ب. الترقيم** — استبدل `generateEntryNumber()` بالكامل:

```php
public function __construct(
    private readonly \App\Services\DocumentNumberService $sequences
) {}

// وبدل النداء:
'entry_number' => $this->sequences->next('journal_entry'),
```

يحل مشكلة `max('id') + 1` اللي بتولّد أرقام مكررة بعد أي حذف.

---

## ٥. FinanceDashboardController.php — اسم عمود غلط

```php
// من — العمود ده مش موجود
Project::query()->where('stage', 'finance')->count();

// إلى
Project::query()->where('current_stage', 'finance')->count();
```

---

## ٦. PricingRuleController.php — ٤ تعديلات

**أ. السعر المقترح يتجاهل الحد الأدنى:**

```php
// من
$recommendedPrice = max((float) ($targetPrice ?? 0), (float) $markupPrice);

// إلى
$recommendedPrice = max(
    (float) ($minimumPrice ?? 0),
    (float) ($targetPrice ?? 0),
    (float) $markupPrice
);
```

**ب. صيغة fresh() غلط** — مكررة في store و update:

```php
// من
$row->fresh('creator:id,name')

// إلى
$row->fresh()->load('creator:id,name')
```

**ج. الأخص يكسب** — القاعدة العامة حاليًا بتتغلب على قاعدة المنتج لو أولويتها أقل رقمًا:

```php
$matched = $rules
    ->filter(fn ($rule) => $this->ruleMatches($rule, $validated))
    ->sortBy([
        fn ($a, $b) => $b->specificity() <=> $a->specificity(),
        fn ($a, $b) => $a->priority <=> $b->priority,
    ])
    ->first();
```

دالة `specificity()` موجودة في موديل `PricingRule` في الحزمة.

**د. نطاق الفئة** — `resolve()` بيقبل `category` ومش بيطابق بيه أبدًا:

```php
if ($rule->scope_type === 'category') {
    return $rule->scope_value === ($validated['category'] ?? null);
}
```

ولازم تضيف `'category'` لقائمة `in:` في `validatePayload`.

---

## ٧. SupplierInvoiceController.php — حقن الخدمتين

```php
public function __construct(
    private readonly SupplierInvoiceMatchingService $matching,
    private readonly SupplierInvoicePostingService $posting,
    private readonly SupplierInvoicePaymentService $payments
) {}
```

---

## ٨. routes/api.php

**أ.** امسح التكرار — المسار ده مسجّل **مرتين**:

```php
Route::post('/finance/supplier-invoices/{supplierInvoice}/post', ...);
```

**ب.** ضمّ مسارات التسوية البنكية:

```php
require __DIR__ . '/bank-reconciliation-routes.php';
```

---

## ٩. Sidebar.jsx — الشعار بدون تنسيق

الكلاسات في الـ JSX مختلفة عن اللي معرّفة في `master.css`:

```jsx
// من
<div className="brand">
  <div className="brand-logo">M</div>
  <div className="brand-text">

// إلى
<div className="sidebar-brand">
  <div className="sidebar-brand-logo">M</div>
  <div className="sidebar-brand-text">
```

**وكذلك:** التطبيق السريع `employees` مافيش له فرع في `App.jsx`،
فالضغط عليه بيودّي لشاشة فاضية. اربطه بـ `hr-employees`.

---

## ١٠. الفرونت إند — عنوان الـ API

مكتوب يدويًا في **٣٨ ملف**، و٢٧ منهم بدون `VITE_API_URL`،
فأي نشر بره localhost بيكسرهم. اعمل `src/lib/api.js` واحد:

```js
const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

export async function api(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: {
      Accept: "application/json",
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    ...options,
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      json?.message ||
        Object.values(json?.errors || {}).flat()[0] ||
        "تعذر تنفيذ العملية"
    );
  }

  return json;
}
```

ثم استبدل `const API_BASE = "http://127.0.0.1:8000/api"` في كل صفحة
بـ `import { api } from "../lib/api"`.

---

## ١١. المصادقة — أهم تعديل

`routes/api.php` كله مفتوح بدون أي middleware، و `$request->user()?->id`
بيرجع **null دايمًا** — فحقول `created_by` و `approved_by` و `posted_by`
بتتسجل فاضية في كل قيد وكل اعتماد. ده يفضي مسار التدقيق المحاسبي بالكامل.

```bash
composer require laravel/sanctum
php artisan install:api
```

ثم لُف المسارات:

```php
Route::middleware('auth:sanctum')->group(function () {
    // كل المسارات الحالية
});
```