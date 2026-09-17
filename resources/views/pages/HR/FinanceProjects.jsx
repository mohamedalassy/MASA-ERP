import { useEffect, useState } from "react";
import { CircleAlert, FolderKanban, RefreshCw, WalletCards } from "lucide-react";
import "../../../css/missing-pages.css";

const API = "/api/finance/projects-billing";
const rowsOf = (x) => Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : Array.isArray(x?.data?.data) ? x.data.data : [];
const money = (v) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function FinanceProjects({ onNavigate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error();
      setRows(rowsOf(await r.json()));
    } catch {
      setRows([]);
      setError("تعذر تحميل المركز المالي للمشاريع.");
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <main className="masa-page" dir="rtl">
      <header className="masa-page-head">
        <div><span className="masa-eyebrow">MASA Finance</span><h1>مالية المشاريع</h1><p>متابعة الفوترة والتحصيل والقيمة المالية لكل مشروع.</p></div>
        <button className="masa-btn masa-btn--soft" type="button" onClick={load}><RefreshCw size={17} className={loading ? "masa-spin":""}/> تحديث</button>
      </header>
      {error && <div className="masa-alert"><CircleAlert size={18}/>{error}</div>}
      <section className="masa-panel">
        <div className="masa-table-wrap"><table className="masa-table">
          <thead><tr><th>المشروع</th><th>العميل</th><th>قيمة المشروع</th><th>المفوتر</th><th>المتبقي</th><th></th></tr></thead>
          <tbody>
            {!loading && rows.length === 0 && <tr><td colSpan="6" className="masa-empty-row">لا توجد بيانات مشاريع مالية.</td></tr>}
            {rows.map((x) => {
              const p = x.project || x;
              const total = x.project_total ?? x.total ?? p.total ?? 0;
              const invoiced = x.invoiced_total ?? x.invoiced ?? 0;
              return <tr key={p.id || x.id}>
                <td><strong>{p.name || p.project_name || p.code || `مشروع #${p.id || x.id}`}</strong></td>
                <td>{p.customer_name || p.customer?.name || "—"}</td>
                <td>{money(total)}</td><td>{money(invoiced)}</td><td>{money(Number(total)-Number(invoiced))}</td>
                <td><button className="masa-link-btn" type="button" onClick={() => onNavigate?.("finance-project-center", { projectId: p.id || x.project_id })}><WalletCards size={15}/> فتح المركز</button></td>
              </tr>
            })}
          </tbody>
        </table></div>
      </section>
    </main>
  );
}
