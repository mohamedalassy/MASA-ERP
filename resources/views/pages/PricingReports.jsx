import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BadgeDollarSign,
  CheckCircle2,
  Clock3,
  FileText,
  Percent,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle,
} from "lucide-react";

const API = "http://127.0.0.1:8000/api";

const money = (value) =>
  `${Number(value || 0).toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ر.س`;

const monthLabel = (dateString) => {
  if (!dateString) return "غير محدد";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return "غير محدد";
  return d.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "short",
  });
};

export default function PricingReports({ onNavigate }) {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const load = async () => {
    try {
      setLoading(true);
      setMessage("");

      const response = await fetch(`${API}/quotations`, {
        headers: { Accept: "application/json" },
      });

      const json = await response.json();

      if (!response.ok || json?.success === false) {
        throw new Error(json?.message || "تعذر تحميل تقارير التسعير.");
      }

      setQuotations(Array.isArray(json?.data) ? json.data : []);
    } catch (error) {
      setMessage(error.message || "تعذر تحميل البيانات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const enriched = useMemo(() => {
    return quotations.map((q) => {
      const items = Array.isArray(q.items) ? q.items : [];

      const materialCost = items.reduce(
        (sum, item) =>
          sum +
          Number(item.cost_price || 0) *
            Number(item.quantity || 0),
        0
      );

      const extraCosts = Object.values(q.extra_costs || {}).reduce(
        (sum, value) => sum + Number(value || 0),
        0
      );

      const cost = materialCost + extraCosts;
      const saleBeforeTax = Math.max(
        Number(q.subtotal || 0) - Number(q.discount || 0),
        0
      );
      const profit = saleBeforeTax - cost;
      const margin =
        saleBeforeTax > 0
          ? (profit / saleBeforeTax) * 100
          : 0;

      return {
        ...q,
        _materialCost: materialCost,
        _extraCosts: extraCosts,
        _cost: cost,
        _saleBeforeTax: saleBeforeTax,
        _profit: profit,
        _margin: margin,
      };
    });
  }, [quotations]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return enriched.filter((q) => {
      if (status !== "all" && q.status !== status) {
        return false;
      }

      if (!needle) return true;

      return [
        q.quotation_number,
        q.project?.name,
        q.project?.project_code,
        q.project?.customer_name,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(needle)
        );
    });
  }, [enriched, search, status]);

  const stats = useMemo(() => {
    const approved = enriched.filter(
      (q) => q.status === "approved"
    );
    const rejected = enriched.filter(
      (q) => q.status === "rejected"
    );
    const pending = enriched.filter(
      (q) => q.status === "pending_approval"
    );

    const approvedValue = approved.reduce(
      (sum, q) => sum + Number(q.total || 0),
      0
    );

    const approvedProfit = approved.reduce(
      (sum, q) => sum + Number(q._profit || 0),
      0
    );

    const avgMargin =
      approved.length > 0
        ? approved.reduce(
            (sum, q) => sum + Number(q._margin || 0),
            0
          ) / approved.length
        : 0;

    const decided = approved.length + rejected.length;
    const winRate =
      decided > 0
        ? (approved.length / decided) * 100
        : 0;

    return {
      total: enriched.length,
      approved: approved.length,
      rejected: rejected.length,
      pending: pending.length,
      approvedValue,
      approvedProfit,
      avgMargin,
      winRate,
    };
  }, [enriched]);

  const monthly = useMemo(() => {
    const map = new Map();

    enriched.forEach((q) => {
      const key = monthLabel(q.created_at);

      if (!map.has(key)) {
        map.set(key, {
          month: key,
          total: 0,
          approved: 0,
          rejected: 0,
          value: 0,
          profit: 0,
        });
      }

      const row = map.get(key);
      row.total += 1;

      if (q.status === "approved") {
        row.approved += 1;
        row.value += Number(q.total || 0);
        row.profit += Number(q._profit || 0);
      }

      if (q.status === "rejected") {
        row.rejected += 1;
      }
    });

    return [...map.values()].slice(-6);
  }, [enriched]);

  const topProjects = useMemo(() => {
    const map = new Map();

    enriched
      .filter((q) => q.status === "approved")
      .forEach((q) => {
        const key =
          q.project?.id ||
          q.project_id ||
          q.project?.name ||
          "unknown";

        if (!map.has(key)) {
          map.set(key, {
            id: key,
            name:
              q.project?.name ||
              q.project?.project_code ||
              "مشروع بدون اسم",
            customer:
              q.project?.customer_name || "—",
            value: 0,
            profit: 0,
            count: 0,
          });
        }

        const row = map.get(key);
        row.value += Number(q.total || 0);
        row.profit += Number(q._profit || 0);
        row.count += 1;
      });

    return [...map.values()]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);
  }, [enriched]);

  const marginRows = useMemo(() => {
    return [...enriched]
      .filter((q) => q.status === "approved")
      .sort((a, b) => b._margin - a._margin)
      .slice(0, 7);
  }, [enriched]);

  const maxMonthlyValue = Math.max(
    ...monthly.map((m) => m.value),
    1
  );

  const statusText = {
    draft: "مسودة",
    pending_approval: "بانتظار الموافقة",
    approved: "معتمد",
    rejected: "مرفوض",
  };

  return (
    <section className="pricing-reports-page" dir="rtl">
      <style>{`
        .pricing-reports-page {
          color: #23293b;
          padding-bottom: 28px;
        }

        .pr-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-bottom: 18px;
        }

        .pr-kicker {
          color: #6657f5;
          font-size: 12px;
          font-weight: 900;
          margin-bottom: 5px;
        }

        .pr-head h1 {
          margin: 0;
          font-size: 28px;
          color: #171d2d;
        }

        .pr-head p {
          margin: 6px 0 0;
          color: #9298a7;
          font-size: 12px;
        }

        .pr-actions {
          display: flex;
          gap: 8px;
        }

        .pr-button {
          border: 1px solid #e4e7ef;
          background: #fff;
          border-radius: 11px;
          padding: 9px 12px;
          font-family: inherit;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          gap: 6px;
          align-items: center;
        }

        .pr-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }

        .pr-card {
          background: #fff;
          border: 1px solid #e9ebf2;
          border-radius: 17px;
          box-shadow: 0 8px 26px rgba(28, 34, 61, 0.035);
        }

        .pr-kpi {
          padding: 16px;
        }

        .pr-kpi-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .pr-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: #f0edff;
          color: #6557f5;
        }

        .pr-label {
          color: #8f96a6;
          font-size: 10px;
          font-weight: 800;
        }

        .pr-value {
          font-size: 23px;
          font-weight: 900;
          margin-top: 9px;
        }

        .pr-sub {
          color: #a0a6b4;
          font-size: 9px;
          margin-top: 4px;
        }

        .pr-main {
          display: grid;
          grid-template-columns: 1.25fr .75fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        .pr-panel {
          padding: 17px;
        }

        .pr-title {
          font-size: 13px;
          font-weight: 900;
          margin-bottom: 14px;
        }

        .pr-chart {
          display: flex;
          align-items: end;
          gap: 15px;
          min-height: 220px;
          padding: 10px 6px 0;
          border-bottom: 1px solid #eceef4;
        }

        .pr-month {
          flex: 1;
          min-width: 50px;
          display: grid;
          justify-items: center;
          gap: 7px;
        }

        .pr-bar-wrap {
          height: 170px;
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: end;
        }

        .pr-bar {
          width: 28px;
          min-height: 4px;
          border-radius: 8px 8px 2px 2px;
          background: linear-gradient(180deg, #7767ff, #6657f5);
        }

        .pr-month strong {
          font-size: 10px;
        }

        .pr-month small {
          color: #9da3b1;
          font-size: 8px;
        }

        .pr-status-list {
          display: grid;
          gap: 10px;
        }

        .pr-status {
          padding: 11px 0;
          border-bottom: 1px solid #f0f2f6;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          font-size: 11px;
        }

        .pr-status:last-child {
          border-bottom: 0;
        }

        .pr-status span {
          color: #8f96a5;
        }

        .pr-status strong {
          font-size: 12px;
        }

        .pr-bottom {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 12px;
        }

        .pr-ranking {
          display: grid;
          gap: 8px;
        }

        .pr-rank {
          border: 1px solid #eef0f5;
          border-radius: 12px;
          padding: 10px;
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: center;
        }

        .pr-rank-name strong {
          display: block;
          font-size: 11px;
        }

        .pr-rank-name small {
          display: block;
          color: #9ca2b0;
          margin-top: 3px;
          font-size: 8px;
        }

        .pr-rank-value {
          text-align: left;
        }

        .pr-rank-value strong {
          display: block;
          font-size: 11px;
          color: #1c9a68;
        }

        .pr-rank-value small {
          color: #9ca2b0;
          font-size: 8px;
        }

        .pr-filters {
          display: flex;
          gap: 9px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }

        .pr-input,
        .pr-select {
          border: 1px solid #e3e6ee;
          border-radius: 10px;
          padding: 10px 12px;
          font-family: inherit;
          outline: none;
          background: #fff;
        }

        .pr-search {
          flex: 1;
          min-width: 280px;
          position: relative;
        }

        .pr-search svg {
          position: absolute;
          right: 12px;
          top: 11px;
          color: #979dab;
        }

        .pr-input {
          width: 100%;
          box-sizing: border-box;
          padding-right: 37px;
        }

        .pr-table-wrap {
          overflow-x: auto;
        }

        .pr-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1100px;
        }

        .pr-table th {
          text-align: right;
          color: #9198a8;
          font-size: 9px;
          padding: 10px;
          background: #fafbfe;
        }

        .pr-table td {
          padding: 11px 10px;
          border-top: 1px solid #eff1f5;
          font-size: 10px;
        }

        .pr-pill {
          display: inline-flex;
          padding: 5px 8px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 900;
        }

        @media (max-width: 1100px) {
          .pr-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .pr-main,
          .pr-bottom {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .pr-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="pr-head">
        <div>
          <div className="pr-kicker">مركز التسعير</div>
          <h1>تقارير التسعير</h1>
          <p>
            تحليل العروض، الربحية، نسب الاعتماد وأداء المشاريع.
          </p>
        </div>

        <div className="pr-actions">
          <button
            type="button"
            className="pr-button"
            onClick={load}
          >
            <RefreshCw size={15} />
            تحديث
          </button>

          <button
            type="button"
            className="pr-button"
            onClick={() => onNavigate?.("pricing")}
          >
            <ArrowRight size={15} />
            مركز التسعير
          </button>
        </div>
      </div>

      {message && (
        <div
          className="pr-card"
          style={{
            padding: 12,
            marginBottom: 12,
            color: "#c84e5c",
            background: "#fff4f5",
          }}
        >
          {message}
        </div>
      )}

      <div className="pr-grid">
        <Kpi
          icon={FileText}
          label="إجمالي عروض الأسعار"
          value={loading ? "..." : stats.total}
          sub={`${stats.pending} بانتظار الموافقة`}
        />

        <Kpi
          icon={CheckCircle2}
          label="Win Rate"
          value={
            loading ? "..." : `${stats.winRate.toFixed(1)}%`
          }
          sub={`${stats.approved} معتمد / ${stats.rejected} مرفوض`}
        />

        <Kpi
          icon={TrendingUp}
          label="متوسط هامش الربح"
          value={
            loading ? "..." : `${stats.avgMargin.toFixed(1)}%`
          }
          sub="للعروض المعتمدة"
        />

        <Kpi
          icon={BadgeDollarSign}
          label="قيمة العروض المعتمدة"
          value={
            loading ? "..." : money(stats.approvedValue)
          }
          sub={`ربح تقديري ${money(stats.approvedProfit)}`}
        />
      </div>

      <div className="pr-main">
        <div className="pr-card pr-panel">
          <div className="pr-title">
            قيمة العروض المعتمدة خلال آخر الفترات
          </div>

          <div className="pr-chart">
            {monthly.length ? (
              monthly.map((row) => (
                <div className="pr-month" key={row.month}>
                  <div className="pr-bar-wrap">
                    <div
                      className="pr-bar"
                      style={{
                        height: `${Math.max(
                          (row.value / maxMonthlyValue) * 100,
                          3
                        )}%`,
                      }}
                    />
                  </div>
                  <strong>{row.month}</strong>
                  <small>{money(row.value)}</small>
                </div>
              ))
            ) : (
              <div
                style={{
                  color: "#9ca2b0",
                  margin: "auto",
                }}
              >
                لا توجد بيانات كافية للرسم.
              </div>
            )}
          </div>
        </div>

        <div className="pr-card pr-panel">
          <div className="pr-title">ملخص الحالات</div>

          <div className="pr-status-list">
            <Status
              icon={<CheckCircle2 size={15} />}
              label="معتمد"
              value={stats.approved}
            />
            <Status
              icon={<Clock3 size={15} />}
              label="بانتظار الموافقة"
              value={stats.pending}
            />
            <Status
              icon={<XCircle size={15} />}
              label="مرفوض"
              value={stats.rejected}
            />
            <Status
              icon={<Percent size={15} />}
              label="Win Rate"
              value={`${stats.winRate.toFixed(1)}%`}
            />
            <Status
              icon={<BadgeDollarSign size={15} />}
              label="الربح المعتمد"
              value={money(stats.approvedProfit)}
            />
          </div>
        </div>
      </div>

      <div className="pr-bottom">
        <div className="pr-card pr-panel">
          <div className="pr-title">
            <Trophy
              size={15}
              style={{ marginLeft: 6, verticalAlign: "middle" }}
            />
            أعلى المشاريع ربحية
          </div>

          <div className="pr-ranking">
            {topProjects.length ? (
              topProjects.map((row) => (
                <div className="pr-rank" key={row.id}>
                  <div className="pr-rank-name">
                    <strong>{row.name}</strong>
                    <small>
                      {row.customer} · {row.count} عرض
                    </small>
                  </div>

                  <div className="pr-rank-value">
                    <strong>{money(row.profit)}</strong>
                    <small>{money(row.value)}</small>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "#9ca2b0" }}>
                لا توجد عروض معتمدة بعد.
              </div>
            )}
          </div>
        </div>

        <div className="pr-card pr-panel">
          <div className="pr-title">
            أفضل العروض حسب هامش الربح
          </div>

          <div className="pr-ranking">
            {marginRows.length ? (
              marginRows.map((q) => (
                <div className="pr-rank" key={q.id}>
                  <div className="pr-rank-name">
                    <strong>
                      {q.quotation_number || `#${q.id}`}
                    </strong>
                    <small>
                      {q.project?.name ||
                        q.project?.customer_name ||
                        "—"}
                    </small>
                  </div>

                  <div className="pr-rank-value">
                    <strong>
                      {q._margin.toFixed(1)}%
                    </strong>
                    <small>{money(q._profit)}</small>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "#9ca2b0" }}>
                لا توجد بيانات ربحية بعد.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="pr-card pr-panel">
        <div className="pr-title">
          تفاصيل عروض الأسعار
        </div>

        <div className="pr-filters">
          <div className="pr-search">
            <Search size={16} />
            <input
              className="pr-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم العرض أو المشروع أو العميل..."
            />
          </div>

          <select
            className="pr-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">كل الحالات</option>
            <option value="approved">معتمد</option>
            <option value="pending_approval">
              بانتظار الموافقة
            </option>
            <option value="rejected">مرفوض</option>
            <option value="draft">مسودة</option>
          </select>
        </div>

        <div className="pr-table-wrap">
          <table className="pr-table">
            <thead>
              <tr>
                <th>العرض</th>
                <th>المشروع / العميل</th>
                <th>الحالة</th>
                <th>التكلفة</th>
                <th>البيع قبل الضريبة</th>
                <th>الربح</th>
                <th>الهامش</th>
                <th>Target</th>
                <th>الإجمالي</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length ? (
                filtered.map((q) => (
                  <tr key={q.id}>
                    <td>
                      <strong>
                        {q.quotation_number ||
                          `#${q.id}`}
                      </strong>
                      <div
                        style={{
                          color: "#9ca2b0",
                          marginTop: 3,
                        }}
                      >
                        V{q.version || 1}
                      </div>
                    </td>

                    <td>
                      <strong>
                        {q.project?.name || "—"}
                      </strong>
                      <div
                        style={{
                          color: "#9ca2b0",
                          marginTop: 3,
                        }}
                      >
                        {q.project?.customer_name ||
                          q.project?.project_code ||
                          "—"}
                      </div>
                    </td>

                    <td>
                      <span
                        className="pr-pill"
                        style={pill(q.status)}
                      >
                        {statusText[q.status] ||
                          q.status}
                      </span>
                    </td>

                    <td>{money(q._cost)}</td>
                    <td>{money(q._saleBeforeTax)}</td>
                    <td>{money(q._profit)}</td>

                    <td>
                      <strong
                        style={{
                          color:
                            q._margin <
                            Number(q.target_margin || 0)
                              ? "#d65260"
                              : "#1e9d69",
                        }}
                      >
                        {q._margin.toFixed(1)}%
                      </strong>
                    </td>

                    <td>
                      {Number(
                        q.target_margin || 0
                      ).toFixed(1)}
                      %
                    </td>

                    <td>{money(q.total)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="9"
                    style={{
                      textAlign: "center",
                      color: "#9ca2b0",
                      padding: 28,
                    }}
                  >
                    لا توجد بيانات مطابقة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Kpi({ icon: Icon, label, value, sub }) {
  return (
    <div className="pr-card pr-kpi">
      <div className="pr-kpi-top">
        <div>
          <div className="pr-label">{label}</div>
        </div>

        <div className="pr-icon">
          <Icon size={18} />
        </div>
      </div>

      <div className="pr-value">{value}</div>
      <div className="pr-sub">{sub}</div>
    </div>
  );
}

function Status({ icon, label, value }) {
  return (
    <div className="pr-status">
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        {icon}
        {label}
      </span>

      <strong>{value}</strong>
    </div>
  );
}

function pill(status) {
  if (status === "approved") {
    return {
      background: "#eaf8f1",
      color: "#1b8c5e",
    };
  }

  if (status === "rejected") {
    return {
      background: "#fff0f2",
      color: "#c94e5c",
    };
  }

  if (status === "pending_approval") {
    return {
      background: "#f0edff",
      color: "#5f51df",
    };
  }

  return {
    background: "#f2f3f6",
    color: "#747b8a",
  };
}
