import { useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlarmClock, CalendarClock, CheckCircle2, Download, FileDown, FileWarning,
  Printer, RefreshCw, Search, ShieldAlert, Sparkles, Truck, WalletCards,
} from "lucide-react";
import "../../styles/financial-reports.css";

const API_BASE = "http://127.0.0.1:8000/api";
const AGING_COLORS = ["#13b8a6", "#6d5dfc", "#3b82f6", "#f59e0b", "#ef5d73"];
const RISK_COLORS = { low: "#13b8a6", medium: "#f59e0b", high: "#ef5d73" };
const riskLabel = { low: "منخفض", medium: "متوسط", high: "مرتفع" };

const money = (value) => Number(value || 0).toLocaleString("ar-SA", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const compactMoney = (value) => new Intl.NumberFormat("ar-SA", {
  notation: "compact", maximumFractionDigits: 1,
}).format(Number(value || 0));
const dateLabel = (value) => value ? new Intl.DateTimeFormat("ar-SA", {
  year: "numeric", month: "short", day: "numeric",
}).format(new Date(value)) : "غير محدد";

function Pill({ children, color = "#6d5dfc" }) {
  return <span style={{ display: "inline-flex", padding: "5px 9px", borderRadius: 20, background: `${color}18`, color, fontSize: 10, fontWeight: 900 }}>{children}</span>;
}

function FinanceSuppliers() {
  const [summary, setSummary] = useState({});
  const [aging, setAging] = useState([]);
  const [monthlyPayments, setMonthlyPayments] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [payables, setPayables] = useState([]);
  const [paymentQueue, setPaymentQueue] = useState([]);
  const [matching, setMatching] = useState({});
  const [search, setSearch] = useState("");
  const [agingBucket, setAgingBucket] = useState("");
  const [risk, setRisk] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true); setError("");
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (agingBucket) params.set("aging_bucket", agingBucket);
      if (risk) params.set("risk", risk);
      const response = await fetch(`${API_BASE}/finance/suppliers-center?${params}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "تعذر تحميل مركز الموردين.");
      setSummary(result.summary || {}); setAging(result.aging || []);
      setMonthlyPayments(result.monthly_payments || []); setSuppliers(result.suppliers || []);
      setPayables(result.payables || []); setPaymentQueue(result.payment_queue || []);
      setMatching(result.matching || {});
    } catch (err) { setError(err.message || "حدث خطأ أثناء تحميل مركز الموردين."); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const riskDistribution = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0 };
    suppliers.forEach((row) => { counts[row.risk] = (counts[row.risk] || 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({ key, name: riskLabel[key], value }));
  }, [suppliers]);

  const exportCsv = () => {
    const rows = [["المرجع", "المورد", "الاستحقاق", "الإجمالي", "المدفوع", "المتبقي", "التأخير", "المخاطر"],
      ...payables.map((r) => [r.reference_number, r.supplier_name, r.due_date || "", r.total, r.paid_amount, r.remaining_amount, r.days_overdue, riskLabel[r.risk]])];
    const blob = new Blob([`\uFEFF${rows.map((r) => r.join(",")).join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "suppliers-payments-center.csv"; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="fin-report-page" dir="rtl">
    <section className="fin-report-hero">
      <div><span className="fin-report-kicker"><Sparkles size={15}/> إدارة الالتزامات والمدفوعات</span><h1>مركز الموردين والمدفوعات</h1><p>إدارة الذمم الدائنة وأولويات السداد ومخاطر الموردين وجاهزية المطابقة الثلاثية.</p></div>
      <div className="fin-report-actions"><button className="ghost" onClick={() => window.print()}><Printer size={17}/> طباعة</button><button className="ghost" onClick={() => window.print()}><FileDown size={17}/> PDF</button><button className="ghost" onClick={exportCsv}><Download size={17}/> تصدير</button><button className="primary" onClick={loadData}><RefreshCw size={17} className={loading ? "spin" : ""}/> تحديث</button></div>
    </section>

    <section className="fin-filter-bar">
      <div className="fin-date-field" style={{ minWidth: 300 }}><span><Search size={16}/> بحث في المورد أو المرجع</span><input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadData()} placeholder="اسم المورد، المرجع، البيان..."/></div>
      <div className="fin-date-field"><span><AlarmClock size={16}/> عمر الالتزام</span><select value={agingBucket} onChange={(e) => setAgingBucket(e.target.value)}><option value="">كل الأعمار</option><option value="current">غير مستحق</option><option value="1_30">1 - 30 يوم</option><option value="31_60">31 - 60 يوم</option><option value="61_90">61 - 90 يوم</option><option value="90_plus">أكثر من 90 يوم</option></select></div>
      <div className="fin-date-field"><span><ShieldAlert size={16}/> المخاطر</span><select value={risk} onChange={(e) => setRisk(e.target.value)}><option value="">كل المخاطر</option><option value="low">منخفضة</option><option value="medium">متوسطة</option><option value="high">مرتفعة</option></select></div>
      <button onClick={loadData}>تطبيق الفلاتر</button>
    </section>
    {error && <div className="fin-report-error">{error}</div>}

    <section className="fin-kpi-grid">
      <article className="fin-kpi-card expense"><span className="fin-kpi-icon"><WalletCards size={22}/></span><div><small>إجمالي الذمم الدائنة</small><strong>{money(summary.total_payables)} <em>ر.س</em></strong></div><span className="fin-kpi-chip">{summary.open_items_count || 0} التزام</span></article>
      <article className="fin-kpi-card revenue"><span className="fin-kpi-icon"><AlarmClock size={22}/></span><div><small>متأخر السداد</small><strong>{money(summary.overdue_payables)} <em>ر.س</em></strong></div><span className="fin-kpi-chip">{summary.overdue_items_count || 0} متأخر</span></article>
      <article className="fin-kpi-card profit"><span className="fin-kpi-icon"><CalendarClock size={22}/></span><div><small>مستحق خلال 30 يومًا</small><strong>{money(summary.due_next_30_days)} <em>ر.س</em></strong></div><span className="fin-kpi-chip positive">خطة الدفع</span></article>
      <article className="fin-kpi-card margin"><span className="fin-kpi-icon"><CheckCircle2 size={22}/></span><div><small>جاهزية المطابقة</small><strong>{Number(summary.matching_rate || 0).toFixed(1)}<em>%</em></strong></div><div className="fin-margin-track"><span style={{ width: `${Math.min(100, Number(summary.matching_rate || 0))}%` }}/></div></article>
    </section>

    <section className="fin-kpi-grid">
      <article className="fin-kpi-card profit"><span className="fin-kpi-icon"><Truck size={22}/></span><div><small>مشتريات معتمدة</small><strong>{money(summary.approved_purchases)} <em>ر.س</em></strong></div></article>
      <article className="fin-kpi-card revenue"><span className="fin-kpi-icon"><WalletCards size={22}/></span><div><small>مدفوع هذا الشهر</small><strong>{money(summary.paid_this_month)} <em>ر.س</em></strong></div></article>
      <article className="fin-kpi-card expense"><span className="fin-kpi-icon"><FileWarning size={22}/></span><div><small>التزامات عالية المخاطر</small><strong>{summary.high_risk_items_count || 0}</strong></div></article>
      <article className="fin-kpi-card margin"><span className="fin-kpi-icon"><Truck size={22}/></span><div><small>موردون لديهم رصيد</small><strong>{summary.suppliers_count || 0}</strong></div><span className="fin-kpi-chip positive">محفظة الموردين</span></article>
    </section>

    <section className="fin-dashboard-grid">
      <article className="fin-chart-card fin-trend-card"><div className="fin-card-head"><div><span>خطة السيولة</span><h2>المدفوع والمستحق شهريًا</h2><p>مقارنة المدفوعات الفعلية بالالتزامات المستحقة</p></div><CalendarClock size={22}/></div><div className="fin-chart-body"><ResponsiveContainer width="100%" height="100%"><AreaChart data={monthlyPayments}><defs><linearGradient id="supplierPaid" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#13b8a6" stopOpacity={.3}/><stop offset="95%" stopColor="#13b8a6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e9eaf2"/><XAxis dataKey="label" axisLine={false} tickLine={false}/><YAxis tickFormatter={compactMoney} orientation="right" axisLine={false} tickLine={false}/><Tooltip formatter={(v) => `${money(v)} ر.س`}/><Area type="monotone" dataKey="paid" name="المدفوع" stroke="#13b8a6" strokeWidth={3} fill="url(#supplierPaid)"/><Area type="monotone" dataKey="due" name="المستحق" stroke="#f59e0b" strokeWidth={3} fill="transparent"/></AreaChart></ResponsiveContainer></div></article>
      <article className="fin-chart-card fin-donut-card"><div className="fin-card-head"><div><span>تركيز المخاطر</span><h2>مخاطر الموردين</h2><p>توزيع الموردين حسب مخاطر التأخير</p></div><ShieldAlert size={22}/></div><div className="fin-donut-wrap"><ResponsiveContainer width="100%" height={230}><PieChart><Pie data={riskDistribution} dataKey="value" innerRadius={68} outerRadius={94} paddingAngle={4}>{riskDistribution.map((r) => <Cell key={r.key} fill={RISK_COLORS[r.key]}/>)}</Pie><Tooltip/></PieChart></ResponsiveContainer><div className="fin-donut-center"><strong>{summary.suppliers_count || 0}</strong><span>مورد</span></div></div><div className="fin-mini-legend">{riskDistribution.map((r) => <div key={r.key}><i style={{ background: RISK_COLORS[r.key] }}/><span>{r.name}</span><strong>{r.value}</strong></div>)}</div></article>
    </section>

    <section className="fin-chart-card fin-accounts-chart"><div className="fin-card-head"><div><span>تحليل الاستحقاق</span><h2>أعمار الذمم الدائنة</h2><p>قيمة الالتزامات وعدد البنود في كل شريحة</p></div><AlarmClock size={22}/></div><div className="fin-chart-body short"><ResponsiveContainer width="100%" height="100%"><BarChart data={aging}><CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e9eaf2"/><XAxis dataKey="label" axisLine={false} tickLine={false}/><YAxis tickFormatter={compactMoney} orientation="right" axisLine={false} tickLine={false}/><Tooltip formatter={(v) => `${money(v)} ر.س`}/><Bar dataKey="amount" name="الالتزامات" radius={[9,9,0,0]}>{aging.map((r, i) => <Cell key={r.key} fill={AGING_COLORS[i % AGING_COLORS.length]}/>)}</Bar></BarChart></ResponsiveContainer></div></section>

    <section className="fin-table-card"><div className="fin-card-head compact"><div><span>محفظة الموردين</span><h2>الالتزامات المفتوحة والمدفوعات الجزئية</h2></div><strong className="orange">{money(summary.total_payables)} ر.س</strong></div><div className="fin-table-wrap"><table><thead><tr><th>المرجع</th><th>المورد / البيان</th><th>المشروع</th><th>الاستحقاق</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>المخاطر</th><th>الإجراء</th></tr></thead><tbody>{payables.length ? payables.map((r) => <tr key={r.id}><td><b>{r.reference_number || `#${r.id}`}</b></td><td><b>{r.supplier_name}</b><br/><small>{r.title}</small></td><td>{r.project?.name || "—"}</td><td>{dateLabel(r.due_date)}</td><td>{money(r.total)}</td><td className="green">{money(r.paid_amount)}</td><td className="orange"><b>{money(r.remaining_amount)}</b></td><td><Pill color={RISK_COLORS[r.risk]}>{riskLabel[r.risk]}</Pill></td><td><small>{r.recommended_action}</small></td></tr>) : <tr><td colSpan="9" className="empty">لا توجد التزامات مطابقة للفلاتر.</td></tr>}</tbody></table></div></section>

    <section className="fin-tables-grid">
      <article className="fin-table-card"><div className="fin-card-head compact"><div><span>تركيز الالتزامات</span><h2>أعلى الموردين رصيدًا</h2></div><Truck size={20}/></div><div className="fin-table-wrap"><table><thead><tr><th>المورد</th><th>الرصيد</th><th>المتأخر</th><th>التركيز</th><th>المخاطر</th></tr></thead><tbody>{suppliers.length ? suppliers.slice(0,8).map((r) => <tr key={r.key}><td><b>{r.supplier_name}</b></td><td>{money(r.outstanding)}</td><td className="orange">{money(r.overdue)}</td><td>{r.exposure_ratio}%</td><td><Pill color={RISK_COLORS[r.risk]}>{riskLabel[r.risk]}</Pill></td></tr>) : <tr><td colSpan="5" className="empty">لا توجد أرصدة موردين.</td></tr>}</tbody></table></div></article>
      <article className="fin-table-card"><div className="fin-card-head compact"><div><span>تشغيل المدفوعات</span><h2>قائمة الدفع ذات الأولوية</h2></div><FileWarning size={20}/></div><div className="fin-table-wrap"><table><thead><tr><th>المرجع</th><th>المورد</th><th>المتبقي</th><th>الإجراء</th></tr></thead><tbody>{paymentQueue.length ? paymentQueue.map((r) => <tr key={r.id}><td><b>{r.reference_number || `#${r.id}`}</b></td><td>{r.supplier_name}</td><td className="orange"><b>{money(r.remaining_amount)}</b></td><td>{r.recommended_action}</td></tr>) : <tr><td colSpan="4" className="empty">لا توجد دفعات عاجلة حاليًا.</td></tr>}</tbody></table></div></article>
    </section>

    <section className="fin-balance-banner"><div><span>جاهزية المطابقة الثلاثية</span><h2>{matching.ready || 0} أوامر جاهزة، {matching.needs_review || 0} تحتاج مراجعة</h2><p>{matching.note}</p></div><strong>{Number(matching.rate || 0).toFixed(1)}%</strong></section>
  </div>;
}

export default FinanceSuppliers;
