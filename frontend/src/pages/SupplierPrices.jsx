import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  RefreshCcw,
  PackageSearch,
  BadgeDollarSign,
  Pencil,
  X,
  CheckCircle2,
  Clock3,
  Boxes,
  Users,
  Upload,
  ImagePlus,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";
const BACKEND_URL = "http://127.0.0.1:8000";

const emptyForm = {
  mode: "existing",
  product_id: "",
  supplier_id: "",
  unit_price: "",
  currency: "SAR",
  minimum_order_quantity: 1,
  lead_time_days: "",
  valid_from: "",
  valid_until: "",
  payment_terms: "",
  warranty_terms: "",
  notes: "",
  is_preferred: false,
  is_active: true,

  new_name: "",
  new_sku: "",
  new_category: "",
  new_brand: "",
  new_model: "",
  new_unit: "قطعة",
  new_description: "",
  new_barcode: "",
  new_default_sale_price: "",
  new_tax_rate: "15",
};

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dateText = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("en-CA");
};

const imageUrl = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${BACKEND_URL}${path.startsWith("/") ? "" : "/"}${path}`;
};

export default function SupplierPrices({ onNavigate }) {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");

      const [pricesRes, productsRes, suppliersRes] = await Promise.all([
        fetch(`${API_URL}/supplier-prices`, {
          headers: { Accept: "application/json" },
        }),
        fetch(`${API_URL}/products`, {
          headers: { Accept: "application/json" },
        }),
        fetch(`${API_URL}/suppliers`, {
          headers: { Accept: "application/json" },
        }),
      ]);

      const [pricesJson, productsJson, suppliersJson] = await Promise.all([
        pricesRes.json(),
        productsRes.json(),
        suppliersRes.json(),
      ]);

      if (!pricesRes.ok || !pricesJson?.success) {
        throw new Error(pricesJson?.message || "تعذر تحميل أسعار الموردين.");
      }

      if (!productsRes.ok || !productsJson?.success) {
        throw new Error(productsJson?.message || "تعذر تحميل المنتجات.");
      }

      if (!suppliersRes.ok || !suppliersJson?.success) {
        throw new Error(suppliersJson?.message || "تعذر تحميل الموردين.");
      }

      setRows(Array.isArray(pricesJson.data) ? pricesJson.data : []);
      setProducts(Array.isArray(productsJson.data) ? productsJson.data : []);
      setSuppliers(Array.isArray(suppliersJson.data) ? suppliersJson.data : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "حدث خطأ أثناء تحميل البيانات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        products
          .map((p) => p.category)
          .filter(Boolean)
          .map(String)
      )
    ).sort();
  }, [products]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return rows.filter((row) => {
      const product = row.product || {};
      const supplier = row.supplier || {};

      const matchesSearch =
        !q ||
        [
          product.name,
          product.sku,
          product.model,
          product.brand,
          supplier.name,
          supplier.code,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));

      const matchesSupplier =
        supplierFilter === "all" ||
        String(row.supplier_id) === String(supplierFilter);

      const matchesCategory =
        categoryFilter === "all" ||
        String(product.category || "") === String(categoryFilter);

      const isExpired =
        row.is_valid === false ||
        (row.valid_until &&
          new Date(row.valid_until).setHours(23, 59, 59, 999) <
            Date.now());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "valid" && !isExpired) ||
        (statusFilter === "expired" && isExpired) ||
        (statusFilter === "preferred" && row.is_preferred);

      return (
        matchesSearch &&
        matchesSupplier &&
        matchesCategory &&
        matchesStatus
      );
    });
  }, [rows, search, supplierFilter, categoryFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      valid: rows.filter((r) => r.is_valid !== false).length,
      productsWithPrices: new Set(rows.map((r) => r.product_id)).size,
      suppliersUsed: new Set(rows.map((r) => r.supplier_id)).size,
    };
  }, [rows]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview("");
    setMessage("");
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      ...emptyForm,
      mode: "existing",
      product_id: row.product_id ? String(row.product_id) : "",
      supplier_id: row.supplier_id ? String(row.supplier_id) : "",
      unit_price: row.unit_price ?? "",
      currency: row.currency || "SAR",
      minimum_order_quantity: row.minimum_order_quantity ?? 1,
      lead_time_days: row.lead_time_days ?? "",
      valid_from: row.valid_from ? String(row.valid_from).slice(0, 10) : "",
      valid_until: row.valid_until ? String(row.valid_until).slice(0, 10) : "",
      payment_terms: row.payment_terms || "",
      warranty_terms: row.warranty_terms || "",
      notes: row.notes || "",
      is_preferred: Boolean(row.is_preferred),
      is_active: row.is_active !== false,
    });

    setImageFile(null);
    setImagePreview("");
    setMessage("");
    setModalOpen(true);
  };

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleImage = (file) => {
    if (!file) {
      setImageFile(null);
      setImagePreview("");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const createProductFromSupplier = async () => {
    if (!form.new_name.trim() || !form.new_sku.trim()) {
      throw new Error("اسم المنتج و SKU مطلوبان لإنشاء منتج جديد.");
    }

    const data = new FormData();

    data.append("name", form.new_name.trim());
    data.append("sku", form.new_sku.trim());
    data.append("category", form.new_category || "");
    data.append("brand", form.new_brand || "");
    data.append("model", form.new_model || "");
    data.append("unit", form.new_unit || "قطعة");
    data.append("description", form.new_description || "");
    data.append("barcode", form.new_barcode || "");
    data.append("cost_price", String(Number(form.unit_price || 0)));
    data.append(
      "default_sale_price",
      String(Number(form.new_default_sale_price || 0))
    );
    data.append("tax_rate", String(Number(form.new_tax_rate || 0)));
    data.append("opening_stock", "0");
    data.append("minimum_stock", "0");
    data.append("is_active", "1");

    if (imageFile) {
      data.append("image", imageFile);
    }

    const response = await fetch(`${API_URL}/products`, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: data,
    });

    const json = await response.json();

    if (!response.ok || !json?.success) {
      const firstValidationError = json?.errors
        ? Object.values(json.errors)?.[0]?.[0]
        : null;

      throw new Error(
        firstValidationError ||
          json?.message ||
          "تعذر إنشاء المنتج الجديد."
      );
    }

    return json.data;
  };

  const submitForm = async (event) => {
    event.preventDefault();

    if (!form.supplier_id || form.unit_price === "") {
      setMessage("اختر المورد وأدخل سعر الوحدة.");
      return;
    }

    if (form.mode === "existing" && !form.product_id) {
      setMessage("اختر المنتج.");
      return;
    }

    try {
      setSaving(true);
      setMessage("");

      let productId = form.product_id;

      if (!editingId && form.mode === "new") {
        const createdProduct = await createProductFromSupplier();
        productId = createdProduct.id;
      }

      const payload = {
        product_id: Number(productId),
        supplier_id: Number(form.supplier_id),
        unit_price: Number(form.unit_price),
        currency: form.currency || "SAR",
        minimum_order_quantity: Number(form.minimum_order_quantity || 1),
        lead_time_days:
          form.lead_time_days === "" ? null : Number(form.lead_time_days),
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        payment_terms: form.payment_terms || null,
        warranty_terms: form.warranty_terms || null,
        notes: form.notes || null,
        is_preferred: Boolean(form.is_preferred),
        is_active: Boolean(form.is_active),
      };

      const url = editingId
        ? `${API_URL}/supplier-prices/${editingId}`
        : `${API_URL}/supplier-prices`;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json();

      if (!response.ok || !json?.success) {
        const firstValidationError = json?.errors
          ? Object.values(json.errors)?.[0]?.[0]
          : null;

        throw new Error(
          firstValidationError ||
            json?.message ||
            "تعذر حفظ سعر المورد."
        );
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setImageFile(null);
      setImagePreview("");
      await loadAll();
    } catch (err) {
      console.error(err);
      setMessage(err.message || "تعذر حفظ البيانات.");
    } finally {
      setSaving(false);
    }
  };

  const selectedProduct = products.find(
    (p) => String(p.id) === String(form.product_id)
  );

  const selectedProductImage = imageUrl(selectedProduct?.image_path);

  return (
    <section className="sp-page" dir="rtl">
      <style>{`
        .sp-page{color:#242a3a;font-family:inherit;padding-bottom:30px;max-width:100%;overflow:hidden}
        .sp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:18px}
        .sp-kicker{font-size:10px;font-weight:900;color:#6b5cf6;margin-bottom:5px}
        .sp-head h1{margin:0;font-size:24px;line-height:1.2}
        .sp-head p{margin:7px 0 0;color:#959cac;font-size:11px}
        .sp-primary{border:0;background:#6757f6;color:#fff;border-radius:11px;min-height:38px;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:7px;cursor:pointer;font-family:inherit;font-weight:900;font-size:10px;box-shadow:0 8px 20px rgba(103,87,246,.18)}
        .sp-secondary{border:1px solid #e2e5ed;background:#fff;color:#4d5569;border-radius:10px;min-height:36px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;font-family:inherit;font-weight:800;font-size:9px}
        .sp-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
        .sp-stat{background:#fff;border:1px solid #e9ebf2;border-radius:15px;padding:14px;display:flex;justify-content:space-between;align-items:center;min-height:74px}
        .sp-stat small{color:#9ba2b1;font-size:8px;font-weight:800;display:block;margin-bottom:6px}
        .sp-stat strong{font-size:19px;line-height:1}
        .sp-stat-icon{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;background:#f2f0ff;color:#6757f6}
        .sp-stat:nth-child(2) .sp-stat-icon{background:#edf9f4;color:#1b9a70}
        .sp-stat:nth-child(3) .sp-stat-icon{background:#fff6e8;color:#d78a23}
        .sp-stat:nth-child(4) .sp-stat-icon{background:#eef6ff;color:#367bd7}
        .sp-card{background:#fff;border:1px solid #e9ebf2;border-radius:16px;overflow:hidden;max-width:100%}
        .sp-toolbar{padding:13px;display:grid;grid-template-columns:minmax(240px,1.6fr) repeat(3,minmax(135px,.7fr)) auto;gap:9px;border-bottom:1px solid #edf0f5;align-items:center}
        .sp-field{position:relative}
        .sp-field svg{position:absolute;right:11px;top:50%;transform:translateY(-50%);color:#9aa1b2;pointer-events:none}
        .sp-input,.sp-select{width:100%;min-height:36px;border:1px solid #e4e7ef;border-radius:9px;background:#fff;font-family:inherit;font-size:9px;color:#3e4658;outline:none;padding:0 11px;box-sizing:border-box}
        .sp-field .sp-input{padding-right:34px}
        .sp-input:focus,.sp-select:focus,.sp-textarea:focus{border-color:#b8b0ff;box-shadow:0 0 0 3px rgba(103,87,246,.07)}
        .sp-table-wrap{overflow:auto;max-width:100%}
        .sp-table{width:100%;border-collapse:collapse;min-width:980px}
        .sp-table th{background:#fafbfc;color:#8e95a7;font-size:8px;font-weight:900;padding:11px 10px;text-align:right;border-bottom:1px solid #e9ecf2;white-space:nowrap}
        .sp-table td{padding:12px 10px;border-bottom:1px solid #eef0f4;font-size:9px;vertical-align:middle}
        .sp-product{display:flex;align-items:center;gap:9px;min-width:180px}
        .sp-product-image{width:42px;height:42px;border-radius:11px;border:1px solid #eceef4;background:#f8f9fb;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto}
        .sp-product-image img{width:100%;height:100%;object-fit:contain}
        .sp-product strong{display:block;font-size:9px;margin-bottom:3px}
        .sp-product small{color:#a0a6b4;font-size:7px}
        .sp-supplier strong{display:block;margin-bottom:3px}
        .sp-supplier small{color:#a1a7b5;font-size:7px}
        .sp-price{font-weight:900;font-size:10px;color:#2d3345;white-space:nowrap}
        .sp-badge{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:4px 7px;font-size:7px;font-weight:900;white-space:nowrap}
        .sp-badge.valid{background:#eaf8f2;color:#15825e}
        .sp-badge.expired{background:#fff0f0;color:#cc555b}
        .sp-badge.preferred{background:#fff7e8;color:#bc7717;margin-right:4px}
        .sp-icon-btn{width:29px;height:29px;border:1px solid #e5e8ef;background:#fff;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;color:#657086;cursor:pointer}
        .sp-empty{padding:38px 20px;text-align:center;color:#999fac;font-size:10px}
        .sp-message{margin:0 0 12px;border:1px solid #f0d7d8;background:#fff7f7;color:#b84f55;border-radius:10px;padding:9px 11px;font-size:9px;font-weight:700}
        .sp-modal-backdrop{position:fixed;inset:0;z-index:1600;background:rgba(26,31,45,.32);display:flex;align-items:center;justify-content:center;padding:18px}
        .sp-modal{width:min(920px,96vw);max-height:92vh;overflow:auto;background:#fff;border:1px solid #e7e9ef;border-radius:18px;box-shadow:0 28px 80px rgba(25,30,45,.22)}
        .sp-modal-head{position:sticky;top:0;z-index:3;background:#fff;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 18px;border-bottom:1px solid #edf0f4}
        .sp-modal-head h3{margin:0;font-size:14px}
        .sp-modal-head p{margin:4px 0 0;font-size:8px;color:#9ba1af}
        .sp-close{width:32px;height:32px;border:1px solid #e5e8ef;background:#fff;border-radius:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#687084}
        .sp-form{padding:16px 18px 18px}
        .sp-mode-tabs{display:flex;gap:8px;margin-bottom:15px}
        .sp-mode{flex:1;border:1px solid #e5e7ef;background:#fafbfc;color:#697184;border-radius:11px;padding:11px;cursor:pointer;font-family:inherit;font-weight:900;font-size:9px}
        .sp-mode.active{background:#f2f0ff;border-color:#bcb5ff;color:#6354f5}
        .sp-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
        .sp-form-group label{display:block;font-size:8px;color:#737b8e;font-weight:900;margin-bottom:5px}
        .sp-form-group.full{grid-column:1/-1}
        .sp-textarea{width:100%;min-height:70px;border:1px solid #e4e7ef;border-radius:10px;padding:10px;resize:vertical;box-sizing:border-box;font-family:inherit;font-size:9px;outline:none}
        .sp-new-product-box{grid-column:1/-1;border:1px solid #e8eaf1;background:#fbfbfd;border-radius:14px;padding:14px}
        .sp-new-product-head{display:flex;align-items:center;gap:8px;margin-bottom:12px}
        .sp-new-product-head strong{font-size:10px}
        .sp-upload{border:1px dashed #cfc9ff;background:#f8f7ff;border-radius:12px;min-height:116px;padding:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;cursor:pointer}
        .sp-upload img{width:100%;height:116px;object-fit:contain}
        .sp-upload-placeholder{text-align:center;color:#887cf8}
        .sp-upload-placeholder small{display:block;color:#9ba1b2;margin-top:5px;font-size:7px}
        .sp-upload input{position:absolute;inset:0;opacity:0;cursor:pointer}
        .sp-product-preview{border:1px solid #eceef4;background:#fafbfc;border-radius:11px;padding:10px;display:flex;align-items:center;gap:9px;margin-top:7px}
        .sp-product-preview strong{font-size:9px}
        .sp-product-preview small{display:block;color:#a0a6b4;font-size:7px;margin-top:3px}
        .sp-checks{display:flex;align-items:center;gap:16px;margin-top:5px}
        .sp-check{display:flex;align-items:center;gap:6px;font-size:8px;color:#596174;font-weight:800}
        .sp-form-actions{display:flex;justify-content:flex-start;gap:8px;border-top:1px solid #edf0f4;margin-top:16px;padding-top:14px}
        @media(max-width:1100px){.sp-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sp-toolbar{grid-template-columns:1fr 1fr}.sp-toolbar .sp-search-box{grid-column:1/-1}}
        @media(max-width:700px){.sp-head{flex-direction:column}.sp-stat-grid{grid-template-columns:1fr}.sp-toolbar{grid-template-columns:1fr}.sp-toolbar .sp-search-box{grid-column:auto}.sp-form-grid{grid-template-columns:1fr}.sp-new-product-box{grid-column:auto}}
      `}</style>

      <div className="sp-head">
        <div>
          <div className="sp-kicker">الموردين / مركز التسعير</div>
          <h1>أسعار الموردين</h1>
          <p>
            أدخل أسعار المنتجات الحالية أو أنشئ منتجًا جديدًا من عرض المورد
            مباشرة.
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="sp-secondary"
            onClick={() => onNavigate?.("pricing")}
          >
            العودة لمركز التسعير
          </button>

          <button type="button" className="sp-primary" onClick={openCreate}>
            <Plus size={15} />
            إضافة سعر مورد
          </button>
        </div>
      </div>

      {error && <div className="sp-message">{error}</div>}

      <div className="sp-stat-grid">
        <div className="sp-stat">
          <div>
            <small>إجمالي أسعار الموردين</small>
            <strong>{stats.total}</strong>
          </div>
          <span className="sp-stat-icon">
            <BadgeDollarSign size={18} />
          </span>
        </div>

        <div className="sp-stat">
          <div>
            <small>الأسعار السارية</small>
            <strong>{stats.valid}</strong>
          </div>
          <span className="sp-stat-icon">
            <CheckCircle2 size={18} />
          </span>
        </div>

        <div className="sp-stat">
          <div>
            <small>منتجات لها أسعار</small>
            <strong>{stats.productsWithPrices}</strong>
          </div>
          <span className="sp-stat-icon">
            <Boxes size={18} />
          </span>
        </div>

        <div className="sp-stat">
          <div>
            <small>موردون مستخدمون</small>
            <strong>{stats.suppliersUsed}</strong>
          </div>
          <span className="sp-stat-icon">
            <Users size={18} />
          </span>
        </div>
      </div>

      <div className="sp-card">
        <div className="sp-toolbar">
          <div className="sp-field sp-search-box">
            <Search size={14} />
            <input
              className="sp-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن منتج، SKU، مورد، موديل..."
            />
          </div>

          <select
            className="sp-select"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="all">كل الموردين</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>

          <select
            className="sp-select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">كل الفئات</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>

          <select
            className="sp-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">كل الحالات</option>
            <option value="valid">ساري</option>
            <option value="expired">منتهي</option>
            <option value="preferred">مورد مفضل</option>
          </select>

          <button type="button" className="sp-secondary" onClick={loadAll}>
            <RefreshCcw size={13} />
            تحديث
          </button>
        </div>

        <div className="sp-table-wrap">
          {loading ? (
            <div className="sp-empty">جاري تحميل أسعار الموردين...</div>
          ) : filteredRows.length ? (
            <table className="sp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>المنتج</th>
                  <th>المورد</th>
                  <th>سعر الوحدة</th>
                  <th>الحد الأدنى</th>
                  <th>مدة التوريد</th>
                  <th>آخر تحديث</th>
                  <th>صلاحية السعر</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row, index) => {
                  const expired =
                    row.is_valid === false ||
                    (row.valid_until &&
                      new Date(row.valid_until).setHours(23, 59, 59, 999) <
                        Date.now());

                  return (
                    <tr key={row.id}>
                      <td>{index + 1}</td>

                      <td>
                        <div className="sp-product">
                          <div className="sp-product-image">
                            {row.product?.image_path ? (
                              <img
                                src={imageUrl(row.product.image_path)}
                                alt={row.product?.name || ""}
                              />
                            ) : (
                              <PackageSearch size={17} color="#9aa1b2" />
                            )}
                          </div>

                          <div>
                            <strong>{row.product?.name || "—"}</strong>
                            <small>
                              {row.product?.sku || "بدون SKU"}
                              {row.product?.brand
                                ? ` · ${row.product.brand}`
                                : ""}
                            </small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="sp-supplier">
                          <strong>{row.supplier?.name || "—"}</strong>
                          <small>
                            {row.supplier?.code ||
                              row.supplier?.phone ||
                              "مورد"}
                          </small>
                        </div>
                      </td>

                      <td>
                        <span className="sp-price">
                          {money(row.unit_price)} ر.س
                        </span>
                      </td>

                      <td>{row.minimum_order_quantity || 1}</td>

                      <td>
                        {row.lead_time_days !== null &&
                        row.lead_time_days !== undefined
                          ? `${row.lead_time_days} يوم`
                          : "—"}
                      </td>

                      <td>{dateText(row.updated_at)}</td>
                      <td>{dateText(row.valid_until)}</td>

                      <td>
                        <span
                          className={`sp-badge ${
                            expired ? "expired" : "valid"
                          }`}
                        >
                          {expired ? (
                            <Clock3 size={10} />
                          ) : (
                            <CheckCircle2 size={10} />
                          )}
                          {expired ? "منتهي" : "ساري"}
                        </span>

                        {row.is_preferred && (
                          <span className="sp-badge preferred">مفضل</span>
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="sp-icon-btn"
                          title="تعديل السعر"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="sp-empty">
              لا توجد أسعار مطابقة للفلاتر الحالية.
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div
          className="sp-modal-backdrop"
          onClick={() => setModalOpen(false)}
        >
          <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sp-modal-head">
              <div>
                <h3>
                  {editingId ? "تعديل سعر المورد" : "إضافة سعر مورد جديد"}
                </h3>
                <p>
                  يمكنك اختيار منتج موجود أو إنشاء منتج جديد مع الصورة من نفس
                  النافذة.
                </p>
              </div>

              <button
                type="button"
                className="sp-close"
                onClick={() => setModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form className="sp-form" onSubmit={submitForm}>
              {message && <div className="sp-message">{message}</div>}

              {!editingId && (
                <div className="sp-mode-tabs">
                  <button
                    type="button"
                    className={`sp-mode ${
                      form.mode === "existing" ? "active" : ""
                    }`}
                    onClick={() => setField("mode", "existing")}
                  >
                    منتج موجود
                  </button>

                  <button
                    type="button"
                    className={`sp-mode ${
                      form.mode === "new" ? "active" : ""
                    }`}
                    onClick={() => setField("mode", "new")}
                  >
                    + إنشاء منتج جديد
                  </button>
                </div>
              )}

              <div className="sp-form-grid">
                {(editingId || form.mode === "existing") && (
                  <div className="sp-form-group full">
                    <label>المنتج *</label>
                    <select
                      className="sp-select"
                      value={form.product_id}
                      disabled={Boolean(editingId)}
                      onChange={(e) =>
                        setField("product_id", e.target.value)
                      }
                    >
                      <option value="">اختر المنتج</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                          {product.sku ? ` - ${product.sku}` : ""}
                        </option>
                      ))}
                    </select>

                    {selectedProduct && (
                      <div className="sp-product-preview">
                        <div className="sp-product-image">
                          {selectedProductImage ? (
                            <img
                              src={selectedProductImage}
                              alt={selectedProduct.name}
                            />
                          ) : (
                            <PackageSearch size={17} color="#8e95a8" />
                          )}
                        </div>
                        <div>
                          <strong>{selectedProduct.name}</strong>
                          <small>
                            {selectedProduct.sku || "بدون SKU"}
                            {selectedProduct.category
                              ? ` · ${selectedProduct.category}`
                              : ""}
                          </small>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!editingId && form.mode === "new" && (
                  <div className="sp-new-product-box">
                    <div className="sp-new-product-head">
                      <ImagePlus size={16} color="#6757f6" />
                      <strong>بيانات المنتج الجديد</strong>
                    </div>

                    <div className="sp-form-grid">
                      <div className="sp-form-group">
                        <label>صورة المنتج</label>

                        <label className="sp-upload">
                          {imagePreview ? (
                            <img src={imagePreview} alt="معاينة المنتج" />
                          ) : (
                            <div className="sp-upload-placeholder">
                              <Upload size={21} />
                              <div>اختر صورة المنتج</div>
                              <small>PNG / JPG / WEBP - حتى 5MB</small>
                            </div>
                          )}

                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={(e) =>
                              handleImage(e.target.files?.[0] || null)
                            }
                          />
                        </label>
                      </div>

                      <div className="sp-form-group">
                        <label>اسم المنتج *</label>
                        <input
                          className="sp-input"
                          value={form.new_name}
                          onChange={(e) =>
                            setField("new_name", e.target.value)
                          }
                          placeholder="مثال: Hikvision 8MP Bullet Camera"
                        />

                        <label style={{ marginTop: 10 }}>SKU / Part Number *</label>
                        <input
                          className="sp-input"
                          value={form.new_sku}
                          onChange={(e) =>
                            setField("new_sku", e.target.value)
                          }
                          placeholder="CAM-8MP-001"
                        />
                      </div>

                      <div className="sp-form-group">
                        <label>الماركة</label>
                        <input
                          className="sp-input"
                          value={form.new_brand}
                          onChange={(e) =>
                            setField("new_brand", e.target.value)
                          }
                          placeholder="Hikvision"
                        />
                      </div>

                      <div className="sp-form-group">
                        <label>الموديل</label>
                        <input
                          className="sp-input"
                          value={form.new_model}
                          onChange={(e) =>
                            setField("new_model", e.target.value)
                          }
                          placeholder="DS-2CD..."
                        />
                      </div>

                      <div className="sp-form-group">
                        <label>التصنيف</label>
                        <input
                          className="sp-input"
                          value={form.new_category}
                          onChange={(e) =>
                            setField("new_category", e.target.value)
                          }
                          placeholder="كاميرات مراقبة"
                        />
                      </div>

                      <div className="sp-form-group">
                        <label>الوحدة</label>
                        <select
                          className="sp-select"
                          value={form.new_unit}
                          onChange={(e) =>
                            setField("new_unit", e.target.value)
                          }
                        >
                          <option value="قطعة">قطعة</option>
                          <option value="متر">متر</option>
                          <option value="لفة">لفة</option>
                          <option value="علبة">علبة</option>
                          <option value="طقم">طقم</option>
                          <option value="جهاز">جهاز</option>
                        </select>
                      </div>

                      <div className="sp-form-group">
                        <label>سعر البيع الافتراضي</label>
                        <input
                          className="sp-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.new_default_sale_price}
                          onChange={(e) =>
                            setField(
                              "new_default_sale_price",
                              e.target.value
                            )
                          }
                          placeholder="0.00"
                        />
                      </div>

                      <div className="sp-form-group">
                        <label>الضريبة %</label>
                        <input
                          className="sp-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.new_tax_rate}
                          onChange={(e) =>
                            setField("new_tax_rate", e.target.value)
                          }
                        />
                      </div>

                      <div className="sp-form-group">
                        <label>Barcode</label>
                        <input
                          className="sp-input"
                          value={form.new_barcode}
                          onChange={(e) =>
                            setField("new_barcode", e.target.value)
                          }
                          placeholder="اختياري"
                        />
                      </div>

                      <div className="sp-form-group full">
                        <label>وصف المنتج</label>
                        <textarea
                          className="sp-textarea"
                          value={form.new_description}
                          onChange={(e) =>
                            setField("new_description", e.target.value)
                          }
                          placeholder="وصف مختصر أو المواصفات الأساسية..."
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="sp-form-group">
                  <label>المورد *</label>
                  <select
                    className="sp-select"
                    value={form.supplier_id}
                    disabled={Boolean(editingId)}
                    onChange={(e) =>
                      setField("supplier_id", e.target.value)
                    }
                  >
                    <option value="">اختر المورد</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sp-form-group">
                  <label>سعر الوحدة *</label>
                  <input
                    className="sp-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unit_price}
                    onChange={(e) =>
                      setField("unit_price", e.target.value)
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className="sp-form-group">
                  <label>العملة</label>
                  <select
                    className="sp-select"
                    value={form.currency}
                    onChange={(e) => setField("currency", e.target.value)}
                  >
                    <option value="SAR">SAR - ريال سعودي</option>
                    <option value="USD">USD - دولار</option>
                    <option value="AED">AED - درهم</option>
                  </select>
                </div>

                <div className="sp-form-group">
                  <label>الحد الأدنى للطلب</label>
                  <input
                    className="sp-input"
                    type="number"
                    min="0"
                    step="1"
                    value={form.minimum_order_quantity}
                    onChange={(e) =>
                      setField("minimum_order_quantity", e.target.value)
                    }
                  />
                </div>

                <div className="sp-form-group">
                  <label>مدة التوريد بالأيام</label>
                  <input
                    className="sp-input"
                    type="number"
                    min="0"
                    step="1"
                    value={form.lead_time_days}
                    onChange={(e) =>
                      setField("lead_time_days", e.target.value)
                    }
                    placeholder="مثال: 5"
                  />
                </div>

                <div className="sp-form-group">
                  <label>ساري من</label>
                  <input
                    className="sp-input"
                    type="date"
                    value={form.valid_from}
                    onChange={(e) =>
                      setField("valid_from", e.target.value)
                    }
                  />
                </div>

                <div className="sp-form-group">
                  <label>ساري حتى</label>
                  <input
                    className="sp-input"
                    type="date"
                    value={form.valid_until}
                    onChange={(e) =>
                      setField("valid_until", e.target.value)
                    }
                  />
                </div>

                <div className="sp-form-group full">
                  <label>شروط الدفع</label>
                  <input
                    className="sp-input"
                    value={form.payment_terms}
                    onChange={(e) =>
                      setField("payment_terms", e.target.value)
                    }
                    placeholder="مثال: 30% مقدم - 70% عند التوريد"
                  />
                </div>

                <div className="sp-form-group full">
                  <label>شروط الضمان</label>
                  <input
                    className="sp-input"
                    value={form.warranty_terms}
                    onChange={(e) =>
                      setField("warranty_terms", e.target.value)
                    }
                    placeholder="مثال: سنة ضد عيوب الصناعة"
                  />
                </div>

                <div className="sp-form-group full">
                  <label>ملاحظات</label>
                  <textarea
                    className="sp-textarea"
                    value={form.notes}
                    onChange={(e) => setField("notes", e.target.value)}
                    placeholder="أي تفاصيل إضافية خاصة بهذا السعر..."
                  />
                </div>

                <div className="sp-form-group full">
                  <div className="sp-checks">
                    <label className="sp-check">
                      <input
                        type="checkbox"
                        checked={form.is_preferred}
                        onChange={(e) =>
                          setField("is_preferred", e.target.checked)
                        }
                      />
                      المورد المفضل لهذا المنتج
                    </label>

                    <label className="sp-check">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) =>
                          setField("is_active", e.target.checked)
                        }
                      />
                      السعر نشط
                    </label>
                  </div>
                </div>
              </div>

              <div className="sp-form-actions">
                <button
                  type="submit"
                  className="sp-primary"
                  disabled={saving}
                >
                  {saving
                    ? "جاري الحفظ..."
                    : editingId
                    ? "حفظ التعديلات"
                    : form.mode === "new"
                    ? "إنشاء المنتج وإضافة السعر"
                    : "إضافة السعر"}
                </button>

                <button
                  type="button"
                  className="sp-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
