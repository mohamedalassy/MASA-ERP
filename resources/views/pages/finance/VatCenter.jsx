import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  FileCheck2,
  Landmark,
  Loader2,
  Printer,
  ReceiptText,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import "../../styles/vat-center.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const money = (value) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(Number(value || 0));
const number = (value) => new Intl.NumberFormat("ar-SA").format(Number(value || 0));
const dateValue = (value) => value ? String(value).slice(0, 10) : "—";
const zatcaLabels = { not_submitted: "لم ترسل", pending: "قيد الإرسال", cleared: "تمت الموافقة", reported: "تم الإبلاغ", warning: "تحذير", rejected: "مرفوضة" };
const empty = { period: {}, summary: {}, monthly: [], zatca: [], sales_invoices: [], purchase_invoices: [], attention_queue: [] };

export default function VatCenter({ onChangeView }) {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(`${now.getFullYear()}-12-31`);
  const [zatcaStatus, setZatcaStatus] = useState("");
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("sales");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ from, to });
      if (zatcaStatus) params.set("zatca_status", zatcaStatus);
      const response = await fetch(`${API_BASE}/finance/vat-center?${params}`, { headers: { Accept: "application/json" } });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.message || "تعذر تحميل مركز الضريبة");
      setData({ ...empty, ...json });
    } catch (err) { setError(err.message || "حدث خطأ أثناء تحميل مركز الضريبة"); }
    finally { setLoading(false); }
  }, [from, to, zatcaStatus]);

  useEffect(() => { load(); }, [zatcaStatus]);
  const summary = data.summary || {};
  const maxChart = useMemo(() => Math.max(...(data.monthly || []).flatMap((x) => [Number(x.output_tax || 0), Number(x.input_tax || 0)]), 1), [data.monthly]);
  const rows = tab === "sales" ? data.sales_invoices || [] : data.purchase_invoices || [];

  return <main className="vat-page" dir="rtl">
    <header className="vat-hero">
      <div><span>الامتثال والضرائب</span><h1>مركز ضريبة القيمة المضافة وZATCA</h1><p>متابعة ضريبة المخرجات والمدخلات وصافي الالتزام وحالة الفواتير الإلكترونية.</p></div>
      <div className="vat-actions"><button className="ghost" onClick={() => window.print()}><Printer size={17}/> طباعة التقرير</button><button onClick={load} disabled={loading}><RefreshCw size={17} className={loading ? "vat-spin" : ""}/> تحديث</button></div>
    </header>

    <section className="vat-filter"><label><span>من تاريخ</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)}/></label><label><span>إلى تاريخ</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)}/></label><label><span>حالة ZATCA</span><select value={zatcaStatus} onChange={(e) => setZatcaStatus(e.target.value)}><option value="">كل الحالات</option>{Object.entries(zatcaLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label><button onClick={load}><CalendarDays size={17}/> تطبيق الفترة</button></section>

    {error && <div className="vat-error"><AlertTriangle size={18}/>{error}</div>}
    {loading && !data.monthly?.length ? <div className="vat-loading"><Loader2 className="vat-spin"/> جاري إعداد التقرير الضريبي...</div> : <>
      <section className="vat-kpis">
        <Kpi tone="purple" icon={ReceiptText} label="ضريبة المخرجات" value={money(summary.output_tax)} note={`${number(summary.sales_invoices_count)} فاتورة عميل`}/>
        <Kpi tone="green" icon={Building2} label="ضريبة المدخلات" value={money(summary.input_tax)} note={`${number(summary.purchase_invoices_count)} فاتورة مورد`}/>
        <Kpi tone={summary.position === "payable" ? "orange" : "blue"} icon={Landmark} label={summary.position === "payable" ? "صافي الضريبة المستحقة" : "رصيد ضريبي دائن"} value={money(Math.abs(Number(summary.net_vat || 0)))} note={summary.position === "payable" ? "مستحق للهيئة" : "رصيد لصالح المنشأة"}/>
        <Kpi tone="red" icon={ShieldAlert} label="تحتاج متابعة ZATCA" value={number(summary.zatca_attention_count)} note="غير مرسلة أو مرفوضة أو تحذير"/>
      </section>

      <section className="vat-grid">
        <article className="vat-card vat-chart-card"><CardHead kicker="التحليل الشهري" title="المخرجات مقابل المدخلات" icon={TrendingUp}/><div className="vat-chart"><div className="vat-legend"><span><i className="output"/>ضريبة المخرجات</span><span><i className="input"/>ضريبة المدخلات</span></div><div className="vat-chart-bars">{(data.monthly || []).map((item) => <div className="vat-month" key={item.month}><div className="vat-pair"><i className="output" style={{height:`${Math.max(3,Number(item.output_tax||0)/maxChart*100)}%`}}/><i className="input" style={{height:`${Math.max(3,Number(item.input_tax||0)/maxChart*100)}%`}}/></div><b>{item.label}</b><small>{money(item.net_vat)}</small></div>)}</div></div></article>
        <article className="vat-card"><CardHead kicker="الفوترة الإلكترونية" title="حالات ZATCA" icon={FileCheck2}/><div className="vat-zatca">{(data.zatca || []).map((item) => <div key={item.status}><span className={`vat-status ${item.status}`}>{item.label}</span><strong>{number(item.count)}</strong><small>{money(item.total)}</small></div>)}</div></article>
      </section>

      <section className="vat-card vat-table-card">
        <div className="vat-table-head"><div><span>سجل الضريبة</span><h2>{tab === "sales" ? "فواتير المبيعات وضريبة المخرجات" : "فواتير المشتريات وضريبة المدخلات"}</h2></div><div className="vat-tabs"><button className={tab === "sales" ? "active" : ""} onClick={() => setTab("sales")}>المبيعات</button><button className={tab === "purchases" ? "active" : ""} onClick={() => setTab("purchases")}>المشتريات</button></div></div>
        <div className="vat-table-wrap"><table><thead><tr><th>رقم الفاتورة</th><th>{tab === "sales" ? "العميل" : "المورد"}</th><th>التاريخ</th><th>الخاضع للضريبة</th><th>الضريبة</th><th>الإجمالي</th>{tab === "sales" && <th>ZATCA</th>}<th></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{tab === "sales" ? row.invoice_number : row.supplier_invoice_number || row.invoice_number}</b></td><td>{tab === "sales" ? row.buyer_name : row.supplier_name}<small>{row.project?.name || row.project?.project_code || "—"}</small></td><td>{dateValue(tab === "sales" ? row.issue_date : row.invoice_date)}</td><td>{money(row.taxable_amount)}</td><td className="vat-tax"><b>{money(row.tax_total)}</b></td><td>{money(row.total)}</td>{tab === "sales" && <td><span className={`vat-status ${row.zatca_status}`}>{zatcaLabels[row.zatca_status] || row.zatca_status}</span></td>}<td>{tab === "sales" && <button className="vat-open" onClick={() => onChangeView?.("finance-tax-details", {taxInvoiceId:row.id})}>فتح</button>}</td></tr>)}</tbody></table>{!rows.length && <div className="vat-empty">لا توجد فواتير خلال الفترة المحددة.</div>}</div>
      </section>
    </>}
  </main>;
}

function Kpi({ tone, icon: Icon, label, value, note }) { return <article className={`vat-kpi ${tone}`}><div className="vat-kpi-icon"><Icon size={21}/></div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>; }
function CardHead({ kicker, title, icon: Icon }) { return <div className="vat-card-head"><div><span>{kicker}</span><h2>{title}</h2></div><Icon size={22}/></div>; }
