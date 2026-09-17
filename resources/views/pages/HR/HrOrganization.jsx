import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2, ChevronLeft, CircleAlert, GitBranch, Layers3, MapPin,
  Network, Plus, RefreshCw, Search, ShieldCheck, Users, X,
} from "lucide-react";
import HrNavigation from "../../components/HR/HrNavigation.jsx";
import "../../styles/hr-organization.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const EMPTY_BRANCH = { code: "", name: "", name_en: "", country: "السعودية", city: "", address: "", phone: "", email: "", timezone: "Asia/Riyadh", attendance_radius: 100, is_head_office: false, is_active: true };
const EMPTY_DEPARTMENT = { code: "", name: "", name_en: "", branch_id: "", parent_id: "", cost_center_code: "", email: "", phone: "", is_active: true, description: "" };

function token() { return localStorage.getItem("token") || localStorage.getItem("auth_token") || ""; }
async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...options.headers } });
  const text = await response.text();
  let payload = null;
  if (text.trim()) { try { payload = JSON.parse(text); } catch { throw new Error(`استجابة غير صالحة من الخادم (${response.status})`); } }
  if (!response.ok) { const validation = payload?.errors ? Object.values(payload.errors).flat().join("، ") : ""; throw new Error(validation || payload?.message || "تعذر تنفيذ الطلب"); }
  return payload;
}
function collection(payload) { const page = payload?.data?.data && Array.isArray(payload.data.data) ? payload.data : payload; const rows = Array.isArray(page) ? page : Array.isArray(page?.data) ? page.data : []; return { rows, total: Number(page?.total ?? rows.length) || 0 }; }

function Bars({ items }) {
  const max = Math.max(...items.map((item) => item.employees_count || 0), 1);
  return <div className="hro-bars">{items.slice(0, 6).map((item, index) => <div key={item.id}><span>{item.name}</span><div><i style={{ width: `${Math.max(((item.employees_count || 0) / max) * 100, 5)}%`, "--delay": `${index * 70}ms` }} /></div><b>{item.employees_count || 0}</b></div>)}</div>;
}

export default function HrOrganization({ onNavigate }) {
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [totals, setTotals] = useState({ branches: 0, departments: 0 });
  const [tab, setTab] = useState("departments");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [branchForm, setBranchForm] = useState(EMPTY_BRANCH);
  const [departmentForm, setDepartmentForm] = useState(EMPTY_DEPARTMENT);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [branchPayload, departmentPayload] = await Promise.all([request("/hr/branches?per_page=100"), request("/hr/departments?per_page=100")]);
      const branchResult = collection(branchPayload); const departmentResult = collection(departmentPayload);
      setBranches(branchResult.rows); setDepartments(departmentResult.rows); setTotals({ branches: branchResult.total, departments: departmentResult.total });
    } catch (err) { setError(err.message || "تعذر تحميل الهيكل التنظيمي"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const source = tab === "branches" ? branches : departments;
    const term = search.trim().toLowerCase();
    return source.filter((item) => (!term || `${item.name} ${item.name_en || ""} ${item.code}`.toLowerCase().includes(term)) && (tab === "branches" || !branchFilter || String(item.branch_id) === String(branchFilter)));
  }, [tab, branches, departments, search, branchFilter]);
  const analytics = useMemo(() => ({
    activeBranches: branches.filter((item) => item.is_active !== false).length,
    activeDepartments: departments.filter((item) => item.is_active !== false).length,
    roots: departments.filter((item) => !item.parent_id).length,
    employees: branches.reduce((sum, item) => sum + Number(item.employees_count || 0), 0),
    largest: [...departments].sort((a, b) => (b.employees_count || 0) - (a.employees_count || 0)),
  }), [branches, departments]);

  async function submit(event) {
    event.preventDefault(); setSaving(true); setFormError("");
    try {
      const isBranch = modal === "branch"; const form = isBranch ? branchForm : departmentForm;
      const body = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === "" ? null : value]));
      await request(isBranch ? "/hr/branches" : "/hr/departments", { method: "POST", body: JSON.stringify(body) });
      setModal(null); setBranchForm(EMPTY_BRANCH); setDepartmentForm(EMPTY_DEPARTMENT); await load();
    } catch (err) { setFormError(err.message || "تعذر الحفظ"); } finally { setSaving(false); }
  }

  const stats = [
    { label: "الفروع النشطة", value: analytics.activeBranches, note: `من أصل ${totals.branches}`, icon: Building2, tone: "blue" },
    { label: "الأقسام النشطة", value: analytics.activeDepartments, note: `من أصل ${totals.departments}`, icon: Network, tone: "cyan" },
    { label: "الإدارات الرئيسية", value: analytics.roots, note: "في قمة الهيكل", icon: Layers3, tone: "violet" },
    { label: "القوة العاملة", value: analytics.employees, note: "موزعون على الفروع", icon: Users, tone: "green" },
  ];

  return <main className="hro" dir="rtl">
    <HrNavigation activeView="hr-organization" onNavigate={onNavigate} />
    <header className="hro-header"><div><button type="button" onClick={() => onNavigate?.("hr-dashboard")}><ChevronLeft size={17} /> الموارد البشرية</button><h1>الهيكل التنظيمي</h1><p>إدارة الفروع والأقسام والعلاقات الإدارية من مركز واحد.</p></div><div><button className="hro-refresh" type="button" onClick={load}><RefreshCw size={18} className={loading ? "hro-spin" : ""} /></button><button className="hro-primary" type="button" onClick={() => setModal(tab === "branches" ? "branch" : "department")}><Plus size={18} /> إضافة {tab === "branches" ? "فرع" : "قسم"}</button></div></header>
    {error && <div className="hro-alert"><CircleAlert size={20} /><div><strong>تعذر تحميل الهيكل التنظيمي</strong><span>{error}</span></div></div>}
    <section className="hro-stats">{stats.map(({ label, value, note, icon: Icon, tone }) => <article className={`hro-stat hro-stat--${tone}`} key={label}><span><Icon size={22} /></span><div><small>{label}</small><strong>{loading ? "—" : value.toLocaleString("ar-SA")}</strong><em>{note}</em></div></article>)}</section>
    <section className="hro-insights"><article><div className="hro-title"><span><GitBranch size={18} /></span><div><h2>توزيع الموظفين على الأقسام</h2><p>أكبر الأقسام من حيث القوة العاملة</p></div></div><Bars items={analytics.largest} /></article><article className="hro-health"><div className="hro-title"><span><ShieldCheck size={18} /></span><div><h2>صحة الهيكل</h2><p>جاهزية بيانات المؤسسة</p></div></div><div className="hro-health__body"><div className="hro-ring" style={{ "--value": `${totals.departments ? Math.round((analytics.activeDepartments / totals.departments) * 100) : 0}%` }}><strong>{totals.departments ? Math.round((analytics.activeDepartments / totals.departments) * 100) : 0}%</strong><span>أقسام فعّالة</span></div><ul><li><span>فروع تشغيلية</span><b>{analytics.activeBranches}</b></li><li><span>إدارات رئيسية</span><b>{analytics.roots}</b></li><li><span>إجمالي الموظفين</span><b>{analytics.employees}</b></li></ul></div></article></section>
    <section className="hro-directory"><div className="hro-directory__head"><div><h2>دليل المؤسسة</h2><p>استعرض الهيكل وابحث داخله بسهولة</p></div><div className="hro-tabs"><button className={tab === "departments" ? "active" : ""} onClick={() => setTab("departments")} type="button">الأقسام</button><button className={tab === "branches" ? "active" : ""} onClick={() => setTab("branches")} type="button">الفروع</button></div></div><div className="hro-filters"><label><Search size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`ابحث في ${tab === "branches" ? "الفروع" : "الأقسام"}...`} /></label>{tab === "departments" && <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}><option value="">كل الفروع</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}</div>
      <div className="hro-cards">{!loading && filtered.length === 0 && <div className="hro-empty"><Network size={38} /><strong>لا توجد نتائج</strong><span>غيّر البحث أو أضف عنصرًا جديدًا.</span></div>}{filtered.map((item) => <article key={`${tab}-${item.id}`}><span className={tab === "branches" ? "branch" : "department"}>{tab === "branches" ? <Building2 size={22} /> : <Network size={22} />}</span><div className="hro-card__main"><div><small>{item.code}</small><h3>{item.name}</h3><p>{tab === "branches" ? <><MapPin size={13} /> {item.city || item.country || "الموقع غير محدد"}</> : <><Building2 size={13} /> {item.branch?.name || "بدون فرع"}</>}</p></div><i className={item.is_active === false ? "off" : ""}>{item.is_active === false ? "غير نشط" : "نشط"}</i></div><footer><span><Users size={14} /> {item.employees_count || 0} موظف</span><span>{tab === "branches" ? `${item.departments_count || 0} قسم` : `${item.children_count || 0} قسم فرعي`}</span></footer></article>)}</div>
    </section>
    {modal && <div className="hro-modal"><button className="hro-backdrop" type="button" onClick={() => !saving && setModal(null)} /><form onSubmit={submit}><header><div><span>{modal === "branch" ? <Building2 size={20} /> : <Network size={20} />}</span><div><h2>إضافة {modal === "branch" ? "فرع جديد" : "قسم جديد"}</h2><p>أدخل البيانات الأساسية ويمكن استكمالها لاحقًا.</p></div></div><button type="button" onClick={() => setModal(null)}><X size={19} /></button></header>{formError && <div className="hro-form-error"><CircleAlert size={17} /> {formError}</div>}<div className="hro-form-body">
      {modal === "branch" ? <><label><span>كود الفرع *</span><input required value={branchForm.code} onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })} /></label><label><span>اسم الفرع *</span><input required value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} /></label><label><span>المدينة</span><input value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} /></label><label><span>العنوان</span><input value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} /></label><label><span>الهاتف</span><input value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} /></label><label><span>البريد</span><input type="email" value={branchForm.email} onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })} /></label></> : <><label><span>كود القسم *</span><input required value={departmentForm.code} onChange={(e) => setDepartmentForm({ ...departmentForm, code: e.target.value })} /></label><label><span>اسم القسم *</span><input required value={departmentForm.name} onChange={(e) => setDepartmentForm({ ...departmentForm, name: e.target.value })} /></label><label><span>الفرع</span><select value={departmentForm.branch_id} onChange={(e) => setDepartmentForm({ ...departmentForm, branch_id: e.target.value })}><option value="">اختر الفرع</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>القسم الرئيسي</span><select value={departmentForm.parent_id} onChange={(e) => setDepartmentForm({ ...departmentForm, parent_id: e.target.value })}><option value="">قسم رئيسي</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>مركز التكلفة</span><input value={departmentForm.cost_center_code} onChange={(e) => setDepartmentForm({ ...departmentForm, cost_center_code: e.target.value })} /></label><label><span>البريد</span><input type="email" value={departmentForm.email} onChange={(e) => setDepartmentForm({ ...departmentForm, email: e.target.value })} /></label></>}
    </div><footer><button type="button" onClick={() => setModal(null)}>إلغاء</button><button className="hro-primary" type="submit" disabled={saving}>{saving ? <RefreshCw className="hro-spin" size={17} /> : <Plus size={17} />}{saving ? "جارٍ الحفظ..." : "حفظ"}</button></footer></form></div>}
  </main>;
}
