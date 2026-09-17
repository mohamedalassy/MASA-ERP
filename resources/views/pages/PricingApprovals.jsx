import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, CheckCircle2, Clock3, Eye, RefreshCw, RotateCcw,
  Search, ShieldCheck, XCircle, AlertTriangle, FileText, TrendingUp,
} from "lucide-react";

const API = "http://127.0.0.1:8000/api";
const money = (v) => `${Number(v || 0).toLocaleString("ar-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س`;

export default function PricingApprovals({ onNavigate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("pending_approval");
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/quotations`, { headers: { Accept: "application/json" } });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "تعذر تحميل عروض الأسعار");
      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (e) { setMessage(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const enriched = useMemo(() => rows.map((q) => {
    const items = Array.isArray(q.items) ? q.items : [];
    const materialCost = items.reduce((s, i) => s + Number(i.cost_price || 0) * Number(i.quantity || 0), 0);
    const extra = Object.values(q.extra_costs || {}).reduce((s, v) => s + Number(v || 0), 0);
    const cost = materialCost + extra;
    const sale = Math.max(Number(q.subtotal || 0) - Number(q.discount || 0), 0);
    const profit = sale - cost;
    const margin = sale > 0 ? (profit / sale) * 100 : 0;
    return { ...q, _materialCost: materialCost, _extra: extra, _cost: cost, _sale: sale, _profit: profit, _margin: margin };
  }), [rows]);

  const visible = useMemo(() => enriched.filter((q) => {
    if (filter !== "all" && q.status !== filter) return false;
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return [q.quotation_number, q.project?.name, q.project?.project_code, q.project?.customer_name]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(s));
  }), [enriched, filter, search]);

  const pending = enriched.filter((q) => q.status === "pending_approval").length;
  const approved = enriched.filter((q) => q.status === "approved").length;
  const rejected = enriched.filter((q) => q.status === "rejected").length;

  const act = async () => {
    if (!selected || !decision) return;
    if ((decision === "reject" || decision === "request-changes") && !reason.trim()) {
      setMessage("اكتب سبب القرار أولًا."); return;
    }
    const projectId = selected.project_id || selected.project?.id;
    const endpoint = decision === "approve" ? "approve" : decision === "reject" ? "reject" : "request-changes";
    try {
      setBusyId(selected.id); setMessage("");
      const res = await fetch(`${API}/projects/${projectId}/quotations/${selected.id}/${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ reason: reason.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || json?.success === false) throw new Error(json?.message || "تعذر تنفيذ القرار");

      if (decision === "approve") {
        const move = await fetch(`${API}/projects/${projectId}/next-stage`, {
          method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ notes: `تم اعتماد عرض السعر ${selected.quotation_number} من مركز موافقات التسعير.` }),
        });
        const moveJson = await move.json();
        setMessage(move.ok ? `${json.message} وتم تحويل المشروع للمرحلة التالية.` : `${json.message} لكن تعذر تحويل المشروع: ${moveJson?.message || "خطأ"}`);
      } else setMessage(json.message || "تم تنفيذ القرار.");

      setDecision(null); setReason(""); setSelected(null); await load();
    } catch (e) { setMessage(e.message); }
    finally { setBusyId(null); }
  };

  const statusText = { draft: "مسودة", pending_approval: "بانتظار الموافقة", approved: "معتمد", rejected: "مرفوض" };
  const actionText = {
    submitted: "تم الإرسال للموافقة",
    changes_requested: "تم طلب تعديل",
    approved: "تم الاعتماد",
    rejected: "تم الرفض",
  };

  return <section dir="rtl" style={{ display:"grid", gap:18 }}>
    <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"center", flexWrap:"wrap" }}>
      <div>
        <div style={{ color:"#6b5bf5", fontWeight:900, fontSize:12 }}>مركز التسعير</div>
        <h1 style={{ margin:"5px 0", fontSize:27 }}>موافقات التسعير</h1>
        <p style={{ margin:0, color:"#8b91a1" }}>مراجعة التكلفة والهامش واتخاذ قرار الاعتماد من شاشة واحدة.</p>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={load} style={btn()}><RefreshCw size={15}/> تحديث</button>
        <button onClick={() => onNavigate?.("pricing")} style={btn()}><ArrowRight size={15}/> مركز التسعير</button>
      </div>
    </div>

    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(150px,1fr))", gap:12 }}>
      <Kpi icon={<Clock3/>} title="بانتظار الموافقة" value={pending}/>
      <Kpi icon={<CheckCircle2/>} title="معتمد" value={approved}/>
      <Kpi icon={<XCircle/>} title="مرفوض" value={rejected}/>
      <Kpi icon={<ShieldCheck/>} title="إجمالي العروض" value={enriched.length}/>
    </div>

    {message && <div style={{ background:"#f4f2ff", border:"1px solid #ded9ff", color:"#5648d8", borderRadius:12, padding:"11px 14px", fontWeight:800 }}>{message}</div>}

    <div style={card()}>
      <div style={{ display:"flex", gap:10, justifyContent:"space-between", flexWrap:"wrap", marginBottom:14 }}>
        <div style={{ position:"relative", minWidth:280, flex:1 }}><Search size={16} style={{ position:"absolute", right:12, top:12, color:"#9298a8" }}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث برقم العرض أو المشروع أو العميل..." style={input({paddingRight:38})}/></div>
        <select value={filter} onChange={e=>setFilter(e.target.value)} style={input({width:190})}>
          <option value="pending_approval">بانتظار الموافقة</option><option value="approved">المعتمد</option><option value="rejected">المرفوض</option><option value="draft">المسودات</option><option value="all">الكل</option>
        </select>
      </div>

      {loading ? <div style={{ padding:30, textAlign:"center", color:"#8d93a3" }}>جاري تحميل الموافقات...</div> :
      !visible.length ? <div style={{ padding:34, textAlign:"center", color:"#9aa0ae" }}>لا توجد عروض في هذا التصنيف.</div> :
      <div style={{ overflowX:"auto" }}><table style={{ width:"100%", borderCollapse:"collapse", minWidth:1050 }}><thead><tr>
        {['العرض','المشروع / العميل','التكلفة','البيع قبل الضريبة','الربح','الهامش','Target','الحالة','الإجراء'].map(h=><th key={h} style={th()}>{h}</th>)}
      </tr></thead><tbody>{visible.map(q=><tr key={q.id}>
        <td style={td()}><b>{q.quotation_number || `#${q.id}`}</b><div style={muted()}>V{q.version || 1}</div></td>
        <td style={td()}><b>{q.project?.name || '-'}</b><div style={muted()}>{q.project?.customer_name || q.project?.project_code || '-'}</div></td>
        <td style={td()}>{money(q._cost)}<div style={muted()}>مواد {money(q._materialCost)}</div></td>
        <td style={td()}>{money(q._sale)}</td><td style={td()}>{money(q._profit)}</td>
        <td style={td()}><b style={{ color:q._margin < Number(q.target_margin||0) ? '#dc5b68':'#20a36a' }}>{q._margin.toFixed(1)}%</b></td>
        <td style={td()}>{Number(q.target_margin||0).toFixed(1)}%</td>
        <td style={td()}><span style={pill(q.status)}>{statusText[q.status] || q.status}</span></td>
        <td style={td()}><div style={{ display:'flex', gap:6 }}>
          <button style={mini()} onClick={()=>setSelected(q)}><Eye size={14}/> مراجعة</button>
          {q.status==='pending_approval' && <button style={mini(true)} disabled={busyId===q.id} onClick={()=>{setSelected(q);setDecision('approve');setReason('')}}><CheckCircle2 size={14}/> اعتماد</button>}
        </div></td>
      </tr>)}</tbody></table></div>}
    </div>

    {selected && <div style={overlay()} onMouseDown={()=>{setSelected(null);setDecision(null)}}><div style={drawer()} onMouseDown={e=>e.stopPropagation()}>
      <div style={{ display:'flex', justifyContent:'space-between', gap:10 }}><div><div style={{color:'#6b5bf5',fontWeight:900}}>مراجعة عرض السعر</div><h2 style={{margin:'5px 0'}}>{selected.quotation_number || `عرض سعر V${selected.version || 1}`}</h2></div><button style={mini()} onClick={()=>{setSelected(null);setDecision(null)}}>إغلاق</button></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,margin:'18px 0'}}><Metric t="إجمالي التكلفة" v={money(selected._cost)}/><Metric t="البيع قبل الضريبة" v={money(selected._sale)}/><Metric t="الربح" v={money(selected._profit)}/><Metric t="الهامش" v={`${selected._margin.toFixed(2)}%`}/></div>
      {selected._margin < Number(selected.target_margin||0) && <div style={{background:'#fff7e8',border:'1px solid #ffe1a8',padding:12,borderRadius:12,color:'#9b6910',display:'flex',gap:8}}><AlertTriangle size={18}/> الهامش الحالي أقل من Target Margin ({Number(selected.target_margin||0).toFixed(1)}%).</div>}
      <h3>البنود</h3><div style={{maxHeight:220,overflow:'auto',border:'1px solid #eceef4',borderRadius:12}}>{(selected.items||[]).map((i,idx)=><div key={i.id||idx} style={{padding:10,borderBottom:'1px solid #f0f1f5',display:'flex',justifyContent:'space-between'}}><span>{i.product_name || i.product?.name || '-'}</span><b>{i.quantity} × {money(i.unit_price)}</b></div>)}</div>
      <h3>سجل القرارات</h3><div style={{display:'grid',gap:7}}>{(selected.approval_histories||[]).length ? selected.approval_histories.map(h=><div key={h.id} style={{padding:10,background:'#fafafe',borderRadius:10}}><b>{actionText[h.action] || h.action}</b> · {h.actor?.name || 'المستخدم'}<div style={muted()}>{h.reason || 'بدون ملاحظات'}</div></div>) : <div style={muted()}>لا يوجد سجل سابق لهذا العرض.</div>}</div>
      {selected.status==='pending_approval' && <><div style={{display:'flex',gap:8,marginTop:18,flexWrap:'wrap'}}><button style={action('#6557f5')} onClick={()=>setDecision('approve')}><CheckCircle2 size={15}/> اعتماد</button><button style={action('#f2a63b')} onClick={()=>setDecision('request-changes')}><RotateCcw size={15}/> طلب تعديل</button><button style={action('#df5a68')} onClick={()=>setDecision('reject')}><XCircle size={15}/> رفض</button><button style={btn()} onClick={()=>onNavigate?.('pricing-builder',{projectId:selected.project_id||selected.project?.id,quotationId:selected.id})}><FileText size={15}/> فتح BOQ</button></div>
      {decision && <div style={{marginTop:14,padding:14,border:'1px solid #e9eaf1',borderRadius:14}}><b>{decision==='approve'?'تأكيد الاعتماد':decision==='reject'?'سبب الرفض':'التعديلات المطلوبة'}</b><textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder={decision==='approve'?'ملاحظة اختيارية...':'اكتب السبب بالتفصيل...'} style={{...input(),height:90,marginTop:9,resize:'vertical'}}/><button disabled={busyId===selected.id} onClick={act} style={{...action(decision==='reject'?'#df5a68':decision==='request-changes'?'#f2a63b':'#6557f5'),marginTop:8}}>{busyId===selected.id?'جاري التنفيذ...':'تأكيد القرار'}</button></div>}</>}
    </div></div>}
  </section>;
}

function Kpi({icon,title,value}){return <div style={card()}><div style={{color:'#6b5bf5'}}>{icon}</div><div style={{fontSize:25,fontWeight:900,marginTop:8}}>{value}</div><div style={muted()}>{title}</div></div>}
function Metric({t,v}){return <div style={{background:'#fafafe',padding:12,borderRadius:12}}><div style={muted()}>{t}</div><b style={{fontSize:18}}>{v}</b></div>}
const card=()=>({background:'#fff',border:'1px solid #e9ebf2',borderRadius:18,padding:18,boxShadow:'0 7px 22px rgba(28,34,61,.035)'});
const btn=()=>({border:'1px solid #e5e7ef',background:'#fff',borderRadius:10,padding:'9px 12px',fontFamily:'inherit',fontWeight:800,cursor:'pointer',display:'inline-flex',gap:6,alignItems:'center'});
const mini=(primary=false)=>({border:primary?'0':'1px solid #e6e8ef',background:primary?'#f0edff':'#fff',color:primary?'#5d50df':'#555d6e',borderRadius:9,padding:'7px 9px',fontFamily:'inherit',fontWeight:800,cursor:'pointer',display:'inline-flex',gap:5,alignItems:'center'});
const input=(x={})=>({width:'100%',boxSizing:'border-box',border:'1px solid #e4e6ee',borderRadius:10,padding:'10px 12px',outline:'none',fontFamily:'inherit',background:'#fff',...x});
const th=()=>({textAlign:'right',padding:'11px 9px',fontSize:12,color:'#8c92a1',borderBottom:'1px solid #eceef4',whiteSpace:'nowrap'});
const td=()=>({padding:'12px 9px',borderBottom:'1px solid #f0f1f5',fontSize:13,verticalAlign:'middle'});
const muted=()=>({color:'#9298a7',fontSize:12,marginTop:3});
const pill=(s)=>({display:'inline-block',padding:'5px 9px',borderRadius:20,fontWeight:800,fontSize:11,background:s==='approved'?'#e9f8f0':s==='rejected'?'#fff0f2':s==='pending_approval'?'#f1eeff':'#f3f4f7',color:s==='approved'?'#178757':s==='rejected'?'#c84857':s==='pending_approval'?'#5f51df':'#737a89'});
const overlay=()=>({position:'fixed',inset:0,background:'rgba(20,25,45,.24)',zIndex:1000,display:'flex',justifyContent:'flex-start'});
const drawer=()=>({width:'min(620px,94vw)',height:'100%',overflow:'auto',background:'#fff',padding:22,boxShadow:'10px 0 35px rgba(25,30,55,.15)'});
const action=(bg)=>({border:0,background:bg,color:'#fff',borderRadius:10,padding:'9px 13px',fontFamily:'inherit',fontWeight:900,cursor:'pointer',display:'inline-flex',gap:6,alignItems:'center'});
