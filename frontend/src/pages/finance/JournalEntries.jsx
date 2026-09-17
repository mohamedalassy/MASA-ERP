import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  X,
  Trash2,
  Send,
  CheckCircle2,
  UploadCloud,
  FileClock,
  ShieldCheck,
  BookCheck,
  Eye,
  Printer,
  FileDown,
} from "lucide-react";

const API = "http://127.0.0.1:8000/api";

const money = (value) =>
  Number(value || 0).toLocaleString("ar-SA", {
    maximumFractionDigits: 2,
  });

const labels = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  approved: "معتمد",
  posted: "مرحّل",
  rejected: "مرفوض",
};

const referenceTypeLabels = {
  supplier_invoice: "فاتورة مورد",
  supplier_payment: "دفعة مورد",
  customer_invoice: "فاتورة عميل",
  customer_payment: "تحصيل عميل",
  manual: "قيد يدوي",
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date.toLocaleDateString("ar-SA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

export default function JournalEntries() {
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [centers, setCenters] = useState([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [modal, setModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [selectedEntry, setSelectedEntry] = useState(null);

  const blankLine = () => ({
    account_id: "",
    cost_center_id: "",
    project_id: "",
    description: "",
    debit: 0,
    credit: 0,
  });

  const [form, setForm] = useState({
    entry_date: new Date().toISOString().slice(0, 10),
    description: "",
    reference_number: "",
    project_id: "",
    notes: "",
    lines: [blankLine(), blankLine()],
  });

  const load = async () => {
    setLoading(true);

    try {
      const [e, a, p, c] = await Promise.all([
        fetch(`${API}/finance/journal-entries`).then((r) => r.json()),
        fetch(`${API}/finance/accounts?active=true`).then((r) => r.json()),
        fetch(`${API}/projects`).then((r) => r.json()),
        fetch(`${API}/finance/cost-centers`).then((r) => r.json()),
      ]);

      setEntries(e.data || []);
      setAccounts(
        (a.data || []).filter((x) => x.is_postable && x.is_active)
      );
      setProjects(p.data || []);
      setCenters(c.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      entries.filter(
        (entry) =>
          (!status || entry.status === status) &&
          (!search ||
            `${entry.entry_number} ${entry.description || ""} ${
              entry.reference_number || ""
            }`
              .toLowerCase()
              .includes(search.toLowerCase()))
      ),
    [entries, search, status]
  );

  const totals = useMemo(
    () =>
      form.lines.reduce(
        (sum, line) => ({
          d: sum.d + Number(line.debit || 0),
          c: sum.c + Number(line.credit || 0),
        }),
        { d: 0, c: 0 }
      ),
    [form.lines]
  );

  const setLine = (index, key, value) =>
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, rowIndex) =>
        rowIndex === index
          ? {
              ...line,
              [key]: value,
              ...(key === "debit" && Number(value) > 0
                ? { credit: 0 }
                : {}),
              ...(key === "credit" && Number(value) > 0
                ? { debit: 0 }
                : {}),
            }
          : line
      ),
    }));

  const save = async (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      project_id: form.project_id ? Number(form.project_id) : null,
      lines: form.lines.map((line) => ({
        ...line,
        account_id: Number(line.account_id),
        cost_center_id: line.cost_center_id
          ? Number(line.cost_center_id)
          : null,
        project_id: line.project_id ? Number(line.project_id) : null,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
      })),
    };

    const response = await fetch(`${API}/finance/journal-entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await response.json();

    if (!response.ok) {
      alert(
        json.message ||
          Object.values(json.errors || {}).flat().join("\n") ||
          "تعذر إنشاء القيد"
      );
      return;
    }

    setModal(false);
    await load();
  };

  const action = async (id, name, body) => {
    const response = await fetch(
      `${API}/finance/journal-entries/${id}/${name}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      }
    );

    const json = await response.json();

    if (!response.ok) {
      alert(json.message || "تعذر تنفيذ العملية");
      return;
    }

    await load();

    if (detailsOpen && selectedEntry?.id === id) {
      await openDetails(id);
    }
  };

  const openDetails = async (id) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError("");
    setSelectedEntry(null);

    try {
      const response = await fetch(`${API}/finance/journal-entries/${id}`, {
        headers: { Accept: "application/json" },
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.message || "تعذر تحميل تفاصيل القيد.");
      }

      setSelectedEntry(json.data || json);
    } catch (error) {
      setDetailsError(error.message || "تعذر تحميل تفاصيل القيد.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setDetailsError("");
    setSelectedEntry(null);
  };

  const printEntry = (saveAsPdf = false) => {
    if (!selectedEntry) return;

    const printWindow = window.open("", "_blank", "width=1100,height=780");
    if (!printWindow) {
      alert("يرجى السماح بالنوافذ المنبثقة حتى يمكن طباعة القيد.");
      return;
    }

    const debit = Number(selectedEntry.total_debit || 0);
    const credit = Number(selectedEntry.total_credit || 0);
    const balanced = Math.abs(debit - credit) < 0.001;
    const entryDate = formatDate(selectedEntry.entry_date);
    const rows = (selectedEntry.lines || []).map((line) => `
      <tr>
        <td>${escapeHtml(line.account?.code || "—")}</td>
        <td class="account">${escapeHtml(line.account?.name || "—")}</td>
        <td>${escapeHtml(line.description || "—")}</td>
        <td>${escapeHtml(money(line.debit))}</td>
        <td>${escapeHtml(money(line.credit))}</td>
        <td>${escapeHtml(line.cost_center?.name || "—")}</td>
      </tr>`).join("");

    printWindow.document.write(`<!doctype html>
      <html lang="ar" dir="rtl"><head><meta charset="utf-8" />
      <title>${saveAsPdf ? "PDF" : "طباعة"} - ${escapeHtml(selectedEntry.entry_number)}</title>
      <style>
        @page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;color:#172036;font-family:Tahoma,Arial,sans-serif;background:#fff}.sheet{min-height:267mm;border:1px solid #e4e7ef;padding:24px;position:relative}.top{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:18px;border-bottom:3px solid #6657f5}.brand{display:flex;align-items:center;gap:12px}.logo{width:54px;height:54px;display:grid;place-items:center;border-radius:16px;color:#fff;background:linear-gradient(145deg,#786aff,#5546e8);font-size:25px;font-weight:900}.brand strong{display:block;font-size:20px}.brand span{color:#8b92a3;font-size:11px}.document-title{text-align:left}.document-title h1{margin:0 0 6px;font-size:23px}.document-title b{color:#6657f5;font-size:13px}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:22px 0}.meta div{min-height:58px;padding:11px 13px;border:1px solid #e8eaf1;border-radius:10px}.meta span{display:block;color:#9299a8;font-size:10px;margin-bottom:6px}.meta strong{font-size:12px}.wide{grid-column:span 2}h2{margin:24px 0 10px;font-size:16px}table{width:100%;border-collapse:collapse}th{color:#777f90;background:#f7f7fb;font-size:10px}th,td{padding:11px 9px;text-align:right;border:1px solid #e9ebf2}td{font-size:10px}td.account{font-weight:800}.totals{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;padding:14px;border-radius:10px;color:#107858;background:#eaf8f2;font-size:11px}.totals strong{text-align:center}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:35px;margin-top:65px;text-align:center;color:#697184;font-size:11px}.signatures div{padding-top:10px;border-top:1px solid #aeb3bf}.footer{position:absolute;right:24px;left:24px;bottom:18px;display:flex;justify-content:space-between;padding-top:9px;border-top:1px solid #eceef3;color:#a0a6b2;font-size:9px}@media print{.sheet{border:0}}
      </style></head><body><main class="sheet">
      <header class="top"><div class="brand"><div class="logo">M</div><div><strong>MASA ERP</strong><span>النظام المالي والمحاسبي</span></div></div><div class="document-title"><h1>سند قيد يومية</h1><b>${escapeHtml(selectedEntry.entry_number || "—")}</b></div></header>
      <section class="meta"><div><span>تاريخ القيد</span><strong>${escapeHtml(entryDate || "—")}</strong></div><div><span>الحالة</span><strong>${escapeHtml(labels[selectedEntry.status] || selectedEntry.status || "—")}</strong></div><div><span>المشروع</span><strong>${escapeHtml(selectedEntry.project?.name || "بدون مشروع")}</strong></div><div><span>المرجع</span><strong>${escapeHtml(selectedEntry.reference_number || "—")}</strong></div><div class="wide"><span>البيان</span><strong>${escapeHtml(selectedEntry.description || "—")}</strong></div></section>
      <h2>أطراف القيد</h2><table><thead><tr><th>الكود</th><th>الحساب</th><th>البيان</th><th>مدين</th><th>دائن</th><th>مركز التكلفة</th></tr></thead><tbody>${rows}</tbody></table>
      <section class="totals"><span>إجمالي المدين: <b>${escapeHtml(money(debit))} ر.س</b></span><span>إجمالي الدائن: <b>${escapeHtml(money(credit))} ر.س</b></span><strong>${balanced ? "القيد متوازن" : "القيد غير متوازن"}</strong></section>
      <section class="signatures"><div>إعداد المحاسب</div><div>مراجعة</div><div>اعتماد المدير المالي</div></section><footer class="footer"><span>تم الإنشاء بواسطة MASA ERP</span><span>${escapeHtml(new Date().toLocaleString("ar-SA"))}</span></footer>
      </main><script>window.onload=()=>{window.focus();window.print()};<\/script></body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="acc-page finx-page">
      <section className="finx-hero">
        <div className="finx-hero-copy">
          <span className="finx-eyebrow">
            <BookOpen size={16} /> MASA Finance
          </span>
          <h1>القيود اليومية</h1>
          <p>
            مركز التحكم في دورة القيد من المسودة والمراجعة وحتى الاعتماد
            والترحيل النهائي.
          </p>
        </div>

        <div className="finx-hero-actions">
          <button className="finx-btn finx-btn-soft" onClick={load}>
            <RefreshCw size={16} /> تحديث
          </button>

          <button
            className="finx-btn finx-btn-primary"
            onClick={() => setModal(true)}
          >
            <Plus size={17} /> قيد جديد
          </button>
        </div>
      </section>

      <section className="finx-kpi-grid">
        <article className="finx-kpi-card">
          <div className="finx-kpi-icon purple">
            <BookOpen size={19} />
          </div>
          <div className="finx-kpi-main">
            <span>إجمالي القيود</span>
            <strong>{entries.length}</strong>
          </div>
        </article>

        <article className="finx-kpi-card">
          <div className="finx-kpi-icon orange">
            <FileClock size={19} />
          </div>
          <div className="finx-kpi-main">
            <span>قيد المراجعة</span>
            <strong>
              {entries.filter((entry) => entry.status === "pending").length}
            </strong>
          </div>
        </article>

        <article className="finx-kpi-card">
          <div className="finx-kpi-icon blue">
            <ShieldCheck size={19} />
          </div>
          <div className="finx-kpi-main">
            <span>المعتمدة</span>
            <strong>
              {entries.filter((entry) => entry.status === "approved").length}
            </strong>
          </div>
        </article>

        <article className="finx-kpi-card">
          <div className="finx-kpi-icon green">
            <BookCheck size={19} />
          </div>
          <div className="finx-kpi-main">
            <span>المرحّلة</span>
            <strong>
              {entries.filter((entry) => entry.status === "posted").length}
            </strong>
          </div>
        </article>
      </section>

      <div className="acc-card">
        <div className="acc-toolbar">
          <label>
            <Search size={16} />
            <input
              placeholder="بحث في القيود..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">كل الحالات</option>
            {Object.entries(labels).map(([key, value]) => (
              <option value={key} key={key}>
                {value}
              </option>
            ))}
          </select>

          <button className="acc-icon-btn" onClick={load}>
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="acc-table-wrap">
          <table className="acc-table">
            <thead>
              <tr>
                <th>رقم القيد</th>
                <th>التاريخ</th>
                <th>البيان</th>
                <th>المشروع</th>
                <th>الحالة</th>
                <th>مدين</th>
                <th>دائن</th>
                <th>إجراء</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="acc-empty">
                    جاري التحميل...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="acc-empty">
                    لا توجد قيود مطابقة.
                  </td>
                </tr>
              ) : (
                filtered.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => openDetails(entry.id)}
                        style={{
                          background: "transparent",
                          border: 0,
                          padding: 0,
                          font: "inherit",
                          cursor: "pointer",
                        }}
                      >
                        <b>{entry.entry_number}</b>
                      </button>
                    </td>

                    <td>{formatDate(entry.entry_date)}</td>
                    <td>{entry.description || "—"}</td>
                    <td>{entry.project?.name || "—"}</td>

                    <td>
                      <span className={`acc-status ${entry.status}`}>
                        {labels[entry.status] || entry.status}
                      </span>
                    </td>

                    <td>{money(entry.total_debit)}</td>
                    <td>{money(entry.total_credit)}</td>

                    <td>
                      <div className="acc-actions">
                        <button
                          type="button"
                          title="عرض التفاصيل"
                          onClick={() => openDetails(entry.id)}
                        >
                          <Eye size={15} />
                        </button>

                        {entry.status === "draft" && (
                          <button
                            type="button"
                            title="إرسال للمراجعة"
                            onClick={() => action(entry.id, "submit")}
                          >
                            <Send size={15} />
                          </button>
                        )}

                        {entry.status === "pending" && (
                          <button
                            type="button"
                            title="اعتماد"
                            onClick={() => action(entry.id, "approve")}
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        )}

                        {entry.status === "approved" && (
                          <button
                            type="button"
                            title="ترحيل"
                            onClick={() => action(entry.id, "post")}
                          >
                            <UploadCloud size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailsOpen && (
        <div className="acc-modal-backdrop">
          <div className="acc-modal acc-modal-lg">
            <div className="acc-modal-head">
              <div>
                <h3>تفاصيل القيد المحاسبي</h3>
                <p>
                  مراجعة الحسابات وأطراف القيد قبل الاعتماد أو الترحيل.
                </p>
              </div>

              <button type="button" onClick={closeDetails}>
                <X size={18} />
              </button>
            </div>

            {detailsLoading ? (
              <div className="acc-empty">جاري تحميل تفاصيل القيد...</div>
            ) : detailsError ? (
              <div className="acc-empty">{detailsError}</div>
            ) : selectedEntry ? (
              <>
                <div className="acc-form-grid">
                  <label>
                    رقم القيد
                    <input
                      value={selectedEntry.entry_number || ""}
                      readOnly
                    />
                  </label>

                  <label>
                    الحالة
                    <input
                      value={labels[selectedEntry.status] || selectedEntry.status}
                      readOnly
                    />
                  </label>

                  <label>
                    التاريخ
                    <input
                      value={formatDate(selectedEntry.entry_date)}
                      readOnly
                    />
                  </label>

                  <label>
                    المشروع
                    <input
                      value={selectedEntry.project?.name || "بدون مشروع"}
                      readOnly
                    />
                  </label>

                  <label className="acc-wide">
                    البيان
                    <input
                      value={selectedEntry.description || ""}
                      readOnly
                    />
                  </label>

                  <label>
                    نوع المرجع
                    <input
                      value={referenceTypeLabels[selectedEntry.reference_type] || selectedEntry.reference_type || "—"}
                      readOnly
                    />
                  </label>

                  <label>
                    رقم المرجع
                    <input
                      value={selectedEntry.reference_number || "—"}
                      readOnly
                    />
                  </label>
                </div>

                <div className="acc-lines">
                  <div className="acc-lines-head">
                    <strong>أطراف القيد</strong>
                  </div>

                  <div className="acc-table-wrap">
                    <table className="acc-table">
                      <thead>
                        <tr>
                          <th>الكود</th>
                          <th>الحساب</th>
                          <th>البيان</th>
                          <th>مدين</th>
                          <th>دائن</th>
                          <th>مركز التكلفة</th>
                        </tr>
                      </thead>

                      <tbody>
                        {(selectedEntry.lines || []).map((line) => (
                          <tr key={line.id}>
                            <td>{line.account?.code || "—"}</td>
                            <td>
                              <b>{line.account?.name || "—"}</b>
                            </td>
                            <td>{line.description || "—"}</td>
                            <td>{money(line.debit)} ر.س</td>
                            <td>{money(line.credit)} ر.س</td>
                            <td>{line.cost_center?.name || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div
                  className={`acc-balance ${
                    Math.abs(
                      Number(selectedEntry.total_debit || 0) -
                        Number(selectedEntry.total_credit || 0)
                    ) < 0.001
                      ? "balanced"
                      : "unbalanced"
                  }`}
                >
                  <span>
                    إجمالي المدين{" "}
                    <b>{money(selectedEntry.total_debit)} ر.س</b>
                  </span>
                  <span>
                    إجمالي الدائن{" "}
                    <b>{money(selectedEntry.total_credit)} ر.س</b>
                  </span>
                  <strong>
                    {Math.abs(
                      Number(selectedEntry.total_debit || 0) -
                        Number(selectedEntry.total_credit || 0)
                    ) < 0.001
                      ? "القيد متوازن"
                      : "القيد غير متوازن"}
                  </strong>
                </div>

                <div className="acc-modal-foot">
                  <button
                    type="button"
                    className="acc-secondary"
                    onClick={closeDetails}
                  >
                    إغلاق
                  </button>

                  <button
                    type="button"
                    className="acc-print-btn"
                    onClick={() => printEntry(false)}
                  >
                    <Printer size={15} />
                    طباعة القيد
                  </button>

                  <button
                    type="button"
                    className="acc-pdf-btn"
                    onClick={() => printEntry(true)}
                  >
                    <FileDown size={15} />
                    حفظ PDF
                  </button>

                  {selectedEntry.status === "draft" && (
                    <button
                      type="button"
                      className="acc-primary"
                      onClick={() => action(selectedEntry.id, "submit")}
                    >
                      <Send size={15} />
                      إرسال للمراجعة
                    </button>
                  )}

                  {selectedEntry.status === "pending" && (
                    <button
                      type="button"
                      className="acc-primary"
                      onClick={() => action(selectedEntry.id, "approve")}
                    >
                      <CheckCircle2 size={15} />
                      اعتماد القيد
                    </button>
                  )}

                  {selectedEntry.status === "approved" && (
                    <button
                      type="button"
                      className="acc-primary"
                      onClick={() => action(selectedEntry.id, "post")}
                    >
                      <UploadCloud size={15} />
                      ترحيل القيد
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {modal && (
        <div className="acc-modal-backdrop">
          <form className="acc-modal acc-modal-lg" onSubmit={save}>
            <div className="acc-modal-head">
              <div>
                <h3>قيد يومية جديد</h3>
                <p>يجب أن يتساوى إجمالي المدين والدائن.</p>
              </div>

              <button type="button" onClick={() => setModal(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="acc-form-grid">
              <label>
                تاريخ القيد
                <input
                  type="date"
                  required
                  value={form.entry_date}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      entry_date: event.target.value,
                    })
                  }
                />
              </label>

              <label>
                المشروع
                <select
                  value={form.project_id}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      project_id: event.target.value,
                    })
                  }
                >
                  <option value="">بدون مشروع</option>
                  {projects.map((project) => (
                    <option value={project.id} key={project.id}>
                      {project.project_code || project.id} - {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="acc-wide">
                البيان
                <input
                  value={form.description}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      description: event.target.value,
                    })
                  }
                />
              </label>
            </div>

            <div className="acc-lines">
              <div className="acc-lines-head">
                <strong>أطراف القيد</strong>

                <button
                  type="button"
                  className="acc-secondary"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      lines: [...current.lines, blankLine()],
                    }))
                  }
                >
                  <Plus size={14} /> سطر
                </button>
              </div>

              {form.lines.map((line, index) => (
                <div className="acc-line" key={index}>
                  <select
                    required
                    value={line.account_id}
                    onChange={(event) =>
                      setLine(index, "account_id", event.target.value)
                    }
                  >
                    <option value="">الحساب</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={line.cost_center_id}
                    onChange={(event) =>
                      setLine(index, "cost_center_id", event.target.value)
                    }
                  >
                    <option value="">مركز التكلفة</option>
                    {centers.map((center) => (
                      <option key={center.id} value={center.id}>
                        {center.code} - {center.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="مدين"
                    value={line.debit}
                    onChange={(event) =>
                      setLine(index, "debit", event.target.value)
                    }
                  />

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="دائن"
                    value={line.credit}
                    onChange={(event) =>
                      setLine(index, "credit", event.target.value)
                    }
                  />

                  <button
                    type="button"
                    disabled={form.lines.length <= 2}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        lines: current.lines.filter(
                          (_, rowIndex) => rowIndex !== index
                        ),
                      }))
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>

            <div
              className={`acc-balance ${
                Math.abs(totals.d - totals.c) < 0.001 && totals.d > 0
                  ? "balanced"
                  : "unbalanced"
              }`}
            >
              <span>
                إجمالي المدين <b>{money(totals.d)} ر.س</b>
              </span>
              <span>
                إجمالي الدائن <b>{money(totals.c)} ر.س</b>
              </span>
              <strong>
                {Math.abs(totals.d - totals.c) < 0.001 && totals.d > 0
                  ? "القيد متوازن"
                  : "القيد غير متوازن"}
              </strong>
            </div>

            <div className="acc-modal-foot">
              <button
                type="button"
                className="acc-secondary"
                onClick={() => setModal(false)}
              >
                إلغاء
              </button>

              <button
                className="acc-primary"
                disabled={
                  Math.abs(totals.d - totals.c) >= 0.001 || totals.d <= 0
                }
              >
                حفظ كمسودة
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
