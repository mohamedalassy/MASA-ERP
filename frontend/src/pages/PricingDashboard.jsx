import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  BarChart3,
  Boxes,
  Calculator,
  CheckCircle2,
  Clock3,
  FilePlus2,
  FileText,
  History,
  PackagePlus,
  Percent,
  Scale,
  Sparkles,
  TrendingUp,
  Trophy,
  UsersRound,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const money = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });

const statusLabel = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

export default function PricingDashboard({ onNavigate }) {
  const [quotations, setQuotations] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [qRes, pRes] = await Promise.allSettled([
          fetch(`${API_URL}/quotations`, {
            headers: { Accept: "application/json" },
          }).then((r) => r.json()),
          fetch(`${API_URL}/products`, {
            headers: { Accept: "application/json" },
          }).then((r) => r.json()),
        ]);

        if (!active) return;

        if (qRes.status === "fulfilled") {
          const data = qRes.value?.data;
          setQuotations(Array.isArray(data) ? data : []);
        }

        if (pRes.status === "fulfilled") {
          const data = pRes.value?.data;
          setProducts(Array.isArray(data) ? data : []);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = quotations.length;
    const approved = quotations.filter((q) => q.status === "approved");
    const approvedValue = approved.reduce(
      (sum, q) => sum + Number(q.total || 0),
      0
    );

    const totalValue = quotations.reduce(
      (sum, q) => sum + Number(q.total || 0),
      0
    );

    const margins = products
      .map((p) => {
        const cost = Number(p.cost_price || 0);
        const sale = Number(p.default_sale_price || 0);
        return sale > 0 ? ((sale - cost) / sale) * 100 : 0;
      })
      .filter((m) => Number.isFinite(m) && m > 0);

    const avgMargin = margins.length
      ? margins.reduce((a, b) => a + b, 0) / margins.length
      : 0;

    return {
      total,
      approved: approved.length,
      approvedValue,
      totalValue,
      avgMargin,
    };
  }, [quotations, products]);

  const topProducts = useMemo(() => {
    return products
      .map((p) => {
        const cost = Number(p.cost_price || 0);
        const sale = Number(p.default_sale_price || 0);
        const margin = sale > 0 ? ((sale - cost) / sale) * 100 : 0;
        return { ...p, margin };
      })
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 4);
  }, [products]);

  const recentQuotations = useMemo(
    () => [...quotations].slice(0, 4),
    [quotations]
  );

  const quickActions = [
    {
      title: "عرض سعر جديد",
      sub: "إنشاء وتسعير عرض جديد",
      icon: FilePlus2,
      tone: "purple",
      view: "quotations",
    },
    {
      title: "BOQ Builder",
      sub: "بناء الكميات والبنود",
      icon: Boxes,
      tone: "blue",
      view: "pricing-boq",
    },
    {
      title: "باقات المنتجات",
      sub: "Packages جاهزة للتسعير",
      icon: PackagePlus,
      tone: "violet",
      view: "pricing-packages",
    },
    {
      title: "قواعد الربح والخصومات",
      sub: "Margin & Discount Rules",
      icon: Percent,
      tone: "orange",
      view: "pricing-rules",
    },
    {
      title: "سعر مقترح",
      sub: "حساب Target Selling Price",
      icon: Sparkles,
      tone: "amber",
      view: "pricing-calculator",
    },
    {
      title: "سجل أسعار المنتجات",
      sub: "Price History",
      icon: History,
      tone: "purple",
      view: "pricing-history",
    },
    {
      title: "مقارنة الموردين",
      sub: "السعر ومدة التوريد",
      icon: Scale,
      tone: "cyan",
      view: "pricing-suppliers",
    },
    {
      title: "حساب تكلفة المشروع",
      sub: "التكلفة الحقيقية والربح",
      icon: Calculator,
      tone: "blue",
      view: "pricing-costing",
    },
  ];

  const modules = [
    {
      title: "قائمة الأسعار",
      sub: "شراء، بيع، هامش ومخزون",
      icon: BadgeDollarSign,
      view: "price-list",
      tone: "green",
    },
    {
      title: "عروض الأسعار",
      sub: "كل إصدارات عروض العملاء",
      icon: FileText,
      view: "quotations",
      tone: "blue",
    },
    {
      title: "الباقات",
      sub: "إنشاء وإدارة Packages",
      icon: Boxes,
      view: "pricing-packages",
      tone: "purple",
    },
    {
      title: "الموردين",
      sub: "أسعار الموردين ومقارنتها",
      icon: UsersRound,
      view: "pricing-suppliers",
      tone: "cyan",
    },
    {
      title: "البدائل",
      sub: "بدائل المنتجات والمقارنة",
      icon: Scale,
      view: "pricing-alternatives",
      tone: "green",
    },
    {
      title: "سجل الأسعار",
      sub: "تاريخ تغير الشراء والبيع",
      icon: History,
      view: "pricing-history",
      tone: "purple",
    },
    {
      title: "الموافقات",
      sub: "اعتمادات الأسعار والخصومات",
      icon: CheckCircle2,
      view: "pricing-approvals",
      tone: "orange",
    },
    {
      title: "تقارير التسعير",
      sub: "الربحية وWin Rate",
      icon: BarChart3,
      view: "pricing-reports",
      tone: "blue",
    },
  ];

  const go = (view) => onNavigate?.(view);

  return (
    <section className="pricing-center" dir="rtl">
      <style>{`
        .pricing-center{font-family:inherit;color:#20263a;padding:4px 2px 28px}
        .pc-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:18px}
        .pc-kicker{font-size:11px;font-weight:800;color:#6d5dfc;margin-bottom:5px}
        .pc-head h1{margin:0;font-size:28px;letter-spacing:-.5px;color:#17213a}
        .pc-head p{margin:6px 0 0;color:#9aa1b2;font-size:12px}
        .pc-back{border:1px solid #e4e7ef;background:#fff;padding:10px 15px;border-radius:11px;color:#687086;font-weight:700;cursor:pointer}
        .pc-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-bottom:14px}
        .pc-card{background:#fff;border:1px solid #e9ebf2;border-radius:16px;box-shadow:0 8px 28px rgba(36,45,79,.04)}
        .pc-stat{padding:17px}
        .pc-stat-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .pc-stat-label{font-size:11px;color:#7e8799;font-weight:700}
        .pc-icon{width:42px;height:42px;border-radius:12px;display:grid;place-items:center}
        .pc-icon.purple{background:#f0edff;color:#6757f4}.pc-icon.green{background:#eaf9f3;color:#16a673}
        .pc-icon.orange{background:#fff3e5;color:#f79b2e}.pc-icon.blue{background:#ecf3ff;color:#4d7dff}
        .pc-stat-value{font-size:22px;font-weight:900;margin-top:10px;color:#192238}
        .pc-stat-sub{font-size:10px;color:#9aa1b2;margin-top:4px}.pc-up{color:#1aa673;font-weight:800}
        .pc-actions{padding:16px;margin-bottom:14px}.pc-section-title{font-size:14px;font-weight:900;margin-bottom:13px;color:#27304a}
        .pc-actions-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:9px}
        .pc-action{border:1px solid #e8ebf2;background:#fff;border-radius:13px;min-height:94px;padding:12px 8px;cursor:pointer;text-align:center;transition:.18s ease}
        .pc-action:hover,.pc-module:hover{transform:translateY(-2px);border-color:#cfc9ff;box-shadow:0 10px 24px rgba(95,79,246,.08)}
        .pc-action .pc-icon{margin:0 auto 9px;width:38px;height:38px}.pc-action strong{display:block;font-size:10px;color:#2d354a}.pc-action small{display:block;font-size:8px;color:#a0a6b3;margin-top:4px}
        .pc-main-grid{display:grid;grid-template-columns:1.15fr .95fr .8fr;gap:13px;margin-bottom:14px}
        .pc-panel{padding:17px;min-height:295px}
        .pc-chart{height:205px;display:flex;align-items:end;gap:9px;padding:16px 8px 4px;border-bottom:1px solid #edf0f5;position:relative}
        .pc-chart:before,.pc-chart:after{content:"";position:absolute;left:8px;right:8px;border-top:1px dashed #edf0f5}
        .pc-chart:before{top:62px}.pc-chart:after{top:122px}
        .pc-bar-wrap{flex:1;height:100%;display:flex;align-items:end;justify-content:center;gap:4px;position:relative;z-index:1}
        .pc-bar{width:10px;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,#7568ff,#aaa2ff)}
        .pc-bar.orange{background:linear-gradient(180deg,#f6a63b,#ffd18b)}
        .pc-months{display:flex;justify-content:space-around;color:#a0a6b4;font-size:9px;padding-top:8px}
        .pc-donut-wrap{display:flex;align-items:center;justify-content:center;gap:28px;height:220px}
        .pc-donut{width:126px;height:126px;border-radius:50%;background:conic-gradient(#31b77b 0 49%,#f6a62e 49% 70%,#ef5c61 70% 84%,#aab2c1 84%);display:grid;place-items:center;position:relative}
        .pc-donut:after{content:"";position:absolute;width:82px;height:82px;background:#fff;border-radius:50%}
        .pc-donut-value{position:relative;z-index:2;text-align:center;font-size:20px;font-weight:900}.pc-donut-value small{display:block;font-size:8px;color:#969dad;font-weight:600}
        .pc-legend{display:grid;gap:11px}.pc-legend-row{display:flex;align-items:center;gap:8px;font-size:10px}.pc-dot{width:8px;height:8px;border-radius:50%}
        .pc-profit-list{display:grid;gap:11px}.pc-profit-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding-bottom:10px;border-bottom:1px solid #f0f2f6}.pc-profit-row:last-child{border-bottom:0}
        .pc-profit-name{font-size:10px;font-weight:800}.pc-profit-meta{font-size:8px;color:#a1a7b4;margin-top:3px}.pc-profit-margin{font-size:11px;color:#18a873;font-weight:900}
        .pc-bottom{display:grid;grid-template-columns:1.6fr .55fr;gap:13px;margin-bottom:14px}.pc-table{padding:0;overflow:hidden}
        .pc-table-head{display:flex;justify-content:space-between;align-items:center;padding:15px 17px;border-bottom:1px solid #edf0f5}.pc-table-head strong{font-size:13px}
        .pc-table-head button{border:0;background:none;color:#6657f5;font-size:10px;cursor:pointer;font-weight:800}
        .pc-table table{width:100%;border-collapse:collapse}.pc-table th{background:#fafbfe;color:#9ba2b0;font-size:8px;text-align:right;padding:9px 12px}.pc-table td{padding:10px 12px;border-top:1px solid #f0f2f5;font-size:9px;color:#586075}
        .pc-status{padding:4px 8px;border-radius:999px;font-size:8px;font-weight:800;background:#f2f3f7;color:#788092}.pc-status.approved{background:#e8f8f1;color:#159665}.pc-status.draft{background:#f0edff;color:#6555f4}.pc-status.rejected{background:#fff0f0;color:#e35459}
        .pc-cta{padding:20px;background:linear-gradient(145deg,#6a59f5,#765fff);color:#fff;border:0;border-radius:16px;display:flex;flex-direction:column;justify-content:space-between;min-height:205px}.pc-cta h3{font-size:17px;margin:0 0 8px}.pc-cta p{font-size:10px;line-height:1.8;color:#e6e1ff;margin:0}.pc-cta button{border:0;background:#fff;color:#6353ef;border-radius:10px;padding:11px;font-weight:900;cursor:pointer}
        .pc-modules{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.pc-module{padding:15px;border:1px solid #e8ebf2;background:#fff;border-radius:14px;display:flex;align-items:center;gap:11px;cursor:pointer;transition:.18s ease;text-align:right}.pc-module .pc-icon{width:38px;height:38px;flex:0 0 auto}.pc-module strong{display:block;font-size:10px}.pc-module small{font-size:8px;color:#a1a7b4}
        @media(max-width:1200px){.pc-actions-grid{grid-template-columns:repeat(4,1fr)}.pc-main-grid{grid-template-columns:1fr 1fr}.pc-main-grid>.pc-panel:last-child{grid-column:1/-1}.pc-modules{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:760px){.pc-stats{grid-template-columns:1fr 1fr}.pc-actions-grid{grid-template-columns:1fr 1fr}.pc-main-grid,.pc-bottom{grid-template-columns:1fr}.pc-modules{grid-template-columns:1fr}.pc-head{align-items:flex-start;flex-direction:column}}
      `}</style>

      <div className="pc-head">
        <div>
          <div className="pc-kicker">مركز التسعير</div>
          <h1>التسعير</h1>
          <p>إدارة الأسعار، العروض، الباقات، الموردين والربحية من مكان واحد.</p>
        </div>

        <button className="pc-back" type="button" onClick={() => go("apps")}>
          العودة إلى التطبيقات
        </button>
      </div>

      <div className="pc-stats">
        <Stat
          icon={FileText}
          tone="blue"
          label="إجمالي عروض الأسعار"
          value={loading ? "..." : stats.total}
          sub="كل عروض التسعير المسجلة"
        />
        <Stat
          icon={BadgeDollarSign}
          tone="green"
          label="قيمة العروض"
          value={loading ? "..." : `${money(stats.totalValue)} ر.س`}
          sub={<span className="pc-up">إجمالي قيمة العروض</span>}
        />
        <Stat
          icon={CheckCircle2}
          tone="orange"
          label="العروض المعتمدة"
          value={loading ? "..." : stats.approved}
          sub={`${money(stats.approvedValue)} ر.س معتمد`}
        />
        <Stat
          icon={TrendingUp}
          tone="purple"
          label="متوسط هامش الربح"
          value={loading ? "..." : `${stats.avgMargin.toFixed(1)}%`}
          sub="حسب قائمة المنتجات الحالية"
        />
      </div>

      <div className="pc-card pc-actions">
        <div className="pc-section-title">⚡ أدوات التسعير السريعة</div>
        <div className="pc-actions-grid">
          {quickActions.map((a) => (
            <button
              type="button"
              className="pc-action"
              key={a.title}
              onClick={() => go(a.view)}
            >
              <span className={`pc-icon ${a.tone}`}>
                <a.icon size={19} />
              </span>
              <strong>{a.title}</strong>
              <small>{a.sub}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="pc-main-grid">
        <div className="pc-card pc-panel">
          <div className="pc-section-title">أداء التسعير خلال آخر 6 أشهر</div>
          <div className="pc-chart">
            {[46, 58, 64, 61, 77, 92].map((h, i) => (
              <div className="pc-bar-wrap" key={i}>
                <div className="pc-bar" style={{ height: `${h}%` }} />
                <div
                  className="pc-bar orange"
                  style={{ height: `${Math.max(20, h - 34)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="pc-months">
            {["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو"].map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>

        <div className="pc-card pc-panel">
          <div className="pc-section-title">توزيع العروض حسب الحالة</div>
          <div className="pc-donut-wrap">
            <div className="pc-donut">
              <div className="pc-donut-value">
                {stats.total}
                <small>إجمالي العروض</small>
              </div>
            </div>
            <div className="pc-legend">
              <Legend color="#31b77b" text="مقبول" />
              <Legend color="#f6a62e" text="قيد المراجعة" />
              <Legend color="#ef5c61" text="مرفوض" />
              <Legend color="#aab2c1" text="مسودة / أخرى" />
            </div>
          </div>
        </div>

        <div className="pc-card pc-panel">
          <div className="pc-section-title">
            <Trophy size={15} style={{ verticalAlign: "middle", marginLeft: 6 }} />
            أعلى المنتجات ربحية
          </div>
          <div className="pc-profit-list">
            {topProducts.length ? (
              topProducts.map((p) => (
                <div className="pc-profit-row" key={p.id}>
                  <div>
                    <div className="pc-profit-name">{p.name}</div>
                    <div className="pc-profit-meta">
                      {p.sku || "بدون SKU"} · {money(p.default_sale_price)} ر.س
                    </div>
                  </div>
                  <div className="pc-profit-margin">
                    {p.margin.toFixed(1)}%
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "#9aa1b2", fontSize: 10 }}>
                لا توجد بيانات منتجات كافية بعد.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pc-bottom">
        <div className="pc-card pc-table">
          <div className="pc-table-head">
            <strong>أحدث عروض الأسعار</strong>
            <button type="button" onClick={() => go("quotations")}>
              عرض الكل
            </button>
          </div>
          <table>
            <thead>
              <tr>
                <th>رقم العرض</th>
                <th>العميل / المشروع</th>
                <th>القيمة</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {recentQuotations.length ? (
                recentQuotations.map((q) => (
                  <tr key={q.id}>
                    <td>{q.quotation_number || `Q-${q.id}`}</td>
                    <td>
                      {q.project?.customer_name ||
                        q.project?.name ||
                        "—"}
                    </td>
                    <td>{money(q.total)} ر.س</td>
                    <td>
                      <span className={`pc-status ${q.status || ""}`}>
                        {statusLabel[q.status] || q.status || "—"}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4">لا توجد عروض لعرضها حتى الآن.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pc-cta">
          <div>
            <FilePlus2 size={30} />
            <h3>ابدأ عرض سعر جديد</h3>
            <p>
              اختر المشروع، أضف المنتجات والتكاليف ثم راقب الربحية قبل الاعتماد.
            </p>
          </div>
          <button type="button" onClick={() => go("quotations")}>
            إنشاء / إدارة عرض سعر
          </button>
        </div>
      </div>

      <div className="pc-modules">
        {modules.map((m) => (
          <button
            type="button"
            className="pc-module"
            key={m.title}
            onClick={() => go(m.view)}
          >
            <span className={`pc-icon ${m.tone}`}>
              <m.icon size={19} />
            </span>
            <span>
              <strong>{m.title}</strong>
              <small>{m.sub}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Stat({ icon: Icon, tone, label, value, sub }) {
  return (
    <article className="pc-card pc-stat">
      <div className="pc-stat-top">
        <span className="pc-stat-label">{label}</span>
        <span className={`pc-icon ${tone}`}>
          <Icon size={19} />
        </span>
      </div>
      <div className="pc-stat-value">{value}</div>
      <div className="pc-stat-sub">{sub}</div>
    </article>
  );
}

function Legend({ color, text }) {
  return (
    <div className="pc-legend-row">
      <span className="pc-dot" style={{ background: color }} />
      <span>{text}</span>
    </div>
  );
}
