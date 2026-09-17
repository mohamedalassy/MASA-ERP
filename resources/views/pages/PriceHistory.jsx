import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  History,
  PackageSearch,
  RefreshCcw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";
const BACKEND_URL = "http://127.0.0.1:8000";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dateText = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleString("en-GB");
};

const imageUrl = (value) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${BACKEND_URL}${value.startsWith("/") ? "" : "/"}${value}`;
};

export default function PriceHistory({ onNavigate }) {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("all");
  const [supplierId, setSupplierId] = useState("all");

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      const [historyRes, productRes, supplierRes] = await Promise.all([
        fetch(`${API_URL}/supplier-price-history`, {
          headers: { Accept: "application/json" },
        }),
        fetch(`${API_URL}/products`, {
          headers: { Accept: "application/json" },
        }),
        fetch(`${API_URL}/suppliers`, {
          headers: { Accept: "application/json" },
        }),
      ]);

      const [historyJson, productJson, supplierJson] = await Promise.all([
        historyRes.json(),
        productRes.json(),
        supplierRes.json(),
      ]);

      if (!historyRes.ok || !historyJson?.success) {
        throw new Error(historyJson?.message || "تعذر تحميل سجل الأسعار.");
      }

      setRows(Array.isArray(historyJson?.data) ? historyJson.data : []);
      setProducts(Array.isArray(productJson?.data) ? productJson.data : []);
      setSuppliers(Array.isArray(supplierJson?.data) ? supplierJson.data : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر تحميل سجل الأسعار.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const product = row.product || {};
      const supplier = row.supplier || {};

      const matchesSearch =
        !q ||
        [product.name, product.sku, product.brand, product.model, supplier.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));

      const matchesProduct =
        productId === "all" || String(row.product_id) === String(productId);

      const matchesSupplier =
        supplierId === "all" || String(row.supplier_id) === String(supplierId);

      return matchesSearch && matchesProduct && matchesSupplier;
    });
  }, [rows, search, productId, supplierId]);

  const stats = useMemo(() => {
    const priceUpdates = rows.filter((r) => r.change_type === "price_update");
    const increases = priceUpdates.filter(
      (r) => Number(r.new_price) > Number(r.old_price || 0)
    ).length;
    const decreases = priceUpdates.filter(
      (r) =>
        r.old_price !== null &&
        Number(r.new_price) < Number(r.old_price || 0)
    ).length;

    return {
      total: rows.length,
      increases,
      decreases,
      products: new Set(rows.map((r) => r.product_id)).size,
    };
  }, [rows]);

  return (
    <section className="ph-page" dir="rtl">
      <style>{`
        .ph-page{color:#27304a;padding-bottom:28px}
        .ph-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}
        .ph-kicker{font-size:10px;color:#6757f5;font-weight:900;margin-bottom:5px}
        .ph-head h1{margin:0;font-size:24px}.ph-head p{margin:6px 0 0;color:#9aa1af;font-size:10px}
        .ph-btn{border:1px solid #e4e7ef;background:#fff;border-radius:10px;padding:9px 12px;font-family:inherit;font-weight:800;font-size:9px;display:inline-flex;align-items:center;gap:6px;cursor:pointer}
        .ph-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:13px}
        .ph-stat{background:#fff;border:1px solid #e8eaf1;border-radius:14px;padding:14px}
        .ph-stat small{display:block;color:#9ba2b0;font-size:8px;margin-bottom:5px}.ph-stat strong{font-size:18px}
        .ph-card{background:#fff;border:1px solid #e8eaf1;border-radius:16px;overflow:hidden}
        .ph-toolbar{display:grid;grid-template-columns:minmax(260px,1.5fr) minmax(180px,.7fr) minmax(180px,.7fr) auto;gap:9px;padding:12px;border-bottom:1px solid #edf0f5}
        .ph-field{position:relative}.ph-field svg{position:absolute;right:11px;top:50%;transform:translateY(-50%);color:#9ca3b3}
        .ph-input,.ph-select{width:100%;min-height:36px;border:1px solid #e3e6ee;border-radius:9px;background:#fff;padding:0 11px;font-family:inherit;font-size:9px;box-sizing:border-box}
        .ph-field .ph-input{padding-right:34px}
        .ph-table-wrap{overflow:auto}.ph-table{width:100%;min-width:1050px;border-collapse:collapse}
        .ph-table th{background:#fafbfc;color:#8f96a7;font-size:8px;padding:10px;text-align:right;border-bottom:1px solid #e9ecf2}
        .ph-table td{padding:11px 10px;border-bottom:1px solid #eef0f4;font-size:9px;vertical-align:middle}
        .ph-product{display:flex;align-items:center;gap:8px}.ph-image{width:34px;height:34px;border:1px solid #eceef4;border-radius:9px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f8f9fb}
        .ph-image img{width:100%;height:100%;object-fit:contain}.ph-product strong{display:block}.ph-product small{display:block;color:#a0a6b4;font-size:7px;margin-top:3px}
        .ph-change{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:4px 7px;font-size:7px;font-weight:900}
        .ph-change.up{background:#fff0f0;color:#c9565b}.ph-change.down{background:#e9f8f2;color:#16825e}.ph-change.same{background:#f3f4f7;color:#747b8d}
        .ph-empty{padding:35px;text-align:center;color:#9ba2b0;font-size:9px}
        .ph-error{margin-bottom:10px;padding:9px 11px;border:1px solid #f0d7d8;background:#fff7f7;color:#bd5257;border-radius:10px;font-size:9px}
        @media(max-width:900px){.ph-stats{grid-template-columns:1fr 1fr}.ph-toolbar{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.ph-head{flex-direction:column}.ph-stats,.ph-toolbar{grid-template-columns:1fr}}
      `}</style>

      <div className="ph-head">
        <div>
          <div className="ph-kicker">مركز التسعير / سجل الأسعار</div>
          <h1>Price History</h1>
          <p>تتبع تغيّر أسعار الموردين بمرور الوقت ومعرفة الزيادة والانخفاض لكل منتج.</p>
        </div>

        <button className="ph-btn" type="button" onClick={() => onNavigate?.("pricing")}>
          <ArrowRight size={13} />
          العودة لمركز التسعير
        </button>
      </div>

      {error && <div className="ph-error">{error}</div>}

      <div className="ph-stats">
        <div className="ph-stat"><small>إجمالي الحركات</small><strong>{stats.total}</strong></div>
        <div className="ph-stat"><small>زيادات سعر</small><strong>{stats.increases}</strong></div>
        <div className="ph-stat"><small>انخفاضات سعر</small><strong>{stats.decreases}</strong></div>
        <div className="ph-stat"><small>منتجات لها تاريخ</small><strong>{stats.products}</strong></div>
      </div>

      <div className="ph-card">
        <div className="ph-toolbar">
          <div className="ph-field">
            <Search size={13} />
            <input
              className="ph-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المنتج، SKU أو المورد..."
            />
          </div>

          <select className="ph-select" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="all">كل المنتجات</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <select className="ph-select" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="all">كل الموردين</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <button className="ph-btn" type="button" onClick={loadAll}>
            <RefreshCcw size={12} />
            تحديث
          </button>
        </div>

        <div className="ph-table-wrap">
          {loading ? (
            <div className="ph-empty">جاري تحميل سجل الأسعار...</div>
          ) : filtered.length ? (
            <table className="ph-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>المنتج</th>
                  <th>المورد</th>
                  <th>السعر القديم</th>
                  <th>السعر الجديد</th>
                  <th>التغير</th>
                  <th>مدة التوريد</th>
                  <th>صلاحية السعر</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, index) => {
                  const oldPrice =
                    row.old_price === null ? null : Number(row.old_price || 0);
                  const newPrice = Number(row.new_price || 0);
                  const diff = oldPrice === null ? 0 : newPrice - oldPrice;
                  const percent =
                    oldPrice && oldPrice !== 0 ? (diff / oldPrice) * 100 : 0;

                  const tone = diff > 0 ? "up" : diff < 0 ? "down" : "same";

                  return (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td>
                        <div className="ph-product">
                          <div className="ph-image">
                            {row.product?.image_path ? (
                              <img src={imageUrl(row.product.image_path)} alt="" />
                            ) : (
                              <PackageSearch size={15} color="#9aa1af" />
                            )}
                          </div>
                          <div>
                            <strong>{row.product?.name || "—"}</strong>
                            <small>{row.product?.sku || "بدون SKU"}</small>
                          </div>
                        </div>
                      </td>
                      <td>{row.supplier?.name || "—"}</td>
                      <td>{oldPrice === null ? "أول سعر" : `${money(oldPrice)} ر.س`}</td>
                      <td><strong>{money(newPrice)} ر.س</strong></td>
                      <td>
                        <span className={`ph-change ${tone}`}>
                          {diff > 0 ? <TrendingUp size={10} /> : diff < 0 ? <TrendingDown size={10} /> : <History size={10} />}
                          {oldPrice === null ? "إنشاء" : `${diff > 0 ? "+" : ""}${money(diff)} (${percent.toFixed(1)}%)`}
                        </span>
                      </td>
                      <td>
                        {row.new_lead_time_days !== null &&
                        row.new_lead_time_days !== undefined
                          ? `${row.new_lead_time_days} يوم`
                          : "—"}
                      </td>
                      <td>{row.new_valid_until || "—"}</td>
                      <td>{dateText(row.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="ph-empty">لا توجد حركات أسعار مطابقة حتى الآن.</div>
          )}
        </div>
      </div>
    </section>
  );
}
