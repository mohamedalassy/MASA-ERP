import { useEffect, useMemo, useState } from "react";
import { CircleAlert, FilePlus2, Plus, Save, Trash2 } from "lucide-react";
import "../../../css/missing-pages.css";

const API = "/api/finance/tax-invoices";
const blankItem = () => ({ description: "", quantity: 1, unit_price: "", tax_rate: 15 });

export default function TaxInvoiceCreate({ onChangeView, initialProjectId = null, initialQuotationId = null }) {
  const [form, setForm] = useState({
    project_id: initialProjectId || "",
    quotation_id: initialQuotationId || "",
    buyer_name: "",
    buyer_vat_number: "",
    issue_date: new Date().toISOString().slice(0, 10),
    items: [blankItem()],
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm((f) => ({ ...f, project_id: initialProjectId || f.project_id, quotation_id: initialQuotationId || f.quotation_id }));
  }, [initialProjectId, initialQuotationId]);

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    form.items.forEach((i) => {
      const line = Number(i.quantity || 0) * Number(i.unit_price || 0);
      subtotal += line; tax += line * Number(i.tax_rate || 0) / 100;
    });
    return { subtotal, tax, total: subtotal + tax };
  }, [form.items]);

  const updateItem = (index, key, value) => setForm((f) => ({
    ...f, items: f.items.map((i, idx) => idx === index ? { ...i, [key]: value } : i)
  }));

  async function submit(e) {
    e.preventDefault(); setSaving(true); setError("");
    try {
      const payload = {
        ...form,
        project_id: form.project_id || null,
        quotation_id: form.quotation_id || null,
        items: form.items.map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price), tax_rate: Number(i.tax_rate) })),
      };
      const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.message || "تعذر حفظ الفاتورة");
      const invoice = json.data || json;
      onChangeView?.("finance-tax-details", { taxInvoiceId: invoice.id });
    } catch (e2) { setError(e2.message); } finally { setSaving(false); }
  }

  const money = (v) => Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main className="masa-page" dir="rtl">
      <header className="masa-page-head">
        <div><span className="masa-eyebrow">MASA Finance</span><h1>إنشاء فاتورة ضريبية</h1><p>فاتورة عربية متوافقة مع بنية وحدة ضريبة القيمة المضافة.</p></div>
      </header>
      {error && <div className="masa-alert"><CircleAlert size={18}/>{error}</div>}
      <form onSubmit={submit}>
        <section className="masa-panel">
          <div className="masa-form-grid">
            <label><span>اسم المشتري</span><input value={form.buyer_name} onChange={(e)=>setForm({...form,buyer_name:e.target.value})}/></label>
            <label><span>الرقم الضريبي للمشتري</span><input value={form.buyer_vat_number} onChange={(e)=>setForm({...form,buyer_vat_number:e.target.value})}/></label>
            <label><span>تاريخ الإصدار</span><input type="date" value={form.issue_date} onChange={(e)=>setForm({...form,issue_date:e.target.value})}/></label>
            <label><span>رقم المشروع</span><input value={form.project_id} onChange={(e)=>setForm({...form,project_id:e.target.value})}/></label>
          </div>
        </section>

        <section className="masa-panel">
          <div className="masa-panel-title"><div><h2>بنود الفاتورة</h2><p>أضف المنتجات أو الخدمات مع الكمية والسعر والضريبة.</p></div>
            <button type="button" className="masa-btn masa-btn--soft" onClick={()=>setForm({...form,items:[...form.items,blankItem()]})}><Plus size={16}/> إضافة بند</button>
          </div>
          <div className="masa-table-wrap">
            <table className="masa-table masa-edit-table">
              <thead><tr><th>الوصف</th><th>الكمية</th><th>سعر الوحدة</th><th>الضريبة %</th><th>الإجمالي</th><th></th></tr></thead>
              <tbody>{form.items.map((i,index)=><tr key={index}>
                <td><input required value={i.description} onChange={(e)=>updateItem(index,"description",e.target.value)}/></td>
                <td><input type="number" min="0.01" step="0.01" value={i.quantity} onChange={(e)=>updateItem(index,"quantity",e.target.value)}/></td>
                <td><input type="number" min="0" step="0.01" value={i.unit_price} onChange={(e)=>updateItem(index,"unit_price",e.target.value)}/></td>
                <td><input type="number" min="0" step="0.01" value={i.tax_rate} onChange={(e)=>updateItem(index,"tax_rate",e.target.value)}/></td>
                <td>{money(Number(i.quantity||0)*Number(i.unit_price||0)*(1+Number(i.tax_rate||0)/100))}</td>
                <td><button className="masa-icon-btn danger" type="button" onClick={()=>setForm({...form,items:form.items.filter((_,idx)=>idx!==index)})} disabled={form.items.length===1}><Trash2 size={16}/></button></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="masa-totals">
            <span>قبل الضريبة <b>{money(totals.subtotal)}</b></span>
            <span>الضريبة <b>{money(totals.tax)}</b></span>
            <strong>الإجمالي <b>{money(totals.total)}</b></strong>
          </div>
        </section>
        <div className="masa-form-actions">
          <button className="masa-btn masa-btn--soft" type="button" onClick={()=>onChangeView?.("finance-tax-invoices")}>إلغاء</button>
          <button className="masa-btn" disabled={saving} type="submit"><Save size={17}/>{saving ? "جاري الحفظ..." : "حفظ الفاتورة"}</button>
        </div>
      </form>
    </main>
  );
}
