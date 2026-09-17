import { useEffect, useMemo, useState } from "react";
import {
  Search,
  SlidersHorizontal,
  FileText,
  CheckCircle2,
  Clock3,
  WalletCards,
  Eye,
  Printer,
  X,
  Building2,
  FolderKanban,
  CalendarDays,
  UserRound,
  Phone,
  Mail,
  MapPin,
  BadgeDollarSign,
  ChevronLeft,
  RefreshCw,
  CircleDollarSign,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const statusMeta = {
  draft: { label: "مسودة", tone: "orange" },
  under_review: { label: "قيد المراجعة", tone: "blue" },
  approved: { label: "معتمد", tone: "green" },
  rejected: { label: "مرفوض", tone: "red" },
  expired: { label: "منتهي", tone: "gray" },
};

const money = (value) =>
  Number(value || 0).toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dateText = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

const dateTimeText = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export default function Quotations({ onOpenProject }) {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [versionFilter, setVersionFilter] = useState("all");

  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const loadQuotations = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const response = await fetch(`${API_URL}/quotations`, {
        headers: { Accept: "application/json" },
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "تعذر تحميل عروض الأسعار");
      }

      setQuotations(Array.isArray(result.data) ? result.data : []);
    } catch (error) {
      console.error(error);
      setLoadError(error.message || "حدث خطأ أثناء تحميل عروض الأسعار");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuotations();
  }, []);

  const stats = useMemo(() => {
    const total = quotations.length;
    const draft = quotations.filter((q) => q.status === "draft").length;
    const approvedRows = quotations.filter((q) => q.status === "approved");
    const approved = approvedRows.length;
    const approvedValue = approvedRows.reduce(
      (sum, q) => sum + Number(q.total || 0),
      0
    );

    return { total, draft, approved, approvedValue };
  }, [quotations]);

  const projects = useMemo(() => {
    const map = new Map();
    quotations.forEach((row) => {
      if (row.project?.id) {
        map.set(row.project.id, row.project);
      }
    });
    return Array.from(map.values());
  }, [quotations]);

  const versions = useMemo(() => {
    return Array.from(
      new Set(quotations.map((row) => Number(row.version || 1)))
    ).sort((a, b) => a - b);
  }, [quotations]);

  const filteredQuotations = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return quotations.filter((row) => {
      const project = row.project || {};
      const matchesSearch =
        !needle ||
        [
          row.quotation_number,
          project.name,
          project.project_code,
          project.customer_name,
          project.customer_code,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));

      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;

      const matchesProject =
        projectFilter === "all" ||
        String(project.id) === String(projectFilter);

      const matchesVersion =
        versionFilter === "all" ||
        String(row.version) === String(versionFilter);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesProject &&
        matchesVersion
      );
    });
  }, [
    quotations,
    search,
    statusFilter,
    projectFilter,
    versionFilter,
  ]);

  const openQuotation = async (row) => {
    const projectId = row.project?.id || row.project_id;

    if (!projectId) {
      setDetailError("تعذر تحديد المشروع المرتبط بعرض السعر.");
      return;
    }

    try {
      setSelectedQuotation(row);
      setDetailLoading(true);
      setDetailError("");

      const response = await fetch(
        `${API_URL}/projects/${projectId}/quotations/${row.id}`,
        { headers: { Accept: "application/json" } }
      );

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "تعذر تحميل تفاصيل عرض السعر");
      }

      setSelectedQuotation({
        ...row,
        ...result.data,
        project: row.project,
      });
    } catch (error) {
      console.error(error);
      setDetailError(error.message || "حدث خطأ أثناء تحميل التفاصيل");
    } finally {
      setDetailLoading(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setProjectFilter("all");
    setVersionFilter("all");
  };

  const printQuotation = (quotation) => {
    if (!quotation) return;

    const project = quotation.project || {};
    const items = quotation.items || [];
    const status =
      statusMeta[quotation.status]?.label || quotation.status || "—";

    const rowsHtml = items
      .map(
        (item, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>
              <strong>${item.product_name || item.product?.name || "—"}</strong>
              ${
                item.sku
                  ? `<div class="sub">${item.sku}</div>`
                  : ""
              }
            </td>
            <td>${money(item.quantity)}</td>
            <td>${money(item.unit_price)}</td>
            <td>${money(item.discount)}</td>
            <td>${money(item.tax_amount)}</td>
            <td>${money(item.line_total)}</td>
          </tr>
        `
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${quotation.quotation_number}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Tahoma,sans-serif;margin:0;padding:32px;color:#12192b;background:#fff}
  .head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:3px solid #6657f6;padding-bottom:20px;margin-bottom:20px}
  .brand{font-weight:900;font-size:26px;color:#131a2b}.brand span{color:#6657f6}
  .qt{font-size:24px;font-weight:900}.sub{font-size:11px;color:#7c8495;margin-top:4px}
  .badge{display:inline-block;padding:7px 12px;border-radius:999px;background:#eafaf2;color:#168353;font-size:12px;font-weight:800;margin-top:8px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:18px 0}
  .card{border:1px solid #e8ebf2;border-radius:14px;padding:16px;background:#fbfcff}
  .card h3{margin:0 0 12px;font-size:14px}
  .row{display:flex;justify-content:space-between;gap:10px;padding:5px 0;font-size:12px}.row span:first-child{color:#8a91a1}
  table{width:100%;border-collapse:collapse;margin-top:20px;font-size:11px}
  th,td{border:1px solid #e6e9ef;padding:10px;text-align:right}
  th{background:#f7f7ff;color:#5e5e78}
  .totals{width:380px;margin-right:auto;margin-top:18px}
  .totalrow{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:12px}
  .grand{font-size:17px;font-weight:900;color:#4f46e5}
  .reason{margin-top:18px;border:1px solid #fed7aa;background:#fff8ee;border-radius:12px;padding:12px;font-size:12px}
  .footer{margin-top:36px;padding-top:14px;border-top:1px solid #e8ebef;color:#9aa0ad;font-size:10px;text-align:center}
  @media print{body{padding:12px}.no-print{display:none}}
</style>
</head>
<body>
  <div class="head">
    <div>
      <div class="brand">MASA <span>ERP</span></div>
      <div class="sub">عرض سعر</div>
    </div>
    <div>
      <div class="qt">${quotation.quotation_number || "—"}</div>
      <div class="badge">${status} • V${quotation.version || 1}</div>
      <div class="sub">تاريخ الإنشاء: ${dateTimeText(
        quotation.created_at
      )}</div>
    </div>
  </div>

  <div class="grid">
    <div class="card">
      <h3>بيانات العميل</h3>
      <div class="row"><span>اسم العميل</span><strong>${
        project.customer_name || "—"
      }</strong></div>
      <div class="row"><span>كود العميل</span><strong>${
        project.customer_code || "—"
      }</strong></div>
      <div class="row"><span>الجوال</span><strong>${
        project.phone || "—"
      }</strong></div>
      <div class="row"><span>البريد الإلكتروني</span><strong>${
        project.email || "—"
      }</strong></div>
      <div class="row"><span>العنوان</span><strong>${
        project.address || "—"
      }</strong></div>
      <div class="row"><span>الرقم الضريبي</span><strong>${
        project.tax_number || "—"
      }</strong></div>
    </div>

    <div class="card">
      <h3>بيانات المشروع</h3>
      <div class="row"><span>اسم المشروع</span><strong>${
        project.name || "—"
      }</strong></div>
      <div class="row"><span>كود المشروع</span><strong>${
        project.project_code || "—"
      }</strong></div>
      <div class="row"><span>مدير المشروع</span><strong>${
        project.project_manager || "—"
      }</strong></div>
      <div class="row"><span>نوع المشروع</span><strong>${
        project.project_type || "—"
      }</strong></div>
      <div class="row"><span>صالح حتى</span><strong>${dateText(
        quotation.valid_until
      )}</strong></div>
      <div class="row"><span>آخر اعتماد</span><strong>${dateTimeText(
        quotation.approved_at
      )}</strong></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>البند</th>
        <th>الكمية</th>
        <th>سعر الوحدة</th>
        <th>الخصم</th>
        <th>الضريبة</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>${rowsHtml || '<tr><td colspan="7">لا توجد بنود</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <div class="totalrow"><span>الإجمالي قبل الضريبة</span><strong>${money(
      quotation.subtotal
    )} ر.س</strong></div>
    <div class="totalrow"><span>الخصم</span><strong>${money(
      quotation.discount
    )} ر.س</strong></div>
    <div class="totalrow"><span>الضريبة</span><strong>${money(
      quotation.tax
    )} ر.س</strong></div>
    <div class="totalrow grand"><span>الإجمالي الكلي</span><strong>${money(
      quotation.total
    )} ر.س</strong></div>
  </div>

  ${
    quotation.revision_reason
      ? `<div class="reason"><strong>سبب التعديل / الإصدار:</strong> ${quotation.revision_reason}</div>`
      : ""
  }

  ${
    quotation.notes
      ? `<div class="reason"><strong>ملاحظات:</strong> ${quotation.notes}</div>`
      : ""
  }

  <div class="footer">تم إنشاء هذا المستند من نظام MASA ERP</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=1100,height=850");
    if (!printWindow) return;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="qt-page" dir="rtl">
      <style>{`
        .qt-page {
          --qt-purple: #6457f5;
          --qt-purple-soft: #f0efff;
          --qt-text: #171b2c;
          --qt-muted: #8b92a3;
          --qt-border: #e8ebf2;
          --qt-bg: #f7f8fc;
          min-height: 100%;
          color: var(--qt-text);
        }

        .qt-page * { box-sizing: border-box; }

        .qt-page button,
        .qt-page input,
        .qt-page select {
          font-family: inherit;
        }

        .qt-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 18px;
        }

        .qt-title h1 {
          margin: 0;
          font-size: 27px;
          line-height: 1.2;
          font-weight: 900;
          color: #111827;
        }

        .qt-title p {
          margin: 7px 0 0;
          font-size: 12px;
          color: var(--qt-muted);
        }

        .qt-refresh {
          border: 1px solid var(--qt-border);
          background: #fff;
          border-radius: 11px;
          height: 42px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #626b7e;
          cursor: pointer;
          font-weight: 800;
        }

        .qt-cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          margin-bottom: 16px;
        }

        .qt-card {
          background: #fff;
          border: 1px solid var(--qt-border);
          border-radius: 16px;
          padding: 16px;
          min-height: 116px;
          display: flex;
          justify-content: space-between;
          gap: 12px;
          position: relative;
          overflow: hidden;
        }

        .qt-card::after {
          content: "";
          position: absolute;
          width: 82px;
          height: 82px;
          border-radius: 999px;
          left: -28px;
          top: -30px;
          background: rgba(100, 87, 245, 0.05);
        }

        .qt-card-label {
          color: #8b92a3;
          font-size: 11px;
          font-weight: 700;
        }

        .qt-card-value {
          margin-top: 13px;
          font-size: 26px;
          line-height: 1;
          font-weight: 900;
          color: #111827;
        }

        .qt-card-value.money {
          font-size: 20px;
        }

        .qt-card-sub {
          margin-top: 9px;
          font-size: 10px;
          color: #9ba1ae;
        }

        .qt-card-icon {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }

        .qt-card-icon.purple { background:#efedff; color:#6257f5; }
        .qt-card-icon.orange { background:#fff2e5; color:#f59e0b; }
        .qt-card-icon.green { background:#e9fbf3; color:#18a66c; }
        .qt-card-icon.blue { background:#edf5ff; color:#4385f5; }

        .qt-panel {
          background: #fff;
          border: 1px solid var(--qt-border);
          border-radius: 16px;
          overflow: hidden;
        }

        .qt-filters {
          padding: 15px;
          border-bottom: 1px solid var(--qt-border);
          display: grid;
          grid-template-columns: minmax(280px, 1.5fr) repeat(3, minmax(130px, .65fr)) auto;
          gap: 10px;
          align-items: center;
        }

        .qt-search {
          position: relative;
        }

        .qt-search svg {
          position: absolute;
          right: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: #9aa1b0;
          pointer-events: none;
        }

        .qt-search input,
        .qt-filter-select {
          width: 100%;
          height: 42px;
          border: 1px solid #e3e6ee;
          border-radius: 11px;
          background: #fff;
          outline: none;
          color: #333a4c;
          font-size: 11px;
        }

        .qt-search input {
          padding: 0 40px 0 12px;
        }

        .qt-filter-select {
          padding: 0 11px;
          cursor: pointer;
        }

        .qt-clear {
          height: 42px;
          border-radius: 11px;
          border: 1px solid #e3e6ee;
          background: #fafbfe;
          color: #747d90;
          padding: 0 14px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          white-space: nowrap;
        }

        .qt-table-wrap {
          width: 100%;
          overflow-x: auto;
        }

        .qt-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1050px;
        }

        .qt-table th {
          height: 46px;
          padding: 0 12px;
          text-align: right;
          font-size: 10px;
          color: #8b92a3;
          font-weight: 800;
          background: #fbfcff;
          border-bottom: 1px solid var(--qt-border);
        }

        .qt-table td {
          padding: 12px;
          border-bottom: 1px solid #f0f2f6;
          font-size: 11px;
          vertical-align: middle;
          color: #333a4c;
        }

        .qt-table tbody tr {
          transition: background .15s ease;
        }

        .qt-table tbody tr:hover {
          background: #fbfbff;
        }

        .qt-number {
          display: flex;
          align-items: center;
          gap: 8px;
          direction: ltr;
          justify-content: flex-end;
          color: #584cf4;
          font-weight: 900;
          white-space: nowrap;
        }

        .qt-number-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          display: grid;
          place-items: center;
          background: #f0efff;
          color: #6557f6;
          flex: 0 0 auto;
        }

        .qt-version {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 34px;
          height: 27px;
          padding: 0 9px;
          border-radius: 8px;
          background: #f3f4f8;
          font-weight: 900;
          direction: ltr;
        }

        .qt-project-name {
          font-weight: 900;
          color: #22293a;
        }

        .qt-project-code {
          margin-top: 4px;
          color: #695df5;
          font-size: 9px;
          direction: ltr;
          text-align: right;
        }

        .qt-customer {
          font-weight: 700;
        }

        .qt-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 9px;
          font-weight: 900;
          white-space: nowrap;
        }

        .qt-status.green { background:#eafaf2; color:#168353; }
        .qt-status.orange { background:#fff2e5; color:#dd7a08; }
        .qt-status.blue { background:#edf5ff; color:#3579de; }
        .qt-status.red { background:#fff0f0; color:#d94747; }
        .qt-status.gray { background:#f2f3f5; color:#747b87; }

        .qt-money {
          font-weight: 900;
          color: #20283a;
          white-space: nowrap;
        }

        .qt-money small {
          display: block;
          margin-top: 3px;
          color: #9ba1ae;
          font-size: 8px;
          font-weight: 600;
        }

        .qt-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .qt-icon-btn {
          width: 32px;
          height: 32px;
          display: grid;
          place-items: center;
          border: 1px solid #e3e6ee;
          border-radius: 9px;
          background: #fff;
          color: #6d7486;
          cursor: pointer;
        }

        .qt-icon-btn.primary {
          color: #6557f6;
          background: #f7f6ff;
          border-color: #e4e1ff;
        }

        .qt-empty,
        .qt-loading,
        .qt-error {
          padding: 55px 20px;
          text-align: center;
          color: #8b92a3;
          font-size: 12px;
        }

        .qt-error { color: #d94141; }

        .qt-footer {
          min-height: 52px;
          padding: 0 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #9aa1ae;
          font-size: 10px;
        }

        .qt-detail-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(22, 27, 45, .32);
          padding: 24px;
          overflow-y: auto;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }

        .qt-detail {
          width: min(1120px, 100%);
          margin: 25px auto;
          background: #fff;
          border-radius: 20px;
          box-shadow: 0 24px 80px rgba(30, 36, 60, .2);
          overflow: hidden;
          border: 1px solid #edf0f5;
        }

        .qt-detail-head {
          min-height: 74px;
          padding: 15px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          border-bottom: 1px solid #edf0f5;
        }

        .qt-detail-title {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .qt-detail-title-icon {
          width: 42px;
          height: 42px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          color: #6557f6;
          background: #f0efff;
          flex: 0 0 auto;
        }

        .qt-detail-number {
          font-size: 16px;
          font-weight: 900;
          direction: ltr;
          text-align: right;
          white-space: nowrap;
        }

        .qt-detail-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .qt-detail-btn {
          height: 38px;
          border-radius: 10px;
          padding: 0 13px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          cursor: pointer;
          font-weight: 800;
          font-size: 10px;
          border: 1px solid #e3e6ee;
          background: #fff;
          color: #596174;
        }

        .qt-detail-btn.print {
          background: #6557f6;
          color: #fff;
          border-color: #6557f6;
        }

        .qt-detail-close {
          width: 38px;
          padding: 0;
          justify-content: center;
        }

        .qt-detail-body {
          padding: 17px;
          background: #fbfcff;
        }

        .qt-client-project {
          display: grid;
          grid-template-columns: 1fr 1fr 0.7fr;
          gap: 12px;
          margin-bottom: 14px;
        }

        .qt-info-card {
          background: #fff;
          border: 1px solid #e8ebf2;
          border-radius: 14px;
          padding: 14px;
        }

        .qt-info-title {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 13px;
          font-size: 11px;
          font-weight: 900;
          color: #3a4255;
        }

        .qt-info-title svg { color:#6557f6; }

        .qt-info-line {
          display: grid;
          grid-template-columns: 110px 1fr;
          gap: 8px;
          padding: 6px 0;
          border-bottom: 1px dashed #f0f1f5;
          font-size: 10px;
        }

        .qt-info-line:last-child { border-bottom:0; }
        .qt-info-line span { color:#969dab; }
        .qt-info-line strong { color:#313849; font-weight:800; }

        .qt-total-card {
          background:
            linear-gradient(145deg, #f8f7ff 0%, #fff 75%);
        }

        .qt-big-total {
          margin: 12px 0 5px;
          font-size: 25px;
          font-weight: 900;
          color: #1f2637;
        }

        .qt-big-total span {
          font-size: 11px;
          color: #8d94a4;
          font-weight: 700;
        }

        .qt-items-card {
          background: #fff;
          border: 1px solid #e8ebf2;
          border-radius: 14px;
          overflow: hidden;
        }

        .qt-items-head {
          padding: 14px 15px;
          border-bottom: 1px solid #edf0f5;
          font-size: 12px;
          font-weight: 900;
        }

        .qt-items-table-wrap { overflow-x:auto; }

        .qt-items-table {
          width: 100%;
          min-width: 820px;
          border-collapse: collapse;
        }

        .qt-items-table th {
          padding: 10px;
          background: #fafbfe;
          border-bottom: 1px solid #e9ecf2;
          color: #8d94a4;
          font-size: 9px;
          text-align: right;
        }

        .qt-items-table td {
          padding: 11px 10px;
          border-bottom: 1px solid #f0f2f6;
          font-size: 10px;
          color: #3b4253;
        }

        .qt-items-table tbody tr:last-child td { border-bottom:0; }

        .qt-detail-bottom {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 12px;
          margin-top: 12px;
        }

        .qt-note-card,
        .qt-totals-card {
          background:#fff;
          border:1px solid #e8ebf2;
          border-radius:14px;
          padding:14px;
        }

        .qt-reason {
          background:#fff8ee;
          border:1px solid #fed7aa;
          color:#9a5b16;
          padding:10px 11px;
          border-radius:10px;
          font-size:10px;
          line-height:1.7;
          margin-bottom:9px;
        }

        .qt-note {
          color:#71798b;
          font-size:10px;
          line-height:1.8;
        }

        .qt-total-row {
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:8px 0;
          border-bottom:1px solid #f0f2f6;
          font-size:10px;
        }

        .qt-total-row:last-child { border-bottom:0; }

        .qt-total-row span { color:#9299a8; }

        .qt-total-row strong { color:#2c3447; }

        .qt-total-row.grand {
          margin-top:4px;
          padding-top:12px;
          font-size:13px;
        }

        .qt-total-row.grand strong { color:#6557f6; font-size:16px; }

        @media (max-width: 1180px) {
          .qt-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .qt-filters { grid-template-columns: 1fr 1fr; }
          .qt-client-project { grid-template-columns: 1fr 1fr; }
          .qt-total-card { grid-column: 1 / -1; }
        }

        @media (max-width: 760px) {
          .qt-header { align-items:flex-start; }
          .qt-cards { grid-template-columns:1fr; }
          .qt-filters { grid-template-columns:1fr; }
          .qt-detail-backdrop { padding:10px; }
          .qt-client-project { grid-template-columns:1fr; }
          .qt-total-card { grid-column:auto; }
          .qt-detail-bottom { grid-template-columns:1fr; }
          .qt-detail-head { align-items:flex-start; flex-direction:column; }
          .qt-detail-actions { width:100%; flex-wrap:wrap; }
        }
      `}</style>

      <div className="qt-header">
        <div className="qt-title">
          <h1>عروض الأسعار</h1>
          <p>عرض وإدارة جميع عروض الأسعار وربط كل عرض بالمشروع والعميل.</p>
        </div>

        <button
          type="button"
          className="qt-refresh"
          onClick={loadQuotations}
          disabled={loading}
        >
          <RefreshCw size={16} />
          تحديث
        </button>
      </div>

      <div className="qt-cards">
        <div className="qt-card">
          <div>
            <div className="qt-card-label">إجمالي عروض الأسعار</div>
            <div className="qt-card-value">{stats.total}</div>
            <div className="qt-card-sub">كل الإصدارات المسجلة بالنظام</div>
          </div>
          <div className="qt-card-icon blue">
            <FileText size={21} />
          </div>
        </div>

        <div className="qt-card">
          <div>
            <div className="qt-card-label">العروض المسودة</div>
            <div className="qt-card-value">{stats.draft}</div>
            <div className="qt-card-sub">تحتاج استكمال أو اعتماد</div>
          </div>
          <div className="qt-card-icon orange">
            <Clock3 size={21} />
          </div>
        </div>

        <div className="qt-card">
          <div>
            <div className="qt-card-label">العروض المعتمدة</div>
            <div className="qt-card-value">{stats.approved}</div>
            <div className="qt-card-sub">إصدارات تم اعتمادها</div>
          </div>
          <div className="qt-card-icon green">
            <CheckCircle2 size={21} />
          </div>
        </div>

        <div className="qt-card">
          <div>
            <div className="qt-card-label">قيمة العروض المعتمدة</div>
            <div className="qt-card-value money">
              {money(stats.approvedValue)}
            </div>
            <div className="qt-card-sub">ريال سعودي</div>
          </div>
          <div className="qt-card-icon purple">
            <WalletCards size={21} />
          </div>
        </div>
      </div>

      <div className="qt-panel">
        <div className="qt-filters">
          <div className="qt-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم العرض أو اسم المشروع أو العميل..."
            />
          </div>

          <select
            className="qt-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="under_review">قيد المراجعة</option>
            <option value="approved">معتمد</option>
            <option value="rejected">مرفوض</option>
            <option value="expired">منتهي</option>
          </select>

          <select
            className="qt-filter-select"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">كل المشاريع</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} — {project.project_code}
              </option>
            ))}
          </select>

          <select
            className="qt-filter-select"
            value={versionFilter}
            onChange={(e) => setVersionFilter(e.target.value)}
          >
            <option value="all">كل الإصدارات</option>
            {versions.map((version) => (
              <option key={version} value={version}>
                V{version}
              </option>
            ))}
          </select>

          <button type="button" className="qt-clear" onClick={clearFilters}>
            <SlidersHorizontal size={15} />
            مسح الفلاتر
          </button>
        </div>

        {loading ? (
          <div className="qt-loading">جاري تحميل عروض الأسعار...</div>
        ) : loadError ? (
          <div className="qt-error">{loadError}</div>
        ) : filteredQuotations.length === 0 ? (
          <div className="qt-empty">لا توجد عروض أسعار مطابقة.</div>
        ) : (
          <div className="qt-table-wrap">
            <table className="qt-table">
              <thead>
                <tr>
                  <th>رقم العرض</th>
                  <th>الإصدار</th>
                  <th>المشروع</th>
                  <th>العميل</th>
                  <th>الحالة</th>
                  <th>القيمة الإجمالية</th>
                  <th>تاريخ الإنشاء</th>
                  <th>آخر اعتماد</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>

              <tbody>
                {filteredQuotations.map((row) => {
                  const meta =
                    statusMeta[row.status] || {
                      label: row.status || "—",
                      tone: "gray",
                    };

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="qt-number">
                          <span>{row.quotation_number}</span>
                          <span className="qt-number-icon">
                            <FileText size={14} />
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className="qt-version">
                          V{row.version || 1}
                        </span>
                      </td>

                      <td>
                        <div className="qt-project-name">
                          {row.project?.name || "—"}
                        </div>
                        <div className="qt-project-code">
                          {row.project?.project_code || "—"}
                        </div>
                      </td>

                      <td>
                        <div className="qt-customer">
                          {row.project?.customer_name || "—"}
                        </div>
                        <div
                          style={{
                            color: "#9ba1ae",
                            marginTop: 4,
                            fontSize: 9,
                          }}
                        >
                          {row.project?.customer_code || ""}
                        </div>
                      </td>

                      <td>
                        <span className={`qt-status ${meta.tone}`}>
                          <CheckCircle2 size={11} />
                          {meta.label}
                        </span>
                      </td>

                      <td>
                        <div className="qt-money">
                          {money(row.total)}
                          <small>ر.س</small>
                        </div>
                      </td>

                      <td>{dateTimeText(row.created_at)}</td>
                      <td>{dateTimeText(row.approved_at)}</td>

                      <td>
                        <div className="qt-actions">
                          <button
                            type="button"
                            className="qt-icon-btn primary"
                            title="فتح التفاصيل"
                            onClick={() => openQuotation(row)}
                          >
                            <Eye size={15} />
                          </button>

                          <button
                            type="button"
                            className="qt-icon-btn"
                            title="طباعة"
                            onClick={() => {
                              if (row.items) {
                                printQuotation(row);
                              } else {
                                openQuotation(row).then?.(() => {});
                              }
                            }}
                          >
                            <Printer size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="qt-footer">
          <span>
            عرض {filteredQuotations.length} من {quotations.length} عرض
          </span>
          <span>جميع الإصدارات محفوظة كسجل تاريخي</span>
        </div>
      </div>

      {selectedQuotation && (
        <div
          className="qt-detail-backdrop"
          onClick={() => setSelectedQuotation(null)}
        >
          <div className="qt-detail" onClick={(e) => e.stopPropagation()}>
            <div className="qt-detail-head">
              <div className="qt-detail-title">
                <div className="qt-detail-title-icon">
                  <FileText size={20} />
                </div>

                <div>
                  <div className="qt-detail-number">
                    {selectedQuotation.quotation_number}
                  </div>
                  <div
                    style={{
                      marginTop: 5,
                      display: "flex",
                      gap: 7,
                      alignItems: "center",
                    }}
                  >
                    <span
                      className={`qt-status ${
                        statusMeta[selectedQuotation.status]?.tone || "gray"
                      }`}
                    >
                      {statusMeta[selectedQuotation.status]?.label ||
                        selectedQuotation.status}
                    </span>
                    <span className="qt-version">
                      V{selectedQuotation.version || 1}
                    </span>
                  </div>
                </div>
              </div>

              <div className="qt-detail-actions">
                {onOpenProject && (
                  <button
                    type="button"
                    className="qt-detail-btn"
                    onClick={() =>
                      onOpenProject(
                        selectedQuotation.project?.id ||
                          selectedQuotation.project_id
                      )
                    }
                  >
                    <FolderKanban size={14} />
                    فتح المشروع
                    <ChevronLeft size={13} />
                  </button>
                )}

                <button
                  type="button"
                  className="qt-detail-btn print"
                  onClick={() => printQuotation(selectedQuotation)}
                >
                  <Printer size={14} />
                  طباعة العرض
                </button>

                <button
                  type="button"
                  className="qt-detail-btn qt-detail-close"
                  onClick={() => setSelectedQuotation(null)}
                  title="إغلاق"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="qt-detail-body">
              {detailLoading ? (
                <div className="qt-loading">جاري تحميل التفاصيل...</div>
              ) : detailError ? (
                <div className="qt-error">{detailError}</div>
              ) : (
                <>
                  <div className="qt-client-project">
                    <div className="qt-info-card">
                      <div className="qt-info-title">
                        <Building2 size={15} />
                        بيانات العميل
                      </div>

                      <div className="qt-info-line">
                        <span>اسم العميل</span>
                        <strong>
                          {selectedQuotation.project?.customer_name || "—"}
                        </strong>
                      </div>
                      <div className="qt-info-line">
                        <span>كود العميل</span>
                        <strong>
                          {selectedQuotation.project?.customer_code || "—"}
                        </strong>
                      </div>
                      <div className="qt-info-line">
                        <span>
                          <Phone size={11} style={{ verticalAlign: "middle" }} />{" "}
                          الجوال
                        </span>
                        <strong>
                          {selectedQuotation.project?.phone || "—"}
                        </strong>
                      </div>
                      <div className="qt-info-line">
                        <span>
                          <Mail size={11} style={{ verticalAlign: "middle" }} />{" "}
                          البريد
                        </span>
                        <strong>
                          {selectedQuotation.project?.email || "—"}
                        </strong>
                      </div>
                      <div className="qt-info-line">
                        <span>
                          <MapPin
                            size={11}
                            style={{ verticalAlign: "middle" }}
                          />{" "}
                          العنوان
                        </span>
                        <strong>
                          {selectedQuotation.project?.address || "—"}
                        </strong>
                      </div>
                      <div className="qt-info-line">
                        <span>الرقم الضريبي</span>
                        <strong>
                          {selectedQuotation.project?.tax_number || "—"}
                        </strong>
                      </div>
                    </div>

                    <div className="qt-info-card">
                      <div className="qt-info-title">
                        <FolderKanban size={15} />
                        بيانات المشروع
                      </div>

                      <div className="qt-info-line">
                        <span>اسم المشروع</span>
                        <strong>
                          {selectedQuotation.project?.name || "—"}
                        </strong>
                      </div>
                      <div className="qt-info-line">
                        <span>كود المشروع</span>
                        <strong dir="ltr" style={{ textAlign: "right" }}>
                          {selectedQuotation.project?.project_code || "—"}
                        </strong>
                      </div>
                      <div className="qt-info-line">
                        <span>
                          <UserRound
                            size={11}
                            style={{ verticalAlign: "middle" }}
                          />{" "}
                          مدير المشروع
                        </span>
                        <strong>
                          {selectedQuotation.project?.project_manager || "—"}
                        </strong>
                      </div>
                      <div className="qt-info-line">
                        <span>نوع المشروع</span>
                        <strong>
                          {selectedQuotation.project?.project_type || "—"}
                        </strong>
                      </div>
                      <div className="qt-info-line">
                        <span>
                          <CalendarDays
                            size={11}
                            style={{ verticalAlign: "middle" }}
                          />{" "}
                          بداية متوقعة
                        </span>
                        <strong>
                          {dateText(
                            selectedQuotation.project?.expected_start_date
                          )}
                        </strong>
                      </div>
                      <div className="qt-info-line">
                        <span>نهاية متوقعة</span>
                        <strong>
                          {dateText(
                            selectedQuotation.project?.expected_end_date
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="qt-info-card qt-total-card">
                      <div className="qt-info-title">
                        <CircleDollarSign size={15} />
                        ملخص العرض
                      </div>

                      <div className="qt-big-total">
                        {money(selectedQuotation.total)}{" "}
                        <span>ر.س</span>
                      </div>

                      <div className="qt-info-line">
                        <span>الإصدار</span>
                        <strong>V{selectedQuotation.version || 1}</strong>
                      </div>
                      <div className="qt-info-line">
                        <span>تاريخ الإنشاء</span>
                        <strong>
                          {dateTimeText(selectedQuotation.created_at)}
                        </strong>
                      </div>
                      <div className="qt-info-line">
                        <span>صالح حتى</span>
                        <strong>
                          {dateText(selectedQuotation.valid_until)}
                        </strong>
                      </div>
                      <div className="qt-info-line">
                        <span>آخر اعتماد</span>
                        <strong>
                          {dateTimeText(selectedQuotation.approved_at)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="qt-items-card">
                    <div className="qt-items-head">تفاصيل البنود والأسعار</div>

                    <div className="qt-items-table-wrap">
                      <table className="qt-items-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>البند</th>
                            <th>SKU</th>
                            <th>الكمية</th>
                            <th>سعر الوحدة</th>
                            <th>الخصم</th>
                            <th>الضريبة</th>
                            <th>الإجمالي</th>
                          </tr>
                        </thead>

                        <tbody>
                          {(selectedQuotation.items || []).length ? (
                            selectedQuotation.items.map((item, index) => (
                              <tr key={item.id || index}>
                                <td>{index + 1}</td>
                                <td>
                                  <strong>
                                    {item.product_name ||
                                      item.product?.name ||
                                      "—"}
                                  </strong>
                                  {item.description && (
                                    <div
                                      style={{
                                        color: "#9aa1ae",
                                        marginTop: 4,
                                        fontSize: 9,
                                      }}
                                    >
                                      {item.description}
                                    </div>
                                  )}
                                </td>
                                <td dir="ltr" style={{ textAlign: "right" }}>
                                  {item.sku || "—"}
                                </td>
                                <td>{money(item.quantity)}</td>
                                <td>{money(item.unit_price)}</td>
                                <td>{money(item.discount)}</td>
                                <td>{money(item.tax_amount)}</td>
                                <td>
                                  <strong>{money(item.line_total)}</strong>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="8">لا توجد بنود في هذا العرض.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="qt-detail-bottom">
                    <div className="qt-note-card">
                      {selectedQuotation.revision_reason && (
                        <div className="qt-reason">
                          <strong>سبب التعديل / الإصدار:</strong>{" "}
                          {selectedQuotation.revision_reason}
                        </div>
                      )}

                      <div className="qt-note">
                        <strong style={{ color: "#4f5668" }}>ملاحظات:</strong>
                        <br />
                        {selectedQuotation.notes || "لا توجد ملاحظات إضافية."}
                      </div>
                    </div>

                    <div className="qt-totals-card">
                      <div className="qt-total-row">
                        <span>الإجمالي قبل الضريبة</span>
                        <strong>
                          {money(selectedQuotation.subtotal)} ر.س
                        </strong>
                      </div>
                      <div className="qt-total-row">
                        <span>الخصم</span>
                        <strong>
                          {money(selectedQuotation.discount)} ر.س
                        </strong>
                      </div>
                      <div className="qt-total-row">
                        <span>الضريبة</span>
                        <strong>{money(selectedQuotation.tax)} ر.س</strong>
                      </div>
                      <div className="qt-total-row grand">
                        <span>الإجمالي الكلي</span>
                        <strong>
                          {money(selectedQuotation.total)} ر.س
                        </strong>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
