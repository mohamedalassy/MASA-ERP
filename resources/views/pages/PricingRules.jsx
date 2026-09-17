import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgePercent,
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCcw,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const emptyForm = {
  name: "",
  scope_type: "global",
  scope_id: "",
  minimum_margin_percent: 15,
  target_margin_percent: 25,
  default_markup_percent: 30,
  maximum_discount_percent: 10,
  block_below_minimum_margin: true,
  require_approval_below_target: true,
  is_active: true,
  priority: 100,
};

const num = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function PricingRules({ onNavigate }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const loadRules = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/pricing-rules`, {
        headers: { Accept: "application/json" },
      });

      const json = await response.json();

      if (!response.ok || !json?.success) {
        throw new Error(json?.message || "تعذر تحميل قواعد التسعير.");
      }

      setRows(Array.isArray(json?.data) ? json.data : []);
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر تحميل قواعد التسعير.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.is_active).length;
    const protectedRules = rows.filter((r) => r.block_below_minimum_margin).length;
    const approvalRules = rows.filter((r) => r.require_approval_below_target).length;

    return {
      total: rows.length,
      active,
      protectedRules,
      approvalRules,
    };
  }, [rows]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage("");
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      ...emptyForm,
      ...row,
      scope_id: row.scope_id ?? "",
    });
    setMessage("");
    setModalOpen(true);
  };

  const saveRule = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");

      const payload = {
        ...form,
        scope_id:
          form.scope_type === "global" || form.scope_id === ""
            ? null
            : Number(form.scope_id),
        minimum_margin_percent: Number(form.minimum_margin_percent || 0),
        target_margin_percent: Number(form.target_margin_percent || 0),
        default_markup_percent: Number(form.default_markup_percent || 0),
        maximum_discount_percent: Number(form.maximum_discount_percent || 0),
        priority: Number(form.priority || 100),
        block_below_minimum_margin: Boolean(form.block_below_minimum_margin),
        require_approval_below_target: Boolean(form.require_approval_below_target),
        is_active: Boolean(form.is_active),
      };

      const url = editingId
        ? `${API_URL}/pricing-rules/${editingId}`
        : `${API_URL}/pricing-rules`;

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
        const firstError = json?.errors
          ? Object.values(json.errors)?.flat()?.find(Boolean)
          : null;

        throw new Error(firstError || json?.message || "تعذر حفظ قاعدة التسعير.");
      }

      setModalOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadRules();
    } catch (err) {
      console.error(err);
      setMessage(err.message || "تعذر حفظ قاعدة التسعير.");
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async (row) => {
    if (!window.confirm(`حذف قاعدة "${row.name}"؟`)) return;

    try {
      const response = await fetch(`${API_URL}/pricing-rules/${row.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      const json = await response.json();

      if (!response.ok || !json?.success) {
        throw new Error(json?.message || "تعذر حذف القاعدة.");
      }

      await loadRules();
    } catch (err) {
      console.error(err);
      setError(err.message || "تعذر حذف القاعدة.");
    }
  };

  return (
    <section className="pr-page" dir="rtl">
      <style>{`
        .pr-page{color:#262d3d;padding-bottom:28px}
        .pr-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;margin-bottom:16px}
        .pr-kicker{font-size:10px;font-weight:900;color:#6757f5;margin-bottom:5px}
        .pr-head h1{font-size:24px;margin:0}.pr-head p{font-size:10px;color:#969dac;margin:6px 0 0}
        .pr-actions{display:flex;gap:8px}
        .pr-btn{border:1px solid #e4e7ef;background:#fff;border-radius:10px;padding:9px 12px;font-family:inherit;font-weight:800;font-size:9px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
        .pr-btn.primary{background:#6657f5;color:#fff;border-color:#6657f5}
        .pr-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:13px}
        .pr-stat{background:#fff;border:1px solid #e8eaf1;border-radius:14px;padding:14px}
        .pr-stat small{display:block;color:#9ba2b0;font-size:8px;margin-bottom:5px}.pr-stat strong{font-size:18px}
        .pr-card{background:#fff;border:1px solid #e8eaf1;border-radius:16px;overflow:hidden}
        .pr-table{width:100%;border-collapse:collapse;min-width:1000px}
        .pr-table th{background:#fafbfc;color:#8f96a7;font-size:8px;padding:10px;text-align:right;border-bottom:1px solid #e9ecf2}
        .pr-table td{padding:12px 10px;border-bottom:1px solid #eef0f4;font-size:9px;vertical-align:middle}
        .pr-badge{display:inline-flex;border-radius:999px;padding:4px 7px;font-size:7px;font-weight:900}
        .pr-badge.green{background:#eaf8f1;color:#15805d}.pr-badge.orange{background:#fff3e7;color:#c97417}.pr-badge.purple{background:#f1efff;color:#6657f5}.pr-badge.gray{background:#f1f2f5;color:#747b89}
        .pr-row-actions{display:flex;gap:5px}.pr-icon-btn{width:30px;height:30px;border-radius:8px;border:1px solid #e5e8ef;background:#fff;display:grid;place-items:center;cursor:pointer}
        .pr-empty{padding:35px;text-align:center;color:#9ba2b0;font-size:9px}
        .pr-error{margin-bottom:10px;padding:9px 11px;border:1px solid #f0d7d8;background:#fff7f7;color:#bd5257;border-radius:10px;font-size:9px}
        .pr-modal-backdrop{position:fixed;inset:0;background:rgba(21,25,35,.26);display:flex;align-items:center;justify-content:center;padding:20px;z-index:1000}
        .pr-modal{width:min(720px,100%);background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(32,38,55,.2);overflow:hidden}
        .pr-modal-head{display:flex;justify-content:space-between;align-items:center;padding:15px 18px;border-bottom:1px solid #eceef3}
        .pr-modal-head h3{margin:0;font-size:17px}.pr-modal-body{padding:17px}
        .pr-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pr-field{display:flex;flex-direction:column;gap:5px}.pr-field.full{grid-column:1/-1}
        .pr-field label{font-size:8px;font-weight:800;color:#737b8e}.pr-input,.pr-select{border:1px solid #e3e6ee;border-radius:9px;min-height:38px;padding:0 10px;font-family:inherit;font-size:9px}
        .pr-checks{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}
        .pr-check{border:1px solid #e6e9f0;border-radius:10px;padding:10px;font-size:8px;display:flex;gap:7px;align-items:flex-start}
        .pr-modal-foot{display:flex;justify-content:flex-start;gap:8px;padding:13px 18px;border-top:1px solid #eceef3;background:#fafbfc}
        .pr-msg{margin-top:10px;padding:8px 10px;border-radius:9px;background:#fff6f6;color:#b34d52;font-size:8px}
        @media(max-width:800px){.pr-stats{grid-template-columns:1fr 1fr}.pr-grid,.pr-checks{grid-template-columns:1fr}}
        @media(max-width:560px){.pr-head{flex-direction:column}.pr-stats{grid-template-columns:1fr}}
      `}</style>

      <div className="pr-head">
        <div>
          <div className="pr-kicker">مركز التسعير / قواعد التسعير</div>
          <h1>Pricing Rules</h1>
          <p>حدد الحد الأدنى للربح والهامش المستهدف والخصومات المسموح بها.</p>
        </div>

        <div className="pr-actions">
          <button className="pr-btn" type="button" onClick={() => onNavigate?.("pricing")}>
            <ArrowRight size={13} />
            العودة
          </button>

          <button className="pr-btn primary" type="button" onClick={openCreate}>
            <Plus size={13} />
            قاعدة جديدة
          </button>
        </div>
      </div>

      {error && <div className="pr-error">{error}</div>}

      <div className="pr-stats">
        <div className="pr-stat"><small>إجمالي القواعد</small><strong>{stats.total}</strong></div>
        <div className="pr-stat"><small>قواعد فعالة</small><strong>{stats.active}</strong></div>
        <div className="pr-stat"><small>حماية الحد الأدنى</small><strong>{stats.protectedRules}</strong></div>
        <div className="pr-stat"><small>تتطلب موافقة</small><strong>{stats.approvalRules}</strong></div>
      </div>

      <div className="pr-card" style={{ overflowX: "auto" }}>
        {loading ? (
          <div className="pr-empty">جاري تحميل قواعد التسعير...</div>
        ) : rows.length ? (
          <table className="pr-table">
            <thead>
              <tr>
                <th>القاعدة</th>
                <th>النطاق</th>
                <th>أقل هامش</th>
                <th>الهامش المستهدف</th>
                <th>Markup</th>
                <th>أقصى خصم</th>
                <th>السياسات</th>
                <th>الأولوية</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.name}</strong></td>
                  <td>
                    <span className="pr-badge purple">
                      {row.scope_type === "global"
                        ? "عام"
                        : row.scope_type === "product"
                        ? `منتج #${row.scope_id}`
                        : `عميل #${row.scope_id}`}
                    </span>
                  </td>
                  <td>{num(row.minimum_margin_percent)}%</td>
                  <td><strong>{num(row.target_margin_percent)}%</strong></td>
                  <td>{num(row.default_markup_percent)}%</td>
                  <td>{num(row.maximum_discount_percent)}%</td>
                  <td>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {row.block_below_minimum_margin && (
                        <span className="pr-badge orange">
                          <ShieldAlert size={9} />
                          منع تحت الحد
                        </span>
                      )}
                      {row.require_approval_below_target && (
                        <span className="pr-badge purple">
                          موافقة تحت Target
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{row.priority}</td>
                  <td>
                    <span className={`pr-badge ${row.is_active ? "green" : "gray"}`}>
                      {row.is_active ? "فعال" : "موقوف"}
                    </span>
                  </td>
                  <td>
                    <div className="pr-row-actions">
                      <button className="pr-icon-btn" type="button" onClick={() => openEdit(row)}>
                        <Pencil size={12} />
                      </button>
                      <button className="pr-icon-btn" type="button" onClick={() => deleteRule(row)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="pr-empty">
            لا توجد قواعد تسعير حتى الآن. أنشئ أول قاعدة عامة للنظام.
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="pr-modal-backdrop">
          <form className="pr-modal" onSubmit={saveRule}>
            <div className="pr-modal-head">
              <h3>{editingId ? "تعديل قاعدة التسعير" : "قاعدة تسعير جديدة"}</h3>
              <button
                type="button"
                className="pr-icon-btn"
                onClick={() => setModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            <div className="pr-modal-body">
              <div className="pr-grid">
                <div className="pr-field full">
                  <label>اسم القاعدة</label>
                  <input
                    className="pr-input"
                    value={form.name}
                    onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                    placeholder="مثال: القاعدة العامة للمبيعات"
                    required
                  />
                </div>

                <div className="pr-field">
                  <label>نطاق القاعدة</label>
                  <select
                    className="pr-select"
                    value={form.scope_type}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        scope_type: e.target.value,
                        scope_id: e.target.value === "global" ? "" : c.scope_id,
                      }))
                    }
                  >
                    <option value="global">عام - Global</option>
                    <option value="product">منتج محدد</option>
                    <option value="customer">عميل محدد</option>
                  </select>
                </div>

                <div className="pr-field">
                  <label>Scope ID</label>
                  <input
                    className="pr-input"
                    type="number"
                    min="1"
                    disabled={form.scope_type === "global"}
                    value={form.scope_id}
                    onChange={(e) => setForm((c) => ({ ...c, scope_id: e.target.value }))}
                    placeholder={form.scope_type === "global" ? "غير مطلوب" : "ID"}
                  />
                </div>

                <div className="pr-field">
                  <label>الحد الأدنى للهامش %</label>
                  <input
                    className="pr-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="99.99"
                    value={form.minimum_margin_percent}
                    onChange={(e) => setForm((c) => ({ ...c, minimum_margin_percent: e.target.value }))}
                  />
                </div>

                <div className="pr-field">
                  <label>الهامش المستهدف %</label>
                  <input
                    className="pr-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="99.99"
                    value={form.target_margin_percent}
                    onChange={(e) => setForm((c) => ({ ...c, target_margin_percent: e.target.value }))}
                  />
                </div>

                <div className="pr-field">
                  <label>Default Markup %</label>
                  <input
                    className="pr-input"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.default_markup_percent}
                    onChange={(e) => setForm((c) => ({ ...c, default_markup_percent: e.target.value }))}
                  />
                </div>

                <div className="pr-field">
                  <label>أقصى خصم %</label>
                  <input
                    className="pr-input"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={form.maximum_discount_percent}
                    onChange={(e) => setForm((c) => ({ ...c, maximum_discount_percent: e.target.value }))}
                  />
                </div>

                <div className="pr-field">
                  <label>الأولوية</label>
                  <input
                    className="pr-input"
                    type="number"
                    min="1"
                    value={form.priority}
                    onChange={(e) => setForm((c) => ({ ...c, priority: e.target.value }))}
                  />
                </div>
              </div>

              <div className="pr-checks">
                <label className="pr-check">
                  <input
                    type="checkbox"
                    checked={form.block_below_minimum_margin}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        block_below_minimum_margin: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>منع البيع تحت الحد الأدنى</strong>
                  </span>
                </label>

                <label className="pr-check">
                  <input
                    type="checkbox"
                    checked={form.require_approval_below_target}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        require_approval_below_target: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>موافقة عند النزول عن Target</strong>
                  </span>
                </label>

                <label className="pr-check">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        is_active: e.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>القاعدة فعالة</strong>
                  </span>
                </label>
              </div>

              {message && <div className="pr-msg">{message}</div>}
            </div>

            <div className="pr-modal-foot">
              <button type="submit" className="pr-btn primary" disabled={saving}>
                <CheckCircle2 size={13} />
                {saving ? "جاري الحفظ..." : "حفظ القاعدة"}
              </button>

              <button type="button" className="pr-btn" onClick={() => setModalOpen(false)}>
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
