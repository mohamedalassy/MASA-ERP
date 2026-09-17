import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpLeft,
  Banknote,
  BookOpen,
  Building2,
  Calculator,
  ChevronLeft,
  CircleDollarSign,
  Landmark,
  Layers3,
  Loader2,
  PieChart,
  Printer,
  ReceiptText,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";

const API_BASE = "http://127.0.0.1:8000/api";

const money = (value) =>
  new Intl.NumberFormat("ar-SA", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const statusLabels = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  approved: "معتمد",
  posted: "مرحّل",
  rejected: "مرفوض",
  cancelled: "ملغي",
  paid: "مدفوع",
  partially_paid: "مدفوع جزئيًا",
  overdue: "متأخر",
};

const transactionTypeLabels = {
  customer_invoice: "فاتورة عميل",
  customer_payment: "تحصيل عميل",
  supplier_invoice: "فاتورة مورد",
  supplier_payment: "دفعة مورد",
  expense: "مصروف",
  refund: "مرتجع",
  adjustment: "تسوية",
};

function FinanceDashboard({ onNavigate }) {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_BASE}/finance/dashboard`);

      if (!response.ok) {
        throw new Error("تعذر تحميل بيانات المحاسبة.");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.message || "تعذر تحميل بيانات المحاسبة."
        );
      }

      setDashboard(result.data);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل البيانات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const kpis = dashboard?.kpis || {};

  const netMargin = useMemo(() => {
    const income = Number(kpis.income || 0);
    const net = Number(kpis.net || 0);

    if (income <= 0) {
      return 0;
    }

    return (net / income) * 100;
  }, [kpis.income, kpis.net]);

  const modules = [
    {
      id: "finance-journal",
      title: "القيود اليومية",
      description: "إنشاء ومراجعة وترحيل القيود المحاسبية",
      icon: BookOpen,
      accent: "purple",
    },
    {
      id: "finance-chart-accounts",
      title: "دليل الحسابات",
      description: "إدارة شجرة الحسابات والحسابات الفرعية",
      icon: Layers3,
      accent: "blue",
    },
    {
      id: "finance-general-ledger",
      title: "دفتر الأستاذ العام",
      description: "الحركات المرحلة والأرصدة وميزان المراجعة",
      icon: Scale,
      accent: "green",
    },
    {
      id: "finance-collections-center",
      title: "مركز التحصيلات",
      description: "الفواتير والمستحقات وأعمار الديون ومتابعة التحصيل",
      icon: CircleDollarSign,
      accent: "green",
    },
    {
      id: "finance-suppliers",
      title: "الموردون والمدفوعات",
      description: "المستحقات وفواتير الموردين والمدفوعات",
      icon: ReceiptText,
      accent: "orange",
    },
    {
      id: "finance-banks",
      title: "البنوك والخزينة",
      description: "الحسابات البنكية والنقدية والتسويات",
      icon: Landmark,
      accent: "cyan",
    },
    {
      id: "finance-fixed-assets",
      title: "الأصول الثابتة",
      description: "تسجيل الأصول وحساب الإهلاك والقيود المرتبطة بها",
      icon: Building2,
      accent: "blue",
    },
    {
      id: "finance-cost-centers",
      title: "مراكز التكلفة",
      description: "تحليل المصروفات والإيرادات حسب المركز",
      icon: PieChart,
      accent: "pink",
    },
    {
      id: "finance-projects",
      title: "محاسبة المشاريع",
      description: "تكلفة وربحية وتدفقات كل مشروع",
      icon: Building2,
      accent: "purple",
    },
    {
      id: "finance-tax-invoices",
      title: "الفواتير الضريبية",
      description: "إنشاء وإدارة الفواتير الكاملة والجزئية والمرحلية",
      icon: ReceiptText,
      accent: "purple",
    },
    {
      id: "finance-vat-center",
      title: "ضريبة القيمة المضافة وZATCA",
      description: "ضريبة المخرجات والمدخلات وصافي الالتزام والفوترة الإلكترونية",
      icon: Calculator,
      accent: "orange",
    },
    {
      id: "finance-tax-profile",
      title: "الملف الضريبي",
      description: "بيانات المنشأة والرقم الضريبي والعنوان الوطني",
      icon: Building2,
      accent: "purple",
    },
    {
      id: "finance-customer-tax-profile",
      title: "بيانات العملاء الضريبية",
      description: "الرقم الضريبي والسجل التجاري والعنوان الوطني للمشترين",
      icon: Building2,
      accent: "purple",
    },
    {
      id: "finance-income-statement",
      title: "قائمة الدخل",
      description: "الإيرادات والمصروفات وصافي الربح أو الخسارة",
      icon: TrendingUp,
      accent: "green",
    },
    {
      id: "finance-balance-sheet",
      title: "الميزانية العمومية",
      description: "الأصول والالتزامات وحقوق الملكية والمؤشرات المالية",
      icon: Landmark,
      accent: "blue",
    },
    {
        id: "finance-cash-flow",
        title: "التدفقات النقدية",
        description: "المقبوضات والمدفوعات والسيولة والأنشطة النقدية",
        icon: WalletCards,
        accent: "cyan",
      },
    {
      id: "finance-reports",
      title: "مركز الطباعة والتقارير",
      description: "طباعة وتصدير القوائم والدفاتر والتقارير المحاسبية",
      icon: Printer,
      accent: "blue",
    },
  ];

  if (loading) {
    return (
      <div className="finance-state-card">
        <Loader2 className="finance-spin" size={30} />
        <strong>جاري تحميل مركز المالية...</strong>
        <span>يتم تجميع البيانات المالية الحالية.</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="finance-state-card finance-error-state">
        <Calculator size={34} />
        <strong>تعذر تحميل مركز المالية</strong>
        <span>{error}</span>

        <button type="button" onClick={loadDashboard}>
          <RefreshCw size={16} />
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="finance-page">
      <section className="finance-hero">
        <div>
          <div className="finance-eyebrow">
            <Calculator size={15} />
            مركز المالية والمحاسبة
          </div>

          <h1>لوحة المحاسبة</h1>

          <p>
            نظرة موحدة على الإيرادات والمصروفات والمستحقات
            وحركة المشاريع والقيود المحاسبية.
          </p>
        </div>

        <div className="finance-hero-actions">
          <button
            type="button"
            className="finance-secondary-btn"
            onClick={loadDashboard}
          >
            <RefreshCw size={16} />
            تحديث
          </button>

          <button
            type="button"
            className="finance-primary-btn"
            onClick={() => onNavigate?.("finance-journal")}
          >
            <BookOpen size={17} />
            قيد يومية جديد
          </button>
        </div>
      </section>

      <section className="finance-kpi-grid">
        <article className="finance-kpi-card">
          <div className="finance-kpi-top">
            <span className="finance-kpi-icon green">
              <TrendingUp size={19} />
            </span>

            <span className="finance-kpi-label">
              إجمالي الإيرادات
            </span>
          </div>

          <strong>
            {money(kpis.income)}
            <small> ر.س</small>
          </strong>

          <p>الحركات المالية الدائنة للمشاريع</p>
        </article>

        <article className="finance-kpi-card">
          <div className="finance-kpi-top">
            <span className="finance-kpi-icon red">
              <TrendingDown size={19} />
            </span>

            <span className="finance-kpi-label">
              إجمالي المصروفات
            </span>
          </div>

          <strong>
            {money(kpis.expenses)}
            <small> ر.س</small>
          </strong>

          <p>
            بخلاف مصروفات المشاريع المسجلة:{" "}
            {money(kpis.project_expenses)} ر.س
          </p>
        </article>

        <article className="finance-kpi-card">
          <div className="finance-kpi-top">
            <span className="finance-kpi-icon purple">
              <Banknote size={19} />
            </span>

            <span className="finance-kpi-label">
              صافي الحركة
            </span>
          </div>

          <strong>
            {money(kpis.net)}
            <small> ر.س</small>
          </strong>

          <p>هامش حالي {netMargin.toFixed(1)}%</p>
        </article>

        <article className="finance-kpi-card">
          <div className="finance-kpi-top">
            <span className="finance-kpi-icon blue">
              <WalletCards size={19} />
            </span>

            <span className="finance-kpi-label">
              مستحقات العملاء
            </span>
          </div>

          <strong>
            {money(kpis.receivables)}
            <small> ر.س</small>
          </strong>

          <p>
            {Number(kpis.overdue_transactions || 0)} حركة متأخرة
          </p>
        </article>
      </section>

      <section className="finance-overview-row">
        <div className="finance-overview-card">
          <div>
            <span>مستحقات الموردين</span>
            <strong>{money(kpis.payables)} ر.س</strong>
          </div>

          <span className="finance-overview-icon orange">
            <ReceiptText size={21} />
          </span>
        </div>

        <div className="finance-overview-card">
          <div>
            <span>المشتريات المعتمدة</span>
            <strong>
              {money(kpis.approved_purchases)} ر.س
            </strong>
          </div>

          <span className="finance-overview-icon blue">
            <WalletCards size={21} />
          </span>
        </div>

        <div className="finance-overview-card">
          <div>
            <span>مشاريع داخل المالية</span>
            <strong>
              {Number(kpis.projects_in_finance || 0)}
            </strong>
          </div>

          <span className="finance-overview-icon purple">
            <Building2 size={21} />
          </span>
        </div>

        <div className="finance-overview-card">
          <div>
            <span>قيود تنتظر الاعتماد</span>
            <strong>
              {Number(kpis.pending_entries || 0)}
            </strong>
          </div>

          <span className="finance-overview-icon green">
            <BookOpen size={21} />
          </span>
        </div>
      </section>

      <section className="finance-visual-grid">
        <article className="finance-chart-card finance-cashflow-card">
          <div className="finance-visual-header">
            <div>
              <span className="finance-visual-kicker">التدفق النقدي</span>
              <h3>الإيرادات مقابل المصروفات</h3>
              <p>ملخص بصري للحركة المالية الحالية</p>
            </div>
            <span className="finance-chart-badge">آخر 6 أشهر</span>
          </div>

          <div className="finance-chart-summary">
            <div><span>إجمالي الإيرادات</span><strong className="finance-positive">{money(kpis.income)} ر.س</strong></div>
            <div><span>إجمالي المصروفات</span><strong className="finance-negative">{money(kpis.expenses)} ر.س</strong></div>
            <div><span>صافي الحركة</span><strong>{money(kpis.net)} ر.س</strong></div>
          </div>

          <div className="finance-bars-chart">
            {[48, 62, 55, 77, 68, 88].map((value, index) => (
              <div className="finance-chart-month" key={index}>
                <div className="finance-bar-stack">
                  <span className="finance-bar income" style={{ height: `${value}%` }} />
                  <span className="finance-bar expense" style={{ height: `${Math.max(value - 22, 20)}%` }} />
                </div>
                <small>{["مار", "أبر", "ماي", "يون", "يول", "أغس"][index]}</small>
              </div>
            ))}
          </div>
          <div className="finance-chart-legend">
            <span><i className="income-dot" />الإيرادات</span>
            <span><i className="expense-dot" />المصروفات</span>
          </div>
        </article>

        <article className="finance-chart-card">
          <div className="finance-visual-header">
            <div><span className="finance-visual-kicker">الذمم المالية</span><h3>المستحقات</h3><p>العملاء مقابل الموردين</p></div>
            <WalletCards size={20} />
          </div>
          <div className="finance-ring-wrap">
            <div className="finance-ring" style={{"--ring-value": `${Number(kpis.receivables || 0) + Number(kpis.payables || 0) > 0 ? Math.min(100, (Number(kpis.receivables || 0) / (Number(kpis.receivables || 0) + Number(kpis.payables || 0))) * 100) : 0}%`}}>
              <div className="finance-ring-center"><strong>{money(kpis.receivables)}</strong><span>ر.س تحصيل</span></div>
            </div>
          </div>
          <div className="finance-progress-list">
            <div><div className="finance-progress-heading"><span>مستحقات العملاء</span><strong>{money(kpis.receivables)} ر.س</strong></div><div className="finance-progress"><span className="green" style={{ width: "74%" }} /></div></div>
            <div><div className="finance-progress-heading"><span>مستحقات الموردين</span><strong>{money(kpis.payables)} ر.س</strong></div><div className="finance-progress"><span className="orange" style={{ width: "52%" }} /></div></div>
          </div>
        </article>

        <article className="finance-chart-card">
          <div className="finance-visual-header">
            <div><span className="finance-visual-kicker">ربحية المشاريع</span><h3>الأداء المالي للمشاريع</h3><p>نظرة سريعة على النشاط الحالي</p></div>
            <Building2 size={20} />
          </div>
          <div className="finance-project-analytics">
            <div className="finance-score-circle"><strong>{Math.max(0, Math.min(100, Math.round(netMargin || 0)))}%</strong><span>الهامش</span></div>
            <div className="finance-project-metrics">
              <div><span>مشاريع داخل المالية</span><strong>{Number(kpis.projects_in_finance || 0)}</strong></div>
              <div><span>مصاريف المشاريع</span><strong>{money(kpis.project_expenses)} ر.س</strong></div>
              <div><span>المشتريات المعتمدة</span><strong>{money(kpis.approved_purchases)} ر.س</strong></div>
            </div>
          </div>
        </article>

        <article className="finance-chart-card">
          <div className="finance-visual-header">
            <div><span className="finance-visual-kicker">دورة القيود</span><h3>حالة القيود اليومية</h3><p>متابعة الاعتماد والترحيل</p></div>
            <BookOpen size={20} />
          </div>
          <div className="finance-journal-dashboard">
            <div className="finance-journal-ring"><strong>{Number(kpis.posted_entries || 0) + Number(kpis.pending_entries || 0)}</strong><span>إجمالي القيود</span></div>
            <div className="finance-journal-stats">
              <div className="purple-stat"><span>قيد المراجعة</span><strong>{Number(kpis.pending_entries || 0)}</strong></div>
              <div className="green-stat"><span>تم الترحيل</span><strong>{Number(kpis.posted_entries || 0)}</strong></div>
              <div className="red-stat"><span>حركات متأخرة</span><strong>{Number(kpis.overdue_transactions || 0)}</strong></div>
            </div>
          </div>
        </article>
      </section>

      <section className="finance-section">
        <div className="finance-section-heading">
          <div>
            <h2>الوحدات المالية</h2>
            <p>الوصول السريع إلى أقسام المحاسبة</p>
          </div>
        </div>

        <div className="finance-modules-grid">
          {modules.map((module) => {
            const Icon = module.icon;

            return (
              <button
                type="button"
                className="finance-module-card"
                key={module.id}
                onClick={() => onNavigate?.(module.id)}
              >
                <span
                  className={`finance-module-icon ${module.accent}`}
                >
                  <Icon size={22} />
                </span>

                <span className="finance-module-copy">
                  <strong>{module.title}</strong>
                  <small>{module.description}</small>
                </span>

                <ChevronLeft
                  className="finance-module-arrow"
                  size={18}
                />
              </button>
            );
          })}
        </div>
      </section>

      <section className="finance-dashboard-grid">
        <div className="finance-table-card">
          <div className="finance-card-header">
            <div>
              <h3>أحدث الحركات المالية</h3>
              <p>آخر حركات المشاريع المسجلة</p>
            </div>

            <ArrowUpLeft size={18} />
          </div>

          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>الحركة</th>
                  <th>المشروع</th>
                  <th>الحالة</th>
                  <th>القيمة</th>
                </tr>
              </thead>

              <tbody>
                {(dashboard?.recent_transactions || []).length ===
                0 ? (
                  <tr>
                    <td colSpan="4">
                      <div className="finance-empty">
                        لا توجد حركات مالية مسجلة حتى الآن.
                      </div>
                    </td>
                  </tr>
                ) : (
                  dashboard.recent_transactions.map(
                    (transaction) => (
                      <tr key={transaction.id}>
                        <td>
                          <div className="finance-table-main">
                            <strong>
                              {transaction.title ||
                                transactionTypeLabels[
                                  transaction.type
                                ] ||
                                "حركة مالية"}
                            </strong>

                            <span>
                              {transaction.reference_number ||
                                transactionTypeLabels[
                                  transaction.type
                                ] ||
                                "—"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="finance-table-main">
                            <strong>
                              {transaction.project?.name || "—"}
                            </strong>
                            <span>
                              {transaction.project?.project_code ||
                                "—"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`finance-status ${transaction.status}`}
                          >
                            {statusLabels[transaction.status] ||
                              transaction.status}
                          </span>
                        </td>

                        <td>
                          <strong
                            className={
                              transaction.direction === "income"
                                ? "finance-positive"
                                : "finance-negative"
                            }
                          >
                            {transaction.direction === "income"
                              ? "+"
                              : "-"}
                            {money(transaction.total)} ر.س
                          </strong>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="finance-side-card">
          <div className="finance-card-header">
            <div>
              <h3>حالة القيود</h3>
              <p>متابعة دورة القيد المحاسبي</p>
            </div>
          </div>

          <div className="finance-journal-summary">
            <div>
              <span>قيود قيد المراجعة</span>
              <strong>
                {Number(kpis.pending_entries || 0)}
              </strong>
            </div>

            <div>
              <span>قيود تم ترحيلها</span>
              <strong>
                {Number(kpis.posted_entries || 0)}
              </strong>
            </div>

            <div>
              <span>حركات متأخرة</span>
              <strong>
                {Number(kpis.overdue_transactions || 0)}
              </strong>
            </div>
          </div>

          <button
            type="button"
            className="finance-side-action"
            onClick={() => onNavigate?.("finance-journal")}
          >
            فتح القيود اليومية
            <ArrowLeft size={16} />
          </button>
        </aside>
      </section>
    </div>
  );
}

export default FinanceDashboard;
