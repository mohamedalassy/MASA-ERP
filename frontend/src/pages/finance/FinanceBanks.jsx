import { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Landmark,
  RefreshCw,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  FinancePageShell,
  FinanceTable,
  InsightStrip,
  KpiGrid,
  SectionCard,
  TrendBars,
  money,
  useFinanceDashboard,
} from "./FinancePageShared";

function FinanceBanks({ onChangeView }) {
  const [period, setPeriod] = useState("year");
  const { data, loading, error, load } = useFinanceDashboard(period);

  const kpis = data?.kpis || {};

  const cashMovements = useMemo(
    () =>
      (data?.recent_transactions || []).filter(
        (item) =>
          ["customer_payment", "supplier_payment"].includes(item.type) ||
          item.payment_method
      ),
    [data]
  );

  const forecast = Number(data?.expected_collections_30d || 0) -
    Number(data?.expected_payments_30d || 0);

  return (
    <FinancePageShell
      icon={Landmark}
      title="البنوك والخزينة"
      description="لوحة سيولة وتشغيل للخزينة تعرض التدفقات المتوقعة، الحركة النقدية ومؤشرات التغطية."
      period={period}
      onPeriodChange={setPeriod}
      onRefresh={load}
      loading={loading}
      error={error}
    >
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => onChangeView?.("finance-bank-reconciliation")}
          style={{ border: 0, borderRadius: 12, padding: "12px 18px", background: "#6654f6", color: "#fff", fontWeight: 800, cursor: "pointer" }}
        >
          فتح التسوية البنكية
        </button>
      </div>
      <KpiGrid
        items={[
          {
            label: "المؤشر النقدي التشغيلي",
            value: `${money(data?.cash_position)} ر.س`,
            icon: Landmark,
            tone: "purple",
          },
          {
            label: "تحصيلات 30 يوم",
            value: `${money(data?.expected_collections_30d)} ر.س`,
            icon: ArrowDownLeft,
            tone: "green",
          },
          {
            label: "مدفوعات 30 يوم",
            value: `${money(data?.expected_payments_30d)} ر.س`,
            icon: ArrowUpRight,
            tone: "red",
          },
          {
            label: "صافي توقع 30 يوم",
            value: `${money(forecast)} ر.س`,
            icon: TrendingUp,
            tone: forecast >= 0 ? "blue" : "red",
          },
        ]}
      />

      <InsightStrip
        items={[
          {
            label: "إجمالي الإيرادات",
            value: `${money(kpis.income)} ر.س`,
            icon: ArrowDownLeft,
          },
          {
            label: "إجمالي المصروفات",
            value: `${money(kpis.expenses)} ر.س`,
            icon: ArrowUpRight,
          },
          {
            label: "صافي التشغيل",
            value: `${money(kpis.net)} ر.س`,
            icon: Banknote,
          },
          {
            label: "وضع السيولة",
            value: forecast >= 0 ? "تغطية موجبة" : "فجوة متوقعة",
            icon: WalletCards,
          },
        ]}
      />

      <div className="finx-grid">
        <SectionCard
          className="finx-span-5"
          title="تدفق 6 أشهر"
          subtitle="مقارنة الإيرادات والمصروفات"
          icon={TrendingUp}
        >
          <TrendBars rows={data?.monthly_trend || []} />
        </SectionCard>

        <SectionCard
          className="finx-span-7"
          title="آخر الحركات النقدية"
          subtitle="تحصيلات ومدفوعات مسجلة في النظام"
          icon={Landmark}
        >
          <FinanceTable
            rows={cashMovements}
            searchable={false}
            columns={[
              { key: "transaction_date", label: "التاريخ" },
              { key: "reference_number", label: "المرجع" },
              { key: "title", label: "البيان" },
              { key: "payment_method", label: "طريقة الدفع" },
              {
                key: "direction",
                label: "الاتجاه",
                render: (row) =>
                  row.direction === "income" ? "وارد" : "صادر",
              },
              {
                key: "total",
                label: "القيمة",
                render: (row) => `${money(row.total)} ر.س`,
              },
            ]}
          />
        </SectionCard>
      </div>
    </FinancePageShell>
  );
}

export default FinanceBanks;
