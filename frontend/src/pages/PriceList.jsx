import { useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  RefreshCw,
  Package,
  ShoppingCart,
  BadgeDollarSign,
  TrendingUp,
  WalletCards,
  Pencil,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  Boxes,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const money = (value) => {
  const number = Number(value || 0);

  return new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
};

const marginPercent = (cost, sale) => {
  const saleValue = Number(sale || 0);
  const costValue = Number(cost || 0);

  if (saleValue <= 0) return 0;

  return ((saleValue - costValue) / saleValue) * 100;
};

const profitAmount = (cost, sale) =>
  Number(sale || 0) - Number(cost || 0);

const emptyEditState = {
  id: null,
  name: "",
  sku: "",
  category: "",
  brand: "",
  model: "",
  unit: "",
  cost_price: "",
  default_sale_price: "",
  tax_rate: "",
  stock_quantity: "",
  minimum_stock: "",
  is_active: true,
};

export default function PriceList() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [brand, setBrand] = useState("all");
  const [status, setStatus] = useState("all");

  const [editProduct, setEditProduct] =
    useState(emptyEditState);

  const [isEditOpen, setIsEditOpen] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] =
    useState("");

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/products`
      );

      if (!response.ok) {
        throw new Error(
          "تعذر تحميل قائمة المنتجات."
        );
      }

      const result = await response.json();

      const data = Array.isArray(result)
        ? result
        : Array.isArray(result?.data)
        ? result.data
        : [];

      setProducts(data);
    } catch (err) {
      setError(
        err.message ||
          "حدث خطأ أثناء تحميل المنتجات."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const categories = useMemo(() => {
    return [
      ...new Set(
        products
          .map((item) => item.category)
          .filter(Boolean)
      ),
    ];
  }, [products]);

  const brands = useMemo(() => {
    return [
      ...new Set(
        products
          .map((item) => item.brand)
          .filter(Boolean)
      ),
    ];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const searchable = [
        product.name,
        product.sku,
        product.barcode,
        product.category,
        product.brand,
        product.model,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !query || searchable.includes(query);

      const matchesCategory =
        category === "all" ||
        product.category === category;

      const matchesBrand =
        brand === "all" ||
        product.brand === brand;

      const isActive =
        product.is_active === true ||
        product.is_active === 1 ||
        product.is_active === "1";

      const matchesStatus =
        status === "all" ||
        (status === "active" && isActive) ||
        (status === "inactive" && !isActive);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesBrand &&
        matchesStatus
      );
    });
  }, [
    products,
    search,
    category,
    brand,
    status,
  ]);

  const stats = useMemo(() => {
    const count = products.length;

    const avgCost =
      count > 0
        ? products.reduce(
            (sum, item) =>
              sum +
              Number(item.cost_price || 0),
            0
          ) / count
        : 0;

    const avgSale =
      count > 0
        ? products.reduce(
            (sum, item) =>
              sum +
              Number(
                item.default_sale_price || 0
              ),
            0
          ) / count
        : 0;

    const averageMargin =
      count > 0
        ? products.reduce(
            (sum, item) =>
              sum +
              marginPercent(
                item.cost_price,
                item.default_sale_price
              ),
            0
          ) / count
        : 0;

    const inventoryValue = products.reduce(
      (sum, item) =>
        sum +
        Number(item.stock_quantity || 0) *
          Number(item.cost_price || 0),
      0
    );

    return {
      count,
      avgCost,
      avgSale,
      averageMargin,
      inventoryValue,
    };
  }, [products]);

  const openEdit = (product) => {
    setEditProduct({
      ...emptyEditState,
      ...product,
      is_active:
        product.is_active === true ||
        product.is_active === 1 ||
        product.is_active === "1",
    });

    setSuccessMessage("");
    setIsEditOpen(true);
  };

  const handleEditChange = (key, value) => {
    setEditProduct((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const saveProduct = async (event) => {
    event.preventDefault();

    if (!editProduct?.id) return;

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const payload = {
        ...editProduct,
        cost_price: Number(
          editProduct.cost_price || 0
        ),
        default_sale_price: Number(
          editProduct.default_sale_price || 0
        ),
        tax_rate: Number(
          editProduct.tax_rate || 0
        ),
        stock_quantity: Number(
          editProduct.stock_quantity || 0
        ),
        minimum_stock: Number(
          editProduct.minimum_stock || 0
        ),
        is_active: Boolean(
          editProduct.is_active
        ),
      };

      const response = await fetch(
        `${API_URL}/products/${editProduct.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        const backendMessage =
          result?.message ||
          Object.values(
            result?.errors || {}
          )
            .flat()
            .join(" ");

        throw new Error(
          backendMessage ||
            "تعذر تحديث بيانات المنتج."
        );
      }

      setProducts((current) =>
        current.map((product) =>
          product.id === editProduct.id
            ? {
                ...product,
                ...(result?.data || payload),
              }
            : product
        )
      );

      setSuccessMessage(
        "تم تحديث سعر المنتج بنجاح."
      );

      setTimeout(() => {
        setIsEditOpen(false);
        setSuccessMessage("");
      }, 700);
    } catch (err) {
      setError(
        err.message ||
          "حدث خطأ أثناء تحديث المنتج."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="price-list-page" dir="rtl">
      <style>{`
        .price-list-page {
          --pl-purple: #635bff;
          --pl-purple-soft: #f2f0ff;
          --pl-text: #172033;
          --pl-muted: #7a8499;
          --pl-border: #e8ebf2;
          --pl-card: #ffffff;
          --pl-bg: #f7f8fc;
          --pl-green: #12a872;
          --pl-green-soft: #e9faf3;
          --pl-orange: #f59e0b;
          --pl-orange-soft: #fff6df;
          --pl-blue: #3b82f6;
          --pl-blue-soft: #edf5ff;
          --pl-red: #ef4444;
          --pl-shadow: 0 10px 28px rgba(37, 43, 67, 0.06);
          color: var(--pl-text);
        }

        .pl-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
          margin-bottom: 22px;
        }

        .pl-title-wrap h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
        }

        .pl-title-wrap p {
          margin: 7px 0 0;
          color: var(--pl-muted);
          font-size: 14px;
        }

        .pl-refresh {
          border: 1px solid var(--pl-border);
          background: white;
          height: 44px;
          padding: 0 16px;
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          color: var(--pl-text);
          font-weight: 700;
        }

        .pl-stats {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 18px;
        }

        .pl-stat-card {
          background: var(--pl-card);
          border: 1px solid var(--pl-border);
          box-shadow: var(--pl-shadow);
          border-radius: 16px;
          padding: 17px;
          min-height: 120px;
        }

        .pl-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 17px;
        }

        .pl-stat-label {
          color: var(--pl-muted);
          font-size: 13px;
          font-weight: 700;
        }

        .pl-stat-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: grid;
          place-items: center;
        }

        .pl-stat-icon.purple {
          color: var(--pl-purple);
          background: var(--pl-purple-soft);
        }

        .pl-stat-icon.orange {
          color: var(--pl-orange);
          background: var(--pl-orange-soft);
        }

        .pl-stat-icon.green {
          color: var(--pl-green);
          background: var(--pl-green-soft);
        }

        .pl-stat-icon.blue {
          color: var(--pl-blue);
          background: var(--pl-blue-soft);
        }

        .pl-stat-value {
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
        }

        .pl-stat-sub {
          margin-top: 7px;
          font-size: 12px;
          color: var(--pl-muted);
        }

        .pl-toolbar {
          background: white;
          border: 1px solid var(--pl-border);
          box-shadow: var(--pl-shadow);
          border-radius: 16px;
          padding: 15px;
          display: grid;
          grid-template-columns: minmax(260px, 2fr) repeat(3, minmax(150px, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .pl-search {
          position: relative;
        }

        .pl-search svg {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--pl-muted);
        }

        .pl-search input,
        .pl-toolbar select {
          width: 100%;
          height: 44px;
          border: 1px solid var(--pl-border);
          border-radius: 11px;
          background: #fbfcfe;
          outline: none;
          font: inherit;
          color: var(--pl-text);
        }

        .pl-search input {
          padding: 0 42px 0 14px;
        }

        .pl-toolbar select {
          padding: 0 12px;
        }

        .pl-table-card {
          background: white;
          border: 1px solid var(--pl-border);
          box-shadow: var(--pl-shadow);
          border-radius: 17px;
          overflow: hidden;
        }

        .pl-table-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 17px 18px;
          border-bottom: 1px solid var(--pl-border);
        }

        .pl-table-head strong {
          font-size: 15px;
        }

        .pl-result-count {
          color: var(--pl-muted);
          font-size: 13px;
        }

        .pl-table-wrap {
          overflow-x: auto;
        }

        .pl-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1180px;
        }

        .pl-table th {
          background: #fafbfe;
          color: #737d92;
          font-size: 12px;
          font-weight: 800;
          padding: 13px 12px;
          text-align: right;
          white-space: nowrap;
          border-bottom: 1px solid var(--pl-border);
        }

        .pl-table td {
          padding: 14px 12px;
          font-size: 13px;
          border-bottom: 1px solid #f0f2f7;
          vertical-align: middle;
        }

        .pl-product {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 220px;
        }

        .pl-product-image {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: #f3f5f9;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          overflow: hidden;
        }

        .pl-product-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .pl-product strong {
          display: block;
          font-size: 13px;
          margin-bottom: 3px;
        }

        .pl-product small {
          color: var(--pl-muted);
          font-size: 11px;
        }

        .pl-price {
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }

        .pl-profit {
          color: var(--pl-green);
          font-weight: 800;
        }

        .pl-margin {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: var(--pl-green-soft);
          color: var(--pl-green);
          border-radius: 999px;
          padding: 5px 8px;
          font-weight: 800;
          font-size: 11px;
        }

        .pl-stock {
          font-weight: 800;
        }

        .pl-stock.low {
          color: var(--pl-orange);
        }

        .pl-status {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 800;
        }

        .pl-status.active {
          color: var(--pl-green);
          background: var(--pl-green-soft);
        }

        .pl-status.inactive {
          color: var(--pl-red);
          background: #fff0f0;
        }

        .pl-edit-btn {
          border: 1px solid var(--pl-border);
          background: white;
          color: var(--pl-purple);
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          cursor: pointer;
        }

        .pl-empty {
          padding: 48px 20px;
          text-align: center;
          color: var(--pl-muted);
        }

        .pl-alert {
          margin-bottom: 16px;
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          font-weight: 700;
        }

        .pl-alert.error {
          background: #fff1f2;
          color: #be123c;
          border: 1px solid #fecdd3;
        }

        .pl-alert.success {
          background: var(--pl-green-soft);
          color: var(--pl-green);
          border: 1px solid #c9f3e1;
        }

        .pl-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 999;
          background: rgba(22, 27, 45, 0.42);
          display: grid;
          place-items: center;
          padding: 22px;
        }

        .pl-modal {
          width: min(720px, 100%);
          max-height: calc(100vh - 44px);
          overflow-y: auto;
          background: white;
          border-radius: 20px;
          box-shadow: 0 24px 80px rgba(13, 18, 35, 0.22);
        }

        .pl-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 20px 22px;
          border-bottom: 1px solid var(--pl-border);
        }

        .pl-modal-header h3 {
          margin: 0;
          font-size: 19px;
        }

        .pl-close {
          border: 0;
          background: #f4f5f8;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .pl-form {
          padding: 22px;
        }

        .pl-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 15px;
        }

        .pl-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .pl-field.full {
          grid-column: 1 / -1;
        }

        .pl-field label {
          font-size: 12px;
          font-weight: 800;
          color: #667085;
        }

        .pl-field input,
        .pl-field select {
          height: 44px;
          border: 1px solid var(--pl-border);
          border-radius: 11px;
          padding: 0 12px;
          font: inherit;
          outline: none;
        }

        .pl-price-preview {
          margin-top: 17px;
          border: 1px solid var(--pl-border);
          border-radius: 14px;
          background: #fafbff;
          padding: 15px;
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .pl-preview-item span {
          display: block;
          color: var(--pl-muted);
          font-size: 11px;
          margin-bottom: 5px;
        }

        .pl-preview-item strong {
          font-size: 16px;
        }

        .pl-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 20px;
        }

        .pl-secondary-btn,
        .pl-primary-btn {
          height: 42px;
          border-radius: 11px;
          padding: 0 17px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font: inherit;
          font-weight: 800;
        }

        .pl-secondary-btn {
          background: white;
          border: 1px solid var(--pl-border);
          color: var(--pl-text);
        }

        .pl-primary-btn {
          background: var(--pl-purple);
          color: white;
          border: 1px solid var(--pl-purple);
        }

        .pl-primary-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        @media (max-width: 1250px) {
          .pl-stats {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .pl-toolbar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .pl-stats,
          .pl-toolbar,
          .pl-form-grid,
          .pl-price-preview {
            grid-template-columns: 1fr;
          }

          .pl-header {
            flex-direction: column;
          }
        }
      `}</style>

      <div className="pl-header">
        <div className="pl-title-wrap">
          <h1>قائمة الأسعار</h1>
          <p>
            إدارة أسعار الشراء والبيع وهوامش الربح
            لجميع المنتجات.
          </p>
        </div>

        <button
          type="button"
          className="pl-refresh"
          onClick={loadProducts}
        >
          <RefreshCw size={17} />
          تحديث
        </button>
      </div>

      {error && (
        <div className="pl-alert error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {successMessage && (
        <div className="pl-alert success">
          <CheckCircle2 size={18} />
          {successMessage}
        </div>
      )}

      <section className="pl-stats">
        <StatCard
          icon={Package}
          tone="purple"
          label="إجمالي المنتجات"
          value={stats.count}
          sub="منتج مسجل"
        />

        <StatCard
          icon={ShoppingCart}
          tone="orange"
          label="متوسط سعر الشراء"
          value={`${money(stats.avgCost)} ر.س`}
          sub="متوسط تكلفة المنتجات"
        />

        <StatCard
          icon={BadgeDollarSign}
          tone="purple"
          label="متوسط سعر البيع"
          value={`${money(stats.avgSale)} ر.س`}
          sub="متوسط السعر الافتراضي"
        />

        <StatCard
          icon={TrendingUp}
          tone="blue"
          label="متوسط هامش الربح"
          value={`${stats.averageMargin.toFixed(
            2
          )}%`}
          sub="من سعر البيع"
        />

        <StatCard
          icon={WalletCards}
          tone="green"
          label="قيمة المخزون"
          value={`${money(
            stats.inventoryValue
          )} ر.س`}
          sub="بسعر التكلفة"
        />
      </section>

      <section className="pl-toolbar">
        <div className="pl-search">
          <Search size={18} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="ابحث بالمنتج، الكود، الباركود، البراند أو الموديل..."
          />
        </div>

        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value)
          }
        >
          <option value="all">
            كل الفئات
          </option>

          {categories.map((item) => (
            <option
              key={item}
              value={item}
            >
              {item}
            </option>
          ))}
        </select>

        <select
          value={brand}
          onChange={(event) =>
            setBrand(event.target.value)
          }
        >
          <option value="all">
            كل العلامات
          </option>

          {brands.map((item) => (
            <option
              key={item}
              value={item}
            >
              {item}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
        >
          <option value="all">
            كل الحالات
          </option>
          <option value="active">
            نشط
          </option>
          <option value="inactive">
            غير نشط
          </option>
        </select>
      </section>

      <section className="pl-table-card">
        <div className="pl-table-head">
          <div>
            <strong>
              جميع المنتجات
            </strong>

            <div className="pl-result-count">
              {filteredProducts.length} نتيجة
            </div>
          </div>

          <SlidersHorizontal
            size={19}
            color="#7a8499"
          />
        </div>

        {loading ? (
          <div className="pl-empty">
            جاري تحميل المنتجات...
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="pl-empty">
            لا توجد منتجات مطابقة للبحث.
          </div>
        ) : (
          <div className="pl-table-wrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>الكود / الباركود</th>
                  <th>الفئة</th>
                  <th>البراند / الموديل</th>
                  <th>سعر الشراء</th>
                  <th>سعر البيع</th>
                  <th>الربح</th>
                  <th>هامش الربح</th>
                  <th>المخزون</th>
                  <th>الحالة</th>
                  <th>تعديل</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map(
                  (product) => {
                    const margin =
                      marginPercent(
                        product.cost_price,
                        product.default_sale_price
                      );

                    const profit =
                      profitAmount(
                        product.cost_price,
                        product.default_sale_price
                      );

                    const lowStock =
                      Number(
                        product.stock_quantity ||
                          0
                      ) <=
                      Number(
                        product.minimum_stock ||
                          0
                      );

                    const isActive =
                      product.is_active === true ||
                      product.is_active === 1 ||
                      product.is_active === "1";

                    return (
                      <tr key={product.id}>
                        <td>
                          <div className="pl-product">
                            <div className="pl-product-image">
                              {product.image_path ? (
                                <img
                                  src={
                                    product.image_path
                                  }
                                  alt={
                                    product.name ||
                                    "product"
                                  }
                                />
                              ) : (
                                <Boxes
                                  size={20}
                                  color="#8d96a9"
                                />
                              )}
                            </div>

                            <div>
                              <strong>
                                {product.name ||
                                  "-"}
                              </strong>
                              <small>
                                {product.unit ||
                                  "وحدة"}
                              </small>
                            </div>
                          </div>
                        </td>

                        <td>
                          <strong>
                            {product.sku || "-"}
                          </strong>
                          <div
                            style={{
                              marginTop: 4,
                              color: "#8a93a5",
                              fontSize: 11,
                            }}
                          >
                            {product.barcode || "-"}
                          </div>
                        </td>

                        <td>
                          {product.category ||
                            "-"}
                        </td>

                        <td>
                          <strong>
                            {product.brand ||
                              "-"}
                          </strong>
                          <div
                            style={{
                              marginTop: 4,
                              color: "#8a93a5",
                              fontSize: 11,
                            }}
                          >
                            {product.model ||
                              "-"}
                          </div>
                        </td>

                        <td className="pl-price">
                          {money(
                            product.cost_price
                          )}{" "}
                          ر.س
                        </td>

                        <td className="pl-price">
                          {money(
                            product.default_sale_price
                          )}{" "}
                          ر.س
                        </td>

                        <td className="pl-profit">
                          {money(profit)} ر.س
                        </td>

                        <td>
                          <span className="pl-margin">
                            <TrendingUp
                              size={13}
                            />
                            {margin.toFixed(
                              2
                            )}
                            %
                          </span>
                        </td>

                        <td>
                          <span
                            className={`pl-stock ${
                              lowStock
                                ? "low"
                                : ""
                            }`}
                          >
                            {Number(
                              product.stock_quantity ||
                                0
                            )}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`pl-status ${
                              isActive
                                ? "active"
                                : "inactive"
                            }`}
                          >
                            {isActive
                              ? "نشط"
                              : "غير نشط"}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="pl-edit-btn"
                            onClick={() =>
                              openEdit(
                                product
                              )
                            }
                            title="تعديل السعر"
                          >
                            <Pencil
                              size={16}
                            />
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isEditOpen && (
        <div className="pl-modal-backdrop">
          <div className="pl-modal">
            <div className="pl-modal-header">
              <div>
                <h3>
                  تعديل سعر المنتج
                </h3>

                <div
                  style={{
                    color: "#7a8499",
                    fontSize: 12,
                    marginTop: 5,
                  }}
                >
                  {editProduct.name}
                </div>
              </div>

              <button
                type="button"
                className="pl-close"
                onClick={() =>
                  setIsEditOpen(false)
                }
              >
                <X size={18} />
              </button>
            </div>

            <form
              className="pl-form"
              onSubmit={saveProduct}
            >
              <div className="pl-form-grid">
                <div className="pl-field">
                  <label>
                    اسم المنتج
                  </label>
                  <input
                    value={
                      editProduct.name ||
                      ""
                    }
                    onChange={(event) =>
                      handleEditChange(
                        "name",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="pl-field">
                  <label>SKU</label>
                  <input
                    value={
                      editProduct.sku || ""
                    }
                    onChange={(event) =>
                      handleEditChange(
                        "sku",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="pl-field">
                  <label>
                    سعر الشراء
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={
                      editProduct.cost_price ??
                      ""
                    }
                    onChange={(event) =>
                      handleEditChange(
                        "cost_price",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="pl-field">
                  <label>
                    سعر البيع الافتراضي
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={
                      editProduct.default_sale_price ??
                      ""
                    }
                    onChange={(event) =>
                      handleEditChange(
                        "default_sale_price",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="pl-field">
                  <label>
                    الضريبة %
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={
                      editProduct.tax_rate ??
                      ""
                    }
                    onChange={(event) =>
                      handleEditChange(
                        "tax_rate",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="pl-field">
                  <label>
                    الحد الأدنى للمخزون
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={
                      editProduct.minimum_stock ??
                      ""
                    }
                    onChange={(event) =>
                      handleEditChange(
                        "minimum_stock",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="pl-field">
                  <label>الحالة</label>
                  <select
                    value={
                      editProduct.is_active
                        ? "active"
                        : "inactive"
                    }
                    onChange={(event) =>
                      handleEditChange(
                        "is_active",
                        event.target.value ===
                          "active"
                      )
                    }
                  >
                    <option value="active">
                      نشط
                    </option>
                    <option value="inactive">
                      غير نشط
                    </option>
                  </select>
                </div>
              </div>

              <div className="pl-price-preview">
                <div className="pl-preview-item">
                  <span>
                    الربح للوحدة
                  </span>
                  <strong>
                    {money(
                      profitAmount(
                        editProduct.cost_price,
                        editProduct.default_sale_price
                      )
                    )}{" "}
                    ر.س
                  </strong>
                </div>

                <div className="pl-preview-item">
                  <span>
                    هامش الربح
                  </span>
                  <strong>
                    {marginPercent(
                      editProduct.cost_price,
                      editProduct.default_sale_price
                    ).toFixed(2)}
                    %
                  </strong>
                </div>

                <div className="pl-preview-item">
                  <span>
                    سعر البيع بعد الضريبة
                  </span>
                  <strong>
                    {money(
                      Number(
                        editProduct.default_sale_price ||
                          0
                      ) *
                        (1 +
                          Number(
                            editProduct.tax_rate ||
                              0
                          ) /
                            100)
                    )}{" "}
                    ر.س
                  </strong>
                </div>
              </div>

              <div className="pl-modal-actions">
                <button
                  type="button"
                  className="pl-secondary-btn"
                  onClick={() =>
                    setIsEditOpen(false)
                  }
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="pl-primary-btn"
                  disabled={saving}
                >
                  <Save size={17} />
                  {saving
                    ? "جاري الحفظ..."
                    : "حفظ التعديلات"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}) {
  return (
    <article className="pl-stat-card">
      <div className="pl-stat-top">
        <span className="pl-stat-label">
          {label}
        </span>

        <div
          className={`pl-stat-icon ${tone}`}
        >
          <Icon
            size={19}
            strokeWidth={1.9}
          />
        </div>
      </div>

      <div className="pl-stat-value">
        {value}
      </div>

      <div className="pl-stat-sub">
        {sub}
      </div>
    </article>
  );
}
