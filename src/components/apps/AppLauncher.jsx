import {
  Users,
  TrendingUp,
  BadgeDollarSign,
  FileText,
  ShoppingCart,
  Package,
  Calculator,
  FolderKanban,
  UserRound,
  WalletCards,
  BarChart3,
  Settings,
  Headphones,
  Boxes,
  Building2,
  Wrench,
  ChevronLeft,
} from "lucide-react";

const apps = [
  {
    id: "crm",
    name: "العملاء CRM",
    description: "إدارة العملاء والفرص والمتابعات",
    icon: Users,
    tone: "cyan",
    stage: "crm",
  },
  {
    id: "sales",
    name: "المبيعات",
    description: "عروض الأسعار وأوامر البيع",
    icon: TrendingUp,
    tone: "purple",
  },
  {
    id: "pricing",
    name: "التسعير",
    description: "طلبات التسعير والتكلفة وهوامش الربح",
    icon: BadgeDollarSign,
    tone: "orange",
  },
  {
    id: "invoices",
    name: "الفواتير",
    description: "الفواتير والمدفوعات والمستحقات",
    icon: FileText,
    tone: "blue",
  },
  {
    id: "purchases",
    name: "المشتريات",
    description: "الموردون وطلبات وأوامر الشراء",
    icon: ShoppingCart,
    tone: "violet",
    stage: "purchasing",
  },
  {
    id: "inventory",
    name: "المخزون",
    description: "المنتجات والمخازن وحركة الأصناف",
    icon: Package,
    tone: "green",
  },
  {
    id: "accounting",
    name: "المحاسبة",
    description: "الحسابات والقيود والتقارير المالية",
    icon: Calculator,
    tone: "teal",
    stage: "finance",
  },
  {
    id: "projects",
    name: "المشاريع",
    description: "المشاريع والمهام ونسب الإنجاز",
    icon: FolderKanban,
    tone: "blue",
    stage: "all",
  },
  {
    id: "employees",
    name: "الموظفين",
    description: "الموظفون والأقسام والصلاحيات",
    icon: UserRound,
    tone: "red",
  },
  {
    id: "expenses",
    name: "المصروفات",
    description: "طلبات المصروفات والموافقات",
    icon: WalletCards,
    tone: "orange",
  },
  {
    id: "reports",
    name: "التقارير",
    description: "تقارير وتحليلات جميع الأقسام",
    icon: BarChart3,
    tone: "purple",
  },
  {
    id: "support",
    name: "الدعم الفني",
    description: "التذاكر وخدمة العملاء",
    icon: Headphones,
    tone: "cyan",
  },
  {
    id: "assets",
    name: "الأصول",
    description: "إدارة الأصول والعهد",
    icon: Boxes,
    tone: "green",
  },
  {
    id: "branches",
    name: "الفروع",
    description: "إدارة الشركات والفروع",
    icon: Building2,
    tone: "blue",
  },
  {
    id: "maintenance",
    name: "الصيانة",
    description: "أوامر الصيانة والزيارات",
    icon: Wrench,
    tone: "orange",
  },
  {
    id: "settings",
    name: "الإعدادات",
    description: "إعدادات النظام والتخصيص",
    icon: Settings,
    tone: "gray",
  },
];

export default function AppLauncher({ onChangeView }) {
  const handleAppClick = (app) => {
    if (!onChangeView) return;

    if (app.stage) {
      onChangeView("work-orders", {
        stage: app.stage,
        source: app.id,
      });
      return;
    }

    onChangeView(app.id);
  };

  return (
    <section className="app-launcher">
      <div className="app-launcher-header">
        <div>
          <span className="section-kicker">MASA ERP</span>
          <h2>التطبيقات</h2>
          <p>
            كل أدوات إدارة شركتك في مكان واحد، ومربوطة ببعض تلقائياً.
          </p>
        </div>

        <button
          type="button"
          className="manage-apps-button"
        >
          إدارة التطبيقات
          <ChevronLeft size={16} />
        </button>
      </div>

      <div className="apps-grid">
        {apps.map((app) => {
          const Icon = app.icon;

          return (
            <button
              type="button"
              className="app-card"
              key={app.id}
              onClick={() => handleAppClick(app)}
            >
              <div className={`app-icon ${app.tone}`}>
                <Icon size={25} strokeWidth={1.8} />
              </div>

              <div className="app-copy">
                <strong>{app.name}</strong>
                <span>{app.description}</span>
              </div>

              <ChevronLeft
                className="app-arrow"
                size={17}
                strokeWidth={1.8}
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
