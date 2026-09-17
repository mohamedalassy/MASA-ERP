import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  FileDown,
  Landmark,
  Printer,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import "../../styles/financial-reports.css";

const API_BASE = "http://127.0.0.1:8000/api";
const ASSET_COLORS = ["#6d5dfc", "#13b8a6", "#3b82f6", "#f59e0b", "#ef5da8"];

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

function BalanceSheet() {
  const [summary, setSummary] = useState({});
  const [assets, setAssets] = useState([]);
  const [liabilities, setLiabilities] = useState([]);
  const [equity, setEquity] = useState([]);
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (to) params.set("to", to);

      const response = await fetch(
        `${API_BASE}/finance/balance-sheet?${params.toString()}`
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "تعذر تحميل الميزانية العمومية.");
      }

      setSummary(result.summary || {});
      setAssets(result.assets || []);
      setLiabilities(result.liabilities || []);
      setEquity(result.equity || []);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل الميزانية العمومية.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const assetChartData = useMemo(
    () => assets.map((row) => ({ name: row.name, value: Number(row.balance || 0) })),
    [assets]
  );

  const equationData = useMemo(
    () => [
      { name: "الأصول", value: Number(summary.total_assets || 0), fill: "#6d5dfc" },
      { name: "الالتزامات", value: Number(summary.total_liabilities || 0), fill: "#f59e0b" },
      { name: "حقوق الملكية", value: Number(summary.total_equity || 0), fill: "#13b8a6" },
    ],
    [summary]
  );

  const debtRatio = Number(summary.total_assets || 0) > 0
    ? (Number(summary.total_liabilities || 0) / Number(summary.total_assets || 0)) * 100
    : 0;

  const equityRatio = Number(summary.total_assets || 0) > 0
    ? (Number(summary.total_equity || 0) / Number(summary.total_assets || 0)) * 100
    : 0;

  const coverageRatio = Number(summary.total_liabilities || 0) > 0
    ? Number(summary.total_assets || 0) / Number(summary.total_liabilities || 0)
    : 0;

  const exportCsv = () => {
    const rows = [
      ["القسم", "الكود", "الحساب", "الرصيد"],
      ...assets.map((row) => ["الأصول", row.code, row.name, row.balance]),
      ...liabilities.map((row) => ["الالتزامات", row.code, row.name, row.balance]),
      ...equity.map((row) => ["حقوق الملكية", row.code, row.name, row.balance]),
      ["حقوق الملكية", "", "صافي ربح الفترة", summary.net_income || 0],
    ];
    const csv = `\uFEFF${rows.map((row) => row.join(",")).join("\n")}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "balance-sheet.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fin-report-page" dir="rtl">
      <section className="fin-report-hero">
        <div>
          <span className="fin-report-kicker"><Sparkles size={15} /> القوائم المالية</span>
          <h1>الميزانية العمومية</h1>
          <p>مركز مالي تفاعلي يوضح الأصول والالتزامات وحقوق الملكية.</p>
        </div>
        <div className="fin-report-actions">
          <button type="button" className="ghost" onClick={() => window.print()}><Printer size={17} /> طباعة</button>
          <button type="button" className="ghost" onClick={() => window.print()}><FileDown size={17} /> حفظ PDF</button>
          <button type="button" className="ghost" onClick={exportCsv}><Download size={17} /> تصدير</button>
          <button type="button" className="primary" onClick={loadData}><RefreshCw size={17} className={loading ? "spin" : ""} /> تحديث</button>
        </div>
      </section>

      <section className="fin-filter-bar">
        <div className="fin-date-field">
          <span><CalendarDays size={16} /> الميزانية حتى تاريخ</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <button type="button" onClick={loadData}>تطبيق التاريخ</button>
        <small>{to ? `المركز المالي حتى ${to}` : "المركز المالي حتى اليوم"}</small>
      </section>

      {error && <div className="fin-report-error">{error}</div>}

      <section className="fin-kpi-grid">
        <article className="fin-kpi-card revenue">
          <span className="fin-kpi-icon"><WalletCards size={22} /></span>
          <div><small>إجمالي الأصول</small><strong>{money(summary.total_assets)} <em>ر.س</em></strong></div>
          <span className="fin-kpi-chip positive">{assets.length} حساب</span>
        </article>
        <article className="fin-kpi-card expense">
          <span className="fin-kpi-icon"><Landmark size={22} /></span>
          <div><small>إجمالي الالتزامات</small><strong>{money(summary.total_liabilities)} <em>ر.س</em></strong></div>
          <span className="fin-kpi-chip">{debtRatio.toFixed(1)}%</span>
        </article>
        <article className="fin-kpi-card profit">
          <span className="fin-kpi-icon"><ShieldCheck size={22} /></span>
          <div><small>حقوق الملكية</small><strong>{money(summary.total_equity)} <em>ر.س</em></strong></div>
          <span className="fin-kpi-chip positive">{equityRatio.toFixed(1)}%</span>
        </article>
        <article className="fin-kpi-card margin">
          <span className="fin-kpi-icon"><Scale size={22} /></span>
          <div><small>حالة الميزانية</small><strong>{summary.balanced ? "متوازنة" : "غير متوازنة"}</strong></div>
          <span className={`fin-kpi-chip ${summary.balanced ? "positive" : "negative"}`}>{summary.balanced ? "سليمة" : `فرق ${money(summary.difference)}`}</span>
        </article>
      </section>

      <section className="fin-dashboard-grid">
        <article className="fin-chart-card fin-trend-card">
          <div className="fin-card-head">
            <div><span>المعادلة المحاسبية</span><h2>الأصول مقابل مصادر التمويل</h2><p>مقارنة الأصول بالالتزامات وحقوق الملكية</p></div>
            <Scale size={22} />
          </div>
          <div className="fin-chart-body">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={equationData} margin={{ top: 15, right: 10, left: 10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#e9eaf2" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compactMoney} axisLine={false} tickLine={false} orientation="right" />
                <Tooltip formatter={(value) => `${money(value)} ر.س`} />
                <Bar dataKey="value" name="الرصيد" radius={[10, 10, 0, 0]} barSize={58}>
                  {equationData.map((item) => <Cell key={item.name} fill={item.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="fin-chart-card fin-donut-card">
          <div className="fin-card-head">
            <div><span>تكوين المركز المالي</span><h2>توزيع الأصول</h2><p>حصة كل حساب من إجمالي الأصول</p></div>
            <WalletCards size={22} />
          </div>
          <div className="fin-donut-wrap">
            {assetChartData.length ? (
              <>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={assetChartData} dataKey="value" nameKey="name" innerRadius={68} outerRadius={94} paddingAngle={4}>
                      {assetChartData.map((item, index) => <Cell key={item.name} fill={ASSET_COLORS[index % ASSET_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `${money(value)} ر.س`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="fin-donut-center"><strong>{money(summary.total_assets)}</strong><span>إجمالي الأصول</span></div>
              </>
            ) : <div className="fin-empty-chart">لا توجد أرصدة أصول.</div>}
          </div>
          <div className="fin-mini-legend">
            {assetChartData.slice(0, 5).map((item, index) => (
              <div key={item.name}><i style={{ background: ASSET_COLORS[index % ASSET_COLORS.length] }} /><span>{item.name}</span><strong>{money(item.value)}</strong></div>
            ))}
          </div>
        </article>
      </section>

      <section className="fin-kpi-grid">
        <article className="fin-kpi-card margin"><span className="fin-kpi-icon"><ShieldCheck size={22} /></span><div><small>نسبة المديونية</small><strong>{debtRatio.toFixed(1)}<em>%</em></strong></div><div className="fin-margin-track"><span style={{ width: `${Math.min(100, debtRatio)}%` }} /></div></article>
        <article className="fin-kpi-card profit"><span className="fin-kpi-icon"><WalletCards size={22} /></span><div><small>نسبة تمويل الملكية</small><strong>{equityRatio.toFixed(1)}<em>%</em></strong></div><span className="fin-kpi-chip positive">قوة التمويل</span></article>
        <article className="fin-kpi-card revenue"><span className="fin-kpi-icon"><Landmark size={22} /></span><div><small>تغطية الالتزامات</small><strong>{coverageRatio.toFixed(2)}<em> مرة</em></strong></div><span className="fin-kpi-chip positive">الأصول ÷ الالتزامات</span></article>
        <article className="fin-kpi-card expense"><span className="fin-kpi-icon"><CheckCircle2 size={22} /></span><div><small>صافي ربح الفترة</small><strong>{money(summary.net_income)} <em>ر.س</em></strong></div><span className="fin-kpi-chip">ضمن حقوق الملكية</span></article>
      </section>

      <section className="fin-tables-grid">
        <article className="fin-table-card">
          <div className="fin-card-head compact"><div><span>تفاصيل الأصول</span><h2>حسابات الأصول</h2></div><strong className="green">{money(summary.total_assets)} ر.س</strong></div>
          <div className="fin-table-wrap"><table><thead><tr><th>الكود</th><th>الحساب</th><th>الرصيد</th></tr></thead><tbody>{assets.length ? assets.map((row) => <tr key={row.id}><td><b>{row.code}</b></td><td>{row.name}</td><td className="green"><b>{money(row.balance)}</b></td></tr>) : <tr><td colSpan="3" className="empty">لا توجد أصول.</td></tr>}</tbody></table></div>
        </article>
        <article className="fin-table-card">
          <div className="fin-card-head compact"><div><span>مصادر التمويل</span><h2>الالتزامات وحقوق الملكية</h2></div><strong className="orange">{money(summary.liabilities_and_equity)} ر.س</strong></div>
          <div className="fin-table-wrap"><table><thead><tr><th>القسم</th><th>الحساب</th><th>الرصيد</th></tr></thead><tbody>{liabilities.map((row) => <tr key={`l-${row.id}`}><td><b>{row.code}</b></td><td>{row.name}</td><td className="orange"><b>{money(row.balance)}</b></td></tr>)}{equity.map((row) => <tr key={`e-${row.id}`}><td><b>{row.code}</b></td><td>{row.name}</td><td className="green"><b>{money(row.balance)}</b></td></tr>)}<tr><td><b>—</b></td><td>صافي ربح الفترة</td><td className="green"><b>{money(summary.net_income)}</b></td></tr></tbody></table></div>
        </article>
      </section>

      <section className={`fin-result-banner ${summary.balanced ? "profit" : "loss"}`}>
        <div><span>اختبار المعادلة المحاسبية</span><h2>{summary.balanced ? "الميزانية متوازنة" : "الميزانية غير متوازنة"}</h2><p>الأصول = الالتزامات + حقوق الملكية</p></div>
        <strong>{money(summary.total_assets)} <em>ر.س</em></strong>
      </section>
    </div>
  );
}

export default BalanceSheet;
