import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  RefreshCcw,
  ArrowRight,
  CalendarDays,
  Building2,
  Search,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const formatMoney = (value) =>
  `${Number(value || 0).toLocaleString("en-US")} ر.س`;

const formatDate = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-CA");
};

const statusNames = {
  draft: "مسودة",
  pending: "قيد المراجعة",
  approved: "معتمد",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export default function PurchaseOrders({
  projectId = 1,
  onBack,
  onOpenPurchaseOrder,
}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/projects/${projectId}/purchase-orders`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "تعذر تحميل أوامر الشراء"
        );
      }

      setOrders(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      console.error("Purchase orders load error:", err);
      setError(
        err.message || "حدث خطأ أثناء تحميل أوامر الشراء"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [projectId]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return orders;

    return orders.filter((order) => {
      const po = String(order.po_number || "").toLowerCase();
      const supplier = String(
        order.supplier?.name || ""
      ).toLowerCase();

      return po.includes(q) || supplier.includes(q);
    });
  }, [orders, search]);

  const totalValue = orders.reduce(
    (sum, order) => sum + Number(order.total || 0),
    0
  );

  const approvedCount = orders.filter(
    (order) => order.status === "approved"
  ).length;

  const draftCount = orders.filter(
    (order) => order.status === "draft"
  ).length;

  const pageStyle = {
    width: "100%",
    direction: "rtl",
  };

  const headerStyle = {
    background: "#fff",
    border: "1px solid #ececf4",
    borderRadius: 18,
    padding: "24px 26px",
    marginBottom: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 20,
  };

  const backButtonStyle = {
    border: "1px solid #deddf1",
    background: "#fff",
    borderRadius: 10,
    padding: "9px 13px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
    fontFamily: "inherit",
  };

  const statGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 16,
  };

  const statCardStyle = {
    background: "#fff",
    border: "1px solid #ececf4",
    borderRadius: 16,
    padding: 18,
  };

  const toolbarStyle = {
    background: "#fff",
    border: "1px solid #ececf4",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    display: "flex",
    gap: 10,
    alignItems: "center",
  };

  const searchStyle = {
    flex: 1,
    height: 42,
    border: "1px solid #e1e1eb",
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 12px",
  };

  const inputStyle = {
    width: "100%",
    border: 0,
    outline: 0,
    background: "transparent",
    fontFamily: "inherit",
  };

  const tableStyle = {
    background: "#fff",
    border: "1px solid #ececf4",
    borderRadius: 16,
    overflow: "hidden",
  };

  const headStyle = {
    display: "grid",
    gridTemplateColumns:
      "1.2fr 1.3fr 1fr 1fr .8fr 1fr .7fr",
    gap: 10,
    padding: "14px 18px",
    background: "#fafafd",
    borderBottom: "1px solid #eeeeF4",
    fontSize: 12,
    color: "#85879a",
    fontWeight: 700,
  };

  const rowStyle = {
    display: "grid",
    gridTemplateColumns:
      "1.2fr 1.3fr 1fr 1fr .8fr 1fr .7fr",
    gap: 10,
    padding: "17px 18px",
    borderBottom: "1px solid #f0f0f5",
    alignItems: "center",
    fontSize: 13,
  };

  const purpleBadge = {
    display: "inline-flex",
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#f0edff",
    color: "#6557f5",
    fontWeight: 700,
    fontSize: 12,
  };

  const openButtonStyle = {
    border: 0,
    borderRadius: 10,
    padding: "9px 13px",
    background: "#6557f5",
    color: "#fff",
    cursor: "pointer",
    fontFamily: "inherit",
  };

  return (
    <div style={pageStyle}>
      <section style={headerStyle}>
        <div>
          <button
            type="button"
            style={backButtonStyle}
            onClick={onBack}
          >
            <ArrowRight size={16} />
            الرجوع للمشروع
          </button>

          <div style={{ color: "#8d8fa1", fontSize: 12 }}>
            المشتريات / المشروع رقم {projectId}
          </div>

          <h1
            style={{
              margin: "8px 0 6px",
              fontSize: 28,
              color: "#151726",
            }}
          >
            أوامر شراء المشروع
          </h1>

          <p
            style={{
              margin: 0,
              color: "#8d8fa1",
              fontSize: 13,
            }}
          >
            متابعة وإدارة جميع أوامر الشراء المرتبطة بالمشروع.
          </p>
        </div>

        <div
          style={{
            width: 54,
            height: 54,
            borderRadius: 16,
            display: "grid",
            placeItems: "center",
            background: "#fff0dc",
            color: "#ff9f2d",
          }}
        >
          <ShoppingCart size={25} />
        </div>
      </section>

      <section style={statGridStyle}>
        <div style={statCardStyle}>
          <div style={{ color: "#9294a5", fontSize: 12 }}>
            إجمالي الأوامر
          </div>
          <strong style={{ fontSize: 24 }}>
            {orders.length}
          </strong>
        </div>

        <div style={statCardStyle}>
          <div style={{ color: "#9294a5", fontSize: 12 }}>
            مسودة
          </div>
          <strong style={{ fontSize: 24 }}>
            {draftCount}
          </strong>
        </div>

        <div style={statCardStyle}>
          <div style={{ color: "#9294a5", fontSize: 12 }}>
            معتمدة
          </div>
          <strong style={{ fontSize: 24 }}>
            {approvedCount}
          </strong>
        </div>

        <div style={statCardStyle}>
          <div style={{ color: "#9294a5", fontSize: 12 }}>
            إجمالي المشتريات
          </div>
          <strong style={{ fontSize: 20 }}>
            {formatMoney(totalValue)}
          </strong>
        </div>
      </section>

      <section style={toolbarStyle}>
        <div style={searchStyle}>
          <Search size={17} color="#9698a8" />
          <input
            style={inputStyle}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث برقم أمر الشراء أو المورد..."
          />
        </div>

        <button
          type="button"
          onClick={loadOrders}
          style={{
            ...backButtonStyle,
            marginBottom: 0,
          }}
        >
          <RefreshCcw size={16} />
          تحديث
        </button>
      </section>

      {loading && (
        <div style={statCardStyle}>
          جاري تحميل أوامر الشراء...
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            ...statCardStyle,
            color: "#d33",
          }}
        >
          <strong>تعذر تحميل أوامر الشراء</strong>
          <div style={{ marginTop: 8 }}>{error}</div>
        </div>
      )}

      {!loading && !error && !filteredOrders.length && (
        <div
          style={{
            ...statCardStyle,
            textAlign: "center",
            padding: 40,
          }}
        >
          لا توجد أوامر شراء مطابقة.
        </div>
      )}

      {!loading && !error && filteredOrders.length > 0 && (
        <div style={tableStyle}>
          <div style={headStyle}>
            <span>رقم أمر الشراء</span>
            <span>المورد</span>
            <span>تاريخ الطلب</span>
            <span>التوريد المتوقع</span>
            <span>الحالة</span>
            <span>الإجمالي</span>
            <span>إجراء</span>
          </div>

          {filteredOrders.map((order) => (
            <div key={order.id} style={rowStyle}>
              <strong style={{ color: "#6557f5" }}>
                {order.po_number}
              </strong>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Building2 size={14} />
                {order.supplier?.name || "غير محدد"}
              </span>

              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <CalendarDays size={14} />
                {formatDate(order.order_date)}
              </span>

              <span>
                {formatDate(order.expected_delivery_date)}
              </span>

              <span style={purpleBadge}>
                {statusNames[order.status] || order.status}
              </span>

              <strong>{formatMoney(order.total)}</strong>

              <button
                type="button"
                style={openButtonStyle}
                onClick={() =>
                  onOpenPurchaseOrder?.(order.id)
                }
              >
                فتح
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
