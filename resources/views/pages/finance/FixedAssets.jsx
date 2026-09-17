import { useEffect, useMemo, useState } from "react";
import { Boxes, CalendarClock, CircleAlert, Plus, RefreshCw } from "lucide-react";
import "../../../css/missing-pages.css";

const API = "/api/finance/fixed-assets";
const rowsOf = (x) => Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : Array.isArray(x?.data?.data) ? x.data.data : [];
const money = (v) => Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

export default function FixedAssets() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setRows(rowsOf(await r.json()));
    } catch {
      setRows([]);
      setError("تعذر تحميل الأصول الثابتة. تأكد من تسجيل مسارات fixed-assets في api.php.");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const totalCost = useMemo(() => rows.reduce((s, x) => s + Number(x.cost || 0), 0), [rows]);
  const bookValue = useMemo(() => rows.reduce((s, x) => s + Number(x.book_value ?? x.net_book_value ?? x.cost ?? 0), 0), [rows]);

  return (
    <main className="masa-page" dir="rtl">
      <header className="masa-page-head">
        <div><span className="masa-eyebrow">MASA Finance</span><h1>الأصول الثابتة</h1><p>إدارة تكلفة الأصل والإهلاك والقيمة الدفترية.</p></div>
        <div className="masa-head-actions">
          <button className="masa-btn masa-btn--soft" type="button" onClick={load}><RefreshCw size={17} className={loading ? "masa-spin" : ""}/> تحديث</button>
          <button className="masa-btn" type="button" disabled><Plus size={17}/> أصل جديد</button>
        </div>
      </header>

      {error && <div className="masa-alert"><CircleAlert size={18}/><span>{error}</span></div>}

      <section className="masa-kpi-grid">
        <article className="masa-kpi-card static"><span className="masa-icon masa-icon--violet"><Boxes size={22}/></span><small>عدد الأصول</small><strong>{loading ? "…" : rows.length}</strong></article>
        <article className="masa-kpi-card static"><span className="masa-icon masa-icon--blue"><CalendarClock size={22}/></span><small>إجمالي التكلفة</small><strong>{loading ? "…" : money(totalCost)}</strong></article>
        <article className="masa-kpi-card static"><span className="masa-icon masa-icon--green"><Boxes size={22}/></span><small>القيمة الدفترية</small><strong>{loading ? "…" : money(bookValue)}</strong></article>
      </section>

      <section className="masa-panel">
        <div className="masa-table-wrap">
          <table className="masa-table">
            <thead><tr><th>الكود</th><th>الأصل</th><th>تاريخ الشراء</th><th>التكلفة</th><th>القيمة الدفترية</th><th>الحالة</th></tr></thead>
            <tbody>
              {!loading && rows.length === 0 && <tr><td colSpan="6" className="masa-empty-row">لا توجد أصول لعرضها.</td></tr>}
              {rows.map((x) => <tr key={x.id}>
                <td>{x.asset_code || x.code || `#${x.id}`}</td>
                <td><strong>{x.name || "—"}</strong></td>
                <td>{x.purchase_date || "—"}</td>
                <td>{money(x.cost)}</td>
                <td>{money(x.book_value ?? x.net_book_value ?? x.cost)}</td>
                <td><span className="masa-status">{x.status || (x.is_active === false ? "غير نشط" : "نشط")}</span></td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
