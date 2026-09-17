import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const num = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const STATUS_LABELS = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  approved: "معتمد",
  rejected: "مرفوض",
  changes_requested: "مطلوب تعديلات",
};

const emptyLine = () => ({
  key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  product_id: null,
  product_name: "",
  sku: "",
  description: "",
  quantity: 1,
  cost_price: 0,
  unit_price: 0,
  discount: 0,
  tax_rate: 15,
});

/**
 * باني عرض السعر.
 *
 * العقد متوافق مع App.jsx:
 *   onNavigate · initialProjectId · initialQuotationId · initialPackageData
 *
 * الشاشة دي هي نقطة التقاء التسعير بالبيع بالمالية:
 *   - بتسحب المنتجات وتكلفتها
 *   - بتستدعي قواعد الربح وتفرض بوابتها (امنع / موافقة / مسموح)
 *   - بتستقبل باقة جاهزة من شاشة الباقات
 *   - بتحفظ مسودة وترسلها للاعتماد
 */
export default function QuotationBuilder({
  onNavigate,
  initialProjectId = null,
  initialQuotationId = null,
  initialPackageData = null,
}) {
  const [projects, setProjects] = useState([]);
  const [products, setProducts] = useState([]);
  const [packages, setPackages] = useState([]);

  const [projectId, setProjectId] = useState(initialProjectId || "");
  const [quotationId, setQuotationId] = useState(initialQuotationId || null);
  const [status, setStatus] = useState("draft");
  const [version, setVersion] = useState(1);
  const [quotationNumber, setQuotationNumber] = useState("");

  const [lines, setLines] = useState([emptyLine()]);
  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");

  const [rule, setRule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [packageOpen, setPackageOpen] = useState(false);

  const packageApplied = useRef(false);

  /* ------------------------------------------------------------------
   * التحميل الأولي
   * ------------------------------------------------------------------ */

  const loadReferenceData = useCallback(async () => {
    const [projectsRes, productsRes, packagesRes] = await Promise.all([
      fetch(`${API_URL}/projects`).then((r) => r.json()),
      fetch(`${API_URL}/products`).then((r) => r.json()),
      fetch(`${API_URL}/pricing-packages`).then((r) => r.json()),
    ]);

    setProjects(projectsRes?.data || []);
    setProducts(productsRes?.data || []);
    setPackages(packagesRes?.data || []);
  }, []);

  const loadQuotation = useCallback(async (project, quotation) => {
    const res = await fetch(
      `${API_URL}/projects/${project}/quotations/${quotation}`
    );
    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json?.message || "تعذر تحميل عرض السعر");
    }

    const data = json.data;

    setStatus(data.status || "draft");
    setVersion(data.version || 1);
    setQuotationNumber(data.quotation_number || "");
    setHeaderDiscount(num(data.discount));
    setValidUntil(data.valid_until || "");
    setNotes(data.notes || "");

    setLines(
      (data.items || []).map((item, index) => ({
        key: `saved-${item.id ?? index}`,
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name || "",
        sku: item.sku || "",
        description: item.description || "",
        quantity: num(item.quantity),
        cost_price: num(item.cost_price),
        unit_price: num(item.unit_price),
        discount: num(item.discount),
        tax_rate: num(item.tax_rate) || 15,
      }))
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError("");

        await loadReferenceData();

        if (initialProjectId && initialQuotationId) {
          await loadQuotation(initialProjectId, initialQuotationId);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialProjectId, initialQuotationId, loadReferenceData, loadQuotation]);

  /* ------------------------------------------------------------------
   * تسليم الباقة من شاشة الباقات
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (!initialPackageData || packageApplied.current) return;

    packageApplied.current = true;
    applyPackage(initialPackageData);
  }, [initialPackageData]);

  const applyPackage = (pkg) => {
    const items = pkg?.items || [];

    if (!items.length) return;

    setLines(
      items.map((item, index) => ({
        key: `pkg-${pkg.id ?? "x"}-${index}`,
        product_id: item.product_id ?? null,
        product_name: item.product_name || "",
        sku: item.sku || "",
        description: item.description || "",
        quantity: num(item.quantity) || 1,
        cost_price: num(item.cost_price),
        unit_price: num(item.unit_price),
        discount: 0,
        tax_rate: 15,
      }))
    );

    setMessage(`تم تحميل بنود الباقة: ${pkg.name || ""}`);
    setPackageOpen(false);
  };

  /* ------------------------------------------------------------------
   * الحساب
   * ------------------------------------------------------------------ */

  const computed = useMemo(() => {
    let subtotal = 0;
    let lineDiscounts = 0;
    let tax = 0;
    let cost = 0;

    const rows = lines.map((line) => {
      const gross = num(line.quantity) * num(line.unit_price);
      const discount = Math.min(num(line.discount), gross);
      const taxable = gross - discount;
      const lineTax = taxable * (num(line.tax_rate) / 100);
      const lineCost = num(line.quantity) * num(line.cost_price);

      subtotal += gross;
      lineDiscounts += discount;
      tax += lineTax;
      cost += lineCost;

      const profit = taxable - lineCost;

      return {
        ...line,
        gross,
        taxable,
        line_tax: lineTax,
        line_total: taxable + lineTax,
        line_cost: lineCost,
        profit,
        margin: taxable > 0 ? (profit / taxable) * 100 : 0,
      };
    });

    const netBeforeTax = subtotal - lineDiscounts - num(headerDiscount);
    const total = netBeforeTax + tax;
    const profit = netBeforeTax - cost;

    return {
      rows,
      subtotal: Math.round(subtotal * 100) / 100,
      line_discounts: Math.round(lineDiscounts * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      net_before_tax: Math.round(netBeforeTax * 100) / 100,
      total: Math.round(total * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      profit: Math.round(profit * 100) / 100,
      margin: netBeforeTax > 0 ? (profit / netBeforeTax) * 100 : 0,
    };
  }, [lines, headerDiscount]);

  /* ------------------------------------------------------------------
   * بوابة قواعد الربح
   * ------------------------------------------------------------------ */

  useEffect(() => {
    if (computed.cost <= 0) {
      setRule(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/pricing-rules/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            cost: computed.cost,
            sale_price: computed.net_before_tax,
            discount_percent:
              computed.subtotal > 0
                ? ((computed.line_discounts + num(headerDiscount)) /
                    computed.subtotal) *
                  100
                : 0,
          }),
        });

        const json = await res.json();
        if (res.ok && json.success) setRule(json.data);
      } catch {
        /* الإلغاء متوقع أثناء الكتابة */
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    computed.cost,
    computed.net_before_tax,
    computed.subtotal,
    computed.line_discounts,
    headerDiscount,
  ]);

  /**
   * قرار البوابة.
   *
   * مهم: ده تقييد في الواجهة. التحقق السيرفري لازم يتضاف في
   * ProjectQuotationController::store و update — راجع PATCHES.md.
   */
  const gate = useMemo(() => {
    if (!rule || computed.cost <= 0) {
      return { level: "unknown", label: "لم تُطبَّق قاعدة", warnings: [] };
    }

    const margin = computed.margin;
    const minimum = num(rule.minimum_margin_percent);
    const target = num(rule.rule?.target_margin_percent);
    const warnings = rule.warnings || [];

    if (rule.block_below_minimum_margin && margin < minimum) {
      return { level: "blocked", label: "غير مسموح", warnings };
    }

    if (rule.require_approval_below_target && margin < target) {
      return { level: "approval", label: "يحتاج موافقة", warnings };
    }

    if (warnings.length) {
      return { level: "approval", label: "يحتاج موافقة", warnings };
    }

    return { level: "allowed", label: "مسموح", warnings: [] };
  }, [rule, computed.cost, computed.margin]);

  /* ------------------------------------------------------------------
   * تعديل البنود
   * ------------------------------------------------------------------ */

  const updateLine = (key, patch) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );

  const pickProduct = (key, productId) => {
    const product = products.find((p) => String(p.id) === String(productId));

    if (!product) {
      updateLine(key, { product_id: null });
      return;
    }

    updateLine(key, {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      cost_price: num(product.cost_price),
      unit_price: num(product.default_sale_price),
      tax_rate: num(product.tax_rate) || 15,
    });
  };

  const addLine = () => setLines((current) => [...current, emptyLine()]);

  const removeLine = (key) =>
    setLines((current) =>
      current.length === 1 ? [emptyLine()] : current.filter((l) => l.key !== key)
    );

  /* ------------------------------------------------------------------
   * الحفظ والإرسال
   * ------------------------------------------------------------------ */

  const buildPayload = () => ({
    discount: num(headerDiscount),
    valid_until: validUntil || null,
    notes: notes || null,
    items: computed.rows
      .filter((row) => row.product_name && num(row.quantity) > 0)
      .map((row, index) => ({
        product_id: row.product_id,
        product_name: row.product_name,
        sku: row.sku || null,
        description: row.description || null,
        quantity: num(row.quantity),
        cost_price: num(row.cost_price),
        unit_price: num(row.unit_price),
        discount: num(row.discount),
        tax_rate: num(row.tax_rate),
        sort_order: index,
      })),
  });

  const save = async () => {
    setError("");
    setMessage("");

    if (!projectId) {
      setError("اختر المشروع أولًا.");
      return;
    }

    const payload = buildPayload();

    if (!payload.items.length) {
      setError("أضف بندًا واحدًا على الأقل باسم وكمية صحيحة.");
      return;
    }

    if (gate.level === "blocked") {
      setError(
        "هامش الربح أقل من الحد الأدنى المسموح وقاعدة التسعير تمنع الحفظ."
      );
      return;
    }

    try {
      setSaving(true);

      const url = quotationId
        ? `${API_URL}/projects/${projectId}/quotations/${quotationId}`
        : `${API_URL}/projects/${projectId}/quotations`;

      const res = await fetch(url, {
        method: quotationId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(
          json?.message ||
            Object.values(json?.errors || {}).flat()[0] ||
            "تعذر حفظ عرض السعر"
        );
      }

      setQuotationId(json.data?.id || quotationId);
      setQuotationNumber(json.data?.quotation_number || quotationNumber);
      setStatus(json.data?.status || "draft");
      setMessage(json.message || "تم حفظ عرض السعر.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const submitForApproval = async () => {
    if (!quotationId) {
      setError("احفظ عرض السعر قبل إرساله للاعتماد.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const res = await fetch(
        `${API_URL}/projects/${projectId}/quotations/${quotationId}/submit-for-approval`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      );

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json?.message || "تعذر إرسال العرض للاعتماد");
      }

      setStatus("pending");
      setMessage("تم إرسال عرض السعر للاعتماد.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const isLocked = status !== "draft" && status !== "changes_requested";

  /* ------------------------------------------------------------------
   * العرض
   * ------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="qb-state">
        <Loader2 className="qb-spin" size={28} />
        <span>جاري تحميل باني عرض السعر…</span>
      </div>
    );
  }

  return (
    <div className="qb-page">
      <style>{QB_STYLES}</style>

      <header className="qb-hero">
        <div>
          <button
            type="button"
            className="qb-back"
            onClick={() => onNavigate?.("pricing")}
          >
            <ArrowRight size={17} /> لوحة التسعير
          </button>

          <span className="qb-kicker">
            <TrendingUp size={15} /> التسعير وعروض الأسعار
          </span>

          <h1>{quotationNumber || "عرض سعر جديد"}</h1>

          <p>
            {quotationId
              ? `مراجعة ${version} — ${STATUS_LABELS[status] || status}`
              : "البنود والتكلفة والهامش في شاشة واحدة، وقاعدة الربح بتتطبّق لحظيًا."}
          </p>
        </div>

        <div className="qb-actions">
          <button
            type="button"
            className="qb-ghost"
            onClick={() => setPackageOpen((v) => !v)}
          >
            <Package size={17} /> تحميل باقة <ChevronDown size={14} />
          </button>

          <button
            type="button"
            className="qb-ghost"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={17} /> تحديث
          </button>

          <button
            type="button"
            className="qb-primary"
            disabled={saving || isLocked || gate.level === "blocked"}
            onClick={save}
          >
            {saving ? <Loader2 className="qb-spin" size={17} /> : <Save size={17} />}
            {quotationId ? "حفظ التعديلات" : "حفظ كمسودة"}
          </button>

          <button
            type="button"
            className="qb-success"
            disabled={saving || !quotationId || isLocked}
            onClick={submitForApproval}
          >
            <Send size={16} /> إرسال للاعتماد
          </button>
        </div>

        {packageOpen && (
          <div className="qb-package-menu">
            {packages.length ? (
              packages.map((pkg) => (
                <button
                  type="button"
                  key={pkg.id}
                  onClick={() => applyPackage(pkg)}
                >
                  <strong>{pkg.name}</strong>
                  <small>
                    {pkg.items?.length || 0} بند — {money(pkg.total_price)} ر.س
                  </small>
                </button>
              ))
            ) : (
              <span className="qb-empty-menu">لا توجد باقات معرّفة.</span>
            )}
          </div>
        )}
      </header>

      {error && (
        <div className="qb-alert qb-alert--error">
          <AlertTriangle size={17} /> {error}
        </div>
      )}

      {message && !error && (
        <div className="qb-alert qb-alert--ok">
          <CheckCircle2 size={17} /> {message}
        </div>
      )}

      {isLocked && (
        <div className="qb-alert qb-alert--lock">
          <ShieldAlert size={17} /> العرض في حالة «
          {STATUS_LABELS[status] || status}» — التعديل متاح على المسودة
          والمطلوب تعديلها فقط. أنشئ مراجعة جديدة للتغيير.
        </div>
      )}

      <section className="qb-meta">
        <label>
          <span>المشروع</span>
          <select
            value={projectId}
            disabled={Boolean(quotationId) || isLocked}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">اختر المشروع…</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.project_code} — {project.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>خصم على إجمالي العرض</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={headerDiscount}
            disabled={isLocked}
            onChange={(e) => setHeaderDiscount(e.target.value)}
          />
        </label>

        <label>
          <span>صالح حتى</span>
          <input
            type="date"
            value={validUntil || ""}
            disabled={isLocked}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </label>

        <label className="qb-meta-wide">
          <span>ملاحظات</span>
          <input
            value={notes}
            disabled={isLocked}
            placeholder="شروط التسليم، الضمان، أي ملاحظة تظهر للعميل"
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </section>

      <section className={`qb-gate qb-gate--${gate.level}`}>
        <div className="qb-gate-icon">
          {gate.level === "allowed" ? (
            <ShieldCheck size={22} />
          ) : (
            <ShieldAlert size={22} />
          )}
        </div>

        <div className="qb-gate-body">
          <span>بوابة قاعدة الربح</span>
          <h2>{gate.label}</h2>

          {gate.warnings.length ? (
            <ul>
              {gate.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p>
              {rule?.rule?.name
                ? `القاعدة المطبَّقة: ${rule.rule.name}`
                : "لا توجد قاعدة مطابقة — أضف قاعدة عامة في شاشة قواعد الربح."}
            </p>
          )}
        </div>

        <div className="qb-gate-figures">
          <div>
            <small>الهامش الحالي</small>
            <strong>{computed.margin.toFixed(1)}%</strong>
          </div>
          <div>
            <small>الحد الأدنى</small>
            <strong>{num(rule?.minimum_margin_percent).toFixed(1)}%</strong>
          </div>
          <div>
            <small>السعر المقترح</small>
            <strong>{money(rule?.recommended_price)}</strong>
          </div>
        </div>
      </section>

      <section className="qb-card">
        <div className="qb-card-head">
          <div>
            <span>بنود العرض</span>
            <h2>التكلفة والسعر والهامش لكل بند</h2>
          </div>

          <button
            type="button"
            className="qb-ghost"
            disabled={isLocked}
            onClick={addLine}
          >
            <Plus size={16} /> إضافة بند
          </button>
        </div>

        <div className="qb-table-wrap">
          <table>
            <thead>
              <tr>
                <th className="qb-col-product">المنتج</th>
                <th>الكمية</th>
                <th>التكلفة</th>
                <th>سعر البيع</th>
                <th>خصم</th>
                <th>ضريبة %</th>
                <th>الإجمالي</th>
                <th>الربح</th>
                <th>الهامش</th>
                <th />
              </tr>
            </thead>

            <tbody>
              {computed.rows.map((row) => (
                <tr key={row.key}>
                  <td className="qb-col-product">
                    <select
                      value={row.product_id || ""}
                      disabled={isLocked}
                      onChange={(e) => pickProduct(row.key, e.target.value)}
                    >
                      <option value="">— بند حر —</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} — {product.name}
                        </option>
                      ))}
                    </select>

                    <input
                      className="qb-line-name"
                      value={row.product_name}
                      disabled={isLocked}
                      placeholder="اسم البند"
                      onChange={(e) =>
                        updateLine(row.key, { product_name: e.target.value })
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.quantity}
                      disabled={isLocked}
                      onChange={(e) =>
                        updateLine(row.key, { quantity: e.target.value })
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.cost_price}
                      disabled={isLocked}
                      onChange={(e) =>
                        updateLine(row.key, { cost_price: e.target.value })
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unit_price}
                      disabled={isLocked}
                      onChange={(e) =>
                        updateLine(row.key, { unit_price: e.target.value })
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.discount}
                      disabled={isLocked}
                      onChange={(e) =>
                        updateLine(row.key, { discount: e.target.value })
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={row.tax_rate}
                      disabled={isLocked}
                      onChange={(e) =>
                        updateLine(row.key, { tax_rate: e.target.value })
                      }
                    />
                  </td>

                  <td className="qb-num">{money(row.line_total)}</td>

                  <td
                    className={`qb-num ${row.profit < 0 ? "qb-bad" : "qb-good"}`}
                  >
                    {money(row.profit)}
                  </td>

                  <td
                    className={`qb-num ${row.margin < 0 ? "qb-bad" : "qb-good"}`}
                  >
                    {row.margin.toFixed(1)}%
                  </td>

                  <td>
                    <button
                      type="button"
                      className="qb-icon-button"
                      disabled={isLocked}
                      onClick={() => removeLine(row.key)}
                      title="حذف البند"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="qb-totals">
        <div className="qb-totals-list">
          {[
            ["الإجمالي قبل الخصم", computed.subtotal],
            ["خصومات البنود", computed.line_discounts],
            ["خصم على الإجمالي", num(headerDiscount)],
            ["الصافي قبل الضريبة", computed.net_before_tax],
            ["ضريبة القيمة المضافة", computed.tax],
            ["إجمالي التكلفة", computed.cost],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{money(value)}</b>
            </div>
          ))}
        </div>

        <div className="qb-totals-figures">
          <div className="qb-total-box">
            <small>إجمالي العرض شامل الضريبة</small>
            <strong>{money(computed.total)}</strong>
          </div>

          <div
            className={`qb-total-box ${
              computed.profit < 0 ? "qb-box-bad" : "qb-box-good"
            }`}
          >
            <small>الربح المتوقع</small>
            <strong>{money(computed.profit)}</strong>
            <em>هامش {computed.margin.toFixed(1)}%</em>
          </div>
        </div>
      </section>
    </div>
  );
}

const QB_STYLES = `
.qb-page{--purple:#6d5dfc;--green:#0f9f7f;--orange:#f59e0b;--red:#d23c54;--ink:#172033;--muted:#8a93a5;display:flex;flex-direction:column;gap:16px;color:var(--ink);padding-bottom:40px}
.qb-state{min-height:320px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:#8a93a5}
.qb-spin{animation:qb-rotate .8s linear infinite}
@keyframes qb-rotate{to{transform:rotate(360deg)}}

.qb-hero{position:relative;display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:26px 30px;border:1px solid #e8e9f1;border-radius:24px;background:linear-gradient(125deg,#fff 30%,#f2efff 100%);box-shadow:0 14px 36px rgba(35,32,78,.06)}
.qb-back{display:inline-flex;align-items:center;gap:6px;margin-bottom:12px;padding:0;border:0;background:none;color:#7b839a;font-family:inherit;font-size:12px;font-weight:700}
.qb-back:hover{color:var(--purple)}
.qb-kicker{display:inline-flex;align-items:center;gap:7px;color:var(--purple);font-size:12px;font-weight:900;margin-bottom:8px}
.qb-hero h1{margin:0 0 7px;font-size:29px}
.qb-hero p{margin:0;color:var(--muted);font-size:13px}
.qb-actions{display:flex;gap:9px;flex-wrap:wrap;justify-content:flex-end}
.qb-actions button{display:inline-flex;align-items:center;gap:7px;border:0;border-radius:12px;padding:11px 15px;font-family:inherit;font-size:12px;font-weight:800;cursor:pointer}
.qb-actions button:disabled{opacity:.5;cursor:not-allowed}
.qb-ghost{background:#fff;color:#555e70;border:1px solid #e5e7ef!important}
.qb-primary{background:var(--purple);color:#fff;box-shadow:0 9px 20px rgba(109,93,252,.24)}
.qb-success{background:var(--green);color:#fff;box-shadow:0 9px 20px rgba(15,159,127,.22)}

.qb-package-menu{position:absolute;top:92px;left:30px;z-index:20;min-width:280px;max-height:320px;overflow:auto;padding:8px;border:1px solid #e5e7ef;border-radius:16px;background:#fff;box-shadow:0 18px 44px rgba(23,32,51,.14);display:flex;flex-direction:column;gap:4px}
.qb-package-menu button{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:10px 12px;border:0;border-radius:11px;background:transparent;text-align:right;font-family:inherit;cursor:pointer}
.qb-package-menu button:hover{background:#f4f2ff}
.qb-package-menu strong{font-size:12px}
.qb-package-menu small{color:var(--muted);font-size:11px}
.qb-empty-menu{padding:14px;color:var(--muted);font-size:12px}

.qb-alert{display:flex;align-items:center;gap:9px;padding:13px 18px;border-radius:14px;font-size:12.5px;font-weight:700}
.qb-alert--error{background:#fff0f2;color:#c92d46;border:1px solid #ffd8df}
.qb-alert--ok{background:#e8faf5;color:#0b7f66;border:1px solid #c9f0e5}
.qb-alert--lock{background:#fff6e5;color:#96620a;border:1px solid #ffe2bf}

.qb-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:18px 20px;border:1px solid #e8e9f1;border-radius:18px;background:#fff}
.qb-meta label{display:block;min-width:0}
.qb-meta-wide{grid-column:span 2}
.qb-meta span{display:block;margin-bottom:7px;color:#6f788a;font-size:12px;font-weight:800}
.qb-meta input,.qb-meta select{width:100%;box-sizing:border-box;border:1px solid #e2e5ee;border-radius:11px;padding:10px 12px;background:#fafbfe;font-family:inherit;font-size:12px;color:var(--ink)}
.qb-meta input:disabled,.qb-meta select:disabled{background:#f4f5f8;color:#9aa2b1}

.qb-gate{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:20px;padding:22px 26px;border-radius:20px;border:1px solid #e8e9f1;background:#fff}
.qb-gate--allowed{background:linear-gradient(120deg,#e9fbf5,#f7fffc);border-color:#cdf1e4}
.qb-gate--approval{background:linear-gradient(120deg,#fff6e5,#fffcf5);border-color:#ffe2bf}
.qb-gate--blocked{background:linear-gradient(120deg,#fff0f2,#fff8f9);border-color:#ffd3dc}
.qb-gate-icon{width:50px;height:50px;display:grid;place-items:center;border-radius:16px;background:rgba(255,255,255,.75)}
.qb-gate--allowed .qb-gate-icon{color:var(--green)}
.qb-gate--approval .qb-gate-icon{color:var(--orange)}
.qb-gate--blocked .qb-gate-icon{color:var(--red)}
.qb-gate--unknown .qb-gate-icon{color:#9aa2b1}
.qb-gate-body span{color:var(--muted);font-size:11px;font-weight:900}
.qb-gate-body h2{margin:5px 0 4px;font-size:21px}
.qb-gate-body p{margin:0;color:var(--muted);font-size:12px}
.qb-gate-body ul{margin:6px 0 0;padding-inline-start:18px;color:#6f788a;font-size:12px;line-height:1.85}
.qb-gate-figures{display:flex;gap:26px}
.qb-gate-figures small{display:block;color:var(--muted);font-size:10px;font-weight:800;margin-bottom:5px}
.qb-gate-figures strong{font-size:17px}

.qb-card{background:#fff;border:1px solid #e8e9f1;border-radius:22px;box-shadow:0 12px 28px rgba(31,35,60,.045);overflow:hidden}
.qb-card-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:21px 22px 14px}
.qb-card-head span{color:var(--purple);font-size:10px;font-weight:900}
.qb-card-head h2{font-size:18px;margin:5px 0 0}
.qb-card-head button{display:inline-flex;align-items:center;gap:6px;border-radius:11px;padding:9px 13px;font-family:inherit;font-size:11px;font-weight:800;cursor:pointer;background:#fff;color:#555e70;border:1px solid #e5e7ef}

.qb-table-wrap{overflow:auto;border-top:1px solid #eff0f4}
.qb-table-wrap table{width:100%;border-collapse:collapse;min-width:1080px}
.qb-table-wrap th,.qb-table-wrap td{text-align:right;padding:10px 12px;border-bottom:1px solid #f0f1f5;font-size:12px;vertical-align:middle}
.qb-table-wrap th{color:#9aa2b1;font-size:10px;font-weight:800;background:#fbfbfd;white-space:nowrap}
.qb-table-wrap tr:last-child td{border-bottom:0}
.qb-col-product{min-width:250px}
.qb-table-wrap input,.qb-table-wrap select{width:100%;box-sizing:border-box;border:1px solid #e2e5ee;border-radius:9px;padding:7px 9px;background:#fafbfe;font-family:inherit;font-size:12px;color:var(--ink)}
.qb-table-wrap td input[type=number]{min-width:78px;text-align:center}
.qb-line-name{margin-top:6px}
.qb-num{font-weight:700;white-space:nowrap}
.qb-good{color:var(--green)}
.qb-bad{color:var(--red)}
.qb-icon-button{width:30px;height:30px;display:grid;place-items:center;border:1px solid #e5e7ef;border-radius:9px;background:#fff;color:#98a0b0;cursor:pointer}
.qb-icon-button:hover{color:var(--red);border-color:#ffd3dc}
.qb-icon-button:disabled{opacity:.4;cursor:not-allowed}

.qb-totals{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(300px,.9fr);gap:16px}
.qb-totals-list{padding:8px 0;border:1px solid #e8e9f1;border-radius:20px;background:#fff}
.qb-totals-list div{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:12px 22px;border-bottom:1px solid #f4f5f8}
.qb-totals-list div:last-child{border-bottom:0}
.qb-totals-list span{color:#6f788a;font-size:12px;font-weight:600}
.qb-totals-list b{font-size:13px}
.qb-totals-figures{display:flex;flex-direction:column;gap:12px}
.qb-total-box{padding:22px 24px;border-radius:20px;background:#f1efff;border:1px solid #ded8ff}
.qb-total-box small{display:block;color:#6d5dfc;font-size:11px;font-weight:900;margin-bottom:8px}
.qb-total-box strong{font-size:27px;color:#5c42c7}
.qb-total-box em{display:block;margin-top:6px;font-style:normal;font-size:11px;color:#7b839a}
.qb-box-good{background:linear-gradient(120deg,#e9fbf5,#f7fffc);border-color:#cdf1e4}
.qb-box-good small{color:var(--green)}
.qb-box-good strong{color:#0b7f66}
.qb-box-bad{background:linear-gradient(120deg,#fff0f2,#fff8f9);border-color:#ffd3dc}
.qb-box-bad small{color:var(--red)}
.qb-box-bad strong{color:#b32742}

@media(max-width:1200px){
  .qb-meta{grid-template-columns:repeat(2,minmax(0,1fr))}
  .qb-gate{grid-template-columns:auto minmax(0,1fr);row-gap:16px}
  .qb-gate-figures{grid-column:1/-1}
  .qb-totals{grid-template-columns:1fr}
}
@media(max-width:760px){
  .qb-hero{flex-direction:column}
  .qb-actions{width:100%;justify-content:flex-start}
  .qb-meta{grid-template-columns:1fr}
  .qb-meta-wide{grid-column:auto}
  .qb-package-menu{left:12px;right:12px;min-width:0}
}
`;
