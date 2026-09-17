import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CircleDollarSign,
  FileCheck2,
  FilePlus2,
  Loader2,
  ReceiptText,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import "./tax-invoices.css";

const API = "http://127.0.0.1:8000/api";

const money = (value) =>
  new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const statusLabel = {
  draft: "مسودة",
  issued: "صادرة",
  void: "ملغاة",
};

const zatcaLabel = {
  not_submitted: "لم ترسل",
  pending: "بانتظار ZATCA",
  cleared: "تمت الموافقة",
  reported: "تم الإبلاغ",
  warning: "تحذير",
  rejected: "مرفوضة",
};

const paymentStatusLabel = {
  unpaid: "غير محصلة",
  partially_paid: "محصلة جزئيًا",
  paid: "محصلة بالكامل",
  refunded: "مستردة",
};

export default function TaxInvoiceCenter({ onChangeView }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      params.set("per_page", "100");

      const res = await fetch(`${API}/finance/tax-invoices?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "تعذر تحميل الفواتير");

      setRows(json?.data?.data || json?.data || []);
    } catch (e) {
      setError(e.message || "حدث خطأ أثناء تحميل الفواتير");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const stats = useMemo(() => {
    const issued = rows.filter((x) => x.status === "issued");
    const drafts = rows.filter((x) => x.status === "draft");
    const total = issued.reduce((sum, x) => sum + Number(x.total || 0), 0);
    const remaining = issued.reduce(
      (sum, x) => sum + Number(x.remaining_amount || 0),
      0
    );

    return {
      count: rows.length,
      issued: issued.length,
      drafts: drafts.length,
      total,
      remaining,
    };
  }, [rows]);

  return (
    <div className="tax-page" dir="rtl">
      <div className="tax-page-head">
        <div>
          <div className="tax-eyebrow">MASA ERP · المالية</div>
          <h1>مركز الفواتير الضريبية</h1>
          <p>
            إدارة المسودات والفواتير الصادرة والفوترة الجزئية والمرحلية للمشاريع.
          </p>
        </div>

        <button
          className="tax-primary-btn"
          onClick={() => onChangeView?.("finance-tax-create")}
        >
          <FilePlus2 size={18} />
          إنشاء فاتورة
        </button>
      </div>

      <div className="tax-kpis">
        <Kpi icon={ReceiptText} title="إجمالي الفواتير" value={stats.count} />
        <Kpi icon={FileCheck2} title="الفواتير الصادرة" value={stats.issued} />
        <Kpi icon={FilePlus2} title="المسودات" value={stats.drafts} />
        <Kpi icon={BadgeDollarSign} title="إجمالي الصادر" value={money(stats.total)} />
        <Kpi
          icon={CircleDollarSign}
          title="متبقي التحصيل"
          value={money(stats.remaining)}
        />
      </div>

      <section className="tax-card">
        <div className="tax-toolbar">
          <div className="tax-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="رقم الفاتورة، العميل أو الرقم الضريبي..."
            />
          </div>

          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">كل الحالات</option>
            <option value="draft">مسودة</option>
            <option value="issued">صادرة</option>
            <option value="void">ملغاة</option>
          </select>

          <button className="tax-icon-btn" onClick={load} title="تحديث">
            <RefreshCw size={18} />
          </button>
        </div>

        {loading ? (
          <div className="tax-state">
            <Loader2 className="tax-spin" />
            جاري تحميل الفواتير...
          </div>
        ) : error ? (
          <div className="tax-state tax-error">
            <TriangleAlert />
            {error}
          </div>
        ) : rows.length === 0 ? (
          <div className="tax-empty">
            <ReceiptText size={42} />
            <h3>لا توجد فواتير حتى الآن</h3>
            <p>ابدأ من عرض سعر معتمد وأنشئ أول فاتورة من قسم المالية.</p>
            <button
              className="tax-primary-btn"
              onClick={() => onChangeView?.("finance-tax-create")}
            >
              إنشاء أول فاتورة
            </button>
          </div>
        ) : (
          <div className="tax-table-wrap">
            <table className="tax-table">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>العميل</th>
                  <th>المشروع</th>
                  <th>نوع الفوترة</th>
                  <th>الإجمالي</th>
                  <th>المتبقي</th>
                  <th>التحصيل</th>
                  <th>الحالة</th>
                  <th>ZATCA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="tax-clickable"
                    onClick={() =>
                      onChangeView?.("finance-tax-details", {
                        taxInvoiceId: row.id,
                      })
                    }
                  >
                    <td className="tax-number">{row.invoice_number}</td>
                    <td>
                      <strong>{row.buyer_name || "—"}</strong>
                      <small>{row.buyer_vat_number || ""}</small>
                    </td>
                    <td>{row.project?.name || row.project?.project_code || "—"}</td>
                    <td>
                      {row.billing_type === "full"
                        ? "كاملة"
                        : row.billing_type === "progress"
                        ? "مرحلية"
                        : "جزئية"}
                    </td>
                    <td>{money(row.total)}</td>
                    <td>{money(row.remaining_amount)}</td>
                    <td>
                      <span className={`tax-pill payment-${row.payment_status}`}>
                        {paymentStatusLabel[row.payment_status] || row.payment_status || "غير محصلة"}
                      </span>
                    </td>
                    <td>
                      <span className={`tax-pill ${row.status}`}>
                        {statusLabel[row.status] || row.status}
                      </span>
                    </td>
                    <td>
                      <span className={`tax-pill zatca-${row.zatca_status}`}>
                        {zatcaLabel[row.zatca_status] || row.zatca_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, title, value }) {
  return (
    <div className="tax-kpi">
      <div className="tax-kpi-icon">
        <Icon size={20} />
      </div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
