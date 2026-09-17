import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileText,
  Fingerprint,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import "../../styles/hr-employee-profile.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const STATUS_LABELS = {
  active: "نشط",
  draft: "مسودة",
  on_leave: "في إجازة",
  suspended: "موقوف",
  terminated: "منتهي",
};

const CONTRACT_LABELS = {
  active: "ساري",
  draft: "مسودة",
  expired: "منتهي",
  terminated: "موقوف",
};

function getToken() {
  return localStorage.getItem("token") || localStorage.getItem("auth_token") || "";
}

async function getEmployee(id) {
  const token = getToken();
  const response = await fetch(`${API_BASE}/hr/employees/${id}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await response.text();
  let payload = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`استجابة غير صالحة من الخادم (${response.status})`);
    }
  }
  if (!response.ok) {
    throw new Error(payload?.message || (response.status === 404 ? "لم يتم العثور على الموظف" : "تعذر تحميل ملف الموظف"));
  }
  return payload?.data || payload;
}

function formatDate(value) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

function money(value, currency = "SAR") {
  return Number(value || 0).toLocaleString("ar-SA", { style: "currency", currency, maximumFractionDigits: 0 });
}

function Ring({ value, label, tone = "blue" }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className={`hep-ring hep-ring--${tone}`}>
      <svg viewBox="0 0 120 120">
        <circle className="hep-ring__track" cx="60" cy="60" r={radius} />
        <circle className="hep-ring__value" cx="60" cy="60" r={radius} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - safeValue / 100)} />
      </svg>
      <div><strong>{safeValue}%</strong><span>{label}</span></div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return <div className="hep-info-row"><span><Icon size={16} /></span><div><small>{label}</small><strong>{value || "غير محدد"}</strong></div></div>;
}

export default function HrEmployeeProfile({ employeeId, onNavigate }) {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async () => {
    if (!employeeId) {
      setError("لم يتم تحديد الموظف");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setEmployee(await getEmployee(employeeId));
    } catch (err) {
      setError(err.message || "تعذر تحميل ملف الموظف");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const analytics = useMemo(() => {
    if (!employee) return { readiness: 0, documents: 0, contract: 0, attendance: 0 };
    const required = ["employee_number", "first_name", "last_name", "work_email", "mobile", "branch_id", "department_id", "job_title_id", "shift_id", "hire_date", "status", "employment_type"];
    const readiness = Math.round((required.filter((key) => employee[key]).length / required.length) * 100);
    const docs = employee.documents || [];
    const verified = docs.filter((doc) => doc.is_verified).length;
    const documents = docs.length ? Math.round((verified / docs.length) * 100) : 0;
    const contracts = employee.contracts || [];
    const activeContract = contracts.find((item) => item.status === "active") || contracts[0];
    return {
      readiness,
      documents,
      contract: activeContract ? 100 : 0,
      attendance: employee.biometric_user_id ? 100 : 0,
      activeContract,
    };
  }, [employee]);

  if (loading) {
    return <main className="hep hep-state" dir="rtl"><RefreshCw className="hep-spin" size={34} /><strong>جارٍ تحميل ملف الموظف...</strong></main>;
  }

  if (error || !employee) {
    return <main className="hep hep-state" dir="rtl"><CircleAlert size={36} /><strong>{error || "تعذر تحميل الملف"}</strong><button onClick={() => onNavigate?.("hr-employees")} type="button">العودة للموظفين</button></main>;
  }

  const fullName = employee.full_name || `${employee.first_name || ""} ${employee.middle_name || ""} ${employee.last_name || ""}`.replace(/\s+/g, " ").trim();
  const contract = analytics.activeContract;
  const documents = employee.documents || [];
  const contracts = employee.contracts || [];

  return (
    <main className="hep" dir="rtl">
      <header className="hep-header">
        <button type="button" className="hep-back" onClick={() => onNavigate?.("hr-employees")}><ArrowRight size={18} /> دليل الموظفين</button>
        <button type="button" className="hep-refresh" onClick={loadProfile}><RefreshCw size={18} /> تحديث الملف</button>
      </header>

      <section className="hep-hero">
        <div className="hep-person">
          <div className="hep-avatar">{fullName.charAt(0) || "م"}<i /></div>
          <div>
            <div className="hep-name-line"><h1>{fullName}</h1><span className={`hep-status hep-status--${employee.status || "draft"}`}><i />{STATUS_LABELS[employee.status] || "مسودة"}</span></div>
            <p>{employee.job_title?.name || "بدون مسمى وظيفي"} <b>•</b> {employee.department?.name || "غير مرتبط بقسم"}</p>
            <div className="hep-tags"><span><BadgeCheck size={15} /> {employee.employee_number}</span><span><Building2 size={15} /> {employee.branch?.name || "بدون فرع"}</span>{employee.biometric_user_id && <span className="is-biometric"><Fingerprint size={15} /> مرتبط بالبصمة</span>}</div>
          </div>
        </div>
        <div className="hep-score"><small>جاهزية الملف</small><strong>{analytics.readiness}%</strong><div><i style={{ width: `${analytics.readiness}%` }} /></div><span>{analytics.readiness >= 80 ? "الملف جاهز للتشغيل" : "يحتاج استكمال بعض البيانات"}</span></div>
      </section>

      <section className="hep-kpis">
        <article><span className="blue"><ShieldCheck size={20} /></span><div><small>حالة التوظيف</small><strong>{STATUS_LABELS[employee.status] || "مسودة"}</strong><em>{employee.is_active === false ? "غير مفعل" : "حساب مفعل"}</em></div></article>
        <article><span className="violet"><CalendarDays size={20} /></span><div><small>تاريخ التعيين</small><strong>{formatDate(employee.hire_date)}</strong><em>{employee.employment_type || "نوع غير محدد"}</em></div></article>
        <article><span className="green"><FileCheck2 size={20} /></span><div><small>المستندات</small><strong>{documents.length}</strong><em>{documents.filter((item) => item.is_verified).length} موثق</em></div></article>
        <article><span className="orange"><WalletCards size={20} /></span><div><small>العقود</small><strong>{contracts.length}</strong><em>{contract ? CONTRACT_LABELS[contract.status] || contract.status : "لا يوجد عقد"}</em></div></article>
      </section>

      <section className="hep-grid">
        <article className="hep-panel hep-panel--analytics">
          <div className="hep-title"><span><ShieldCheck size={18} /></span><div><h2>مؤشر جاهزية الموظف</h2><p>قراءة لحظية للبيانات والتكاملات</p></div></div>
          <div className="hep-rings"><Ring value={analytics.readiness} label="اكتمال الملف" /><Ring value={analytics.documents} label="توثيق المستندات" tone="green" /><Ring value={analytics.attendance} label="تكامل الحضور" tone="violet" /></div>
        </article>

        <article className="hep-panel">
          <div className="hep-title"><span><UserRound size={18} /></span><div><h2>البيانات الأساسية</h2><p>هوية الموظف ووسائل التواصل</p></div></div>
          <div className="hep-info-grid">
            <InfoRow icon={Mail} label="البريد الوظيفي" value={employee.work_email} />
            <InfoRow icon={Phone} label="رقم الجوال" value={employee.mobile} />
            <InfoRow icon={MapPin} label="العنوان" value={employee.address} />
            <InfoRow icon={CalendarDays} label="تاريخ الميلاد" value={formatDate(employee.birth_date)} />
          </div>
        </article>

        <article className="hep-panel">
          <div className="hep-title"><span><BriefcaseBusiness size={18} /></span><div><h2>الهيكل الوظيفي</h2><p>موقع الموظف داخل المؤسسة</p></div></div>
          <div className="hep-info-grid">
            <InfoRow icon={Building2} label="الفرع" value={employee.branch?.name} />
            <InfoRow icon={BriefcaseBusiness} label="القسم" value={employee.department?.name} />
            <InfoRow icon={BadgeCheck} label="المسمى الوظيفي" value={employee.job_title?.name} />
            <InfoRow icon={UserRound} label="المدير المباشر" value={employee.manager ? `${employee.manager.first_name || ""} ${employee.manager.last_name || ""}` : null} />
          </div>
        </article>

        <article className="hep-panel hep-panel--contract">
          <div className="hep-title"><span><FileText size={18} /></span><div><h2>العقد الحالي</h2><p>البيانات المالية والتعاقدية</p></div></div>
          {!contract ? <div className="hep-empty"><FileText size={30} /><strong>لا يوجد عقد مسجل</strong><span>يمكن إضافة العقد من وحدة العقود.</span></div> : <div className="hep-contract"><div><small>رقم العقد</small><strong>{contract.contract_number}</strong></div><div><small>الراتب الأساسي</small><strong>{money(contract.basic_salary, contract.currency || "SAR")}</strong></div><div><small>بداية العقد</small><strong>{formatDate(contract.start_date)}</strong></div><div><small>نهاية العقد</small><strong>{formatDate(contract.end_date)}</strong></div></div>}
        </article>

        <article className="hep-panel hep-panel--attendance">
          <div className="hep-title"><span><Fingerprint size={18} /></span><div><h2>الحضور والبصمة</h2><p>جاهزية التكامل مع أجهزة الحضور</p></div></div>
          <div className="hep-attendance"><div className={employee.biometric_user_id ? "is-ready" : ""}><Fingerprint size={34} /><span><small>معرّف البصمة</small><strong>{employee.biometric_user_id || "غير مرتبط"}</strong></span></div><div><Clock3 size={18} /><span>الوردية</span><strong>{employee.shift?.name || "غير محددة"}</strong></div><div><ShieldCheck size={18} /><span>حالة الربط</span><strong>{employee.biometric_user_id ? "جاهز للمزامنة" : "بانتظار الربط"}</strong></div></div>
        </article>

        <article className="hep-panel hep-panel--documents">
          <div className="hep-title"><span><FileCheck2 size={18} /></span><div><h2>أحدث المستندات</h2><p>الوثائق المرتبطة بملف الموظف</p></div></div>
          <div className="hep-documents">
            {documents.length === 0 && <div className="hep-empty"><FileCheck2 size={30} /><strong>لا توجد مستندات</strong><span>أضف الهوية والعقد والشهادات.</span></div>}
            {documents.slice(0, 4).map((doc) => <div key={doc.id}><span><FileText size={17} /></span><div><strong>{doc.title || doc.document_type}</strong><small>{doc.document_number || formatDate(doc.issue_date)}</small></div><b className={doc.is_verified ? "verified" : ""}>{doc.is_verified ? "موثق" : "قيد المراجعة"}</b></div>)}
          </div>
        </article>
      </section>
    </main>
  );
}
