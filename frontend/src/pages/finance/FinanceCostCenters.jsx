import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Layers3,
  Network,
  PieChart,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  API,
  FinancePageShell,
  FinanceTable,
  InsightStrip,
  KpiGrid,
  SectionCard,
} from "./FinancePageShared";

function FinanceCostCenters() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);

  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    parent_id: "",
    is_active: true,
  });

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API}/finance/cost-centers`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "تعذر تحميل مراكز التكلفة."
        );
      }

      setRows(result.data || []);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل البيانات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const active = rows.filter((row) => row.is_active).length;
  const parents = rows.filter((row) => !row.parent_id).length;
  const children = rows.filter((row) => row.parent_id).length;

  const maxLevel = useMemo(
    () =>
      Math.max(
        0,
        ...rows.map((row) => Number(row.level || 0))
      ),
    [rows]
  );

  const save = async (event) => {
    event.preventDefault();

    const response = await fetch(`${API}/finance/cost-centers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        parent_id: form.parent_id
          ? Number(form.parent_id)
          : null,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert(
        result.message ||
          Object.values(result.errors || {}).flat().join("\n") ||
          "تعذر حفظ مركز التكلفة."
      );
      return;
    }

    setModal(false);
    setForm({
      code: "",
      name: "",
      description: "",
      parent_id: "",
      is_active: true,
    });

    load();
  };

  return (
    <FinancePageShell
      icon={PieChart}
      title="مراكز التكلفة"
      description="هيكل تحليلي لتوزيع المصروفات والإيرادات على الإدارات والمشاريع والوحدات التشغيلية."
      onRefresh={load}
      loading={loading}
      error={error}
      actions={
        <button
          className="finx-btn finx-btn-primary"
          type="button"
          onClick={() => setModal(true)}
        >
          <Plus size={16} />
          مركز تكلفة جديد
        </button>
      }
    >
      <KpiGrid
        items={[
          {
            label: "إجمالي المراكز",
            value: rows.length,
            icon: Layers3,
            tone: "purple",
          },
          {
            label: "المراكز النشطة",
            value: active,
            icon: ShieldCheck,
            tone: "green",
          },
          {
            label: "مراكز رئيسية",
            value: parents,
            icon: Network,
            tone: "blue",
          },
          {
            label: "مراكز فرعية",
            value: children,
            icon: Activity,
            tone: "orange",
          },
        ]}
      />

      <InsightStrip
        items={[
          {
            label: "أقصى مستوى هيكلي",
            value: maxLevel,
            icon: Layers3,
          },
          {
            label: "نسبة المراكز النشطة",
            value:
              rows.length > 0
                ? `${Math.round((active / rows.length) * 100)}%`
                : "0%",
            icon: ShieldCheck,
          },
          {
            label: "مراكز رئيسية",
            value: parents,
            icon: Network,
          },
          {
            label: "مراكز فرعية",
            value: children,
            icon: Activity,
          },
        ]}
      />

      <div className="finx-grid">
        <SectionCard
          className="finx-span-12"
          title="هيكل مراكز التكلفة"
          subtitle="المراكز الرئيسية والفرعية وحالة التشغيل"
          icon={PieChart}
        >
          <FinanceTable
            rows={rows}
            columns={[
              { key: "code", label: "الكود" },
              { key: "name", label: "اسم المركز" },
              {
                key: "parent",
                label: "المركز الأب",
                render: (row) => row.parent?.name || "مركز رئيسي",
              },
              {
                key: "level",
                label: "المستوى",
                render: (row) => row.level ?? "—",
              },
              { key: "description", label: "الوصف" },
              {
                key: "is_active",
                label: "الحالة",
                render: (row) =>
                  row.is_active ? "نشط" : "موقوف",
              },
            ]}
          />
        </SectionCard>
      </div>

      {modal && (
        <div className="acc-modal-backdrop">
          <form className="acc-modal" onSubmit={save}>
            <div className="acc-modal-head">
              <div>
                <h3>إضافة مركز تكلفة</h3>
                <p>إنشاء مركز جديد داخل الهيكل المالي.</p>
              </div>

              <button type="button" onClick={() => setModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="acc-form-grid">
              <label>
                كود المركز
                <input
                  required
                  value={form.code}
                  onChange={(e) =>
                    setForm({ ...form, code: e.target.value })
                  }
                />
              </label>

              <label>
                اسم المركز
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                />
              </label>

              <label>
                المركز الأب
                <select
                  value={form.parent_id}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      parent_id: e.target.value,
                    })
                  }
                >
                  <option value="">بدون - مركز رئيسي</option>
                  {rows.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.code} - {row.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="acc-wide">
                الوصف
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      description: e.target.value,
                    })
                  }
                />
              </label>
            </div>

            <div className="acc-modal-foot">
              <button
                type="button"
                className="acc-secondary"
                onClick={() => setModal(false)}
              >
                إلغاء
              </button>

              <button className="acc-primary">
                حفظ مركز التكلفة
              </button>
            </div>
          </form>
        </div>
      )}
    </FinancePageShell>
  );
}

export default FinanceCostCenters;
