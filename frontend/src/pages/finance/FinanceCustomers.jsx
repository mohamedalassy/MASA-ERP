import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlarmClock,
  CalendarClock,
  CircleDollarSign,
  Download,
  FileDown,
  FileWarning,
  RefreshCw,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import "../../styles/financial-reports.css";

const API_BASE = "http://127.0.0.1:8000/api";
const AGING_COLORS = ["#13b8a6", "#6d5dfc", "#3b82f6", "#f59e0b", "#ef5d73"];
const RISK_COLORS = { low: "#13b8a6", medium: "#f59e0b", high: "#ef5d73" };

const money = (value) =>
  Number(value || 0).toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const compactMoney = (value) =>
  new Intl.NumberFormat("ar-SA", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value || 0));

const dateLabel = (value) => {
  if (!value) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
};

const riskLabel = { low: "منخفض", medium: "متوسط", high: "مرتفع" };
const statusLabel = {
  unpaid: "غير مدفوع",
  partially_paid: "مدفوع جزئيًا",
  paid: "مدفوع",
};

function Pill({ children, color = "#6d5dfc", background = "#f1efff" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", borderRadius: 20, background, color, fontSize: 10, fontWeight: 900 }}>
      {children}
    </span>
  );
}

function FinanceCustomers({ onNavigate }) {
  const [summary, setSummary] = useState({});
  const [aging, setAging] = useState([]);
  const [monthlyCollections, setMonthlyCollections] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [actionQueue, setActionQueue] = useState([]);
  const [search, setSearch] = useState("");
  const [agingBucket, setAgingBucket] = useState("");
  const [risk, setRisk] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (agingBucket) params.set("aging_bucket", agingBucket);
      if (risk) params.set("risk", risk);

      const response = await fetch(
        `${API_BASE}/finance/collections-center?${params.toString()}`
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "تعذر تحميل مركز التحصيلات.");
      }

      setSummary(result.summary || {});
      setAging(result.aging || []);
      setMonthlyCollections(result.monthly_collections || []);
      setCustomers(result.customers || []);
      setInvoices(result.invoices || []);
      setActionQueue(result.action_queue || []);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل مركز التحصيلات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const riskDistribution = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0 };
    customers.forEach((customer) => { counts[customer.risk] = (counts[customer.risk] || 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({ key, name: riskLabel[key], value }));
  }, [customers]);

  const exportCsv = () => {
    const rows = [
      ["رقم الفاتورة", "العميل", "الإصدار", "الاستحقاق", "الإجمالي", "المدفوع", "المتبقي", "أيام التأخير", "المخاطر"],
      ...invoices.map((row) => [row.invoice_number, row.buyer_name, row.issue_date, row.due_date || "", row.total, row.paid_amount, row.remaining_amount, row.days_overdue, riskLabel[row.risk]]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.join(",")).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "collections-center.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fin-report-page" dir="rtl">
      <section className="fin-report-hero">
        <div>
          <span className="fin-report-kicker"><Sparkles size={15} /> إدارة الائتمان والتحصيل</span>
          <h1>مركز تحصيلات العملاء</h1>
          <p>متابعة الذمم والفواتير وأعمار الديون والمخاطر وإجراءات التحصيل.</p>
        </div>
        <div className="fin-report-actions">
          <button type="button" className="ghost" onClick={() => window.print()}><Printer size={17} /> طباعة</button>
          <button type="button" className="ghost" onClick={() => window.print()}><FileDown size={17} /> PDF</button>
          <button type="button" className="ghost" onClick={exportCsv}><Download size={17} /> تصدير</button>
          <button type="button" className="primary" onClick={loadData}><RefreshCw size={17} className={loading ? "spin" : ""} /> تحديث</button>
        </div>
      </section>

      <section className="fin-filter-bar">
        <div className="fin-date-field" style={{ minWidth: 300 }}>
          <span><Search size={16} /> بحث في العميل أو الفاتورة</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadData()} placeholder="اسم العميل، الرقم الضريبي، رقم الفاتورة..." />
        </div>
        <div className="fin-date-field">
          <span><AlarmClock size={16} /> عمر الدين</span>
          <select value={agingBucket} onChange={(e) => setAgingBucket(e.target.value)} style={{ width: "100%", border: "1px solid #e2e5ee", borderRadius: 11, padding: "10px 12px", background: "#fafbfe", fontFamily: "inherit" }}>
            <option value="">كل الأعمار</option><option value="current">غير مستحق</option><option value="1_30">1 - 30 يوم</option><option value="31_60">31 - 60 يوم</option><option value="61_90">61 - 90 يوم</option><option value="90_plus">أكثر من 90 يوم</option>
          </select>
        </div>
        <div className="fin-date-field">
          <span><ShieldCheck size={16} /> المخاطر</span>
          <select value={risk} onChange={(e) => setRisk(e.target.value)} style={{ width: "100%", border: "1px solid #e2e5ee", borderRadius: 11, padding: "10px 12px", background: "#fafbfe", fontFamily: "inherit" }}>
            <option value="">كل المخاطر</option><option value="low">منخفضة</option><option value="medium">متوسطة</option><option value="high">مرتفعة</option>
          </select>
        </div>
        <button type="button" onClick={loadData}>تطبيق الفلاتر</button>
      </section>

      {error && <div className="fin-report-error">{error}</div>}

      <section className="fin-kpi-grid">
        <article className="fin-kpi-card revenue"><span className="fin-kpi-icon"><WalletCards size={22} /></span><div><small>إجمالي الذمم المدينة</small><strong>{money(summary.total_receivables)} <em>ر.س</em></strong></div><span className="fin-kpi-chip positive">{summary.open_invoices_count || 0} فاتورة</span></article>
        <article className="fin-kpi-card expense"><span className="fin-kpi-icon"><AlarmClock size={22} /></span><div><small>متأخر التحصيل</small><strong>{money(summary.overdue_receivables)} <em>ر.س</em></strong></div><span className="fin-kpi-chip">{summary.overdue_invoices_count || 0} متأخرة</span></article>
        <article className="fin-kpi-card profit"><span className="fin-kpi-icon"><CircleDollarSign size={22} /></span><div><small>المحصل هذا الشهر</small><strong>{money(summary.collected_this_month)} <em>ر.س</em></strong></div><span className="fin-kpi-chip positive">تحصيل فعلي</span></article>
        <article className="fin-kpi-card margin"><span className="fin-kpi-icon"><TrendingUp size={22} /></span><div><small>معدل التحصيل</small><strong>{Number(summary.collection_rate || 0).toFixed(1)}<em>%</em></strong></div><div className="fin-margin-track"><span style={{ width: `${Math.min(100, Number(summary.collection_rate || 0))}%` }} /></div></article>
      </section>

      <section className="fin-kpi-grid">
        <article className="fin-kpi-card revenue"><span className="fin-kpi-icon"><CalendarClock size={22} /></span><div><small>مستحق خلال 30 يومًا</small><strong>{money(summary.due_next_30_days)} <em>ر.س</em></strong></div></article>
        <article className="fin-kpi-card profit"><span className="fin-kpi-icon"><Users size={22} /></span><div><small>عملاء لديهم رصيد</small><strong>{summary.customers_count || 0}</strong></div></article>
        <article className="fin-kpi-card expense"><span className="fin-kpi-icon"><FileWarning size={22} /></span><div><small>فواتير عالية المخاطر</small><strong>{summary.high_risk_invoices_count || 0}</strong></div></article>
        <article className="fin-kpi-card margin"><span className="fin-kpi-icon"><ShieldCheck size={22} /></span><div><small>غير متأخر</small><strong>{money(summary.current_receivables)} <em>ر.س</em></strong></div><span className="fin-kpi-chip positive">محفظة حالية</span></article>
      </section>

      <section className="fin-dashboard-grid">
        <article className="fin-chart-card fin-trend-card">
          <div className="fin-card-head"><div><span>تطور التحصيل</span><h2>التحصيلات الشهرية</h2><p>قيمة الدفعات المسجلة خلال آخر ستة أشهر</p></div><TrendingUp size={22} /></div>
          <div className="fin-chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyCollections} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
                <defs><linearGradient id="collectionsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6d5dfc" stopOpacity={0.3}/><stop offset="95%" stopColor="#6d5dfc" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e9eaf2" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compactMoney} axisLine={false} tickLine={false} orientation="right" />
                <Tooltip formatter={(value) => `${money(value)} ر.س`} />
                <Area type="monotone" dataKey="amount" name="التحصيل" stroke="#6d5dfc" strokeWidth={3} fill="url(#collectionsFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="fin-chart-card fin-donut-card">
          <div className="fin-card-head"><div><span>جودة المحفظة</span><h2>مخاطر العملاء</h2><p>توزيع العملاء حسب مستوى المخاطر</p></div><ShieldCheck size={22} /></div>
          <div className="fin-donut-wrap">
            <ResponsiveContainer width="100%" height={230}><PieChart><Pie data={riskDistribution} dataKey="value" nameKey="name" innerRadius={68} outerRadius={94} paddingAngle={4}>{riskDistribution.map((row) => <Cell key={row.key} fill={RISK_COLORS[row.key]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
            <div className="fin-donut-center"><strong>{summary.customers_count || 0}</strong><span>عميل</span></div>
          </div>
          <div className="fin-mini-legend">{riskDistribution.map((row) => <div key={row.key}><i style={{ background: RISK_COLORS[row.key] }} /><span>{row.name}</span><strong>{row.value}</strong></div>)}</div>
        </article>
      </section>

      <section className="fin-chart-card fin-accounts-chart">
        <div className="fin-card-head"><div><span>تحليل التأخير</span><h2>أعمار الذمم المدينة</h2><p>قيمة المستحقات وعدد الفواتير في كل شريحة</p></div><AlarmClock size={22} /></div>
        <div className="fin-chart-body short">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={aging} margin={{ top: 8, right: 12, left: 12 }}><CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e9eaf2" /><XAxis dataKey="label" axisLine={false} tickLine={false} /><YAxis tickFormatter={compactMoney} axisLine={false} tickLine={false} orientation="right" /><Tooltip formatter={(value) => `${money(value)} ر.س`} /><Bar dataKey="amount" name="المستحقات" radius={[9, 9, 0, 0]}>{aging.map((row, index) => <Cell key={row.key} fill={AGING_COLORS[index % AGING_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer>
        </div>
      </section>

      <section className="fin-table-card">
        <div className="fin-card-head compact"><div><span>محفظة العملاء</span><h2>الفواتير المفتوحة والتحصيلات الجزئية</h2></div><strong className="green">{money(summary.total_receivables)} ر.س</strong></div>
        <div className="fin-table-wrap"><table><thead><tr><th>الفاتورة</th><th>العميل</th><th>الاستحقاق</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>التأخير</th><th>المخاطر</th><th>الإجراء</th></tr></thead><tbody>{invoices.length ? invoices.map((row) => <tr key={row.id}><td><button type="button" onClick={() => onNavigate?.("finance-tax-details", { taxInvoiceId: row.id })} style={{ border: 0, background: "transparent", color: "#6d5dfc", fontWeight: 900, cursor: "pointer", fontFamily: "inherit" }}>{row.invoice_number}</button></td><td><b>{row.buyer_name}</b><br/><small style={{ color: "#9aa2b1" }}>{row.project?.name || "بدون مشروع"}</small></td><td>{dateLabel(row.due_date)}</td><td>{money(row.total)}</td><td className="green"><b>{money(row.paid_amount)}</b></td><td className="orange"><b>{money(row.remaining_amount)}</b></td><td>{row.days_overdue > 0 ? `${row.days_overdue} يوم` : "—"}</td><td><Pill color={RISK_COLORS[row.risk]} background={`${RISK_COLORS[row.risk]}18`}>{riskLabel[row.risk]}</Pill></td><td><span style={{ fontSize: 11 }}>{row.recommended_action}</span><br/><Pill>{statusLabel[row.payment_status] || row.payment_status}</Pill></td></tr>) : <tr><td colSpan="9" className="empty">لا توجد فواتير مطابقة للفلاتر.</td></tr>}</tbody></table></div>
      </section>

      <section className="fin-tables-grid">
        <article className="fin-table-card"><div className="fin-card-head compact"><div><span>مخاطر العملاء</span><h2>أعلى العملاء مديونية</h2></div><Users size={20} /></div><div className="fin-table-wrap"><table><thead><tr><th>العميل</th><th>الرصيد</th><th>المتأخر</th><th>الفواتير</th><th>المخاطر</th></tr></thead><tbody>{customers.length ? customers.slice(0, 8).map((row) => <tr key={row.key}><td><b>{row.buyer_name}</b></td><td>{money(row.outstanding)}</td><td className="orange">{money(row.overdue)}</td><td>{row.invoices_count}</td><td><Pill color={RISK_COLORS[row.risk]} background={`${RISK_COLORS[row.risk]}18`}>{riskLabel[row.risk]}</Pill></td></tr>) : <tr><td colSpan="5" className="empty">لا توجد أرصدة عملاء.</td></tr>}</tbody></table></div></article>
        <article className="fin-table-card"><div className="fin-card-head compact"><div><span>قائمة العمل</span><h2>إجراءات التحصيل العاجلة</h2></div><FileWarning size={20} /></div><div className="fin-table-wrap"><table><thead><tr><th>الفاتورة</th><th>العميل</th><th>المتبقي</th><th>الإجراء</th></tr></thead><tbody>{actionQueue.length ? actionQueue.map((row) => <tr key={row.id}><td><b>{row.invoice_number}</b></td><td>{row.buyer_name}</td><td className="orange"><b>{money(row.remaining_amount)}</b></td><td>{row.recommended_action}</td></tr>) : <tr><td colSpan="4" className="empty">لا توجد إجراءات عاجلة حاليًا.</td></tr>}</tbody></table></div></article>
      </section>
    </div>
  );
}

export default FinanceCustomers;
