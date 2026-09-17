import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2, ChevronLeft, CircleAlert, Fingerprint, Link2, Plus,
  RefreshCw, Search, Server, Settings2, ShieldCheck, Wifi, WifiOff, X,
} from "lucide-react";
import HrNavigation from "../../components/HrNavigation.jsx";
import "../../styles/hr-attendance-devices.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const EMPTY = { branch_id: "", code: "", name: "", provider: "hikvision", model: "", serial_number: "", ip_address: "", port: 80, protocol: "http", username: "", password: "", timezone: "Asia/Riyadh", location: "", sync_interval_minutes: 5, auto_sync: true, is_active: true };
const PROVIDERS = { hikvision: "Hikvision", zkteco: "ZKTeco", suprema: "Suprema", dahua: "Dahua", other: "أخرى" };

function token() { return localStorage.getItem("token") || localStorage.getItem("auth_token") || ""; }
async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...options, headers: { Accept: "application/json", ...(options.body ? { "Content-Type": "application/json" } : {}), ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...options.headers } });
  const text = await response.text(); let payload = null;
  if (text.trim()) { try { payload = JSON.parse(text); } catch { throw new Error(`استجابة غير صالحة من الخادم (${response.status})`); } }
  if (!response.ok) { const validation = payload?.errors ? Object.values(payload.errors).flat().join("، ") : ""; throw new Error(validation || payload?.message || "تعذر تنفيذ الطلب"); }
  return payload;
}
function rows(payload) { const page = payload?.data?.data && Array.isArray(payload.data.data) ? payload.data : payload; return Array.isArray(page) ? page : Array.isArray(page?.data) ? page.data : []; }

export default function HrAttendanceDevices({ onNavigate }) {
  const [devices, setDevices] = useState([]); const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [search, setSearch] = useState("");
  const [provider, setProvider] = useState(""); const [showForm, setShowForm] = useState(false); const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false); const [formError, setFormError] = useState(""); const [testingId, setTestingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const [deviceData, branchData] = await Promise.all([api("/hr/attendance-devices?per_page=100"), api("/hr/branches?per_page=100")]); setDevices(rows(deviceData)); setBranches(rows(branchData)); }
    catch (err) { setError(err.message || "تعذر تحميل أجهزة الحضور"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => { const q = search.trim().toLowerCase(); return devices.filter((item) => (!provider || item.provider === provider) && (!q || `${item.name} ${item.code} ${item.serial_number || ""} ${item.ip_address || ""}`.toLowerCase().includes(q))); }, [devices, search, provider]);
  const stats = useMemo(() => ({ total: devices.length, online: devices.filter((item) => item.status === "online").length, offline: devices.filter((item) => item.status === "offline").length, auto: devices.filter((item) => item.auto_sync).length }), [devices]);

  async function save(event) {
    event.preventDefault(); setSaving(true); setFormError("");
    try { const body = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === "" ? null : value])); await api("/hr/attendance-devices", { method: "POST", body: JSON.stringify(body) }); setShowForm(false); setForm(EMPTY); await load(); }
    catch (err) { setFormError(err.message || "تعذر حفظ الجهاز"); } finally { setSaving(false); }
  }
  async function test(device) {
    setTestingId(device.id); setError("");
    try { await api(`/hr/attendance-devices/${device.id}/test-connection`, { method: "POST" }); await load(); }
    catch (err) { setError(`${device.name}: ${err.message}`); await load(); } finally { setTestingId(null); }
  }

  const cards = [
    { label: "إجمالي الأجهزة", value: stats.total, icon: Server, tone: "blue", note: "كل أجهزة المنظومة" },
    { label: "متصلة الآن", value: stats.online, icon: Wifi, tone: "green", note: "جاهزة للمزامنة" },
    { label: "غير متصلة", value: stats.offline, icon: WifiOff, tone: "red", note: "تحتاج فحص الاتصال" },
    { label: "مزامنة تلقائية", value: stats.auto, icon: RefreshCw, tone: "violet", note: "تعمل حسب الجدولة" },
  ];

  return <main className="hrad" dir="rtl">
    <HrNavigation activeView="hr-attendance" onNavigate={onNavigate} />
    <header className="hrad-header"><div><button type="button" onClick={() => onNavigate?.("hr-attendance")}><ChevronLeft size={17} /> الحضور والبصمة</button><h1>إدارة أجهزة الحضور</h1><p>تهيئة الأجهزة، اختبار الاتصال، ومتابعة حالة المزامنة من مركز واحد.</p></div><div><button className="hrad-refresh" type="button" onClick={load}><RefreshCw size={18} className={loading ? "hrad-spin" : ""} /></button><button className="hrad-primary" type="button" onClick={() => setShowForm(true)}><Plus size={18} /> إضافة جهاز</button></div></header>
    {error && <div className="hrad-alert"><CircleAlert size={20} /><div><strong>تنبيه أجهزة الحضور</strong><span>{error}</span></div></div>}
    <section className="hrad-stats">{cards.map(({ label, value, icon: Icon, tone, note }) => <article className={`hrad-stat hrad-stat--${tone}`} key={label}><span><Icon size={22} /></span><div><small>{label}</small><strong>{loading ? "—" : value.toLocaleString("ar-SA")}</strong><em>{note}</em></div></article>)}</section>
    <section className="hrad-health"><div><span><ShieldCheck size={21} /></span><div><strong>MASA Attendance Gateway</strong><p>بنية موحدة لدعم Hikvision وZKTeco وSuprema وDahua.</p></div></div><div className="hrad-health__score"><span>جاهزية الاتصال</span><strong>{stats.total ? Math.round((stats.online / stats.total) * 100) : 0}%</strong><i><b style={{ width: `${stats.total ? Math.round((stats.online / stats.total) * 100) : 0}%` }} /></i></div></section>
    <section className="hrad-directory"><div className="hrad-directory__head"><div><h2>الأجهزة المسجلة</h2><p>{filtered.length} جهاز ظاهر من أصل {devices.length}</p></div><div><label><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو IP أو Serial..." /></label><select value={provider} onChange={(e) => setProvider(e.target.value)}><option value="">كل الشركات</option>{Object.entries(PROVIDERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div>
      <div className="hrad-cards">{!loading && filtered.length === 0 && <div className="hrad-empty"><Fingerprint size={42} /><strong>لا توجد أجهزة مسجلة</strong><span>أضف أول جهاز حضور لبدء المزامنة.</span><button className="hrad-primary" type="button" onClick={() => setShowForm(true)}><Plus size={17} /> إضافة جهاز</button></div>}{filtered.map((device) => <article key={device.id}><header><span className={`provider provider--${device.provider}`}><Fingerprint size={23} /></span><div><small>{PROVIDERS[device.provider] || device.provider}</small><h3>{device.name}</h3><p>{device.model || "الموديل غير محدد"}</p></div><b className={`status status--${device.status}`}><i />{device.status === "online" ? "متصل" : device.status === "maintenance" ? "صيانة" : device.status === "error" ? "خطأ" : "غير متصل"}</b></header><div className="hrad-device-info"><span><Server size={14} /> {device.ip_address || "بدون IP"}:{device.port}</span><span><Building2 size={14} /> {device.branch?.name || "بدون فرع"}</span><span><RefreshCw size={14} /> كل {device.sync_interval_minutes} دقائق</span><span><Settings2 size={14} /> {device.protocol?.toUpperCase()}</span></div><footer><span>{device.serial_number || device.code}</span><button type="button" onClick={() => test(device)} disabled={testingId === device.id}>{testingId === device.id ? <RefreshCw className="hrad-spin" size={15} /> : <Link2 size={15} />} اختبار الاتصال</button></footer></article>)}</div>
    </section>
    {showForm && <div className="hrad-modal"><button className="hrad-backdrop" type="button" onClick={() => !saving && setShowForm(false)} /><form onSubmit={save}><header><div><span><Fingerprint size={21} /></span><div><h2>إضافة جهاز حضور</h2><p>سجّل بيانات الشبكة والاتصال الخاصة بالجهاز.</p></div></div><button type="button" onClick={() => setShowForm(false)}><X size={19} /></button></header>{formError && <div className="hrad-form-error"><CircleAlert size={17} /> {formError}</div>}<div className="hrad-form-body"><label><span>كود الجهاز *</span><input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="ATT-001" /></label><label><span>اسم الجهاز *</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label><span>الشركة المصنعة *</span><select required value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>{Object.entries(PROVIDERS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>الموديل</span><input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></label><label><span>الفرع</span><select value={form.branch_id} onChange={(e) => setForm({ ...form, branch_id: e.target.value })}><option value="">اختر الفرع</option>{branches.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>الرقم التسلسلي</span><input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></label><label><span>عنوان IP</span><input value={form.ip_address} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} placeholder="192.168.1.100" /></label><label><span>المنفذ *</span><input required type="number" min="1" max="65535" value={form.port} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} /></label><label><span>البروتوكول *</span><select value={form.protocol} onChange={(e) => setForm({ ...form, protocol: e.target.value })}><option value="http">HTTP</option><option value="https">HTTPS</option><option value="adms">ADMS</option><option value="push">Push</option><option value="sdk">SDK</option></select></label><label><span>الموقع</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label><label><span>اسم المستخدم</span><input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label><label><span>كلمة المرور</span><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label></div><footer><button type="button" onClick={() => setShowForm(false)}>إلغاء</button><button className="hrad-primary" type="submit" disabled={saving}>{saving ? <RefreshCw className="hrad-spin" size={17} /> : <Plus size={17} />}{saving ? "جارٍ الحفظ..." : "حفظ الجهاز"}</button></footer></form></div>}
  </main>;
}
