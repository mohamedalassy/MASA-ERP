import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, Building2, CheckCircle2, ChevronLeft, CircleAlert, Clock3,
  Fingerprint, Link2, RefreshCw, Search, Server, ShieldCheck, Users,
  Wifi, WifiOff,
} from "lucide-react";
import HrNavigation from "../../components/HR/HrNavigation";
import "../../styles/hr-attendance.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const PROVIDERS = [
  { id: "hikvision", name: "Hikvision", protocol: "ISAPI / Access Control", tone: "red" },
  { id: "zkteco", name: "ZKTeco", protocol: "ADMS / Push SDK", tone: "blue" },
  { id: "suprema", name: "Suprema", protocol: "BioStar 2 API", tone: "violet" },
];

function getToken() { return localStorage.getItem("token") || localStorage.getItem("auth_token") || ""; }
async function get(path, optional = false) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", headers: { Accept: "application/json", ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) } });
  const text = await response.text();
  let payload = null;
  if (text.trim()) { try { payload = JSON.parse(text); } catch { if (!optional) throw new Error(`استجابة غير صالحة من الخادم (${response.status})`); } }
  if (!response.ok) { if (optional && response.status === 404) return null; throw new Error(payload?.message || "تعذر تحميل بيانات الحضور"); }
  return payload;
}
function rows(payload) { const page = payload?.data?.data && Array.isArray(payload.data.data) ? payload.data : payload; return Array.isArray(page) ? page : Array.isArray(page?.data) ? page.data : []; }

function Donut({ value, label, tone = "blue" }) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0)); const r = 44; const c = 2 * Math.PI * r;
  return <div className={`hra-donut hra-donut--${tone}`}><svg viewBox="0 0 120 120"><circle className="track" cx="60" cy="60" r={r} /><circle className="value" cx="60" cy="60" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - percent / 100)} /></svg><div><strong>{percent}%</strong><span>{label}</span></div></div>;
}

export default function HrAttendance({ onNavigate }) {
  const [data, setData] = useState({ employees: [], shifts: [], branches: [], summary: null });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [employees, shifts, branches, summary] = await Promise.all([
        get("/hr/employees?per_page=100"), get("/hr/shifts?per_page=100"), get("/hr/branches?per_page=100"), get("/hr/attendance/summary", true),
      ]);
      setData({ employees: rows(employees), shifts: rows(shifts), branches: rows(branches), summary });
    } catch (err) { setError(err.message || "تعذر تحميل مركز الحضور"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const metrics = useMemo(() => {
    const linked = data.employees.filter((item) => item.biometric_user_id).length;
    const active = data.employees.filter((item) => item.status === "active").length;
    const assignedShift = data.employees.filter((item) => item.shift_id).length;
    return { total: data.employees.length, linked, active, assignedShift, biometricRate: data.employees.length ? Math.round((linked / data.employees.length) * 100) : 0, shiftRate: data.employees.length ? Math.round((assignedShift / data.employees.length) * 100) : 0 };
  }, [data]);
  const visibleEmployees = useMemo(() => { const term = search.trim().toLowerCase(); return data.employees.filter((item) => !term || `${item.first_name || ""} ${item.last_name || ""} ${item.employee_number || ""} ${item.biometric_user_id || ""}`.toLowerCase().includes(term)); }, [data.employees, search]);
  const summaryAvailable = Boolean(data.summary);
  const today = data.summary?.today || {};

  const stats = [
    { label: "حاضرون اليوم", value: today.present ?? 0, note: summaryAvailable ? "سجل حضور فعلي" : "بانتظار تشغيل السجلات", icon: CheckCircle2, tone: "green" },
    { label: "متأخرون", value: today.late ?? 0, note: "حسب سماحية الوردية", icon: Clock3, tone: "orange" },
    { label: "مرتبطون بالبصمة", value: metrics.linked, note: `من أصل ${metrics.total} موظف`, icon: Fingerprint, tone: "violet" },
    { label: "الفروع المغطاة", value: data.branches.length, note: `${data.shifts.length} وردية معرفة`, icon: Building2, tone: "blue" },
  ];

  return <main className="hra" dir="rtl">
    <HrNavigation activeView="hr-attendance" onNavigate={onNavigate} />
    <header className="hra-header"><div><button type="button" onClick={() => onNavigate?.("hr-dashboard")}><ChevronLeft size={17} /> الموارد البشرية</button><h1>الحضور والبصمة</h1><p>مركز موحد للأجهزة والمزامنة والورديات وحركة الموظفين.</p></div><button className="hra-refresh" type="button" onClick={load}><RefreshCw size={18} className={loading ? "hra-spin" : ""} /> تحديث البيانات</button></header>
    {error && <div className="hra-alert"><CircleAlert size={20} /><div><strong>تعذر تحميل بيانات الحضور</strong><span>{error}</span></div></div>}
    {!summaryAvailable && !loading && <div className="hra-setup"><Server size={19} /><div><strong>لوحة الجاهزية تعمل الآن</strong><span>الأرقام اليومية ستبدأ تلقائيًا بعد إضافة API سجلات الحضور في المرحلة التالية.</span></div></div>}
    <section className="hra-stats">{stats.map(({ label, value, note, icon: Icon, tone }) => <article className={`hra-stat hra-stat--${tone}`} key={label}><span><Icon size={22} /></span><div><small>{label}</small><strong>{loading ? "—" : Number(value).toLocaleString("ar-SA")}</strong><em>{note}</em></div></article>)}</section>
    <section className="hra-grid">
      <article className="hra-panel hra-readiness"><div className="hra-title"><span><ShieldCheck size={18} /></span><div><h2>جاهزية منظومة الحضور</h2><p>اكتمال تعريف الموظفين والورديات</p></div><b>مباشر</b></div><div className="hra-donuts"><Donut value={metrics.biometricRate} label="ربط البصمة" tone="violet" /><Donut value={metrics.shiftRate} label="تعيين الورديات" tone="green" /></div><div className="hra-readiness-list"><div><span><Users size={15} /> موظفون نشطون</span><b>{metrics.active}/{metrics.total}</b></div><div><span><Fingerprint size={15} /> معرفات أجهزة</span><b>{metrics.linked}/{metrics.total}</b></div><div><span><Clock3 size={15} /> ورديات معرفة</span><b>{data.shifts.length}</b></div></div></article>
      <article className="hra-panel hra-devices"><div className="hra-title"><span><Wifi size={18} /></span><div><h2>موصلات أجهزة الحضور</h2><p>منصة واحدة لمختلف الشركات المصنعة</p></div></div><div className="hra-provider-list">{PROVIDERS.map((provider) => <div key={provider.id}><span className={provider.tone}><Fingerprint size={21} /></span><div><strong>{provider.name}</strong><small>{provider.protocol}</small></div><b><WifiOff size={13} /> غير مهيأ</b></div>)}</div><button type="button" onClick={() => onNavigate?.("hr-attendance-devices")}><Link2 size={17} /> إدارة الأجهزة والموصلات</button></article>
      <article className="hra-panel hra-activity"><div className="hra-title"><span><Activity size={18} /></span><div><h2>ملخص اليوم</h2><p>حركة الحضور والانصراف الحالية</p></div></div>{summaryAvailable ? <div className="hra-today"><div><span>حضور في الموعد</span><strong>{today.on_time ?? 0}</strong><i style={{ width: `${today.present ? Math.round(((today.on_time || 0) / today.present) * 100) : 0}%` }} /></div><div><span>حضور متأخر</span><strong>{today.late ?? 0}</strong><i className="orange" style={{ width: `${today.present ? Math.round(((today.late || 0) / today.present) * 100) : 0}%` }} /></div><div><span>غياب</span><strong>{today.absent ?? 0}</strong><i className="red" style={{ width: `${metrics.active ? Math.round(((today.absent || 0) / metrics.active) * 100) : 0}%` }} /></div></div> : <div className="hra-empty"><Activity size={34} /><strong>لا توجد حركات مسجلة بعد</strong><span>ستظهر هنا تحليلات الحضور فور وصول أول بصمة.</span></div>}</article>
    </section>
    <section className="hra-directory"><div className="hra-directory__head"><div><h2>جاهزية الموظفين</h2><p>تأكد من ربط كل موظف بمعرّف بصمة ووردية</p></div><label><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الرقم أو معرّف البصمة..." /></label></div><div className="hra-table-wrap"><table><thead><tr><th>الموظف</th><th>الرقم الوظيفي</th><th>الفرع</th><th>الوردية</th><th>معرّف البصمة</th><th>جاهزية الربط</th></tr></thead><tbody>{visibleEmployees.map((employee) => { const name = employee.full_name || `${employee.first_name || ""} ${employee.last_name || ""}`.trim(); const ready = Boolean(employee.biometric_user_id && employee.shift_id); return <tr key={employee.id}><td><div className="hra-person"><span>{name.charAt(0) || "م"}</span><strong>{name}</strong></div></td><td>{employee.employee_number}</td><td>{employee.branch?.name || "غير محدد"}</td><td>{employee.shift?.name || "غير محددة"}</td><td><code>{employee.biometric_user_id || "—"}</code></td><td><span className={`hra-status ${ready ? "ready" : "pending"}`}>{ready ? <Wifi size={13} /> : <WifiOff size={13} />}{ready ? "جاهز" : "يحتاج إعداد"}</span></td></tr>; })}{!loading && visibleEmployees.length === 0 && <tr><td colSpan="6"><div className="hra-empty"><Users size={34} /><strong>لا توجد نتائج</strong></div></td></tr>}</tbody></table></div></section>
  </main>;
}
