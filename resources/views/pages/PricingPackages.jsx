import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const emptyForm = {
  name: "",
  code: "",
  description: "",
  target_margin_percent: 25,
  discount_percent: 0,
  is_active: true,
  priority: 100,
  items: [],
};

export default function PricingPackages({ onNavigate }) {
  const [packages, setPackages] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      const [packageRes, productRes] = await Promise.all([
        fetch(`${API_URL}/pricing-packages`, {
          headers: { Accept: "application/json" },
        }),
        fetch(`${API_URL}/products`, {
          headers: { Accept: "application/json" },
        }),
      ]);

      const [packageJson, productJson] = await Promise.all([
        packageRes.json(),
        productRes.json(),
      ]);

      if (!packageRes.ok || !packageJson?.success) {
        throw new Error(packageJson?.message || "تعذر تحميل الباقات.");
      }

      if (!productRes.ok || !productJson?.success) {
        throw new Error(productJson?.message || "تعذر تحميل المنتجات.");
      }

      setPackages(Array.isArray(packageJson?.data) ? packageJson.data : []);
      setProducts(Array.isArray(productJson?.data) ? productJson.data : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر تحميل بيانات الباقات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    return products
      .filter((product) => {
        if (!q) return true;

        return [
          product.name,
          product.sku,
          product.brand,
          product.model,
          product.category,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .slice(0, 40);
  }, [products, search]);

  const formTotals = useMemo(() => {
    const totalCost = form.items.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0) * Number(item.cost_price || 0),
      0
    );

    const grossSale = form.items.reduce((sum, item) => {
      const gross =
        Number(item.quantity || 0) * Number(item.sale_price || 0);
      return (
        sum +
        gross * (1 - Number(item.discount_percent || 0) / 100)
      );
    }, 0);

    const netSale =
      grossSale * (1 - Number(form.discount_percent || 0) / 100);

    const profit = netSale - totalCost;
    const margin = netSale > 0 ? (profit / netSale) * 100 : 0;
    const markup = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    const targetMargin = Number(form.target_margin_percent || 0);
    const targetSale =
      targetMargin < 100 && totalCost > 0
        ? totalCost / (1 - targetMargin / 100)
        : 0;

    return {
      totalCost,
      grossSale,
      netSale,
      profit,
      margin,
      markup,
      targetSale,
    };
  }, [form]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setSearch("");
    setMessage("");
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      name: row.name || "",
      code: row.code || "",
      description: row.description || "",
      target_margin_percent: Number(row.target_margin_percent || 25),
      discount_percent: Number(row.discount_percent || 0),
      is_active: row.is_active !== false,
      priority: Number(row.priority || 100),
      items: (row.items || []).map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name_snapshot || item.product?.name || "",
        sku: item.sku_snapshot || item.product?.sku || "",
        unit: item.unit || "قطعة",
        quantity: Number(item.quantity || 1),
        cost_price: Number(item.cost_price || 0),
        sale_price: Number(item.sale_price || 0),
        discount_percent: Number(item.discount_percent || 0),
      })),
    });
    setSearch("");
    setMessage("");
    setModalOpen(true);
  };

  const addProduct = (product) => {
    setForm((current) => {
      const found = current.items.find(
        (item) => String(item.product_id) === String(product.id)
      );

      if (found) {
        return {
          ...current,
          items: current.items.map((item) =>
            String(item.product_id) === String(product.id)
              ? { ...item, quantity: Number(item.quantity || 0) + 1 }
              : item
          ),
        };
      }

      return {
        ...current,
        items: [
          ...current.items,
          {
            product_id: product.id,
            product_name: product.name,
            sku: product.sku || "",
            unit: product.unit || "قطعة",
            quantity: 1,
            cost_price: Number(product.cost_price || 0),
            sale_price: Number(product.default_sale_price || 0),
            discount_percent: 0,
          },
        ],
      };
    });
  };

  const updateItem = (index, field, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: [
                "quantity",
                "cost_price",
                "sale_price",
                "discount_percent",
              ].includes(field)
                ? Number(value || 0)
                : value,
            }
          : item
      ),
    }));
  };

  const removeItem = (index) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const applyTargetMargin = () => {
    if (!form.items.length || formTotals.grossSale <= 0) return;

    const factor = formTotals.targetSale / formTotals.grossSale;

    setForm((current) => ({
      ...current,
      discount_percent: 0,
      items: current.items.map((item) => ({
        ...item,
        sale_price: Number(
          (Number(item.sale_price || 0) * factor).toFixed(2)
        ),
      })),
    }));
  };

  const savePackage = async (event) => {
    event.preventDefault();

    if (!form.items.length) {
      setMessage("أضف منتجًا واحدًا على الأقل داخل الباقة.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      const payload = {
        ...form,
        target_margin_percent: Number(form.target_margin_percent || 0),
        discount_percent: Number(form.discount_percent || 0),
        priority: Number(form.priority || 100),
        is_active: Boolean(form.is_active),
        items: form.items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity || 0),
          cost_price: Number(item.cost_price || 0),
          sale_price: Number(item.sale_price || 0),
          discount_percent: Number(item.discount_percent || 0),
        })),
      };

      const response = await fetch(
        editingId
          ? `${API_URL}/pricing-packages/${editingId}`
          : `${API_URL}/pricing-packages`,
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const json = await response.json();

      if (!response.ok || !json?.success) {
        const firstError = json?.errors
          ? Object.values(json.errors).flat().find(Boolean)
          : null;

        throw new Error(
          firstError || json?.message || "تعذر حفظ الباقة."
        );
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadAll();
    } catch (err) {
      console.error(err);
      setMessage(err.message || "تعذر حفظ الباقة.");
    } finally {
      setSaving(false);
    }
  };

  const deletePackage = async (row) => {
    if (!window.confirm(`حذف الباقة "${row.name}"؟`)) return;

    try {
      const response = await fetch(
        `${API_URL}/pricing-packages/${row.id}`,
        {
          method: "DELETE",
          headers: { Accept: "application/json" },
        }
      );

      const json = await response.json();

      if (!response.ok || !json?.success) {
        throw new Error(json?.message || "تعذر حذف الباقة.");
      }

      await loadAll();
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر حذف الباقة.");
    }
  };

  const sendPackageToBoq = (row) => {
    sessionStorage.setItem(
      "masa_package_to_boq",
      JSON.stringify({
        package_id: row.id,
        package_name: row.name,
        package_code: row.code || "",
        items: (row.items || []).map((item) => ({
          product_id: item.product_id,
          product_name:
            item.product_name_snapshot || item.product?.name || "",
          sku: item.sku_snapshot || item.product?.sku || "",
          unit: item.unit || item.product?.unit || "قطعة",
          quantity: Number(item.quantity || 1),
          cost_price: Number(item.cost_price || 0),
          sale_price: Number(item.sale_price || 0),
          discount_percent: Number(item.discount_percent || 0),
          tax_rate: Number(item.product?.tax_rate || 0),
          stock: Number(item.product?.stock_quantity || 0),
        })),
      })
    );

    onNavigate?.("pricing-builder");
  };

  return (
    <section className="pkg-page" dir="rtl">
      <style>{`
        .pkg-page{color:#27304a;padding-bottom:30px}
        .pkg-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:16px}
        .pkg-kicker{font-size:10px;font-weight:900;color:#6757f5;margin-bottom:5px}
        .pkg-head h1{font-size:24px;margin:0}.pkg-head p{font-size:10px;color:#969dac;margin:6px 0 0}
        .pkg-actions{display:flex;gap:8px}.pkg-btn{border:1px solid #e3e6ee;background:#fff;border-radius:10px;padding:9px 12px;font-family:inherit;font-size:9px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
        .pkg-btn.primary{background:#6657f5;color:#fff;border-color:#6657f5}
        .pkg-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        .pkg-card{background:#fff;border:1px solid #e8eaf1;border-radius:16px;padding:15px}
        .pkg-card-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.pkg-card h3{margin:0;font-size:14px}.pkg-card small{color:#9aa1af;font-size:8px}
        .pkg-status{border-radius:999px;padding:4px 7px;font-size:7px;font-weight:900;background:#eaf8f1;color:#16815f}
        .pkg-status.off{background:#f1f2f5;color:#777f8f}
        .pkg-items{margin-top:12px;border-top:1px solid #edf0f4}.pkg-item{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #f0f2f5;font-size:8px}
        .pkg-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.pkg-metric{background:#fafbfc;border:1px solid #eceef3;border-radius:10px;padding:9px}.pkg-metric span{display:block;font-size:7px;color:#9da3b0}.pkg-metric strong{font-size:11px;display:block;margin-top:4px}
        .pkg-card-actions{display:flex;gap:6px;margin-top:12px;flex-wrap:wrap}
        .pkg-icon-btn{width:32px;height:32px;border:1px solid #e5e8ef;background:#fff;border-radius:8px;display:grid;place-items:center;cursor:pointer}
        .pkg-empty{background:#fff;border:1px dashed #dfe2ea;border-radius:16px;padding:45px;text-align:center;color:#979eac;font-size:9px}
        .pkg-error{margin-bottom:10px;padding:9px 11px;background:#fff3f3;border:1px solid #f0d2d3;color:#c75459;border-radius:10px;font-size:9px}
        .pkg-modal-backdrop{position:fixed;inset:0;background:rgba(20,24,37,.3);z-index:1500;display:flex;align-items:center;justify-content:center;padding:20px}
        .pkg-modal{width:min(1100px,96vw);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(25,30,48,.2)}
        .pkg-modal-head{position:sticky;top:0;z-index:2;background:#fff;display:flex;justify-content:space-between;align-items:center;padding:15px 18px;border-bottom:1px solid #eceef3}
        .pkg-modal-body{padding:16px}.pkg-form-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:9px}.pkg-field{display:flex;flex-direction:column;gap:5px}.pkg-field.full{grid-column:1/-1}
        .pkg-field label{font-size:8px;font-weight:800;color:#747c8e}.pkg-input{border:1px solid #e3e6ee;border-radius:9px;min-height:38px;padding:0 10px;font-family:inherit;font-size:9px;box-sizing:border-box;width:100%}
        .pkg-workspace{display:grid;grid-template-columns:280px 1fr;gap:12px;margin-top:14px}.pkg-product-panel,.pkg-items-panel{border:1px solid #e8eaf1;border-radius:14px;overflow:hidden}
        .pkg-panel-head{padding:11px 12px;border-bottom:1px solid #edf0f4;font-size:10px;font-weight:900}.pkg-search{margin:10px;border:1px solid #e3e6ee;border-radius:9px;display:flex;align-items:center;gap:6px;padding:7px 8px}.pkg-search input{border:0;outline:0;width:100%;font-family:inherit;font-size:8px}
        .pkg-products{max-height:430px;overflow:auto;padding:0 10px 10px}.pkg-product{width:100%;border:1px solid #edf0f4;background:#fff;border-radius:9px;padding:8px;margin-top:6px;text-align:right;font-family:inherit;cursor:pointer}.pkg-product strong{display:block;font-size:8px}.pkg-product small{font-size:7px;color:#9ba2b0}
        .pkg-table-wrap{overflow:auto}.pkg-table{width:100%;min-width:760px;border-collapse:collapse}.pkg-table th{background:#fafbfc;color:#9299a8;font-size:7px;padding:8px;text-align:right}.pkg-table td{border-top:1px solid #eef0f4;padding:7px;font-size:8px}.pkg-table input{width:78px;border:1px solid #e4e7ef;border-radius:7px;padding:6px;font-family:inherit;font-size:8px}
        .pkg-summary{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:12px}.pkg-summary-box{background:#fafbfc;border:1px solid #e9ebf1;border-radius:11px;padding:10px}.pkg-summary-box span{display:block;color:#9ca2af;font-size:7px}.pkg-summary-box strong{font-size:10px;display:block;margin-top:4px}
        .pkg-modal-foot{position:sticky;bottom:0;background:#fafbfc;border-top:1px solid #eceef3;padding:12px 16px;display:flex;gap:8px}
        .pkg-msg{margin-top:10px;background:#fff4f4;color:#bd5055;border:1px solid #f0d2d4;border-radius:9px;padding:8px 10px;font-size:8px}
        @media(max-width:1050px){.pkg-grid{grid-template-columns:1fr 1fr}.pkg-workspace{grid-template-columns:1fr}.pkg-form-grid{grid-template-columns:1fr 1fr}.pkg-summary{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:650px){.pkg-head{flex-direction:column}.pkg-grid,.pkg-form-grid,.pkg-summary{grid-template-columns:1fr}}
      `}</style>

      <div className="pkg-head">
        <div>
          <div className="pkg-kicker">مركز التسعير / الباقات</div>
          <h1>Packages & Bundles</h1>
          <p>
            أنشئ باقات منتجات جاهزة بالتكلفة والكميات وسعر البيع، ثم أضف الباقة كاملة إلى BOQ بضغطة واحدة.
          </p>
        </div>

        <div className="pkg-actions">
          <button className="pkg-btn" type="button" onClick={() => onNavigate?.("pricing")}>
            <ArrowRight size={13} />
            العودة
          </button>

          <button className="pkg-btn primary" type="button" onClick={openCreate}>
            <Plus size={13} />
            باقة جديدة
          </button>
        </div>
      </div>

      {error && <div className="pkg-error">{error}</div>}

      {loading ? (
        <div className="pkg-empty">جاري تحميل الباقات...</div>
      ) : packages.length ? (
        <div className="pkg-grid">
          {packages.map((row) => (
            <article className="pkg-card" key={row.id}>
              <div className="pkg-card-head">
                <div>
                  <h3>{row.name}</h3>
                  <small>
                    {row.code || `PKG-${row.id}`}
                    {row.description ? ` · ${row.description}` : ""}
                  </small>
                </div>

                <span className={`pkg-status ${row.is_active ? "" : "off"}`}>
                  {row.is_active ? "فعال" : "موقوف"}
                </span>
              </div>

              <div className="pkg-items">
                {(row.items || []).slice(0, 5).map((item) => (
                  <div className="pkg-item" key={item.id}>
                    <span>{item.product_name_snapshot}</span>
                    <strong>× {Number(item.quantity || 0)}</strong>
                  </div>
                ))}

                {(row.items || []).length > 5 && (
                  <div className="pkg-item">
                    <span>بنود إضافية</span>
                    <strong>+{row.items.length - 5}</strong>
                  </div>
                )}
              </div>

              <div className="pkg-metrics">
                <div className="pkg-metric">
                  <span>إجمالي التكلفة</span>
                  <strong>{money(row.totals?.total_cost)} ر.س</strong>
                </div>

                <div className="pkg-metric">
                  <span>صافي البيع</span>
                  <strong>{money(row.totals?.net_sale)} ر.س</strong>
                </div>

                <div className="pkg-metric">
                  <span>الربح</span>
                  <strong>{money(row.totals?.profit)} ر.س</strong>
                </div>

                <div className="pkg-metric">
                  <span>Margin</span>
                  <strong>{money(row.totals?.margin_percent)}%</strong>
                </div>
              </div>

              <div className="pkg-card-actions">
                <button
                  className="pkg-btn primary"
                  type="button"
                  onClick={() => sendPackageToBoq(row)}
                >
                  <PackagePlus size={12} />
                  إضافة إلى BOQ
                </button>

                <button className="pkg-icon-btn" type="button" onClick={() => openEdit(row)}>
                  <Pencil size={12} />
                </button>

                <button className="pkg-icon-btn" type="button" onClick={() => deletePackage(row)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="pkg-empty">
          لا توجد باقات حتى الآن. أنشئ أول باقة منتجات جاهزة للتسعير.
        </div>
      )}

      {modalOpen && (
        <div className="pkg-modal-backdrop">
          <form className="pkg-modal" onSubmit={savePackage}>
            <div className="pkg-modal-head">
              <strong>{editingId ? "تعديل الباقة" : "باقة جديدة"}</strong>

              <button
                type="button"
                className="pkg-icon-btn"
                onClick={() => setModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            <div className="pkg-modal-body">
              <div className="pkg-form-grid">
                <div className="pkg-field">
                  <label>اسم الباقة</label>
                  <input
                    className="pkg-input"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="pkg-field">
                  <label>كود الباقة</label>
                  <input
                    className="pkg-input"
                    value={form.code}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="pkg-field">
                  <label>Target Margin %</label>
                  <input
                    className="pkg-input"
                    type="number"
                    min="0"
                    max="99.99"
                    step="0.01"
                    value={form.target_margin_percent}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        target_margin_percent: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="pkg-field">
                  <label>خصم الباقة %</label>
                  <input
                    className="pkg-input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.discount_percent}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        discount_percent: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="pkg-field full">
                  <label>الوصف</label>
                  <input
                    className="pkg-input"
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="pkg-workspace">
                <div className="pkg-product-panel">
                  <div className="pkg-panel-head">المنتجات</div>

                  <div className="pkg-search">
                    <Search size={12} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="ابحث باسم المنتج أو SKU..."
                    />
                  </div>

                  <div className="pkg-products">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className="pkg-product"
                        onClick={() => addProduct(product)}
                      >
                        <strong>{product.name}</strong>
                        <small>
                          {product.sku || "بدون SKU"} · تكلفة {money(product.cost_price)} · بيع {money(product.default_sale_price)}
                        </small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pkg-items-panel">
                  <div className="pkg-panel-head">مكونات الباقة</div>

                  <div className="pkg-table-wrap">
                    <table className="pkg-table">
                      <thead>
                        <tr>
                          <th>المنتج</th>
                          <th>الكمية</th>
                          <th>التكلفة</th>
                          <th>سعر البيع</th>
                          <th>خصم %</th>
                          <th></th>
                        </tr>
                      </thead>

                      <tbody>
                        {form.items.length ? (
                          form.items.map((item, index) => (
                            <tr key={`${item.product_id}-${index}`}>
                              <td>
                                <strong>{item.product_name}</strong>
                                <div style={{ color: "#9ba2b0", fontSize: 7 }}>
                                  {item.sku || "—"}
                                </div>
                              </td>

                              <td>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.quantity}
                                  onChange={(event) =>
                                    updateItem(index, "quantity", event.target.value)
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  dir="ltr"
                                  value={item.cost_price}
                                  onChange={(event) =>
                                    updateItem(index, "cost_price", event.target.value)
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  dir="ltr"
                                  value={item.sale_price}
                                  onChange={(event) =>
                                    updateItem(index, "sale_price", event.target.value)
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={item.discount_percent}
                                  onChange={(event) =>
                                    updateItem(index, "discount_percent", event.target.value)
                                  }
                                />
                              </td>

                              <td>
                                <button
                                  type="button"
                                  className="pkg-icon-btn"
                                  onClick={() => removeItem(index)}
                                >
                                  <Trash2 size={11} />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="6" style={{ textAlign: "center", padding: 30, color: "#9aa1af" }}>
                              اختر منتجات من القائمة.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="pkg-summary">
                <div className="pkg-summary-box">
                  <span>التكلفة</span>
                  <strong>{money(formTotals.totalCost)} ر.س</strong>
                </div>
                <div className="pkg-summary-box">
                  <span>صافي البيع</span>
                  <strong>{money(formTotals.netSale)} ر.س</strong>
                </div>
                <div className="pkg-summary-box">
                  <span>الربح</span>
                  <strong>{money(formTotals.profit)} ر.س</strong>
                </div>
                <div className="pkg-summary-box">
                  <span>Margin</span>
                  <strong>{money(formTotals.margin)}%</strong>
                </div>
                <div className="pkg-summary-box">
                  <span>Markup</span>
                  <strong>{money(formTotals.markup)}%</strong>
                </div>
                <div className="pkg-summary-box">
                  <span>Target Sale</span>
                  <strong>{money(formTotals.targetSale)} ر.س</strong>
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="pkg-btn"
                  onClick={applyTargetMargin}
                  disabled={!form.items.length}
                >
                  تطبيق Target Margin على أسعار الباقة
                </button>
              </div>

              {message && <div className="pkg-msg">{message}</div>}
            </div>

            <div className="pkg-modal-foot">
              <button className="pkg-btn primary" type="submit" disabled={saving}>
                <CheckCircle2 size={13} />
                {saving ? "جاري الحفظ..." : "حفظ الباقة"}
              </button>

              <button className="pkg-btn" type="button" onClick={() => setModalOpen(false)}>
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
