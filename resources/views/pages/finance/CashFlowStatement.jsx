import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Download,
  FileDown,
  Landmark,
  Printer,
  RefreshCw,
  Sparkles,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import "../../styles/financial-reports.css";

const API_BASE = "http://127.0.0.1:8000/api";
const COLORS = ["#6d5dfc", "#13b8a6", "#3b82f6", "#f59e0b", "#ef5da8"];

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

const monthLabel = (value) => {
  if (!value) return "—";
  const [year, month] = value.split("-");
  return new Intl.DateTimeFormat("ar-SA", {
    month: "short",
    year: "2-digit",
  }).format(new Date(Number(year), Number(month) - 1, 1));
};

const dateLabel = (value) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
};

function CashFlowStatement() {
  const [summary, setSummary] = useState({});
  const [categories, setCategories] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(
        `${API_BASE}/finance/cash-flow?${params.toString()}`
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "تعذر تحميل التدفقات النقدية.");
      }

      setSummary(result.summary || {});
      setCategories(result.categories || []);
      setMonthlyTrend(result.monthly_trend || []);
      setCashAccounts(result.cash_accounts || []);
      setTransactions(result.transactions || []);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل التدفقات النقدية.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const cashDistribution = useMemo(
    () => cashAccounts.map((row) => ({ name: row.name, value: Number(row.balance || 0) })),
    [cashAccounts]
  );

  const positiveNet = Number(summary.net_cash_flow || 0) >= 0;

  const exportCsv = () => {
    const rows = [
      ["التاريخ", "رقم القيد", "الحساب النقدي", "الحساب المقابل", "التصنيف", "داخل", "خارج"],
      ...transactions.map((row) => [
        row.entry_date,
        row.entry_number,
        row.cash_account?.name || "",
        row.counterpart_account?.name || "",
        row.category,
        row.inflow,
        row.outflow,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.join(",")).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "cash-flow-statement.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fin-report-page" dir="rtl">
      <section className="fin-report-hero">
        <div>
          <span className="fin-report-kicker"><Sparkles size={15} /> إدارة السيولة</span>
          <h1>قائمة التدفقات النقدية</h1>
          <p>تحليل المقبوضات والمدفوعات والسيولة حسب النشاط والحساب.</p>
        </div>
        <div className="fin-report-actions">
          <button type="button" className="ghost" onClick={() => window.print()}><Printer size={17} /> طباعة</button>
          <button type="button" className="ghost" onClick={() => window.print()}><FileDown size={17} /> حفظ PDF</button>
          <button type="button" className="ghost" onClick={exportCsv}><Download size={17} /> تصدير</button>
          <button type="button" className="primary" onClick={loadData}><RefreshCw size={17} className={loading ? "spin" : ""} /> تحديث</button>
        </div>
      </section>

      <section className="fin-filter-bar">
        <div className="fin-date-field"><span><CalendarDays size={16} /> من تاريخ</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="fin-date-field"><span><CalendarDays size={16} /> إلى تاريخ</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <button type="button" onClick={loadData}>تطبيق الفترة</button>
        <small>{from || to ? "تحليل فترة مخصصة" : "جميع الحركات المرحلة"}</small>
      </section>

      {error && <div className="fin-report-error">{error}</div>}

      <section className="fin-kpi-grid">
        <article className="fin-kpi-card margin"><span className="fin-kpi-icon"><WalletCards size={22} /></span><div><small>الرصيد الافتتاحي</small><strong>{money(summary.opening_balance)} <em>ر.س</em></strong></div><span className="fin-kpi-chip">بداية الفترة</span></article>
        <article className="fin-kpi-card revenue"><span className="fin-kpi-icon"><ArrowDownLeft size={22} /></span><div><small>إجمالي المقبوضات</small><strong>{money(summary.total_inflows)} <em>ر.س</em></strong></div><span className="fin-kpi-chip positive">تدفق داخل</span></article>
        <article className="fin-kpi-card expense"><span className="fin-kpi-icon"><ArrowUpRight size={22} /></span><div><small>إجمالي المدفوعات</small><strong>{money(summary.total_outflows)} <em>ر.س</em></strong></div><span className="fin-kpi-chip">تدفق خارج</span></article>
        <article className="fin-kpi-card profit"><span className="fin-kpi-icon"><TrendingUp size={22} /></span><div><small>صافي التدفق النقدي</small><strong>{money(summary.net_cash_flow)} <em>ر.س</em></strong></div><span className={`fin-kpi-chip ${positiveNet ? "positive" : "negative"}`}>{positiveNet ? "موجب" : "سالب"}</span></article>
      </section>

      <section className="fin-dashboard-grid">
        <article className="fin-chart-card fin-trend-card">
          <div className="fin-card-head"><div><span>اتجاه السيولة</span><h2>المقبوضات والمدفوعات الشهرية</h2><p>تطور صافي الحركة النقدية عبر الزمن</p></div><TrendingUp size={22} /></div>
          <div className="fin-chart-body">
            {monthlyTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashInFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6d5dfc" stopOpacity={0.28}/><stop offset="95%" stopColor="#6d5dfc" stopOpacity={0}/></linearGradient>
                    <linearGradient id="cashOutFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.22}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e9eaf2" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={compactMoney} axisLine={false} tickLine={false} orientation="right" />
                  <Tooltip labelFormatter={monthLabel} formatter={(value) => `${money(value)} ر.س`} />
                  <Legend />
                  <Area type="monotone" dataKey="inflows" name="المقبوضات" stroke="#6d5dfc" strokeWidth={3} fill="url(#cashInFill)" />
                  <Area type="monotone" dataKey="outflows" name="المدفوعات" stroke="#f59e0b" strokeWidth={3} fill="url(#cashOutFill)" />
                  <Line type="monotone" dataKey="net" name="صافي التدفق" stroke="#13b8a6" strokeWidth={3} dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="fin-empty-chart">لا توجد حركة نقدية خلال الفترة.</div>}
          </div>
        </article>

        <article className="fin-chart-card fin-donut-card">
          <div className="fin-card-head"><div><span>مراكز السيولة</span><h2>توزيع النقدية</h2><p>الأرصدة الحالية للصندوق والبنوك</p></div><Landmark size={22} /></div>
          <div className="fin-donut-wrap">
            {cashDistribution.length ? (
              <>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart><Pie data={cashDistribution} dataKey="value" nameKey="name" innerRadius={68} outerRadius={94} paddingAngle={4}>{cashDistribution.map((row, index) => <Cell key={row.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => `${money(value)} ر.س`} /></PieChart>
                </ResponsiveContainer>
                <div className="fin-donut-center"><strong>{money(summary.closing_balance)}</strong><span>الرصيد النقدي</span></div>
              </>
            ) : <div className="fin-empty-chart">لا توجد حسابات نقدية.</div>}
          </div>
          <div className="fin-mini-legend">{cashDistribution.map((row, index) => <div key={row.name}><i style={{ background: COLORS[index % COLORS.length] }} /><span>{row.name}</span><strong>{money(row.value)}</strong></div>)}</div>
        </article>
      </section>

      <section className="fin-chart-card fin-accounts-chart">
        <div className="fin-card-head"><div><span>أنشطة التدفق</span><h2>تشغيلي، استثماري وتمويلي</h2><p>مقارنة الداخل والخارج وصافي كل نشاط</p></div></div>
        <div className="fin-chart-body short">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categories} margin={{ top: 8, right: 15, left: 15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e9eaf2" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compactMoney} axisLine={false} tickLine={false} orientation="right" />
              <Tooltip formatter={(value) => `${money(value)} ر.س`} />
              <Legend />
              <Bar dataKey="inflows" name="التدفقات الداخلة" fill="#6d5dfc" radius={[8, 8, 0, 0]} />
              <Bar dataKey="outflows" name="التدفقات الخارجة" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              <Bar dataKey="net" name="الصافي" fill="#13b8a6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="fin-table-card">
        <div className="fin-card-head compact"><div><span>سجل السيولة</span><h2>أحدث الحركات النقدية</h2></div><strong className="green">{transactions.length} حركة</strong></div>
        <div className="fin-table-wrap">
          <table><thead><tr><th>التاريخ</th><th>رقم القيد</th><th>الحساب النقدي</th><th>الحساب المقابل</th><th>التصنيف</th><th>داخل</th><th>خارج</th></tr></thead>
            <tbody>{transactions.length ? transactions.map((row) => <tr key={row.id}><td>{dateLabel(row.entry_date)}</td><td><b>{row.entry_number || "—"}</b></td><td>{row.cash_account?.name || "—"}</td><td>{row.counterpart_account?.name || "—"}</td><td>{categories.find((item) => item.key === row.category)?.label || row.category}</td><td className="green"><b>{row.inflow ? money(row.inflow) : "—"}</b></td><td className="orange"><b>{row.outflow ? money(row.outflow) : "—"}</b></td></tr>) : <tr><td colSpan="7" className="empty">لا توجد حركات نقدية خلال الفترة.</td></tr>}</tbody>
          </table>
        </div>
      </section>

      <section className={`fin-result-banner ${positiveNet ? "profit" : "loss"}`}>
        <div><span>السيولة في نهاية الفترة</span><h2>الرصيد النقدي الختامي</h2><p>الرصيد الافتتاحي + صافي التدفق النقدي</p></div>
        <strong>{money(summary.closing_balance)} <em>ر.س</em></strong>
      </section>
    </div>
  );
}

export default CashFlowStatement;
