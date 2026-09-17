import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  FileText,
  Plus,
  Save,
  Trash2,
  TrendingUp,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const defaultComponents = [
  { type: "labor", label: "العمالة", calculation_mode: "fixed", percentage_basis: "materials", fixed_amount: 0, percentage: 0 },
  { type: "installation", label: "التركيب", calculation_mode: "fixed", percentage_basis: "materials", fixed_amount: 0, percentage: 0 },
  { type: "freight", label: "الشحن والنقل", calculation_mode: "fixed", percentage_basis: "materials", fixed_amount: 0, percentage: 0 },
  { type: "customs", label: "الجمارك", calculation_mode: "fixed", percentage_basis: "materials", fixed_amount: 0, percentage: 0 },
  { type: "overhead", label: "المصاريف الإدارية", calculation_mode: "percentage", percentage_basis: "running_subtotal", fixed_amount: 0, percentage: 5 },
  { type: "contingency", label: "الاحتياطي / المخاطر", calculation_mode: "percentage", percentage_basis: "running_subtotal", fixed_amount: 0, percentage: 3 },
  { type: "commission", label: "عمولة المبيعات", calculation_mode: "fixed", percentage_basis: "materials", fixed_amount: 0, percentage: 0 },
];

export default function CostingEngine({ onNavigate }) {
  const [projects, setProjects] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [quotationId, setQuotationId] = useState("");
  const [costingId, setCostingId] = useState(null);
  const [title, setTitle] = useState("Project Costing");
  const [materialCost, setMaterialCost] = useState(0);
  const [currentSale, setCurrentSale] = useState(0);
  const [minimumMargin, setMinimumMargin] = useState(15);
  const [targetMargin, setTargetMargin] = useState(25);
  const [taxRate, setTaxRate] = useState(15);
  const [components, setComponents] = useState(defaultComponents);
  const [summary, setSummary] = useState(null);
  const [loadingQuotation, setLoadingQuotation] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [boqSnapshot, setBoqSnapshot] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/projects`, { headers: { Accept: "application/json" } }).then((r) => r.json()),
      fetch(`${API_URL}/quotations`, { headers: { Accept: "application/json" } }).then((r) => r.json()),
    ])
      .then(([p, q]) => {
        setProjects(Array.isArray(p?.data) ? p.data : []);
        setQuotations(Array.isArray(q?.data) ? q.data : []);
      })
      .catch((error) => console.error("Costing initial load:", error));
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem("masa_boq_to_costing");
    if (!raw) return;

    try {
      const snapshot = JSON.parse(raw);
      setBoqSnapshot(snapshot);

      if (snapshot?.project_id) {
        setProjectId(String(snapshot.project_id));
      }

      if (snapshot?.quotation_id) {
        setQuotationId(String(snapshot.quotation_id));
      }

      if (snapshot?.material_cost !== undefined) {
        setMaterialCost(Number(snapshot.material_cost || 0));
      }

      if (snapshot?.current_sale !== undefined) {
        setCurrentSale(Number(snapshot.current_sale || 0));
      }

      if (snapshot?.target_margin !== undefined) {
        setTargetMargin(Number(snapshot.target_margin || 0));
      }

      if (snapshot?.tax_rate !== undefined) {
        setTaxRate(Number(snapshot.tax_rate || 0));
      }

      const incomingExtras = snapshot?.extra_costs || {};
      const hasIncomingExtras = Object.values(incomingExtras).some(
        (value) => Number(value || 0) !== 0
      );

      if (hasIncomingExtras) {
        setComponents((current) =>
          current.map((row) =>
            Object.prototype.hasOwnProperty.call(incomingExtras, row.type)
              ? {
                  ...row,
                  calculation_mode: "fixed",
                  fixed_amount: Number(incomingExtras[row.type] || 0),
                  percentage: 0,
                }
              : row
          )
        );
      }

      setMessage("تم استلام بيانات الـ BOQ الحالية داخل Costing Engine.");
    } catch (error) {
      console.error("BOQ to costing handoff error:", error);
      sessionStorage.removeItem("masa_boq_to_costing");
    }
  }, []);

  const projectQuotations = useMemo(() => {
    if (!projectId) return [];
    return quotations.filter(
      (q) => String(q.project_id || q.project?.id) === String(projectId)
    );
  }, [quotations, projectId]);

  const payload = () => ({
    project_id: projectId ? Number(projectId) : null,
    quotation_id: quotationId ? Number(quotationId) : null,
    title,
    currency: "SAR",
    material_cost: Number(materialCost || 0),
    minimum_margin_percent: Number(minimumMargin || 0),
    target_margin_percent: Number(targetMargin || 0),
    tax_rate: Number(taxRate || 0),
    current_sale: Number(currentSale || 0),
    status: "draft",
    components: components.map((row, index) => ({
      ...row,
      fixed_amount: Number(row.fixed_amount || 0),
      percentage: Number(row.percentage || 0),
      sort_order: index,
    })),
  });

  const calculate = async ({ silent = false } = {}) => {
    setCalculating(true);
    try {
      const response = await fetch(`${API_URL}/pricing-costings/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload()),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.message || "تعذر حساب التكلفة.");
      setSummary(json?.data || null);
      if (!silent) setMessage("تم تحديث حساب التكلفة.");
      return json?.data;
    } catch (error) {
      setMessage(error.message || "تعذر حساب التكلفة.");
      return null;
    } finally {
      setCalculating(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => calculate({ silent: true }), 250);
    return () => clearTimeout(timer);
  }, [materialCost, currentSale, minimumMargin, targetMargin, taxRate, components]);

  const loadQuotation = async (id) => {
    setQuotationId(id);
    if (!id || !projectId) return;

    setLoadingQuotation(true);
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/projects/${projectId}/quotations/${id}`,
        { headers: { Accept: "application/json" } }
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json?.message || "تعذر تحميل عرض السعر.");

      const quotation = json?.data || {};
      const rows = Array.isArray(quotation.items) ? quotation.items : [];

      const materials = rows.reduce(
        (sum, row) =>
          sum + Number(row.quantity || 0) * Number(row.cost_price || 0),
        0
      );

      const sale = rows.reduce((sum, row) => {
        const gross = Number(row.quantity || 0) * Number(row.unit_price || 0);
        return sum + Math.max(0, gross - Number(row.discount || 0));
      }, 0);

      setMaterialCost(Number(materials.toFixed(2)));
      setCurrentSale(Number(sale.toFixed(2)));
      setMessage(
        `تم سحب تكلفة المواد من ${quotation.quotation_number || "عرض السعر"} بنجاح.`
      );
    } catch (error) {
      setMessage(error.message || "تعذر تحميل عرض السعر.");
    } finally {
      setLoadingQuotation(false);
    }
  };

  const updateComponent = (index, field, value) => {
    setComponents((current) =>
      current.map((row, i) =>
        i === index
          ? {
              ...row,
              [field]:
                ["fixed_amount", "percentage"].includes(field)
                  ? Number(value || 0)
                  : value,
            }
          : row
      )
    );
  };

  const addComponent = () => {
    setComponents((current) => [
      ...current,
      {
        type: "other",
        label: "تكلفة إضافية",
        calculation_mode: "fixed",
        percentage_basis: "materials",
        fixed_amount: 0,
        percentage: 0,
      },
    ]);
  };

  const removeComponent = (index) => {
    setComponents((current) => current.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const url = costingId
        ? `${API_URL}/pricing-costings/${costingId}`
        : `${API_URL}/pricing-costings`;

      const response = await fetch(url, {
        method: costingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload()),
      });

      const json = await response.json();
      if (!response.ok) {
        throw new Error(
          json?.message ||
            Object.values(json?.errors || {})?.flat()?.[0] ||
            "تعذر حفظ حساب التكلفة."
        );
      }

      if (json?.data?.id) setCostingId(json.data.id);
      setSummary(json?.data?.summary || summary);
      setMessage(json?.message || "تم حفظ حساب التكلفة.");
      return json?.data || null;
    } catch (error) {
      setMessage(error.message || "تعذر حفظ حساب التكلفة.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const applyToBoq = async () => {
    if (!boqSnapshot) {
      setMessage("افتح Costing Engine من داخل الـ BOQ أولًا.");
      return;
    }

    const calculated = await calculate({ silent: true });

    if (!calculated) {
      setMessage("تعذر حساب التكلفة قبل تطبيقها على عرض السعر.");
      return;
    }

    const saved = await save();

    if (!saved && (projectId || quotationId)) {
      return;
    }

    const knownTypes = [
      "labor",
      "installation",
      "freight",
      "customs",
      "overhead",
      "contingency",
      "commission",
    ];

    const extraCosts = knownTypes.reduce((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {});

    (calculated.components || []).forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(extraCosts, row.type)) {
        extraCosts[row.type] += Number(row.calculated_amount || 0);
      }
    });

    sessionStorage.setItem(
      "masa_costing_to_boq",
      JSON.stringify({
        costing_id: saved?.id || costingId || null,
        boq_snapshot: boqSnapshot,
        extra_costs: extraCosts,
        target_margin: Number(targetMargin || 0),
        tax_rate: Number(taxRate || 0),
        total_cost: Number(calculated.total_cost || 0),
        break_even_price: Number(calculated.break_even_price || 0),
        minimum_price: Number(calculated.minimum_price || 0),
        target_price: Number(calculated.target_price || 0),
        recommended_price: Number(calculated.recommended_price || 0),
      })
    );

    onNavigate?.("pricing-builder", {
      projectId: boqSnapshot?.project_id || projectId || null,
      quotationId: boqSnapshot?.quotation_id || quotationId || null,
    });
  };

  return (
    <section className="ce-page" dir="rtl">
      <style>{`
        .ce-page{color:#252b3d;padding-bottom:30px}
        .ce-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;margin-bottom:16px}
        .ce-kicker{color:#6657f5;font-size:10px;font-weight:900;margin-bottom:5px}
        .ce-head h1{margin:0;font-size:26px}.ce-head p{margin:6px 0 0;color:#969dab;font-size:10px}
        .ce-back,.ce-btn{border:1px solid #e4e7ef;background:#fff;border-radius:10px;padding:9px 12px;font-family:inherit;font-weight:800;font-size:9px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
        .ce-btn.primary{background:#6657f5;border-color:#6657f5;color:#fff}
        .ce-message{padding:10px 12px;border-radius:10px;background:#f5f3ff;color:#6557f5;font-size:9px;font-weight:800;margin-bottom:12px}
        .ce-meta{display:grid;grid-template-columns:1.4fr 1.4fr 1fr 1fr 1fr;gap:10px;background:#fff;border:1px solid #e8eaf1;border-radius:16px;padding:14px;margin-bottom:12px}
        .ce-field label{display:block;font-size:8px;color:#999fad;margin-bottom:5px}.ce-field input,.ce-field select{width:100%;box-sizing:border-box;border:1px solid #e4e7ef;border-radius:9px;padding:9px;font-family:inherit;font-size:9px;background:#fff}
        .ce-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(330px,.7fr);gap:12px}
        .ce-card{background:#fff;border:1px solid #e8eaf1;border-radius:16px;overflow:hidden}
        .ce-card-head{padding:14px 16px;border-bottom:1px solid #eef0f5;display:flex;align-items:center;justify-content:space-between;font-weight:900;font-size:11px}
        .ce-material{padding:15px 16px;border-bottom:1px solid #eef0f5;background:#fbfaff}
        .ce-material-row{display:grid;grid-template-columns:1fr 180px;gap:10px;align-items:center}
        .ce-material strong{font-size:11px}.ce-material small{display:block;color:#989faf;font-size:8px;margin-top:3px}
        .ce-material input{border:1px solid #dcd8ff;border-radius:9px;padding:9px;font-family:inherit;width:100%;box-sizing:border-box}
        .ce-component{display:grid;grid-template-columns:1.2fr 115px 115px 140px 36px;gap:8px;align-items:end;padding:11px 14px;border-bottom:1px solid #f0f2f5}
        .ce-component:last-child{border-bottom:0}
        .ce-component input,.ce-component select{width:100%;box-sizing:border-box;border:1px solid #e5e7ee;border-radius:8px;padding:8px;font-family:inherit;font-size:8px;background:#fff}
        .ce-delete{height:33px;border:0;border-radius:8px;background:#fff0f0;color:#d44f55;cursor:pointer}
        .ce-summary{padding:15px}.ce-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .ce-summary-box{background:#fafbfc;border:1px solid #eef0f4;border-radius:11px;padding:10px}
        .ce-summary-box span{display:block;font-size:7px;color:#989fad}.ce-summary-box strong{display:block;font-size:13px;margin-top:4px}
        .ce-summary-box.hero{grid-column:1/-1;background:#6657f5;color:#fff;border-color:#6657f5}.ce-summary-box.hero span{color:#e7e3ff}.ce-summary-box.hero strong{font-size:20px}
        .ce-current{margin-top:12px;padding:11px;border-radius:11px;background:#f8f7ff;border:1px solid #e5e1ff}
        .ce-current-row{display:flex;justify-content:space-between;padding:5px 0;font-size:9px}
        .ce-actions{display:flex;gap:8px;margin-top:12px}
        @media(max-width:1050px){.ce-meta{grid-template-columns:1fr 1fr}.ce-grid{grid-template-columns:1fr}}
        @media(max-width:700px){.ce-meta{grid-template-columns:1fr}.ce-component{grid-template-columns:1fr 1fr}.ce-material-row{grid-template-columns:1fr}}
      `}</style>

      <div className="ce-head">
        <div>
          <button
            className="ce-back"
            onClick={() =>
              boqSnapshot
                ? onNavigate?.("pricing-builder", {
                    projectId: boqSnapshot?.project_id || null,
                    quotationId: boqSnapshot?.quotation_id || null,
                  })
                : onNavigate?.("pricing")
            }
          >
            <ArrowRight size={13} />
            {boqSnapshot ? "العودة للـ BOQ" : "العودة للتسعير"}
          </button>
          <div className="ce-kicker" style={{ marginTop: 11 }}>مركز التسعير / Costing Engine</div>
          <h1>حساب تكلفة المشروع</h1>
          <p>احسب التكلفة الحقيقية وسعر التعادل والحد الأدنى والسعر المستهدف قبل اعتماد العرض.</p>
        </div>
        <div className="ce-actions">
          <button className="ce-btn" onClick={() => calculate()}>
            <Calculator size={13} /> إعادة الحساب
          </button>
          <button className="ce-btn primary" onClick={save} disabled={saving}>
            <Save size={13} /> {saving ? "جاري الحفظ..." : "حفظ"}
          </button>

          {boqSnapshot && (
            <button
              className="ce-btn primary"
              onClick={applyToBoq}
              disabled={saving || calculating}
            >
              <ArrowRight size={13} />
              تطبيق على عرض السعر
            </button>
          )}
        </div>
      </div>

      {message && <div className="ce-message">{message}</div>}

      <div className="ce-meta">
        <div className="ce-field">
          <label>المشروع</label>
          <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setQuotationId(""); }}>
            <option value="">بدون مشروع / حساب مستقل</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name || p.project_code || `Project #${p.id}`}</option>)}
          </select>
        </div>

        <div className="ce-field">
          <label>سحب تكلفة المواد من عرض سعر</label>
          <select value={quotationId} onChange={(e) => loadQuotation(e.target.value)} disabled={!projectId || loadingQuotation}>
            <option value="">إدخال يدوي</option>
            {projectQuotations.map((q) => <option key={q.id} value={q.id}>{q.quotation_number || `#${q.id}`} — V{q.version || 1}</option>)}
          </select>
        </div>

        <div className="ce-field">
          <label>Minimum Margin %</label>
          <input dir="ltr" type="number" value={minimumMargin} onChange={(e) => setMinimumMargin(Number(e.target.value || 0))} />
        </div>

        <div className="ce-field">
          <label>Target Margin %</label>
          <input dir="ltr" type="number" value={targetMargin} onChange={(e) => setTargetMargin(Number(e.target.value || 0))} />
        </div>

        <div className="ce-field">
          <label>الضريبة %</label>
          <input dir="ltr" type="number" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value || 0))} />
        </div>
      </div>

      <div className="ce-grid">
        <div className="ce-card">
          <div className="ce-card-head">
            <span>مكونات التكلفة</span>
            <button className="ce-btn" onClick={addComponent}><Plus size={12} /> إضافة تكلفة</button>
          </div>

          <div className="ce-material">
            <div className="ce-material-row">
              <div>
                <strong>تكلفة المواد / المنتجات</strong>
                <small>يمكن إدخالها يدويًا أو سحبها تلقائيًا من الـ BOQ.</small>
              </div>
              <input dir="ltr" type="number" value={materialCost} onChange={(e) => setMaterialCost(Number(e.target.value || 0))} />
            </div>
          </div>

          {components.map((row, index) => (
            <div className="ce-component" key={`${row.type}-${index}`}>
              <div className="ce-field">
                <label>البند</label>
                <input value={row.label} onChange={(e) => updateComponent(index, "label", e.target.value)} />
              </div>

              <div className="ce-field">
                <label>طريقة الحساب</label>
                <select value={row.calculation_mode} onChange={(e) => updateComponent(index, "calculation_mode", e.target.value)}>
                  <option value="fixed">مبلغ ثابت</option>
                  <option value="percentage">نسبة %</option>
                </select>
              </div>

              <div className="ce-field">
                <label>{row.calculation_mode === "percentage" ? "النسبة %" : "القيمة"}</label>
                <input
                  dir="ltr"
                  type="number"
                  value={row.calculation_mode === "percentage" ? row.percentage : row.fixed_amount}
                  onChange={(e) =>
                    updateComponent(
                      index,
                      row.calculation_mode === "percentage" ? "percentage" : "fixed_amount",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="ce-field">
                <label>أساس النسبة</label>
                <select
                  value={row.percentage_basis}
                  disabled={row.calculation_mode !== "percentage"}
                  onChange={(e) => updateComponent(index, "percentage_basis", e.target.value)}
                >
                  <option value="materials">تكلفة المواد</option>
                  <option value="running_subtotal">الإجمالي الجاري</option>
                </select>
              </div>

              <button className="ce-delete" onClick={() => removeComponent(index)} title="حذف">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div className="ce-card">
          <div className="ce-card-head">
            <span>نتيجة التسعير</span>
            {calculating ? <span style={{ color: "#9ba1af", fontSize: 8 }}>جاري الحساب...</span> : <CheckCircle2 size={14} color="#18a777" />}
          </div>

          <div className="ce-summary">
            <div className="ce-summary-grid">
              <div className="ce-summary-box">
                <span>Total Cost</span>
                <strong>{money(summary?.total_cost)} ر.س</strong>
              </div>
              <div className="ce-summary-box">
                <span>Break-even</span>
                <strong>{money(summary?.break_even_price)} ر.س</strong>
              </div>
              <div className="ce-summary-box">
                <span>Minimum Price</span>
                <strong>{money(summary?.minimum_price)} ر.س</strong>
              </div>
              <div className="ce-summary-box">
                <span>Target Price</span>
                <strong>{money(summary?.target_price)} ر.س</strong>
              </div>
              <div className="ce-summary-box hero">
                <span>Recommended Price</span>
                <strong>{money(summary?.recommended_price)} ر.س</strong>
              </div>
              <div className="ce-summary-box">
                <span>Target Profit</span>
                <strong>{money(summary?.target_profit)} ر.س</strong>
              </div>
              <div className="ce-summary-box">
                <span>Target Markup</span>
                <strong>{Number(summary?.target_markup_percent || 0).toFixed(2)}%</strong>
              </div>
            </div>

            <div className="ce-current">
              <div style={{ fontWeight: 900, fontSize: 10, marginBottom: 5 }}>
                مقارنة مع عرض السعر الحالي
              </div>
              <div className="ce-current-row"><span>قيمة البيع الحالية</span><strong>{money(currentSale)} ر.س</strong></div>
              <div className="ce-current-row"><span>الربح الحالي</span><strong>{money(summary?.current_profit)} ر.س</strong></div>
              <div className="ce-current-row"><span>Margin الحالي</span><strong>{Number(summary?.current_margin_percent || 0).toFixed(2)}%</strong></div>
              <div className="ce-current-row"><span>Markup الحالي</span><strong>{Number(summary?.current_markup_percent || 0).toFixed(2)}%</strong></div>
            </div>

            <div style={{ marginTop: 12, padding: 11, borderRadius: 10, background: "#fafbfc", fontSize: 8, color: "#7d8494", lineHeight: 1.8 }}>
              السعر المقترح شامل الضريبة: <strong style={{ color: "#6557f5" }}>{money(summary?.recommended_price_with_tax)} ر.س</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
