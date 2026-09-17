import { useEffect, useMemo, useState } from "react";
import { Layers3, Plus, Search, X, Pencil, Trash2, RefreshCw, Network, ShieldCheck, BookOpenCheck, Activity } from "lucide-react";

const API = "http://127.0.0.1:8000/api";
const typeLabel = { asset:"أصول", liability:"التزامات", equity:"حقوق ملكية", revenue:"إيرادات", expense:"مصروفات" };
const normalByType = { asset:"debit", expense:"debit", liability:"credit", equity:"credit", revenue:"credit" };

export default function ChartOfAccounts() {
  const [accounts,setAccounts]=useState([]), [search,setSearch]=useState(""), [type,setType]=useState("");
  const [loading,setLoading]=useState(true), [error,setError]=useState(""), [modal,setModal]=useState(false);
  const empty={id:null,code:"",name:"",name_en:"",type:"asset",parent_id:"",normal_balance:"debit",is_postable:true,is_active:true,description:""};
  const [form,setForm]=useState(empty);

  const load=async()=>{try{setLoading(true);setError("");const r=await fetch(`${API}/finance/accounts`);const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||"تعذر تحميل الحسابات");setAccounts(j.data||[])}catch(e){setError(e.message)}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  const filtered=useMemo(()=>accounts.filter(a=>(!type||a.type===type)&&(!search||`${a.code} ${a.name} ${a.name_en||""}`.toLowerCase().includes(search.toLowerCase()))),[accounts,search,type]);
  const activeCount=accounts.filter(a=>a.is_active).length;
  const postableCount=accounts.filter(a=>a.is_postable).length;
  const rootCount=accounts.filter(a=>!a.parent_id).length;

  const openNew=()=>{setForm(empty);setModal(true)};
  const openEdit=(a)=>{setForm({...empty,...a,parent_id:a.parent_id||""});setModal(true)};
  const save=async(e)=>{e.preventDefault();const body={...form,parent_id:form.parent_id?Number(form.parent_id):null};delete body.id;const r=await fetch(`${API}/finance/accounts${form.id?`/${form.id}`:""}`,{method:form.id?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const j=await r.json();if(!r.ok){alert(j.message||Object.values(j.errors||{}).flat().join("\n")||"تعذر الحفظ");return}setModal(false);load()};
  const remove=async(a)=>{if(!confirm(`حذف الحساب ${a.code} - ${a.name}؟`))return;const r=await fetch(`${API}/finance/accounts/${a.id}`,{method:"DELETE"});const j=await r.json();if(!r.ok){alert(j.message||"تعذر الحذف");return}load()};

  return <div className="acc-page finx-page">
    <section className="finx-hero">
      <div className="finx-hero-copy">
        <span className="finx-eyebrow"><Layers3 size={16}/> MASA Finance</span>
        <h1>دليل الحسابات</h1>
        <p>إدارة الهيكل المحاسبي للحسابات الرئيسية والفرعية مع التحكم في طبيعة الرصيد والترحيل.</p>
      </div>
      <div className="finx-hero-actions">
        <button className="finx-btn finx-btn-soft" onClick={load}><RefreshCw size={16}/> تحديث</button>
        <button className="finx-btn finx-btn-primary" onClick={openNew}><Plus size={17}/> حساب جديد</button>
      </div>
    </section>

    <section className="finx-kpi-grid">
      <article className="finx-kpi-card"><div className="finx-kpi-icon purple"><Layers3 size={19}/></div><div className="finx-kpi-main"><span>إجمالي الحسابات</span><strong>{accounts.length}</strong></div></article>
      <article className="finx-kpi-card"><div className="finx-kpi-icon green"><ShieldCheck size={19}/></div><div className="finx-kpi-main"><span>الحسابات النشطة</span><strong>{activeCount}</strong></div></article>
      <article className="finx-kpi-card"><div className="finx-kpi-icon blue"><BookOpenCheck size={19}/></div><div className="finx-kpi-main"><span>حسابات قابلة للترحيل</span><strong>{postableCount}</strong></div></article>
      <article className="finx-kpi-card"><div className="finx-kpi-icon orange"><Network size={19}/></div><div className="finx-kpi-main"><span>الحسابات الرئيسية</span><strong>{rootCount}</strong></div></article>
    </section>

    <section className="finx-insight-strip">
      {Object.keys(typeLabel).slice(0,4).map(t=><div className="finx-insight" key={t}><Activity size={16}/><div><span>{typeLabel[t]}</span><strong>{accounts.filter(a=>a.type===t).length} حساب</strong></div></div>)}
    </section>

    <section className="finx-card">
      <header className="finx-card-head">
        <div className="finx-card-title"><span className="finx-card-icon"><Layers3 size={17}/></span><div><h3>شجرة الحسابات</h3><p>فلترة وبحث وإدارة الحسابات المحاسبية</p></div></div>
      </header>
      <div className="acc-toolbar">
        <label><Search size={16}/><input placeholder="بحث بالكود أو اسم الحساب..." value={search} onChange={e=>setSearch(e.target.value)}/></label>
        <select value={type} onChange={e=>setType(e.target.value)}><option value="">كل أنواع الحسابات</option>{Object.entries(typeLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>
        <button className="acc-icon-btn" onClick={load}><RefreshCw size={16}/></button>
      </div>
      {loading?<div className="acc-empty">جاري التحميل...</div>:error?<div className="acc-empty">{error}</div>:<div className="acc-table-wrap"><table className="acc-table"><thead><tr><th>الكود</th><th>الحساب</th><th>النوع</th><th>المستوى</th><th>طبيعة الرصيد</th><th>الترحيل</th><th>الحالة</th><th></th></tr></thead><tbody>{filtered.map(a=><tr key={a.id}><td><b>{a.code}</b></td><td><div className="acc-name"><strong>{a.name}</strong><small>{a.parent?.name||a.name_en||"حساب رئيسي"}</small></div></td><td><span className={`acc-chip ${a.type}`}>{typeLabel[a.type]}</span></td><td>{a.level}</td><td>{a.normal_balance==="debit"?"مدين":"دائن"}</td><td>{a.is_postable?"تفصيلي":"تجميعي"}</td><td><span className={`acc-status ${a.is_active?"ok":"off"}`}>{a.is_active?"نشط":"موقوف"}</span></td><td><div className="acc-actions"><button onClick={()=>openEdit(a)}><Pencil size={15}/></button><button onClick={()=>remove(a)}><Trash2 size={15}/></button></div></td></tr>)}</tbody></table></div>}
    </section>
    {modal&&<div className="acc-modal-backdrop"><form className="acc-modal" onSubmit={save}><div className="acc-modal-head"><div><h3>{form.id?"تعديل الحساب":"إضافة حساب"}</h3><p>أدخل بيانات الحساب المحاسبي.</p></div><button type="button" onClick={()=>setModal(false)}><X size={18}/></button></div><div className="acc-form-grid">
      <label>كود الحساب<input required value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label>
      <label>اسم الحساب<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
      <label>الاسم الإنجليزي<input value={form.name_en||""} onChange={e=>setForm({...form,name_en:e.target.value})}/></label>
      <label>نوع الحساب<select value={form.type} onChange={e=>setForm({...form,type:e.target.value,normal_balance:normalByType[e.target.value]})}>{Object.entries(typeLabel).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>الحساب الأب<select value={form.parent_id||""} onChange={e=>setForm({...form,parent_id:e.target.value})}><option value="">بدون - حساب رئيسي</option>{accounts.filter(a=>a.id!==form.id).map(a=><option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}</select></label>
      <label>طبيعة الرصيد<select value={form.normal_balance} onChange={e=>setForm({...form,normal_balance:e.target.value})}><option value="debit">مدين</option><option value="credit">دائن</option></select></label>
      <label className="acc-wide">الوصف<textarea value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      <label className="acc-check"><input type="checkbox" checked={!!form.is_postable} onChange={e=>setForm({...form,is_postable:e.target.checked})}/> يسمح بالترحيل المباشر</label>
      <label className="acc-check"><input type="checkbox" checked={!!form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> الحساب نشط</label>
    </div><div className="acc-modal-foot"><button type="button" className="acc-secondary" onClick={()=>setModal(false)}>إلغاء</button><button className="acc-primary">حفظ الحساب</button></div></form></div>}
  </div>
}
