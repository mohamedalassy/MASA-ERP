import { useState } from "react";
import {
  Banknote,
  BookOpen,
  CircleDollarSign,
  FileDown,
  FileText,
  Landmark,
  Percent,
  Printer,
  Scale,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  AgingBars,
  FinancePageShell,
  InsightStrip,
  KpiGrid,
  SectionCard,
  TrendBars,
  money,
  pct,
  useFinanceDashboard,
} from "./FinancePageShared";

const agingLabels = {
  current: "غير مستحق",
  "1_30": "1 - 30 يوم",
  "31_60": "31 - 60 يوم",
  "61_90": "61 - 90 يوم",
  "90_plus": "أكثر من 90 يوم",
};

const reportLinks = [
  { id: "finance-journal", title: "القيود اليومية", description: "طباعة سندات القيود ومراجعة أطرافها", icon: BookOpen },
  { id: "finance-general-ledger", title: "دفتر الأستاذ وميزان المراجعة", description: "كشوف الحساب والأرصدة المرحلة", icon: Scale },
  { id: "finance-income-statement", title: "قائمة الدخل", description: "الإيرادات والمصروفات وصافي الربح", icon: FileText },
  { id: "finance-balance-sheet", title: "الميزانية العمومية", description: "الأصول والالتزامات وحقوق الملكية", icon: Landmark },
  { id: "finance-cash-flow", title: "التدفقات النقدية", description: "المقبوضات والمدفوعات وحركة السيولة", icon: WalletCards },
  { id: "finance-customers", title: "ذمم العملاء", description: "أعمار الديون والتحصيلات والمخاطر", icon: CircleDollarSign },
  { id: "finance-suppliers", title: "ذمم الموردين", description: "الالتزامات وخطط وأولويات السداد", icon: Banknote },
  { id: "finance-supplier-invoices", title: "فواتير الموردين", description: "الفواتير والمطابقة الثلاثية والترحيل", icon: FileText },
];

function FinanceReports({ onNavigate }) {
  const [period, setPeriod] = useState("year");
  const { data, loading, error, load } = useFinanceDashboard(period);

  const kpis = data?.kpis || {};

  const margin =
    Number(kpis.income || 0) > 0
      ? (Number(kpis.net || 0) / Number(kpis.income || 0)) * 100
      : 0;

  return (
    <FinancePageShell
      icon={Scale}
      title="مركز الطباعة والتقارير"
      description="مركز موحد للوصول إلى القوائم والدفاتر والتقارير المحاسبية وطباعتها أو حفظها PDF."
      period={period}
      onPeriodChange={setPeriod}
      onRefresh={load}
      loading={loading}
      error={error}
      actions={
        <>
          <button type="button" className="finx-btn finx-btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> طباعة الملخص
          </button>
          <button type="button" className="finx-btn finx-btn-soft" onClick={() => window.print()}>
            <FileDown size={16} /> حفظ PDF
          </button>
        </>
      }
    >
      <section className="finx-print-center">
        <div className="finx-print-center-head">
          <div><span>مكتبة التقارير</span><h2>اختر التقرير المطلوب</h2><p>افتح التقرير ثم استخدم الطباعة أو الحفظ بصيغة PDF.</p></div>
          <Printer size={24} />
        </div>
        <div className="finx-print-links">
          {reportLinks.map((report) => {
            const Icon = report.icon;
            return (
              <button type="button" key={report.id} onClick={() => onNavigate?.(report.id)}>
                <span><Icon size={18} /></span>
                <div><strong>{report.title}</strong><small>{report.description}</small></div>
              </button>
            );
          })}
        </div>
      </section>

      <KpiGrid
        items={[
          {
            label: "الإيرادات",
            value: `${money(kpis.income)} ر.س`,
            icon: TrendingUp,
            tone: "green",
          },
          {
            label: "المصروفات",
            value: `${money(kpis.expenses)} ر.س`,
            icon: TrendingDown,
            tone: "orange",
          },
          {
            label: "صافي الربح",
            value: `${money(kpis.net)} ر.س`,
            icon: Banknote,
            tone: Number(kpis.net || 0) >= 0 ? "purple" : "red",
          },
          {
            label: "هامش صافي الربح",
            value: pct(margin),
            icon: Percent,
            tone: "blue",
          },
        ]}
      />

      <InsightStrip
        items={[
          {
            label: "الذمم المدينة",
            value: `${money(kpis.receivables)} ر.س`,
            icon: CircleDollarSign,
          },
          {
            label: "الذمم الدائنة",
            value: `${money(kpis.payables)} ر.س`,
            icon: WalletCards,
          },
          {
            label: "مؤشر السيولة التشغيلي",
            value: `${money(data?.cash_position)} ر.س`,
            icon: Banknote,
          },
          {
            label: "مشاريع لدى المالية",
            value: data?.projects_in_finance || 0,
            icon: Scale,
          },
        ]}
      />

      <div className="finx-grid">
        <SectionCard
          className="finx-span-7"
          title="اتجاه الأداء المالي"
          subtitle="إيرادات مقابل مصروفات خلال آخر 6 أشهر"
          icon={TrendingUp}
        >
          <TrendBars rows={data?.monthly_trend || []} />
        </SectionCard>

        <SectionCard
          className="finx-span-5"
          title="أعمار الذمم المدينة"
          subtitle="تركيز مخاطر التحصيل"
          icon={CircleDollarSign}
        >
          <AgingBars
            data={data?.receivables_aging || {}}
            labels={agingLabels}
          />
        </SectionCard>
      </div>
    </FinancePageShell>
  );
}

export default FinanceReports;
