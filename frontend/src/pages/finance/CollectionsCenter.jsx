import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpLeft,
  CalendarClock,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import "../../styles/collections-center.css";

const API_BASE =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const money = (value) =>
  new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const number = (value) =>
  new Intl.NumberFormat("ar-SA").format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return "غير محدد";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date.toLocaleDateString("ar-SA");
};

const riskLabels = { low: "منخفض", medium: "متوسط", high: "مرتفع" };
const paymentLabels = {
  unpaid: "غير مدفوعة",
  partially_paid: "مدفوعة جزئيًا",
  paid: "مدفوعة",
  refunded: "مستردة",
};

const emptyData = {
  summary: {},
  aging: [],
  monthly_collections: [],
  customers: [],
  invoices: [],
  action_queue: [],
};

export default function CollectionsCenter({ onChangeView }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [agingBucket, setAgingBucket] = useState("");
  const [risk, setRisk] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (paymentStatus) params.set("payment_status", paymentStatus);
      if (agingBucket) params.set("aging_bucket", agingBucket);
      if (risk) params.set("risk", risk);

      const response = await fetch(
        `${API_BASE}/finance/collections-center?${params.toString()}`,
        { headers: { Accept: "application/json" } }
      );
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json?.message || "تعذر تحميل مركز التحصيلات");
      }

      setData({ ...emptyData, ...json });
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل مركز التحصيلات");
    } finally {
      setLoading(false);
    }
  }, [search, paymentStatus, agingBucket, risk]);

  useEffect(() => {
    load();
  }, [paymentStatus, agingBucket, risk]);

  const summary = data.summary || {};
  const maxMonthly = useMemo(
    () => Math.max(...(data.monthly_collections || []).map((x) => Number(x.amount || 0)), 1),
    [data.monthly_collections]
  );
  const maxAging = useMemo(
    () => Math.max(...(data.aging || []).map((x) => Number(x.amount || 0)), 1),
    [data.aging]
  );

  return (
    <main className="collections-page" dir="rtl">
      <header className="collections-hero">
        <div>
          <span className="collections-kicker">المالية والحسابات المدينة</span>
          <h1>مركز التحصيلات</h1>
          <p>متابعة مستحقات العملاء وأعمار الديون ومعدلات التحصيل من مكان واحد.</p>
        </div>
        <div className="collections-hero-actions">
          <div className="collections-rate">
            <span>معدل التحصيل</span>
            <strong>{number(summary.collection_rate)}%</strong>
          </div>
          <button type="button" onClick={load} disabled={loading}>
            <RefreshCw size={17} className={loading ? "collections-spin" : ""} />
            تحديث البيانات
          </button>
        </div>
      </header>

      {error && (
        <div className="collections-error">
          <AlertTriangle size={19} />
          <span>{error}</span>
          <button type="button" onClick={load}>إعادة المحاولة</button>
        </div>
      )}

      <section className="collections-kpis">
        <Kpi icon={WalletCards} tone="violet" label="إجمالي المستحقات" value={money(summary.total_receivables)} note={`${number(summary.open_invoices_count)} فاتورة مفتوحة`} />
        <Kpi icon={ShieldAlert} tone="red" label="المبالغ المتأخرة" value={money(summary.overdue_receivables)} note={`${number(summary.overdue_invoices_count)} فاتورة متأخرة`} />
        <Kpi icon={CalendarClock} tone="orange" label="مستحق خلال 30 يوم" value={money(summary.due_next_30_days)} note="استحقاقات قريبة" />
        <Kpi icon={CircleDollarSign} tone="green" label="المحصل هذا الشهر" value={money(summary.collected_this_month)} note={`${number(summary.collection_rate)}% معدل التحصيل`} />
      </section>

      {loading && !data.invoices?.length ? (
        <div className="collections-loading"><Loader2 className="collections-spin" /> جاري تحليل بيانات التحصيل...</div>
      ) : (
        <>
          <section className="collections-analytics">
            <article className="collections-panel collections-chart-panel">
              <div className="collections-panel-head">
                <div><span>الأداء النقدي</span><h2>التحصيلات خلال 6 أشهر</h2></div>
                <TrendingUp size={22} />
              </div>
              <div className="collections-bars" aria-label="التحصيلات الشهرية">
                {(data.monthly_collections || []).map((item) => (
                  <div className="collections-bar-item" key={item.month}>
                    <span className="collections-bar-value">{money(item.amount)}</span>
                    <div className="collections-bar-track">
                      <i style={{ height: `${Math.max(5, (Number(item.amount || 0) / maxMonthly) * 100)}%` }} />
                    </div>
                    <b>{item.label}</b>
                  </div>
                ))}
              </div>
            </article>

            <article className="collections-panel">
              <div className="collections-panel-head">
                <div><span>تحليل المخاطر</span><h2>أعمار الديون</h2></div>
                <Clock3 size={22} />
              </div>
              <div className="collections-aging">
                {(data.aging || []).map((item) => (
                  <div className="collections-aging-row" key={item.key}>
                    <div><b>{item.label}</b><span>{number(item.invoices_count)} فاتورة</span></div>
                    <strong>{money(item.amount)}</strong>
                    <div className="collections-aging-track"><i className={`bucket-${item.key}`} style={{ width: `${Math.max(2, (Number(item.amount || 0) / maxAging) * 100)}%` }} /></div>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="collections-panel collections-customers-panel">
            <div className="collections-panel-head">
              <div><span>محفظة العملاء</span><h2>أعلى العملاء مديونية</h2></div>
              <Users size={22} />
            </div>
            <div className="collections-customer-list">
              {(data.customers || []).slice(0, 5).map((customer, index) => (
                <div className="collections-customer" key={customer.key || index}>
                  <span className="collections-rank">{index + 1}</span>
                  <div className="collections-customer-name"><b>{customer.buyer_name}</b><small>{number(customer.invoices_count)} فاتورة · متأخر {money(customer.overdue)}</small></div>
                  <div className="collections-customer-amount"><strong>{money(customer.outstanding)}</strong><span className={`collections-risk ${customer.risk}`}>{riskLabels[customer.risk] || customer.risk}</span></div>
                </div>
              ))}
              {!data.customers?.length && <div className="collections-empty">لا توجد مستحقات عملاء حاليًا.</div>}
            </div>
          </section>

          <section className="collections-panel collections-invoices-panel">
            <div className="collections-table-title">
              <div><span>دفتر المتابعة</span><h2>الفواتير المفتوحة</h2></div>
              <div className="collections-count">{number(data.invoices?.length)} فاتورة</div>
            </div>

            <div className="collections-filters">
              <label className="collections-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} placeholder="رقم الفاتورة، العميل أو الرقم الضريبي..." /></label>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option value="">كل حالات السداد</option><option value="unpaid">غير مدفوعة</option><option value="partially_paid">مدفوعة جزئيًا</option></select>
              <select value={agingBucket} onChange={(e) => setAgingBucket(e.target.value)}><option value="">كل أعمار الديون</option><option value="current">غير مستحق</option><option value="1_30">1 - 30 يوم</option><option value="31_60">31 - 60 يوم</option><option value="61_90">61 - 90 يوم</option><option value="90_plus">أكثر من 90 يوم</option></select>
              <select value={risk} onChange={(e) => setRisk(e.target.value)}><option value="">كل مستويات المخاطر</option><option value="low">منخفض</option><option value="medium">متوسط</option><option value="high">مرتفع</option></select>
              <button type="button" onClick={load}><Search size={16} /> بحث</button>
            </div>

            <div className="collections-table-wrap">
              <table className="collections-table">
                <thead><tr><th>الفاتورة</th><th>العميل والمشروع</th><th>الاستحقاق</th><th>الإجمالي</th><th>المتبقي</th><th>السداد</th><th>المخاطر</th><th>الإجراء المقترح</th><th></th></tr></thead>
                <tbody>
                  {(data.invoices || []).map((invoice) => (
                    <tr key={invoice.id} className={invoice.days_overdue > 0 ? "is-overdue" : ""}>
                      <td><b className="collections-invoice-number">{invoice.invoice_number}</b><small>{formatDate(invoice.issue_date)}</small></td>
                      <td><b>{invoice.buyer_name}</b><small>{invoice.project?.name || invoice.project?.project_code || "بدون مشروع"}</small></td>
                      <td><b>{formatDate(invoice.due_date)}</b><small className={invoice.days_overdue > 0 ? "overdue-text" : ""}>{invoice.days_overdue > 0 ? `متأخرة ${number(invoice.days_overdue)} يوم` : "ضمن الموعد"}</small></td>
                      <td>{money(invoice.total)}</td>
                      <td><strong className="collections-remaining">{money(invoice.remaining_amount)}</strong></td>
                      <td><span className={`collections-payment ${invoice.payment_status}`}>{paymentLabels[invoice.payment_status] || invoice.payment_status}</span></td>
                      <td><span className={`collections-risk ${invoice.risk}`}>{riskLabels[invoice.risk] || invoice.risk}</span></td>
                      <td className="collections-action-text">{invoice.recommended_action}</td>
                      <td><button className="collections-open" type="button" title="فتح الفاتورة" onClick={() => onChangeView?.("finance-tax-details", { taxInvoiceId: invoice.id })}><ChevronLeft size={18} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.invoices?.length && <div className="collections-empty"><ReceiptText size={35} /><b>لا توجد فواتير مطابقة</b><span>جرّب تغيير خيارات البحث أو التصفية.</span></div>}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Kpi({ icon: Icon, tone, label, value, note }) {
  return <article className={`collections-kpi ${tone}`}><div className="collections-kpi-icon"><Icon size={21} /></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div><ArrowUpLeft className="collections-kpi-arrow" size={16} /></article>;
}
