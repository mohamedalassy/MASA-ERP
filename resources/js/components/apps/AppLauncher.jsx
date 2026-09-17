import {
  BadgeDollarSign,
  BarChart3,
  Calculator,
  Fingerprint,
  FolderKanban,
  Package,
  ReceiptText,
  ShoppingCart,
  Tags,
  TrendingUp,
  Users,
} from "lucide-react";
import "../../../css/missing-pages.css";

const apps = [
  { id: "work-orders", title: "CRM", note: "إدارة الفرص والمشاريع", icon: Users, tone: "violet", options: { stage: "crm", source: "crm" } },
  { id: "sales", title: "المبيعات", note: "العروض والعملاء", icon: TrendingUp, tone: "blue" },
  { id: "pricing", title: "التسعير", note: "التكلفة وهوامش الربح", icon: BadgeDollarSign, tone: "orange" },
  { id: "price-list", title: "قائمة الأسعار", note: "المنتجات والأسعار", icon: Tags, tone: "cyan" },
  { id: "quotations", title: "عروض الأسعار", note: "إنشاء ومراجعة العروض", icon: ReceiptText, tone: "violet" },
  { id: "purchase-orders", title: "المشتريات", note: "أوامر الشراء والموردون", icon: ShoppingCart, tone: "blue" },
  { id: "inventory", title: "المخزون", note: "الحركة والكميات", icon: Package, tone: "red" },
  { id: "work-orders", title: "المشاريع", note: "دورة حياة المشروع", icon: FolderKanban, tone: "green", options: { stage: "all", source: "projects" } },
  { id: "accounting", title: "المحاسبة", note: "القيود والتقارير المالية", icon: Calculator, tone: "teal" },
  { id: "hr-dashboard", title: "MASA People", note: "الموظفون والحضور", icon: Fingerprint, tone: "violet" },
  { id: "reports", title: "التقارير", note: "مؤشرات الأداء", icon: BarChart3, tone: "orange" },
];

export default function AppLauncher({ onChangeView }) {
  return (
    <main className="masa-page" dir="rtl">
      <header className="masa-page-head">
        <div>
          <span className="masa-eyebrow">MASA ERP</span>
          <h1>التطبيقات</h1>
          <p>كل وحدات النظام في مكان واحد، بنفس هوية MASA الموحدة.</p>
        </div>
      </header>

      <section className="masa-app-grid">
        {apps.map(({ id, title, note, icon: Icon, tone, options }) => (
          <button
            type="button"
            className="masa-app-card"
            key={`${id}-${title}`}
            onClick={() => onChangeView?.(id, options || {})}
          >
            <span className={`masa-icon masa-icon--${tone}`}>
              <Icon size={23} strokeWidth={1.8} />
            </span>
            <strong>{title}</strong>
            <small>{note}</small>
          </button>
        ))}
      </section>
    </main>
  );
}
