# تنسيقات صفحة المشروع مفقودة

## الاكتشاف

`ProjectDetails.jsx` بيستخدم الكلاسات دي:

```
project-file-page · project-file-topbar · project-info-card
project-info-item · project-workflow-card · project-module-card
project-content-grid · project-side-column · project-widget
```

وبحثت عنها في **كل** ملفات CSS السبعة:

| الملف | النتيجة |
|---|---|
| `master.css` (2986 سطر) | ✗ ولا كلاس واحد |
| `accounting-core.css` | ✗ |
| `bank-reconciliation.css` | ✗ |
| `collections-center.css` | ✗ |
| `finance-enterprise.css` | ✗ |
| `financial-reports.css` | ✗ |
| `tax-invoices.css` | ✗ |

**النتيجة:** صفحة ملف المشروع بتُرندر بدون أي تنسيق — عناصر HTML خام
فوق بعضها. ده مش خطأ في الكلاسات، ده ملف CSS ضايع بالكامل
(زي `finance.css` اللي `App.jsx` بيستورده ومش موجود).

## التوكنز المتاحة

الخبر الحسن إن `master.css` فيه نظام توكنز كامل تحت `:root`،
فإعادة بناء التنسيقات بتبقى متسقة تلقائيًا:

```css
--primary: #6557f5;      --primary-dark: #5144e8;   --primary-soft: #f0eeff;
--bg: #f6f7fb;           --surface: #ffffff;        --surface-soft: #fafbfc;
--text: #151821;         --text-soft: #6f7585;      --text-light: #9ba1ae;
--border: #e9ebf1;
--green: #1fb57c;        --green-soft: #eaf9f3;
--orange: #f3a13b;       --orange-soft: #fff4e7;
--blue: #4f7df3;         --blue-soft: #edf2ff;
--cyan: #24b7c6;         --cyan-soft: #eaf9fb;
--red: #e45d68;          --red-soft: #fff0f1;
--radius-sm: 10px;       --radius-md: 16px;         --radius-lg: 22px;
```

## التصميم المرفق

الملف `صفحة المشروع.dc.html` في المشروع مبني بالتوكنز دي بالظبط —
فهو المرجع البصري لإعادة بناء `project.css`، وبيشمل كذلك الإضافات
الستة الجديدة (بوابة التسليم · السجل الموحّد · بصمة الموقع ·
الأنشطة · مؤشرات الربحية · المرفقات).
