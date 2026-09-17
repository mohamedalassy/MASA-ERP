import { useEffect, useState } from "react";
import { CircleAlert, Plus, RefreshCw, Search, UsersRound } from "lucide-react";
import "../../../css/missing-pages.css";

const API = "/api/finance/customer-tax-profiles";
const list = (x) => Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : Array.isArray(x?.data?.data) ? x.data.data : [];

export default function CustomerTaxProfile() {
  const [rows,setRows]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(""); const [search,setSearch]=useState("");
  async function load(){setLoading(true);setError("");try{const r=await fetch(API);if(!r.ok)throw new Error();setRows(list(await r.json()));}catch{setError("تعذر تحميل الملفات الضريبية للعملاء.");setRows([]);}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  const filtered=rows.filter(x=>`${x.customer_name||x.name||""} ${x.vat_number||""}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="masa-page" dir="rtl">
    <header className="masa-page-head"><div><span className="masa-eyebrow">MASA Finance</span><h1>ملفات العملاء الضريبية</h1><p>بيانات ضريبة القيمة المضافة وعناوين الفوترة للعملاء.</p></div><button className="masa-btn masa-btn--soft" onClick={load} type="button"><RefreshCw size={17} className={loading?"masa-spin":""}/> تحديث</button></header>
    {error&&<div className="masa-alert"><CircleAlert size={18}/>{error}</div>}
    <section className="masa-panel">
      <div className="masa-panel-title"><div><h2>دليل العملاء الضريبي</h2><p>{rows.length} ملف مسجل</p></div><button className="masa-btn" type="button" disabled><Plus size={16}/> عميل ضريبي</button></div>
      <label className="masa-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم الضريبي..."/></label>
      <div className="masa-profile-grid">
        {!loading&&filtered.length===0&&<div className="masa-empty-card"><UsersRound size={34}/><strong>لا توجد نتائج</strong></div>}
        {filtered.map(x=><article className="masa-profile-card" key={x.id}>
          <span className="masa-icon masa-icon--blue"><UsersRound size={20}/></span>
          <div><small>{x.customer_code||x.code||`#${x.id}`}</small><h3>{x.customer_name||x.name||"عميل"}</h3><p>VAT: {x.vat_number||"غير مسجل"}</p></div>
          <footer><span>{x.city||"—"}</span><b>{x.is_active===false?"غير نشط":"نشط"}</b></footer>
        </article>)}
      </div>
    </section>
  </main>
}
