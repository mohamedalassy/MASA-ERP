import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeDollarSign,
  Calculator,
  CheckCircle2,
  PackageSearch,
  RefreshCcw,
  Search,
  Sparkles,
  Store,
  Truck,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function SuggestedPriceCalculator({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [supplierPrices, setSupplierPrices] = useState([]);

  const [loading, setLoading] = useState(true);
  const [supplierLoading, setSupplierLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [search, setSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [supplierPriceId, setSupplierPriceId] = useState("");

  const [cost, setCost] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);

  const [result, setResult] = useState(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/products`, {
        headers: { Accept: "application/json" },
      });

      const json = await response.json();

      if (!response.ok || !json?.success) {
        throw new Error(json?.message || "تعذر تحميل المنتجات.");
      }

      setProducts(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر تحميل المنتجات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) => String(product.id) === String(productId)
      ) || null,
    [products, productId]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) {
      return products.slice(0, 20);
    }

    return products
      .filter((product) =>
        [
          product.name,
          product.sku,
          product.brand,
          product.model,
          product.category,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(q)
          )
      )
      .slice(0, 30);
  }, [products, search]);

  const loadSupplierPrices = async (nextProductId) => {
    if (!nextProductId) {
      setSupplierPrices([]);
      setSupplierPriceId("");
      return;
    }

    try {
      setSupplierLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/products/${nextProductId}/supplier-prices`,
        {
          headers: { Accept: "application/json" },
        }
      );

      const json = await response.json();

      if (!response.ok) {
        throw new Error(
          json?.message || "تعذر تحميل أسعار الموردين."
        );
      }

      setSupplierPrices(
        Array.isArray(json?.data) ? json.data : []
      );
    } catch (err) {
      console.error(err);
      setSupplierPrices([]);
      setError(err.message || "تعذر تحميل أسعار الموردين.");
    } finally {
      setSupplierLoading(false);
    }
  };

  const chooseProduct = async (product) => {
    setProductId(String(product.id));
    setSupplierPriceId("");
    setResult(null);
    setMessage("");

    const productCost = Number(product.cost_price || 0);
    const productSale = Number(
      product.default_sale_price ??
        product.sale_price ??
        0
    );

    setCost(productCost);
    setSalePrice(productSale);

    await loadSupplierPrices(product.id);
  };

  const chooseSupplierPrice = (event) => {
    const nextId = event.target.value;
    setSupplierPriceId(nextId);
    setResult(null);
    setMessage("");

    const row = supplierPrices.find(
      (item) => String(item.id) === String(nextId)
    );

    if (row) {
      setCost(Number(row.unit_price || 0));
    }
  };

  const calculate = async () => {
    try {
      setCalculating(true);
      setError("");
      setMessage("");

      const response = await fetch(
        `${API_URL}/pricing-rules/resolve`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_id: productId
              ? Number(productId)
              : null,
            cost: Number(cost || 0),
            sale_price: Number(salePrice || 0),
            discount_percent: Number(
              discountPercent || 0
            ),
          }),
        }
      );

      const json = await response.json();

      if (!response.ok || !json?.success) {
        const firstError = json?.errors
          ? Object.values(json.errors)
              .flat()
              .find(Boolean)
          : null;

        throw new Error(
          firstError ||
            json?.message ||
            "تعذر حساب السعر المقترح."
        );
      }

      setResult(json.data || null);
    } catch (err) {
      console.error(err);
      setError(
        err.message || "تعذر حساب السعر المقترح."
      );
    } finally {
      setCalculating(false);
    }
  };

  const currentMetrics = useMemo(() => {
    const baseSale = Number(salePrice || 0);
    const discount = Number(discountPercent || 0);
    const netSale =
      baseSale * (1 - discount / 100);
    const currentCost = Number(cost || 0);
    const profit = netSale - currentCost;
    const margin =
      netSale > 0
        ? (profit / netSale) * 100
        : 0;
    const markup =
      currentCost > 0
        ? (profit / currentCost) * 100
        : 0;

    return {
      netSale,
      profit,
      margin,
      markup,
    };
  }, [cost, salePrice, discountPercent]);

  const selectedSupplierPrice = useMemo(
    () =>
      supplierPrices.find(
        (row) =>
          String(row.id) ===
          String(supplierPriceId)
      ) || null,
    [supplierPrices, supplierPriceId]
  );

  const applyRecommended = () => {
    if (!result?.recommended_price) return;

    setSalePrice(
      Number(result.recommended_price)
    );
    setDiscountPercent(0);
    setMessage(
      `تم تطبيق السعر المقترح ${money(
        result.recommended_price
      )} ر.س.`
    );
  };

  const sendToBoq = () => {
    if (!selectedProduct) {
      setMessage(
        "اختر منتجًا أولًا قبل الإرسال إلى BOQ."
      );
      return;
    }

    const chosenSale = Number(
      result?.recommended_price ??
        salePrice ??
        0
    );

    const payload = {
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      sku: selectedProduct.sku || "",
      unit: selectedProduct.unit || "قطعة",
      tax_rate: Number(
        selectedProduct.tax_rate || 0
      ),
      supplier_id:
        selectedSupplierPrice?.supplier_id ||
        null,
      supplier_price_id:
        selectedSupplierPrice?.id || null,
      supplier_name:
        selectedSupplierPrice?.supplier?.name ||
        "",
      supplier_cost_snapshot: Number(
        cost || 0
      ),
      supplier_lead_time_snapshot:
        selectedSupplierPrice?.lead_time_days ??
        null,
      supplier_valid_until_snapshot:
        selectedSupplierPrice?.valid_until ||
        null,
      suggested_sale_price: chosenSale,
    };

    sessionStorage.setItem(
      "masa_calculator_to_boq",
      JSON.stringify(payload)
    );

    onNavigate?.("pricing-builder");
  };

  const status = useMemo(() => {
    if (!result) return null;

    const currentMargin = Number(
      result.current_margin_percent || 0
    );
    const minimumMargin = Number(
      result.rule?.minimum_margin_percent || 0
    );
    const targetMargin = Number(
      result.rule?.target_margin_percent || 0
    );

    if (
      result.block_below_minimum_margin &&
      currentMargin < minimumMargin
    ) {
      return {
        key: "blocked",
        title: "غير مسموح",
        text: "السعر الحالي أقل من الحد الأدنى للهامش.",
      };
    }

    if (
      result.require_approval_below_target &&
      currentMargin < targetMargin
    ) {
      return {
        key: "approval",
        title: "يحتاج موافقة",
        text: "السعر الحالي أقل من الهامش المستهدف.",
      };
    }

    return {
      key: "allowed",
      title: "مسموح",
      text: "السعر الحالي متوافق مع قاعدة التسعير.",
    };
  }, [result]);

  return (
    <section className="spc-page" dir="rtl">
      <style>{`
        .spc-page{color:#27304a;padding-bottom:30px}
        .spc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}
        .spc-kicker{font-size:10px;font-weight:900;color:#6757f5;margin-bottom:5px}
        .spc-head h1{margin:0;font-size:24px}.spc-head p{margin:6px 0 0;color:#98a0af;font-size:10px}
        .spc-btn{border:1px solid #e3e6ef;background:#fff;border-radius:10px;padding:9px 12px;font-family:inherit;font-size:9px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
        .spc-btn.primary{background:#6657f5;color:#fff;border-color:#6657f5}
        .spc-layout{display:grid;grid-template-columns:330px minmax(0,1fr);gap:12px}
        .spc-card{background:#fff;border:1px solid #e8eaf1;border-radius:16px;overflow:hidden}
        .spc-card-head{padding:13px 15px;border-bottom:1px solid #edf0f5;display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:900}
        .spc-products{padding:12px}.spc-search{display:flex;align-items:center;gap:7px;border:1px solid #e4e7ee;border-radius:9px;padding:8px 9px;margin-bottom:8px}
        .spc-search input{border:0;outline:0;width:100%;font-family:inherit;font-size:9px}
        .spc-product-list{max-height:620px;overflow:auto}.spc-product{width:100%;text-align:right;border:1px solid #edf0f4;background:#fff;border-radius:10px;padding:10px;margin-top:7px;font-family:inherit;cursor:pointer}
        .spc-product.active{border-color:#cfc8ff;background:#faf9ff}.spc-product strong{display:block;font-size:9px}.spc-product small{font-size:7px;color:#9ba2b0}
        .spc-main{padding:16px}.spc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .spc-field{display:flex;flex-direction:column;gap:5px}.spc-field.full{grid-column:1/-1}.spc-field label{font-size:8px;font-weight:800;color:#7b8394}
        .spc-input,.spc-select{border:1px solid #e3e6ee;border-radius:9px;min-height:39px;padding:0 10px;font-family:inherit;font-size:9px;box-sizing:border-box;width:100%}
        .spc-live{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:12px}
        .spc-live-card{border:1px solid #e8eaf1;border-radius:12px;padding:11px;background:#fafbfc}
        .spc-live-card span{display:block;font-size:7px;color:#99a0ae;margin-bottom:5px}.spc-live-card strong{font-size:13px}
        .spc-actionbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
        .spc-result{margin-top:14px;border-top:1px solid #edf0f5;padding-top:14px}
        .spc-status{border-radius:12px;padding:12px;margin-bottom:10px;border:1px solid}
        .spc-status.allowed{background:#ecf9f3;border-color:#cdeedf;color:#177e5c}
        .spc-status.approval{background:#fff8e8;border-color:#f0dfad;color:#9f6a16}
        .spc-status.blocked{background:#fff0f0;border-color:#f2cccf;color:#c64f55}
        .spc-status strong{display:block;font-size:11px}.spc-status span{display:block;font-size:8px;margin-top:4px}
        .spc-price-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .spc-price{border:1px solid #e8eaf1;border-radius:13px;padding:13px;background:#fff}
        .spc-price small{display:block;color:#999fad;font-size:8px;margin-bottom:6px}.spc-price strong{font-size:16px}
        .spc-price.recommended{background:#f6f3ff;border-color:#ded8ff}.spc-price.recommended strong{color:#6657f5}
        .spc-rule{margin-top:10px;padding:11px;border:1px solid #ebeef3;border-radius:11px;background:#fafbfc;font-size:8px;line-height:1.8}
        .spc-error,.spc-message{margin-bottom:10px;padding:9px 11px;border-radius:10px;font-size:9px}
        .spc-error{background:#fff3f3;border:1px solid #f0d1d3;color:#c75258}.spc-message{background:#edf9f4;border:1px solid #d3eee2;color:#177c5b}
        @media(max-width:1000px){.spc-layout{grid-template-columns:1fr}.spc-grid{grid-template-columns:1fr 1fr}}
        @media(max-width:650px){.spc-head{flex-direction:column}.spc-grid,.spc-live,.spc-price-grid{grid-template-columns:1fr}}
      `}</style>

      <div className="spc-head">
        <div>
          <div className="spc-kicker">
            مركز التسعير / حاسبة السعر المقترح
          </div>
          <h1>Suggested Price Calculator</h1>
          <p>
            جرّب التكلفة وسعر البيع والخصم، ثم طبّق قواعد التسعير قبل إضافة السعر إلى BOQ.
          </p>
        </div>

        <button
          className="spc-btn"
          type="button"
          onClick={() => onNavigate?.("pricing")}
        >
          <ArrowRight size={13} />
          العودة لمركز التسعير
        </button>
      </div>

      {error && <div className="spc-error">{error}</div>}
      {message && <div className="spc-message">{message}</div>}

      <div className="spc-layout">
        <aside className="spc-card">
          <div className="spc-card-head">
            <span>المنتجات</span>
            <PackageSearch size={15} />
          </div>

          <div className="spc-products">
            <div className="spc-search">
              <Search size={13} />
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="ابحث باسم المنتج أو SKU..."
              />
            </div>

            <div className="spc-product-list">
              {loading ? (
                <div style={{ padding: 20, textAlign: "center", fontSize: 9, color: "#999" }}>
                  جاري تحميل المنتجات...
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    className={`spc-product ${
                      String(product.id) === String(productId)
                        ? "active"
                        : ""
                    }`}
                    onClick={() => chooseProduct(product)}
                  >
                    <strong>{product.name}</strong>
                    <small>
                      {product.sku || "بدون SKU"}
                      {product.brand
                        ? ` · ${product.brand}`
                        : ""}
                    </small>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        <div className="spc-card">
          <div className="spc-card-head">
            <span>محاكاة السعر</span>
            <Calculator size={15} />
          </div>

          <div className="spc-main">
            <div className="spc-grid">
              <div className="spc-field full">
                <label>المنتج المختار</label>
                <input
                  className="spc-input"
                  value={
                    selectedProduct
                      ? `${selectedProduct.name}${
                          selectedProduct.sku
                            ? ` · ${selectedProduct.sku}`
                            : ""
                        }`
                      : "يمكن الحساب يدويًا بدون اختيار منتج"
                  }
                  readOnly
                />
              </div>

              <div className="spc-field">
                <label>سعر المورد / مصدر التكلفة</label>
                <select
                  className="spc-select"
                  value={supplierPriceId}
                  onChange={chooseSupplierPrice}
                  disabled={!productId || supplierLoading}
                >
                  <option value="">
                    {supplierLoading
                      ? "جاري التحميل..."
                      : "التكلفة الافتراضية / يدوي"}
                  </option>

                  {supplierPrices.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.supplier?.name || "مورد"} -{" "}
                      {money(row.unit_price)} ر.س
                    </option>
                  ))}
                </select>
              </div>

              <div className="spc-field">
                <label>التكلفة ر.س</label>
                <input
                  className="spc-input"
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={cost}
                  onChange={(event) => {
                    setCost(event.target.value);
                    setResult(null);
                  }}
                />
              </div>

              <div className="spc-field">
                <label>سعر البيع التجريبي ر.س</label>
                <input
                  className="spc-input"
                  type="number"
                  min="0"
                  step="0.01"
                  dir="ltr"
                  value={salePrice}
                  onChange={(event) => {
                    setSalePrice(event.target.value);
                    setResult(null);
                  }}
                />
              </div>

              <div className="spc-field">
                <label>الخصم %</label>
                <input
                  className="spc-input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  dir="ltr"
                  value={discountPercent}
                  onChange={(event) => {
                    setDiscountPercent(
                      event.target.value
                    );
                    setResult(null);
                  }}
                />
              </div>
            </div>

            <div className="spc-live">
              <div className="spc-live-card">
                <span>صافي البيع بعد الخصم</span>
                <strong>
                  {money(currentMetrics.netSale)} ر.س
                </strong>
              </div>

              <div className="spc-live-card">
                <span>الربح</span>
                <strong>
                  {money(currentMetrics.profit)} ر.س
                </strong>
              </div>

              <div className="spc-live-card">
                <span>Margin</span>
                <strong>
                  {currentMetrics.margin.toFixed(1)}%
                </strong>
              </div>

              <div className="spc-live-card">
                <span>Markup</span>
                <strong>
                  {currentMetrics.markup.toFixed(1)}%
                </strong>
              </div>
            </div>

            <div className="spc-actionbar">
              <button
                type="button"
                className="spc-btn primary"
                onClick={calculate}
                disabled={calculating}
              >
                <Sparkles size={13} />
                {calculating
                  ? "جاري الحساب..."
                  : "احسب السعر المقترح"}
              </button>

              <button
                type="button"
                className="spc-btn"
                onClick={() => {
                  setResult(null);
                  setMessage("");
                  if (selectedProduct) {
                    setCost(
                      Number(
                        selectedProduct.cost_price ||
                          0
                      )
                    );
                    setSalePrice(
                      Number(
                        selectedProduct.default_sale_price ||
                          0
                      )
                    );
                  } else {
                    setCost(0);
                    setSalePrice(0);
                  }
                  setDiscountPercent(0);
                }}
              >
                <RefreshCcw size={12} />
                إعادة ضبط
              </button>
            </div>

            {result && (
              <div className="spc-result">
                {status && (
                  <div
                    className={`spc-status ${status.key}`}
                  >
                    <strong>{status.title}</strong>
                    <span>{status.text}</span>
                  </div>
                )}

                <div className="spc-price-grid">
                  <div className="spc-price">
                    <small>Minimum Price</small>
                    <strong>
                      {money(result.minimum_price)} ر.س
                    </strong>
                  </div>

                  <div className="spc-price">
                    <small>Target Price</small>
                    <strong>
                      {money(result.target_price)} ر.س
                    </strong>
                  </div>

                  <div className="spc-price recommended">
                    <small>Recommended Price</small>
                    <strong>
                      {money(
                        result.recommended_price
                      )}{" "}
                      ر.س
                    </strong>
                  </div>
                </div>

                <div className="spc-rule">
                  <strong>
                    القاعدة:{" "}
                    {result.rule?.name ||
                      "لا توجد قاعدة مطابقة"}
                  </strong>
                  <div>
                    Minimum Margin:{" "}
                    {money(
                      result.rule
                        ?.minimum_margin_percent || 0
                    )}
                    %
                  </div>
                  <div>
                    Target Margin:{" "}
                    {money(
                      result.rule
                        ?.target_margin_percent || 0
                    )}
                    %
                  </div>
                  <div>
                    Default Markup:{" "}
                    {money(
                      result.rule
                        ?.default_markup_percent || 0
                    )}
                    %
                  </div>
                  <div>
                    Maximum Discount:{" "}
                    {money(
                      result.maximum_discount_percent ||
                        0
                    )}
                    %
                  </div>
                </div>

                <div className="spc-actionbar">
                  <button
                    type="button"
                    className="spc-btn primary"
                    onClick={applyRecommended}
                  >
                    <CheckCircle2 size={13} />
                    تطبيق السعر المقترح
                  </button>

                  <button
                    type="button"
                    className="spc-btn"
                    onClick={sendToBoq}
                    disabled={!selectedProduct}
                  >
                    <BadgeDollarSign size={13} />
                    استخدام السعر في BOQ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
