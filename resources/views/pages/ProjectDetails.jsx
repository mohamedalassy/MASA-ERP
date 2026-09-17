import { useEffect, useMemo, useState } from "react";

import {
  Building2,
  UserRound,
  Phone,
  Mail,
  MapPin,
  CalendarDays,
  FileText,
  ShoppingCart,
  WalletCards,
  FolderOpen,
  Users,
  CheckCircle2,
  Clock3,
  Send,
  Undo2,
  Edit3,
  Printer,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  ReceiptText,
} from "lucide-react";

/*
|--------------------------------------------------------------------------
| API
|--------------------------------------------------------------------------
*/

const API_URL = "http://127.0.0.1:8000/api";

/*
|--------------------------------------------------------------------------
| Workflow
|--------------------------------------------------------------------------
*/

const workflowStages = [
  {
    key: "crm",
    name: "CRM",
  },
  {
    key: "pricing",
    name: "التسعير",
  },
  {
    key: "purchasing",
    name: "المشتريات",
  },
  {
    key: "finance",
    name: "المالية",
  },
  {
    key: "execution",
    name: "التنفيذ",
  },
  {
    key: "closed",
    name: "الإغلاق",
  },
];

const stageNames = {
  crm: "CRM",
  pricing: "التسعير",
  purchasing: "المشتريات",
  finance: "المالية",
  execution: "التنفيذ",
  closed: "الإغلاق",
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const formatMoney = (value) => {
  const number = Number(value || 0);

  return `${number.toLocaleString("en-US")} ر.س`;
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-CA");
};

const getInitials = (name = "") => {
  const words = name.trim().split(" ").filter(Boolean);

  if (!words.length) {
    return "MA";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
};

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function ProjectDetails() {
  const [project, setProject] = useState(null);

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState("");

  const [isMoving, setIsMoving] = useState(false);

  const [moveMessage, setMoveMessage] = useState("");

  const [moveError, setMoveError] = useState("");

  const [isReturning, setIsReturning] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [returnError, setReturnError] = useState("");

  /*
  |--------------------------------------------------------------------------
  | Load Project
  |--------------------------------------------------------------------------
  */

  const loadProject = async () => {
    try {
      setLoading(true);
      setLoadError("");

      const response = await fetch(
        `${API_URL}/projects/1`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            "تعذر تحميل بيانات المشروع"
        );
      }

      setProject(result.data);
    } catch (error) {
      console.error(error);

      setLoadError(
        error.message ||
          "حدث خطأ أثناء تحميل المشروع"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Move To Next Stage
  |--------------------------------------------------------------------------
  */

  const handleMoveToNextStage = async () => {
    if (!project) {
      return;
    }

    if (project.current_stage === "closed") {
      setMoveError(
        "المشروع موجود بالفعل في مرحلة الإغلاق."
      );

      return;
    }

    try {
      setIsMoving(true);

      setMoveMessage("");
      setMoveError("");

      const response = await fetch(
        `${API_URL}/projects/${project.id}/next-stage`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },

          body: JSON.stringify({
            notes:
              "تم تحويل المشروع من واجهة MASA ERP",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            "تعذر تحويل المشروع للقسم التالي"
        );
      }

      const newStage =
        result.data.current_stage;

      setMoveMessage(
        `تم تحويل المشروع إلى ${
          stageNames[newStage] || newStage
        } بنجاح`
      );

      /*
       * نقرأ المشروع مرة أخرى من قاعدة البيانات
       * حتى تتحدث كل أجزاء الصفحة.
       */
      await loadProject();
    } catch (error) {
      console.error(error);

      setMoveError(
        error.message ||
          "حدث خطأ أثناء تحويل المشروع"
      );
    } finally {
      setIsMoving(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Move To Previous Stage
  |--------------------------------------------------------------------------
  */

  const openReturnModal = () => {
    setReturnError("");
    setReturnReason("");
    setIsReturnModalOpen(true);
  };

  const closeReturnModal = () => {
    if (isReturning) return;

    setIsReturnModalOpen(false);
    setReturnReason("");
    setReturnError("");
  };

  const handleMoveToPreviousStage = async () => {
    if (!project) return;

    if (project.current_stage === "crm") {
      setMoveError("المشروع موجود بالفعل في أول مرحلة.");
      return;
    }

    if (!returnReason.trim()) {
      setReturnError("سبب الإرجاع مطلوب.");
      return;
    }

    try {
      setIsReturning(true);
      setReturnError("");
      setMoveMessage("");
      setMoveError("");

      const response = await fetch(
        `${API_URL}/projects/${project.id}/previous-stage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            notes: returnReason.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "تعذر إرجاع المشروع للقسم السابق"
        );
      }

      const newStage = result.data.current_stage;

      setMoveMessage(
        `تم إرجاع المشروع إلى ${
          stageNames[newStage] || newStage
        } بنجاح`
      );

      setIsReturnModalOpen(false);
      setReturnReason("");

      await loadProject();
    } catch (error) {
      console.error(error);

      setReturnError(
        error.message || "حدث خطأ أثناء إرجاع المشروع"
      );
    } finally {
      setIsReturning(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Dynamic Workflow
  |--------------------------------------------------------------------------
  */

  const workflow = useMemo(() => {
    const currentStage =
      project?.current_stage || "crm";

    const currentIndex =
      workflowStages.findIndex(
        (stage) =>
          stage.key === currentStage
      );

    return workflowStages.map(
      (stage, index) => {
        let status = "pending";

        if (index < currentIndex) {
          status = "completed";
        }

        if (index === currentIndex) {
          status = "current";
        }

        let note = "بانتظار المرحلة السابقة";

        if (status === "completed") {
          note = "تم الانتهاء";
        }

        if (status === "current") {
          note = "قيد العمل";
        }

        if (
          stage.key === "crm" &&
          status === "completed"
        ) {
          note = "تم إنشاء المشروع";
        }

        return {
          id: index + 1,
          ...stage,
          status,
          note,
        };
      }
    );
  }, [project?.current_stage]);

  /*
  |--------------------------------------------------------------------------
  | Data
  |--------------------------------------------------------------------------
  */

  const quotation =
    project?.quotations?.[0] || null;

  const purchaseOrders =
    project?.purchase_orders || [];

  const transactions =
    project?.financial_transactions || [];

  const attachments =
    project?.attachments || [];

  const projectNotes =
    project?.notes || [];

  const workflowHistory =
    project?.workflow_history || [];

  const invoicedTotal = transactions
    .filter(
      (item) =>
        item.type === "customer_invoice"
    )
    .reduce(
      (sum, item) =>
        sum + Number(item.total || 0),
      0
    );

  const paidTotal = transactions
    .filter(
      (item) =>
        item.type === "customer_payment"
    )
    .reduce(
      (sum, item) =>
        sum +
        Number(
          item.paid_amount ||
            item.total ||
            0
        ),
      0
    );

  /*
  |--------------------------------------------------------------------------
  | Loading
  |--------------------------------------------------------------------------
  */

  if (loading && !project) {
    return (
      <div
        className="project-file-page"
        dir="rtl"
      >
        <div className="project-loading">
          جاري تحميل ملف المشروع...
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Error
  |--------------------------------------------------------------------------
  */

  if (loadError && !project) {
    return (
      <div
        className="project-file-page"
        dir="rtl"
      >
        <div className="project-error-box">
          <strong>
            تعذر تحميل المشروع
          </strong>

          <span>{loadError}</span>

          <button
            type="button"
            onClick={loadProject}
          >
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  return (
    <div
      className="project-file-page"
      dir="rtl"
    >
      {/* =====================================================
          TOP
      ====================================================== */}

      <div className="project-file-topbar">
        <div className="project-title-area">
          <div className="project-breadcrumb">
            المشاريع
            <span>/</span>
            متابعة المشاريع
            <span>/</span>
            ملف المشروع
          </div>

          <div className="project-title-row-main">
            <div>
              <h1>{project.name}</h1>

              <div className="project-meta-line">
                <span className="project-code">
                  {project.project_code}
                </span>

                <span className="project-status active">
                  {project.status === "completed"
                    ? "مكتمل"
                    : "قيد التنفيذ"}
                </span>

                <span>أمر عمل</span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="project-main-actions">
            <button
              type="button"
              className="project-secondary-btn"
            >
              <MoreHorizontal size={17} />
              المزيد
            </button>

            <button
              type="button"
              className="project-secondary-btn"
            >
              <Edit3 size={16} />
              تحرير
            </button>

            <div className="project-print-group">
              <button
                type="button"
                className="project-secondary-btn"
              >
                <Printer size={16} />
                طباعة / تصدير
              </button>
            </div>

            <button
              className="project-return-btn"
              type="button"
              onClick={openReturnModal}
              disabled={
                isReturning ||
                project.current_stage === "crm"
              }
            >
              <Undo2 size={17} />

              {project.current_stage === "crm"
                ? "لا توجد مرحلة سابقة"
                : "إرجاع للقسم السابق"}
            </button>

            <button
              className="project-primary-btn"
              type="button"
              onClick={
                handleMoveToNextStage
              }
              disabled={
                isMoving ||
                isReturning ||
                project.current_stage ===
                  "closed"
              }
            >
              <Send size={17} />

              {isMoving
                ? "جاري التحويل..."
                : project.current_stage ===
                    "closed"
                  ? "تم إغلاق المشروع"
                  : "إرسال للقسم التالي"}
            </button>
          </div>

          {moveMessage && (
            <div className="project-move-message">
              {moveMessage}
            </div>
          )}

          {moveError && (
            <div className="project-move-error">
              {moveError}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          CUSTOMER + PROJECT INFORMATION
      ====================================================== */}

      <section className="project-info-card">
        <div className="project-info-item">
          <div className="info-icon">
            <Building2 size={18} />
          </div>

          <div>
            <span>العميل</span>

            <strong>
              {project.customer_name}
            </strong>

            <small>
              {project.customer_code || "-"}
            </small>
          </div>
        </div>

        <div className="project-info-item">
          <div className="info-icon">
            <Phone size={18} />
          </div>

          <div>
            <span>الجوال</span>

            <strong>
              {project.phone || "-"}
            </strong>
          </div>
        </div>

        <div className="project-info-item">
          <div className="info-icon">
            <Mail size={18} />
          </div>

          <div>
            <span>
              البريد الإلكتروني
            </span>

            <strong>
              {project.email || "-"}
            </strong>
          </div>
        </div>

        <div className="project-info-item">
          <div className="info-icon">
            <MapPin size={18} />
          </div>

          <div>
            <span>العنوان</span>

            <strong>
              {project.address || "-"}
            </strong>
          </div>
        </div>

        <div className="project-info-item">
          <div className="info-icon">
            <FileText size={18} />
          </div>

          <div>
            <span>السجل التجاري</span>

            <strong>
              {project.commercial_register ||
                "-"}
            </strong>
          </div>
        </div>

        <div className="project-info-item">
          <div className="info-icon">
            <ReceiptText size={18} />
          </div>

          <div>
            <span>الرقم الضريبي</span>

            <strong>
              {project.tax_number || "-"}
            </strong>
          </div>
        </div>

        <div className="project-info-item">
          <div className="info-icon">
            <UserRound size={18} />
          </div>

          <div>
            <span>مدير المشروع</span>

            <strong>
              {project.project_manager ||
                "-"}
            </strong>
          </div>
        </div>

        <div className="project-info-item">
          <div className="info-icon">
            <Users size={18} />
          </div>

          <div>
            <span>مسؤول العميل</span>

            <strong>
              {project.account_manager ||
                "-"}
            </strong>
          </div>
        </div>

        <div className="project-info-item">
          <div className="info-icon">
            <CalendarDays size={18} />
          </div>

          <div>
            <span>تاريخ الإنشاء</span>

            <strong>
              {formatDate(
                project.created_at
              )}
            </strong>
          </div>
        </div>
      </section>

      {/* =====================================================
          WORKFLOW
      ====================================================== */}

      <section className="project-workflow-card">
        <div className="current-department">
          <div className="current-department-icon">
            <Clock3 size={20} />
          </div>

          <div>
            <span>القسم الحالي</span>

            <strong>
              {stageNames[
                project.current_stage
              ] || project.current_stage}
            </strong>
          </div>
        </div>

        <div className="workflow-track">
          {workflow.map((step) => (
            <div
              key={step.id}
              className={`workflow-step ${step.status}`}
            >
              <div className="workflow-number">
                {step.status ===
                "completed" ? (
                  <CheckCircle2
                    size={18}
                  />
                ) : (
                  step.id
                )}
              </div>

              <strong>
                {step.name}
              </strong>

              <span>
                {step.note}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================
          TABS
      ====================================================== */}

      <div className="project-tabs">
        <button className="active">
          نظرة عامة
        </button>

        <button>
          بيانات العميل
        </button>

        <button>
          عرض السعر
        </button>

        <button>
          المشتريات
        </button>

        <button>
          المالية
        </button>

        <button>
          الملفات
        </button>

        <button>
          الملاحظات
        </button>

        <button>
          سجل الأنشطة
        </button>
      </div>

      {/* =====================================================
          CONTENT
      ====================================================== */}

      <div className="project-content-grid">
        {/* SIDE */}

        <aside className="project-side-column">
          <section className="project-widget">
            <div className="project-widget-header">
              <h3>
                معلومات المشروع
              </h3>
            </div>

            <div className="project-summary-list">
              <div>
                <span>
                  نوع المشروع
                </span>

                <strong>
                  {project.project_type ||
                    "-"}
                </strong>
              </div>

              <div>
                <span>
                  أولوية المشروع
                </span>

                <strong
                  className={
                    project.priority ===
                    "high"
                      ? "priority-high"
                      : ""
                  }
                >
                  {project.priority ===
                  "high"
                    ? "عالية"
                    : project.priority ===
                        "low"
                      ? "منخفضة"
                      : "عادية"}
                </strong>
              </div>

              <div>
                <span>
                  تاريخ البدء المتوقع
                </span>

                <strong>
                  {formatDate(
                    project.expected_start_date
                  )}
                </strong>
              </div>

              <div>
                <span>
                  تاريخ الانتهاء المتوقع
                </span>

                <strong>
                  {formatDate(
                    project.expected_end_date
                  )}
                </strong>
              </div>

              <div>
                <span>
                  القيمة الإجمالية
                </span>

                <strong>
                  {formatMoney(
                    project.total_value
                  )}
                </strong>
              </div>
            </div>
          </section>

          <section className="project-widget">
            <div className="project-widget-header">
              <h3>
                الفريق المسؤول
              </h3>
            </div>

            <div className="project-team-list">
              <div>
                <span className="member-avatar">
                  {getInitials(
                    project.project_manager
                  )}
                </span>

                <div>
                  <strong>
                    {project.project_manager ||
                      "غير محدد"}
                  </strong>

                  <span>
                    مدير المشروع
                  </span>
                </div>
              </div>

              <div>
                <span className="member-avatar">
                  {getInitials(
                    project.account_manager
                  )}
                </span>

                <div>
                  <strong>
                    {project.account_manager ||
                      "غير محدد"}
                  </strong>

                  <span>
                    مسؤول العميل
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="project-permission-badge">
            <ShieldCheck size={18} />

            <div>
              <strong>
                صلاحيات المدير العام
              </strong>

              <span>
                لديك صلاحية مشاهدة
                جميع تفاصيل المشروع
              </span>
            </div>
          </section>
        </aside>

        {/* MAIN */}

        <main className="project-main-column">
          {/* MODULE CARDS */}

          <div className="project-module-grid">
            {/* QUOTATION */}

            <article className="project-module-card">
              <div className="module-card-icon purple">
                <FileText size={22} />
              </div>

              <span className="module-label">
                عرض السعر
              </span>

              {quotation ? (
                <>
                  <strong className="module-value">
                    {
                      quotation.quotation_number
                    }
                  </strong>

                  <span className="module-status success">
                    {quotation.status ===
                    "approved"
                      ? "معتمد"
                      : quotation.status}
                  </span>

                  <div className="module-card-details">
                    <span>
                      القيمة الإجمالية
                    </span>

                    <strong>
                      {formatMoney(
                        quotation.total
                      )}
                    </strong>
                  </div>

                  <button type="button">
                    عرض التفاصيل
                  </button>
                </>
              ) : (
                <>
                  <strong className="module-value empty">
                    لا يوجد عرض سعر
                  </strong>

                  <span className="module-description">
                    لم يتم إنشاء عرض
                    سعر لهذا المشروع
                  </span>

                  <button type="button">
                    <Plus size={14} />
                    إنشاء عرض سعر
                  </button>
                </>
              )}
            </article>

            {/* PURCHASES */}

            <article className="project-module-card">
              <div className="module-card-icon orange">
                <ShoppingCart size={22} />
              </div>

              <span className="module-label">
                المشتريات
              </span>

              {purchaseOrders.length ? (
                <>
                  <strong className="module-value">
                    {
                      purchaseOrders.length
                    }{" "}
                    أمر شراء
                  </strong>

                  <span className="module-description">
                    آخر أمر شراء:{" "}
                    {purchaseOrders[0]
                      ?.po_number || "-"}
                  </span>

                  <div className="module-card-details">
                    <span>
                      إجمالي المشتريات
                    </span>

                    <strong>
                      {formatMoney(
                        purchaseOrders.reduce(
                          (
                            sum,
                            order
                          ) =>
                            sum +
                            Number(
                              order.total ||
                                0
                            ),
                          0
                        )
                      )}
                    </strong>
                  </div>

                  <button
                    className="orange-button"
                    type="button"
                  >
                    عرض المشتريات
                  </button>
                </>
              ) : (
                <>
                  <strong className="module-value empty">
                    لا توجد طلبات شراء
                  </strong>

                  <span className="module-description">
                    لم يتم إنشاء أي
                    طلب شراء لهذا
                    المشروع
                  </span>

                  <button
                    type="button"
                    className="orange-button"
                  >
                    <Plus size={14} />
                    إنشاء طلب شراء
                  </button>
                </>
              )}
            </article>

            {/* FINANCE */}

            <article className="project-module-card">
              <div className="module-card-icon green">
                <WalletCards size={22} />
              </div>

              <span className="module-label">
                الفواتير والمدفوعات
              </span>

              <strong className="module-value">
                {formatMoney(
                  invoicedTotal
                )}
              </strong>

              <div className="finance-mini-grid">
                <div>
                  <span>مفوتر</span>

                  <strong>
                    {formatMoney(
                      invoicedTotal
                    )}
                  </strong>
                </div>

                <div>
                  <span>مدفوع</span>

                  <strong>
                    {formatMoney(
                      paidTotal
                    )}
                  </strong>
                </div>
              </div>

              <button type="button">
                عرض التفاصيل
              </button>
            </article>

            {/* FILES */}

            <article className="project-module-card">
              <div className="module-card-icon blue">
                <FolderOpen size={22} />
              </div>

              <span className="module-label">
                المرفقات
              </span>

              <strong className="module-value">
                {attachments.length}
              </strong>

              <span className="module-description">
                {attachments.length
                  ? `آخر ملف مرفق: ${
                      attachments[0]
                        ?.original_name ||
                      attachments[0]
                        ?.file_name ||
                      "-"
                    }`
                  : "لا توجد مرفقات حتى الآن"}
              </span>

              <button type="button">
                عرض جميع الملفات
              </button>
            </article>
          </div>

          {/* =================================================
              NOTES + ACTIVITY
          ================================================== */}

          <div className="project-lower-grid">
            {/* NOTES */}

            <section className="project-widget project-notes">
              <div className="project-widget-header">
                <h3>
                  آخر الملاحظات
                </h3>

                <button type="button">
                  <Plus size={14} />
                  إضافة ملاحظة
                </button>
              </div>

              <div className="project-note-list">
                {projectNotes.length ? (
                  projectNotes.map(
                    (note) => (
                      <div
                        className="project-note"
                        key={note.id}
                      >
                        <div className="note-avatar">
                          {getInitials(
                            note.user?.name ||
                              "MA"
                          )}
                        </div>

                        <div>
                          <div className="note-top">
                            <strong>
                              {note.user
                                ?.name ||
                                "مستخدم النظام"}
                            </strong>

                            <span>
                              ملاحظة
                            </span>
                          </div>

                          <small>
                            {formatDate(
                              note.created_at
                            )}
                          </small>

                          <p>
                            {note.note}
                          </p>
                        </div>
                      </div>
                    )
                  )
                ) : (
                  <div className="project-empty-state">
                    لا توجد ملاحظات
                    على المشروع حتى
                    الآن.
                  </div>
                )}
              </div>
            </section>

            {/* ACTIVITY */}

            <section className="project-widget project-activity">
              <div className="project-widget-header">
                <h3>
                  سجل الأنشطة
                </h3>
              </div>

              <div className="project-timeline">
                {workflowHistory.length ? (
                  workflowHistory.map(
                    (activity) => (
                      <div
                        key={
                          activity.id
                        }
                        className="timeline-item"
                      >
                        <div className="timeline-icon purple">
                          <Send
                            size={15}
                          />
                        </div>

                        <div className="timeline-content">
                          <strong>
                            {activity.status === "returned"
                              ? "تم إرجاع"
                              : "تم تحويل"}{" "}
                            المشروع من{" "}
                            {stageNames[
                              activity
                                .from_stage
                            ] ||
                              activity.from_stage}{" "}
                            إلى{" "}
                            {stageNames[
                              activity
                                .to_stage
                            ] ||
                              activity.to_stage}
                          </strong>

                          <span>
                            {activity
                              .transferred_by
                              ?.name
                              ? `بواسطة ${activity.transferred_by.name}`
                              : "بواسطة النظام"}
                          </span>
                        </div>

                        <time>
                          {formatDate(
                            activity.transferred_at
                          )}
                        </time>
                      </div>
                    )
                  )
                ) : (
                  <div className="project-empty-state">
                    لا توجد عمليات
                    مسجلة حتى الآن.
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}