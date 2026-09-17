import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  CircleAlert,
  Filter,
  Mail,
  Network,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import "../../styles/hr-employees.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const EMPTY_FORM = {
  employee_number: "",
  first_name: "",
  middle_name: "",
  last_name: "",
  work_email: "",
  mobile: "",
  branch_id: "",
  department_id: "",
  job_title_id: "",
  shift_id: "",
  hire_date: "",
  employment_type: "full_time",
  status: "active",
  biometric_user_id: "",
  is_active: true,
};

const STATUS_LABELS = {
  active: "نشط",
  draft: "مسودة",
  on_leave: "في إجازة",
  suspended: "موقوف",
  terminated: "منتهي",
};

const EMPLOYMENT_LABELS = {
  full_time: "دوام كامل",
  part_time: "دوام جزئي",
  contract: "عقد",
  temporary: "مؤقت",
  intern: "تدريب",
};

function getToken() {
  return localStorage.getItem("token") || localStorage.getItem("auth_token") || "";
}

async function apiRequest(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const responseText = await response.text();
  let payload = null;
  if (responseText.trim()) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new Error(`استجابة غير صالحة من الخادم (${response.status})`);
    }
  }

  if (!response.ok) {
    const validationMessage = payload?.errors
      ? Object.values(payload.errors).flat().join("، ")
      : null;
    const error = new Error(
      validationMessage || payload?.message || (response.status === 401 ? "يجب تسجيل الدخول أولًا" : "تعذر تنفيذ الطلب")
    );
    error.status = response.status;
    throw error;
  }

  return payload;
}

function extractCollection(payload) {
  const paginator = payload?.data?.data && Array.isArray(payload.data.data) ? payload.data : payload;
  const rows = Array.isArray(paginator)
    ? paginator
    : Array.isArray(paginator?.data)
      ? paginator.data
      : Array.isArray(paginator?.rows)
        ? paginator.rows
        : [];
  return { rows, total: Number(paginator?.total ?? payload?.meta?.total ?? rows.length) || 0 };
}

function topGroups(items, relationKey, fallback = "غير محدد", limit = 5) {
  const counts = new Map();
  items.forEach((item) => {
    const name = item?.[relationKey]?.name || fallback;
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function DonutChart({ value, total, label }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="hrx-donut-wrap">
      <svg className="hrx-donut" viewBox="0 0 120 120" role="img" aria-label={`${label}: ${percent}%`}>
        <circle cx="60" cy="60" r={radius} className="hrx-donut__track" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="hrx-donut__value"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
        />
      </svg>
      <div className="hrx-donut__label"><strong>{percent}%</strong><span>{label}</span></div>
    </div>
  );
}

function BarsChart({ data, total }) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <div className="hrx-bars">
      {data.length === 0 && <span className="hrx-chart-empty">لا توجد بيانات كافية</span>}
      {data.map((item, index) => (
        <div className="hrx-bar" key={item.name}>
          <span className="hrx-bar__name">{item.name}</span>
          <div className="hrx-bar__track">
            <i style={{ width: `${Math.max((item.value / max) * 100, 7)}%`, "--delay": `${index * 70}ms` }} />
          </div>
          <b>{item.value}</b>
          <small>{total ? Math.round((item.value / total) * 100) : 0}%</small>
        </div>
      ))}
    </div>
  );
}

export default function HrEmployees({ onNavigate }) {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [lookups, setLookups] = useState({ branches: [], departments: [], jobTitles: [], shifts: [] });
  const [filters, setFilters] = useState({ search: "", branch_id: "", department_id: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadLookups = useCallback(async () => {
    const [branches, departments, jobTitles, shifts] = await Promise.all([
      apiRequest("/hr/branches?per_page=100"),
      apiRequest("/hr/departments?per_page=100"),
      apiRequest("/hr/job-titles?per_page=100"),
      apiRequest("/hr/shifts?per_page=100"),
    ]);
    setLookups({
      branches: extractCollection(branches).rows,
      departments: extractCollection(departments).rows,
      jobTitles: extractCollection(jobTitles).rows,
      shifts: extractCollection(shifts).rows,
    });
  }, []);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ per_page: "100" });
      Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
      const result = extractCollection(await apiRequest(`/hr/employees?${params.toString()}`));
      setEmployees(result.rows);
      setTotal(result.total);
    } catch (err) {
      setError(err.message || "تعذر تحميل الموظفين");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadLookups().catch((err) => setError(err.message || "تعذر تحميل القوائم المساعدة"));
  }, [loadLookups]);

  useEffect(() => {
    const timer = setTimeout(loadEmployees, filters.search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [loadEmployees, filters.search]);

  const analytics = useMemo(() => {
    const active = employees.filter((item) => item.status === "active").length;
    const biometric = employees.filter((item) => item.biometric_user_id).length;
    const onLeave = employees.filter((item) => item.status === "on_leave").length;
    const departments = topGroups(employees, "department");
    const branches = topGroups(employees, "branch");
    return { active, biometric, onLeave, departments, branches };
  }, [employees]);

  const visibleDepartments = useMemo(
    () => lookups.departments.filter((item) => !form.branch_id || String(item.branch_id) === String(form.branch_id)),
    [lookups.departments, form.branch_id]
  );

  async function submitEmployee(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const body = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === "" ? null : value]));
      await apiRequest("/hr/employees", { method: "POST", body: JSON.stringify(body) });
      setShowForm(false);
      setForm(EMPTY_FORM);
      await loadEmployees();
    } catch (err) {
      setFormError(err.message || "تعذر حفظ الموظف");
    } finally {
      setSaving(false);
    }
  }

  const stats = [
    { label: "إجمالي الموظفين", value: total, icon: Users, tone: "blue", note: "ضمن نتائج البحث الحالية" },
    { label: "الموظفون النشطون", value: analytics.active, icon: UserCheck, tone: "green", note: `${total ? Math.round((analytics.active / total) * 100) : 0}% من الإجمالي` },
    { label: "مرتبطون بالبصمة", value: analytics.biometric, icon: ShieldCheck, tone: "violet", note: "جاهزون للحضور والانصراف" },
    { label: "في إجازة", value: analytics.onLeave, icon: BriefcaseBusiness, tone: "orange", note: "الحالة التشغيلية الحالية" },
  ];

  return (
    <main className="hrx" dir="rtl">
      <header className="hrx-header">
        <div>
          <button className="hrx-back" type="button" onClick={() => onNavigate?.("hr-dashboard")}><ChevronLeft size={17} /> الموارد البشرية</button>
          <h1>إدارة الموظفين</h1>
          <p>قاعدة موحدة لملفات الموظفين، الهيكل التنظيمي، وربط الحضور والبصمة.</p>
        </div>
        <div className="hrx-header__actions">
          <button className="hrx-icon-button" type="button" onClick={loadEmployees} disabled={loading} title="تحديث"><RefreshCw size={19} className={loading ? "is-spinning" : ""} /></button>
          <button className="hrx-primary" type="button" onClick={() => setShowForm(true)}><Plus size={19} /> إضافة موظف</button>
        </div>
      </header>

      {error && <div className="hrx-alert"><CircleAlert size={20} /><div><strong>تعذر تحميل بيانات الموظفين</strong><span>{error}</span></div></div>}

      <section className="hrx-stat-grid">
        {stats.map(({ label, value, icon: Icon, tone, note }) => (
          <article className={`hrx-stat hrx-stat--${tone}`} key={label}>
            <span className="hrx-stat__icon"><Icon size={22} /></span>
            <div><small>{label}</small><strong>{loading ? "—" : Number(value).toLocaleString("ar-SA")}</strong><em>{note}</em></div>
          </article>
        ))}
      </section>

      <section className="hrx-analytics">
        <article className="hrx-chart-card hrx-chart-card--health">
          <div className="hrx-section-title"><div><span><ShieldCheck size={18} /></span><div><h2>جاهزية القوى العاملة</h2><p>نسبة الموظفين النشطين والمرتبطين بالبصمة</p></div></div><b>مباشر</b></div>
          <div className="hrx-donuts">
            <DonutChart value={analytics.active} total={total} label="نشطون" />
            <DonutChart value={analytics.biometric} total={total} label="جاهزون للبصمة" />
          </div>
        </article>
        <article className="hrx-chart-card">
          <div className="hrx-section-title"><div><span><Network size={18} /></span><div><h2>توزيع الأقسام</h2><p>أعلى الأقسام حسب عدد الموظفين</p></div></div></div>
          <BarsChart data={analytics.departments} total={employees.length} />
        </article>
        <article className="hrx-chart-card">
          <div className="hrx-section-title"><div><span><Building2 size={18} /></span><div><h2>توزيع الفروع</h2><p>انتشار القوة العاملة بين مواقع التشغيل</p></div></div></div>
          <BarsChart data={analytics.branches} total={employees.length} />
        </article>
      </section>

      <section className="hrx-directory">
        <div className="hrx-directory__heading">
          <div><h2>دليل الموظفين</h2><p>{loading ? "جارٍ التحميل..." : `${employees.length} موظف ظاهر من أصل ${total}`}</p></div>
          <span><Filter size={17} /> فلترة ذكية</span>
        </div>
        <div className="hrx-filters">
          <label className="hrx-search"><Search size={18} /><input value={filters.search} onChange={(e) => setFilters((old) => ({ ...old, search: e.target.value }))} placeholder="ابحث بالاسم، الرقم الوظيفي، الهوية أو الجوال..." /></label>
          <select value={filters.branch_id} onChange={(e) => setFilters((old) => ({ ...old, branch_id: e.target.value }))}><option value="">كل الفروع</option>{lookups.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select value={filters.department_id} onChange={(e) => setFilters((old) => ({ ...old, department_id: e.target.value }))}><option value="">كل الأقسام</option>{lookups.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select value={filters.status} onChange={(e) => setFilters((old) => ({ ...old, status: e.target.value }))}><option value="">كل الحالات</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          {(filters.search || filters.branch_id || filters.department_id || filters.status) && <button className="hrx-clear" type="button" onClick={() => setFilters({ search: "", branch_id: "", department_id: "", status: "" })}><X size={16} /> مسح</button>}
        </div>

        <div className="hrx-table-wrap">
          <table className="hrx-table">
            <thead><tr><th>الموظف</th><th>الرقم الوظيفي</th><th>الوظيفة والقسم</th><th>الفرع</th><th>التواصل</th><th>نوع التوظيف</th><th>الحالة</th></tr></thead>
            <tbody>
              {!loading && employees.length === 0 && <tr><td colSpan="7"><div className="hrx-empty"><Users size={38} /><strong>لا توجد نتائج مطابقة</strong><span>غيّر الفلاتر أو أضف أول موظف.</span></div></td></tr>}
              {employees.map((employee) => {
                const name = employee.full_name || `${employee.first_name || ""} ${employee.middle_name || ""} ${employee.last_name || ""}`.replace(/\s+/g, " ").trim();
                return (
                  <tr key={employee.id} onClick={() => onNavigate?.("hr-employee-profile", employee.id)}>
                    <td><div className="hrx-person"><span>{name.charAt(0) || "م"}</span><div><strong>{name || "بدون اسم"}</strong><small>{employee.name_en || "ملف موظف MASA"}</small></div></div></td>
                    <td><b className="hrx-code">{employee.employee_number}</b></td>
                    <td><strong>{employee.job_title?.name || "بدون مسمى"}</strong><small className="hrx-cell-note">{employee.department?.name || "غير مرتبط بقسم"}</small></td>
                    <td>{employee.branch?.name || "غير محدد"}</td>
                    <td><div className="hrx-contact">{employee.work_email && <span><Mail size={14} />{employee.work_email}</span>}{employee.mobile && <span><Smartphone size={14} />{employee.mobile}</span>}{!employee.work_email && !employee.mobile && "—"}</div></td>
                    <td>{EMPLOYMENT_LABELS[employee.employment_type] || employee.employment_type || "—"}</td>
                    <td><span className={`hrx-status hrx-status--${employee.status || "draft"}`}><i />{STATUS_LABELS[employee.status] || "مسودة"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showForm && (
        <div className="hrx-modal" role="dialog" aria-modal="true" aria-label="إضافة موظف">
          <button className="hrx-modal__backdrop" type="button" onClick={() => !saving && setShowForm(false)} aria-label="إغلاق" />
          <form className="hrx-form" onSubmit={submitEmployee}>
            <header><div><span><Plus size={20} /></span><div><h2>إضافة موظف جديد</h2><p>أدخل البيانات الأساسية ويمكن استكمال الملف لاحقًا.</p></div></div><button type="button" onClick={() => setShowForm(false)} disabled={saving}><X size={20} /></button></header>
            {formError && <div className="hrx-form-error"><CircleAlert size={17} />{formError}</div>}
            <div className="hrx-form__body">
              <label><span>الرقم الوظيفي *</span><input required value={form.employee_number} onChange={(e) => setForm({ ...form, employee_number: e.target.value })} placeholder="EMP-0001" /></label>
              <label><span>الاسم الأول *</span><input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></label>
              <label><span>الاسم الأوسط</span><input value={form.middle_name} onChange={(e) => setForm({ ...form, middle_name: e.target.value })} /></label>
              <label><span>اسم العائلة *</span><input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></label>
              <label><span>البريد الوظيفي</span><input type="email" value={form.work_email} onChange={(e) => setForm({ ...form, work_email: e.target.value })} /></label>
              <label><span>رقم الجوال</span><input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></label>
              <label><span>الفرع</span><select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value, department_id: "" })}><option value="">اختر الفرع</option>{lookups.branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span>القسم</span><select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}><option value="">اختر القسم</option>{visibleDepartments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span>المسمى الوظيفي</span><select value={form.job_title_id} onChange={(e) => setForm({ ...form, job_title_id: e.target.value })}><option value="">اختر المسمى</option>{lookups.jobTitles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span>الوردية</span><select value={form.shift_id} onChange={(e) => setForm({ ...form, shift_id: e.target.value })}><option value="">اختر الوردية</option>{lookups.shifts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              <label><span>تاريخ التعيين</span><input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></label>
              <label><span>نوع التوظيف *</span><select required value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>{Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>الحالة *</span><select required value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>معرّف جهاز البصمة</span><input value={form.biometric_user_id} onChange={(e) => setForm({ ...form, biometric_user_id: e.target.value })} placeholder="اختياري" /></label>
            </div>
            <footer><button type="button" onClick={() => setShowForm(false)} disabled={saving}>إلغاء</button><button className="hrx-primary" type="submit" disabled={saving}>{saving ? <RefreshCw size={18} className="is-spinning" /> : <Plus size={18} />}{saving ? "جارٍ الحفظ..." : "حفظ الموظف"}</button></footer>
          </form>
        </div>
      )}
    </main>
  );
}
