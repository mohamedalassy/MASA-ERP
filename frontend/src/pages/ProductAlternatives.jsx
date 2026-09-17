import { useEffect, useMemo, useState } from "react";

const API_BASE = "http://127.0.0.1:8000/api";

const money = (value) =>
  new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

function unwrap(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.products)) return payload.products;
  return [];
}

export default function ProductAlternatives({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [rows, setRows] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [alternativeProductId, setAlternativeProductId] = useState("");
  const [priority, setPriority] = useState(100);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [preferred, setPreferred] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(selectedProductId)),
    [products, selectedProductId]
  );

  const alternativesAvailable = useMemo(
    () => products.filter((p) => String(p.id) !== String(selectedProductId)),
    [products, selectedProductId]
  );

  async function request(url, options = {}) {
    const response = await fetch(`${API_BASE}${url}`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        payload?.message ||
          Object.values(payload?.errors || {})?.flat()?.[0] ||
          "حدث خطأ أثناء الاتصال بالخادم."
      );
    }

    return payload;
  }

  async function loadProducts() {
    const payload = await request("/products");
    setProducts(unwrap(payload));
  }

  async function loadAlternatives(productId) {
    if (!productId) {
      setRows([]);
      return;
    }
    const payload = await request(`/products/${productId}/alternatives`);
    setRows(unwrap(payload));
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        await loadProducts();
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setError("");
        await loadAlternatives(selectedProductId);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [selectedProductId]);

  async function addAlternative(e) {
    e.preventDefault();
    if (!selectedProductId || !alternativeProductId) {
      setError("اختر المنتج الأساسي والمنتج البديل.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await request("/product-alternatives", {
        method: "POST",
        body: JSON.stringify({
          product_id: Number(selectedProductId),
          alternative_product_id: Number(alternativeProductId),
          priority: Number(priority || 100),
          is_preferred: preferred,
          is_active: true,
          reason: reason || null,
          notes: notes || null,
        }),
      });

      setAlternativeProductId("");
      setPriority(100);
      setReason("");
      setNotes("");
      setPreferred(false);
      setMessage("تم إضافة البديل بنجاح.");
      await loadAlternatives(selectedProductId);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function patchRow(row, patch) {
    try {
      setError("");
      await request(`/product-alternatives/${row.id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      await loadAlternatives(selectedProductId);
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeRow(row) {
    if (!window.confirm("حذف هذا البديل؟")) return;
    try {
      setError("");
      await request(`/product-alternatives/${row.id}`, {
        method: "DELETE",
      });
      await loadAlternatives(selectedProductId);
    } catch (e) {
      setError(e.message);
    }
  }

  const activeCount = rows.filter((r) => r.is_active).length;
  const preferredRow = rows.find((r) => r.is_preferred);

  return (
    <div className="pa-page" dir="rtl">
      <style>{`
        .pa-page{font-family:inherit;color:#202333}
        .pa-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:20px}
        .pa-kicker{font-size:11px;font-weight:900;color:#6b5bf5;margin-bottom:7px}
        .pa-head h1{margin:0;font-size:25px}.pa-head p{margin:7px 0 0;color:#9298a8;font-size:13px}
        .pa-back{border:1px solid #e7e8ef;background:#fff;padding:10px 14px;border-radius:11px;font-family:inherit;font-weight:800;cursor:pointer}
        .pa-grid{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(310px,.75fr);gap:18px}
        .pa-card{background:#fff;border:1px solid #e9ebf2;border-radius:18px;box-shadow:0 8px 28px rgba(28,31,49,.035)}
        .pa-pad{padding:20px}.pa-title{font-size:15px;font-weight:900;margin-bottom:15px}
        .pa-select,.pa-input,.pa-textarea{width:100%;box-sizing:border-box;border:1px solid #e4e6ee;background:#fff;border-radius:11px;padding:11px 12px;font-family:inherit;outline:none}
        .pa-select:focus,.pa-input:focus,.pa-textarea:focus{border-color:#8a7ef7;box-shadow:0 0 0 3px rgba(107,91,245,.08)}
        .pa-textarea{resize:vertical;min-height:76px}.pa-label{display:block;font-size:11px;font-weight:850;color:#747b8d;margin:0 0 6px}
        .pa-form-grid{display:grid;grid-template-columns:1fr 120px;gap:11px}.pa-field{margin-bottom:12px}
        .pa-check{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;margin:5px 0 15px}
        .pa-primary{width:100%;border:0;background:#6657f5;color:#fff;border-radius:11px;padding:12px;font-family:inherit;font-weight:900;cursor:pointer}
        .pa-primary:disabled{opacity:.55;cursor:not-allowed}
        .pa-alert{padding:10px 12px;border-radius:10px;margin-bottom:12px;font-size:12px;font-weight:800}
        .pa-error{background:#fff1f2;color:#b42318}.pa-ok{background:#effaf5;color:#16794b}
        .pa-product-card{padding:18px 20px;border-bottom:1px solid #eef0f5;display:flex;justify-content:space-between;align-items:center;gap:15px}
        .pa-product-name{font-weight:950;font-size:17px}.pa-meta{font-size:11px;color:#989eac;margin-top:5px}
        .pa-stats{display:flex;gap:8px;flex-wrap:wrap}.pa-stat{background:#f7f7fb;border-radius:10px;padding:8px 11px;font-size:11px}
        .pa-stat b{display:block;font-size:14px;margin-top:2px}
        .pa-empty{padding:55px 20px;text-align:center;color:#9aa0ad}
        .pa-row{padding:17px 20px;border-bottom:1px solid #eef0f5}.pa-row:last-child{border-bottom:0}
        .pa-row-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
        .pa-row-name{font-size:14px;font-weight:950}.pa-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
        .pa-badge{padding:4px 8px;border-radius:999px;background:#f3f2ff;color:#6253e8;font-size:10px;font-weight:900}
        .pa-badge.good{background:#ecf9f2;color:#147a4d}.pa-badge.off{background:#f3f4f6;color:#777}
        .pa-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:14px}
        .pa-metric{background:#fafafd;border:1px solid #f0f1f5;border-radius:11px;padding:9px}
        .pa-metric span{display:block;color:#989eaa;font-size:9px;margin-bottom:4px}.pa-metric b{font-size:12px}
        .pa-suppliers{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}
        .pa-supplier{background:#fbfbfd;border-radius:10px;padding:9px;font-size:10px;color:#73798a}
        .pa-supplier b{color:#252837}
        .pa-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
        .pa-btn{border:1px solid #e5e7ef;background:#fff;border-radius:9px;padding:7px 9px;font-family:inherit;font-size:10px;font-weight:850;cursor:pointer}
        .pa-btn.purple{border-color:#ddd8ff;color:#6253e8;background:#f8f7ff}.pa-btn.danger{color:#c9362b}
        @media(max-width:1050px){.pa-grid{grid-template-columns:1fr}.pa-metrics{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:650px){.pa-head{flex-direction:column}.pa-form-grid,.pa-suppliers{grid-template-columns:1fr}.pa-metrics{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <div className="pa-head">
        <div>
          <div className="pa-kicker">مركز التسعير / بدائل المنتجات</div>
          <h1>بدائل المنتجات</h1>
          <p>اربط كل منتج ببدائل مناسبة وقارن التكلفة والهامش والمخزون والمورد قبل استخدامه في الـ BOQ.</p>
        </div>
        <button className="pa-back" onClick={() => onNavigate?.("pricing")}>العودة لمركز التسعير</button>
      </div>

      {error && <div className="pa-alert pa-error">{error}</div>}
      {message && <div className="pa-alert pa-ok">{message}</div>}

      <div className="pa-grid">
        <section className="pa-card">
          <div className="pa-product-card">
            <div style={{minWidth:260,flex:1}}>
              <label className="pa-label">المنتج الأساسي</label>
              <select className="pa-select" value={selectedProductId} onChange={(e)=>setSelectedProductId(e.target.value)}>
                <option value="">اختر المنتج لعرض بدائله...</option>
                {products.map((p)=><option key={p.id} value={p.id}>{p.name} {p.sku ? `— ${p.sku}` : ""}</option>)}
              </select>
            </div>
            {selectedProduct && (
              <div className="pa-stats">
                <div className="pa-stat">التكلفة<b>{money(selectedProduct.cost_price)}</b></div>
                <div className="pa-stat">سعر البيع<b>{money(selectedProduct.default_sale_price)}</b></div>
                <div className="pa-stat">المخزون<b>{Number(selectedProduct.stock_quantity || 0)}</b></div>
                <div className="pa-stat">البدائل النشطة<b>{activeCount}</b></div>
              </div>
            )}
          </div>

          {!selectedProductId ? (
            <div className="pa-empty">اختر منتجًا من الأعلى لعرض البدائل.</div>
          ) : rows.length === 0 ? (
            <div className="pa-empty">لا توجد بدائل لهذا المنتج حتى الآن. أضف أول بديل من النموذج.</div>
          ) : (
            rows.map((row) => {
              const alt = row.alternative_product || {};
              const c = row.comparison || {};
              const best = c.best_supplier_price;
              const fastest = c.fastest_supplier_price;
              return (
                <div className="pa-row" key={row.id}>
                  <div className="pa-row-top">
                    <div>
                      <div className="pa-row-name">{alt.name || "منتج بديل"}</div>
                      <div className="pa-meta">{alt.sku || "بدون SKU"} · {alt.brand || "بدون علامة"} · {alt.model || "بدون موديل"}</div>
                      <div className="pa-badges">
                        {row.is_preferred && <span className="pa-badge good">البديل المفضل</span>}
                        <span className="pa-badge">الأولوية {row.priority}</span>
                        {!row.is_active && <span className="pa-badge off">معطل</span>}
                      </div>
                    </div>
                  </div>

                  <div className="pa-metrics">
                    <div className="pa-metric"><span>تكلفة المنتج</span><b>{money(c.cost_price)}</b></div>
                    <div className="pa-metric"><span>أفضل تكلفة</span><b>{money(c.best_cost)}</b></div>
                    <div className="pa-metric"><span>سعر البيع</span><b>{money(c.default_sale_price)}</b></div>
                    <div className="pa-metric"><span>الهامش</span><b>{c.margin_percent == null ? "—" : `${c.margin_percent}%`}</b></div>
                    <div className="pa-metric"><span>المخزون</span><b>{Number(c.stock_quantity || 0)}</b></div>
                  </div>

                  <div className="pa-suppliers">
                    <div className="pa-supplier">
                      أفضل مورد: <b>{best?.supplier?.name || "لا يوجد سعر مورد"}</b>
                      {best && <> · {money(best.unit_price)}</>}
                    </div>
                    <div className="pa-supplier">
                      أسرع توريد: <b>{fastest?.supplier?.name || "غير محدد"}</b>
                      {fastest?.lead_time_days != null && <> · {fastest.lead_time_days} يوم</>}
                    </div>
                  </div>

                  {(row.reason || row.notes) && (
                    <div className="pa-meta" style={{marginTop:9}}>
                      {row.reason && <>السبب: {row.reason}</>}
                      {row.reason && row.notes && " · "}
                      {row.notes && <>ملاحظات: {row.notes}</>}
                    </div>
                  )}

                  <div className="pa-actions">
                    {!row.is_preferred && <button className="pa-btn purple" onClick={()=>patchRow(row,{is_preferred:true})}>تعيين كمفضل</button>}
                    <button className="pa-btn" onClick={()=>patchRow(row,{is_active:!row.is_active})}>{row.is_active ? "تعطيل" : "تفعيل"}</button>
                    <button className="pa-btn" onClick={()=>patchRow(row,{priority:Math.max(1,Number(row.priority||100)-10)})}>رفع الأولوية</button>
                    <button className="pa-btn danger" onClick={()=>removeRow(row)}>حذف</button>
                  </div>
                </div>
              );
            })
          )}
        </section>

        <aside className="pa-card pa-pad">
          <div className="pa-title">إضافة بديل جديد</div>
          <form onSubmit={addAlternative}>
            <div className="pa-field">
              <label className="pa-label">المنتج البديل</label>
              <select className="pa-select" value={alternativeProductId} onChange={(e)=>setAlternativeProductId(e.target.value)} disabled={!selectedProductId}>
                <option value="">اختر البديل...</option>
                {alternativesAvailable.map((p)=><option key={p.id} value={p.id}>{p.name} {p.sku ? `— ${p.sku}` : ""}</option>)}
              </select>
            </div>

            <div className="pa-form-grid">
              <div className="pa-field">
                <label className="pa-label">سبب اختيار البديل</label>
                <input className="pa-input" value={reason} onChange={(e)=>setReason(e.target.value)} placeholder="مثال: نفس المواصفات وسعر أفضل" />
              </div>
              <div className="pa-field">
                <label className="pa-label">الأولوية</label>
                <input dir="ltr" type="number" min="1" className="pa-input" value={priority} onChange={(e)=>setPriority(e.target.value)} />
              </div>
            </div>

            <div className="pa-field">
              <label className="pa-label">ملاحظات</label>
              <textarea className="pa-textarea" value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="أي ملاحظات فنية أو تجارية..." />
            </div>

            <label className="pa-check">
              <input type="checkbox" checked={preferred} onChange={(e)=>setPreferred(e.target.checked)} />
              تعيين كبديل مفضل
            </label>

            <button className="pa-primary" disabled={saving || !selectedProductId || !alternativeProductId}>
              {saving ? "جاري الإضافة..." : "إضافة البديل"}
            </button>
          </form>

          {preferredRow && (
            <div style={{marginTop:16,padding:12,background:"#f8f7ff",borderRadius:11,fontSize:11}}>
              <b style={{color:"#6253e8"}}>البديل المفضل الحالي</b>
              <div style={{marginTop:5}}>{preferredRow.alternative_product?.name}</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
