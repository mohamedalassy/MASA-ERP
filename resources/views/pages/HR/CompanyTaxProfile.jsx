import { useEffect, useState } from "react";
import { Building2, CircleAlert, Save } from "lucide-react";
import "../../../css/missing-pages.css";

const API = "/api/finance/tax-profiles";

export default function CompanyTaxProfile() {
  const [form, setForm] = useState({ legal_name: "", vat_number: "", commercial_registration: "", address: "", city: "", country: "SA" });
  const [id, setId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(API).then(r => r.ok ? r.json() : Promise.reject()).then(j => {
      const x = Array.isArray(j?.data) ? j.data[0] : Array.isArray(j) ? j[0] : j?.data || j;
      if (x?.id) { setId(x.id); setForm(f => ({...f, ...x})); }
    }).catch(()=>{});
  }, []);

  async function save(e) {
    e.preventDefault(); setError(""); setMessage("");
    try {
      const r = await fetch(id ? `${API}/${id}` : API, {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(form)
      });
      const j = await r.json().catch(()=>({}));
      if (!r.ok) throw new Error(j.message || "تعذر الحفظ");
      const x = j.data || j; if (x.id) setId(x.id);
      setMessage("تم حفظ الملف الضريبي للشركة.");
    } catch(e2) { setError(e2.message); }
  }

  return (
    <main className="masa-page" dir="rtl">
      <header className="masa-page-head"><div><span className="masa-eyebrow">MASA Finance</span><h1>الملف الضريبي للشركة</h1><p>بيانات المنشأة المستخدمة في الفواتير الإلكترونية.</p></div></header>
      {error && <div className="masa-alert"><CircleAlert size={18}/>{error}</div>}
      {message && <div className="masa-success">{message}</div>}
      <form className="masa-panel" onSubmit={save}>
        <div className="masa-form-title"><span className="masa-icon masa-icon--violet"><Building2 size={22}/></span><div><h2>بيانات المنشأة</h2><p>راجع البيانات القانونية والضريبية قبل إصدار الفواتير.</p></div></div>
        <div className="masa-form-grid">
          <label><span>الاسم القانوني</span><input value={form.legal_name || form.company_name || ""} onChange={e=>setForm({...form,legal_name:e.target.value})}/></label>
          <label><span>الرقم الضريبي</span><input value={form.vat_number || ""} onChange={e=>setForm({...form,vat_number:e.target.value})}/></label>
          <label><span>السجل التجاري</span><input value={form.commercial_registration || form.cr_number || ""} onChange={e=>setForm({...form,commercial_registration:e.target.value})}/></label>
          <label><span>المدينة</span><input value={form.city || ""} onChange={e=>setForm({...form,city:e.target.value})}/></label>
          <label className="span-2"><span>العنوان</span><input value={form.address || ""} onChange={e=>setForm({...form,address:e.target.value})}/></label>
        </div>
        <div className="masa-form-actions"><button className="masa-btn" type="submit"><Save size={17}/> حفظ البيانات</button></div>
      </form>
    </main>
  );
}
