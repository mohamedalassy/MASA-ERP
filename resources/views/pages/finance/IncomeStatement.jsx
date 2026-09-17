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
  CalendarDays,
  Download,
  FileDown,
  FileBarChart2,
  PieChart as PieChartIcon,
  Printer,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import "../../styles/financial-reports.css";

const API_BASE = "http://127.0.0.1:8000/api";
const COLORS = ["#6d5dfc", "#13b8a6", "#f59e0b", "#ef5da8", "#3b82f6"];

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
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat("ar-SA", {
    month: "short",
    year: "2-digit",
  }).format(date);
};

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="fin-chart-tooltip">
      <strong>{monthLabel(label)}</strong>
      {payload.map((item) => (
        <span key={item.dataKey}>
          <i style={{ background: item.color }} />
          {item.name}: {money(item.value)} ر.س
        </span>
      ))}
    </div>
  );
}

function IncomeStatement() {
  const [summary, setSummary] = useState({});
  const [revenues, setRevenues] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [monthlyTrend, setMonthlyTrend] = useState([]);
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
        `${API_BASE}/finance/income-statement?${params.toString()}`
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "تعذر تحميل قائمة الدخل.");
      }

      setSummary(result.summary || {});
      setRevenues(result.revenues || []);
      setExpenses(result.expenses || []);
      setMonthlyTrend(result.monthly_trend || []);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل قائمة الدخل.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const isProfit = Number(summary.net_profit || 0) >= 0;

  const expenseChartData = useMemo(
    () =>
      expenses.map((row) => ({
        name: row.name,
        value: Number(row.amount || 0),
      })),
    [expenses]
  );

  const accountComparison = useMemo(
    () => [
      ...revenues.map((row) => ({
        name: row.name,
        الإيرادات: Number(row.amount || 0),
        المصروفات: 0,
      })),
      ...expenses.map((row) => ({
        name: row.name,
        الإيرادات: 0,
        المصروفات: Number(row.amount || 0),
      })),
    ],
    [revenues, expenses]
  );

  const exportCsv = () => {
    const rows = [
      ["النوع", "الكود", "الحساب", "المبلغ"],
      ...revenues.map((row) => ["إيراد", row.code, row.name, row.amount]),
      ...expenses.map((row) => ["مصروف", row.code, row.name, row.amount]),
      ["النتيجة", "", "صافي الربح", summary.net_profit || 0],
    ];

    const csv = `\uFEFF${rows.map((row) => row.join(",")).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "income-statement.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fin-report-page" dir="rtl">
      <section className="fin-report-hero">
        <div>
          <span className="fin-report-kicker">
            <Sparkles size={15} /> التحليلات المالية
          </span>
          <h1>قائمة الدخل</h1>
          <p>تحليل حي للإيرادات والمصروفات والربحية من القيود المرحلة.</p>
        </div>

        <div className="fin-report-actions">
          <button type="button" className="ghost" onClick={() => window.print()}>
            <Printer size={17} /> طباعة
          </button>
          <button type="button" className="ghost" onClick={() => window.print()}>
            <FileDown size={17} /> حفظ PDF
          </button>
          <button type="button" className="ghost" onClick={exportCsv}>
            <Download size={17} /> تصدير
          </button>
          <button type="button" className="primary" onClick={loadData}>
            <RefreshCw size={17} className={loading ? "spin" : ""} /> تحديث
          </button>
        </div>
      </section>

      <section className="fin-filter-bar">
        <div className="fin-date-field">
          <span><CalendarDays size={16} /> من تاريخ</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="fin-date-field">
          <span><CalendarDays size={16} /> إلى تاريخ</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button type="button" onClick={loadData}>تطبيق الفترة</button>
        <small>{from || to ? "فترة مخصصة" : "جميع الفترات المتاحة"}</small>
      </section>

      {error && <div className="fin-report-error">{error}</div>}

      <section className="fin-kpi-grid">
        <article className="fin-kpi-card revenue">
          <span className="fin-kpi-icon"><TrendingUp size={22} /></span>
          <div><small>إجمالي الإيرادات</small><strong>{money(summary.total_revenue)} <em>ر.س</em></strong></div>
          <span className="fin-kpi-chip positive">إيرادات مرحلة</span>
        </article>
        <article className="fin-kpi-card expense">
          <span className="fin-kpi-icon"><TrendingDown size={22} /></span>
          <div><small>إجمالي المصروفات</small><strong>{money(summary.total_expenses)} <em>ر.س</em></strong></div>
          <span className="fin-kpi-chip">{expenses.length} حساب</span>
        </article>
        <article className="fin-kpi-card profit">
          <span className="fin-kpi-icon"><WalletCards size={22} /></span>
          <div><small>{isProfit ? "صافي الربح" : "صافي الخسارة"}</small><strong>{money(Math.abs(summary.net_profit || 0))} <em>ر.س</em></strong></div>
          <span className={`fin-kpi-chip ${isProfit ? "positive" : "negative"}`}>{isProfit ? "ربح" : "خسارة"}</span>
        </article>
        <article className="fin-kpi-card margin">
          <span className="fin-kpi-icon"><PieChartIcon size={22} /></span>
          <div><small>هامش صافي الربح</small><strong>{Number(summary.profit_margin || 0).toFixed(1)}<em>%</em></strong></div>
          <div className="fin-margin-track"><span style={{ width: `${Math.min(100, Math.max(0, Number(summary.profit_margin || 0)))}%` }} /></div>
        </article>
      </section>

      <section className="fin-dashboard-grid">
        <article className="fin-chart-card fin-trend-card">
          <div className="fin-card-head">
            <div><span>اتجاه الأداء</span><h2>الإيرادات والمصروفات الشهرية</h2><p>مقارنة الحركة وصافي الربح عبر الزمن</p></div>
            <FileBarChart2 size={22} />
          </div>
          <div className="fin-chart-body">
            {monthlyTrend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyTrend} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6d5dfc" stopOpacity={0.3}/><stop offset="95%" stopColor="#6d5dfc" stopOpacity={0}/></linearGradient>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/><stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e9eaf2" />
                  <XAxis dataKey="month" tickFormatter={monthLabel} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={compactMoney} axisLine={false} tickLine={false} orientation="right" />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="الإيرادات" stroke="#6d5dfc" strokeWidth={3} fill="url(#revenueFill)" />
                  <Area type="monotone" dataKey="expenses" name="المصروفات" stroke="#f59e0b" strokeWidth={3} fill="url(#expenseFill)" />
                  <Line type="monotone" dataKey="net_profit" name="صافي الربح" stroke="#13b8a6" strokeWidth={3} dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="fin-empty-chart">لا توجد بيانات شهرية خلال الفترة.</div>}
          </div>
        </article>

        <article className="fin-chart-card fin-donut-card">
          <div className="fin-card-head">
            <div><span>هيكل التكلفة</span><h2>توزيع المصروفات</h2><p>نسبة كل حساب من إجمالي المصروفات</p></div>
            <PieChartIcon size={22} />
          </div>
          <div className="fin-donut-wrap">
            {expenseChartData.length ? (
              <>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={expenseChartData} dataKey="value" nameKey="name" innerRadius={68} outerRadius={94} paddingAngle={4}>
                      {expenseChartData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `${money(value)} ر.س`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="fin-donut-center"><strong>{money(summary.total_expenses)}</strong><span>إجمالي المصروفات</span></div>
              </>
            ) : <div className="fin-empty-chart">لا توجد مصروفات.</div>}
          </div>
          <div className="fin-mini-legend">
            {expenseChartData.slice(0, 5).map((item, index) => (
              <div key={item.name}><i style={{ background: COLORS[index % COLORS.length] }} /><span>{item.name}</span><strong>{money(item.value)}</strong></div>
            ))}
          </div>
        </article>
      </section>

      <section className="fin-chart-card fin-accounts-chart">
        <div className="fin-card-head">
          <div><span>تحليل الحسابات</span><h2>مقارنة حسابات الدخل</h2><p>حجم الإيرادات والمصروفات حسب الحساب</p></div>
        </div>
        <div className="fin-chart-body short">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={accountComparison} layout="vertical" margin={{ right: 24, left: 20 }}>
              <CartesianGrid strokeDasharray="4 6" horizontal={false} stroke="#e9eaf2" />
              <XAxis type="number" tickFormatter={compactMoney} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={130} axisLine={false} tickLine={false} />
              <Tooltip formatter={(value) => `${money(value)} ر.س`} />
              <Legend />
              <Bar dataKey="الإيرادات" fill="#6d5dfc" radius={[0, 8, 8, 0]} barSize={16} />
              <Bar dataKey="المصروفات" fill="#f59e0b" radius={[0, 8, 8, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="fin-tables-grid">
        <article className="fin-table-card">
          <div className="fin-card-head compact"><div><span>تفاصيل الإيرادات</span><h2>حسابات الإيراد</h2></div><strong className="green">{money(summary.total_revenue)} ر.س</strong></div>
          <div className="fin-table-wrap"><table><thead><tr><th>الكود</th><th>الحساب</th><th>صافي الإيراد</th></tr></thead><tbody>{revenues.length ? revenues.map((row) => <tr key={row.id}><td><b>{row.code}</b></td><td>{row.name}</td><td className="green"><b>{money(row.amount)}</b></td></tr>) : <tr><td colSpan="3" className="empty">لا توجد إيرادات.</td></tr>}</tbody></table></div>
        </article>
        <article className="fin-table-card">
          <div className="fin-card-head compact"><div><span>تفاصيل المصروفات</span><h2>حسابات المصروف</h2></div><strong className="orange">{money(summary.total_expenses)} ر.س</strong></div>
          <div className="fin-table-wrap"><table><thead><tr><th>الكود</th><th>الحساب</th><th>صافي المصروف</th></tr></thead><tbody>{expenses.length ? expenses.map((row) => <tr key={row.id}><td><b>{row.code}</b></td><td>{row.name}</td><td className="orange"><b>{money(row.amount)}</b></td></tr>) : <tr><td colSpan="3" className="empty">لا توجد مصروفات.</td></tr>}</tbody></table></div>
        </article>
      </section>

      <section className={`fin-result-banner ${isProfit ? "profit" : "loss"}`}>
        <div><span>{isProfit ? "نتيجة النشاط إيجابية" : "نتيجة النشاط سلبية"}</span><h2>{isProfit ? "صافي الربح" : "صافي الخسارة"}</h2><p>هامش النتيجة {Number(summary.profit_margin || 0).toFixed(1)}% من إجمالي الإيرادات.</p></div>
        <strong>{money(Math.abs(summary.net_profit || 0))} <em>ر.س</em></strong>
      </section>
    </div>
  );
}

export default IncomeStatement;
