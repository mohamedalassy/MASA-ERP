import { Bell, Search, Settings2 } from "lucide-react";

export default function Topbar() {
  return (
    <header className="topbar" dir="rtl">
      <div className="topbar-user">
        <div className="topbar-avatar">MA</div>
        <div className="topbar-user-info">
          <strong>MASA ERP</strong>
          <span>لوحة الإدارة</span>
        </div>
      </div>

      <label className="topbar-search">
        <Search size={18} strokeWidth={1.8} />
        <input
          type="search"
          placeholder="ابحث في النظام..."
          aria-label="البحث في النظام"
        />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button className="topbar-icon-button" type="button" title="الإشعارات">
          <Bell size={19} strokeWidth={1.8} />
        </button>
        <button className="topbar-icon-button" type="button" title="الإعدادات">
          <Settings2 size={19} strokeWidth={1.8} />
        </button>
      </div>
    </header>
  );
}
