import { useEffect, useMemo, useState } from "react";

import {
  Boxes,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCcw,
  Search,
  AlertTriangle,
  History,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const formatMoney = (value) =>
  `${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ر.س`;

const formatDateTime = (value) => {
  if (!value) return "-";

  return new Date(value).toLocaleString("ar-SA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadInventory = async () => {
    try {
      setLoading(true);
      setError("");

      const [productsResponse, transactionsResponse] =
        await Promise.all([
          fetch(`${API_URL}/products`, {
            headers: {
              Accept: "application/json",
            },
          }),
          fetch(`${API_URL}/inventory-transactions`, {
            headers: {
              Accept: "application/json",
            },
          }),
        ]);

      const productsResult = await productsResponse.json();
      const transactionsResult =
        await transactionsResponse.json();

      if (
        !productsResponse.ok ||
        !productsResult.success
      ) {
        throw new Error(
          productsResult.message ||
            "تعذر تحميل بيانات المنتجات."
        );
      }

      if (
        !transactionsResponse.ok ||
        !transactionsResult.success
      ) {
        throw new Error(
          transactionsResult.message ||
            "تعذر تحميل حركات المخزون."
        );
      }

      setProducts(
        Array.isArray(productsResult.data)
          ? productsResult.data
          : []
      );

      setTransactions(
        Array.isArray(transactionsResult.data)
          ? transactionsResult.data
          : []
      );
    } catch (error) {
      console.error(error);

      setError(
        error.message ||
          "حدث خطأ أثناء تحميل المخزون."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return products;

    return products.filter((product) => {
      return [
        product.name,
        product.sku,
        product.brand,
        product.model,
        product.category,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(term)
        );
    });
  }, [products, search]);

  const totalProducts = products.length;

  const totalStock = products.reduce(
    (sum, product) =>
      sum + Number(product.stock_quantity || 0),
    0
  );

  const lowStockProducts = products.filter(
    (product) =>
      Number(product.stock_quantity || 0) <=
      Number(product.minimum_stock || 0)
  );

  const totalStockValue = products.reduce(
    (sum, product) =>
      sum +
      Number(product.stock_quantity || 0) *
        Number(product.cost_price || 0),
    0
  );

  if (loading) {
    return (
      <div
        className="inventory-page"
        dir="rtl"
        style={{ padding: "24px" }}
      >
        جاري تحميل المخزون...
      </div>
    );
  }

  return (
    <div
      className="inventory-page"
      dir="rtl"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <div
        style={{
          padding: "24px",
          border: "1px solid #e7e9f2",
          borderRadius: "18px",
          background: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "14px",
              background: "#fff1f2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Boxes size={24} />
          </div>

          <div>
            <span
              style={{
                color: "#6257ff",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              المخزون
            </span>

            <h1
              style={{
                margin: "4px 0 0",
                fontSize: "26px",
              }}
            >
              إدارة المخزون
            </h1>

            <p
              style={{
                margin: "6px 0 0",
                color: "#9aa0af",
                fontSize: "13px",
              }}
            >
              المنتجات والكميات وحركات الدخول والصرف
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadInventory}
          style={{
            height: "40px",
            padding: "0 16px",
            border: "1px solid #ddd6fe",
            borderRadius: "10px",
            background: "#f5f3ff",
            color: "#6257ff",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 700,
          }}
        >
          <RefreshCcw size={16} />
          تحديث
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "12px 14px",
            borderRadius: "12px",
            background: "#fff1f2",
            color: "#dc2626",
            fontSize: "13px",
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4, minmax(0, 1fr))",
          gap: "14px",
        }}
      >
        <StatCard
          icon={<Package size={20} />}
          label="عدد المنتجات"
          value={totalProducts}
        />

        <StatCard
          icon={<Boxes size={20} />}
          label="إجمالي الوحدات"
          value={totalStock.toLocaleString("en-US")}
        />

        <StatCard
          icon={<AlertTriangle size={20} />}
          label="مخزون منخفض"
          value={lowStockProducts.length}
        />

        <StatCard
          icon={<History size={20} />}
          label="قيمة المخزون"
          value={formatMoney(totalStockValue)}
        />
      </div>

      <div
        style={{
          padding: "22px",
          border: "1px solid #e7e9f2",
          borderRadius: "18px",
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "18px",
              }}
            >
              أرصدة المنتجات
            </h3>

            <span
              style={{
                color: "#9aa0af",
                fontSize: "12px",
              }}
            >
              الرصيد الحالي وحد إعادة الطلب
            </span>
          </div>

          <div
            style={{
              position: "relative",
              width: "320px",
            }}
          >
            <Search
              size={16}
              style={{
                position: "absolute",
                top: "50%",
                right: "12px",
                transform: "translateY(-50%)",
                color: "#9aa0af",
              }}
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="ابحث بالاسم أو SKU أو الموديل..."
              style={{
                width: "100%",
                height: "42px",
                border: "1px solid #dfe2ea",
                borderRadius: "11px",
                padding: "0 38px 0 12px",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        <div
          style={{
            border: "1px solid #eceef5",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1.7fr 1fr 1fr 1fr 1fr",
              gap: "12px",
              padding: "12px 14px",
              background: "#fafbfe",
              color: "#8d94a5",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            <span>المنتج</span>
            <span>SKU</span>
            <span>الرصيد</span>
            <span>الحد الأدنى</span>
            <span>الحالة</span>
          </div>

          {filteredProducts.length ? (
            filteredProducts.map((product) => {
              const stock = Number(
                product.stock_quantity || 0
              );
              const minimum = Number(
                product.minimum_stock || 0
              );
              const low = stock <= minimum;

              return (
                <div
                  key={product.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1.7fr 1fr 1fr 1fr 1fr",
                    gap: "12px",
                    padding: "14px",
                    borderTop:
                      "1px solid #f0f1f6",
                    alignItems: "center",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <strong
                      style={{
                        display: "block",
                      }}
                    >
                      {product.name}
                    </strong>

                    <span
                      style={{
                        display: "block",
                        marginTop: "4px",
                        color: "#9aa0af",
                        fontSize: "11px",
                      }}
                    >
                      {product.brand || "-"}
                      {product.model
                        ? ` • ${product.model}`
                        : ""}
                    </span>
                  </div>

                  <span>
                    {product.sku || "-"}
                  </span>

                  <strong>{stock}</strong>

                  <span>{minimum}</span>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "fit-content",
                      padding: "5px 10px",
                      borderRadius: "999px",
                      background: low
                        ? "#fff7ed"
                        : "#ecfdf3",
                      color: low
                        ? "#ea580c"
                        : "#15803d",
                      fontWeight: 700,
                      fontSize: "11px",
                    }}
                  >
                    {low
                      ? "مخزون منخفض"
                      : "متوفر"}
                  </span>
                </div>
              );
            })
          ) : (
            <div
              style={{
                padding: "22px",
                textAlign: "center",
                color: "#9aa0af",
              }}
            >
              لا توجد منتجات مطابقة.
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          padding: "22px",
          border: "1px solid #e7e9f2",
          borderRadius: "18px",
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "18px",
          }}
        >
          <History size={20} />

          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "18px",
              }}
            >
              آخر حركات المخزون
            </h3>

            <span
              style={{
                color: "#9aa0af",
                fontSize: "12px",
              }}
            >
              الاستلامات وحركات الدخول والصرف
            </span>
          </div>
        </div>

        <div
          style={{
            border: "1px solid #eceef5",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1.4fr 0.7fr 0.7fr 0.8fr 0.8fr 1fr 1.2fr",
              gap: "10px",
              padding: "12px 14px",
              background: "#fafbfe",
              color: "#8d94a5",
              fontSize: "12px",
              fontWeight: 700,
            }}
          >
            <span>المنتج</span>
            <span>الحركة</span>
            <span>الكمية</span>
            <span>قبل</span>
            <span>بعد</span>
            <span>المرجع</span>
            <span>التاريخ</span>
          </div>

          {transactions.length ? (
            transactions.map((transaction) => {
              const isIn =
                transaction.type === "IN";

              return (
                <div
                  key={transaction.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "1.4fr 0.7fr 0.7fr 0.8fr 0.8fr 1fr 1.2fr",
                    gap: "10px",
                    padding: "14px",
                    alignItems: "center",
                    borderTop:
                      "1px solid #f0f1f6",
                    fontSize: "12px",
                  }}
                >
                  <strong>
                    {transaction.product?.name ||
                      transaction.purchase_order_item
                        ?.product_name ||
                      "-"}
                  </strong>

                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontWeight: 700,
                      color: isIn
                        ? "#15803d"
                        : "#dc2626",
                    }}
                  >
                    {isIn ? (
                      <ArrowDownToLine size={15} />
                    ) : (
                      <ArrowUpFromLine size={15} />
                    )}

                    {transaction.type}
                  </span>

                  <strong>
                    {transaction.quantity}
                  </strong>

                  <span>
                    {transaction.stock_before}
                  </span>

                  <span>
                    {transaction.stock_after}
                  </span>

                  <span>
                    {transaction.reference ||
                      transaction.purchase_order
                        ?.po_number ||
                      "-"}
                  </span>

                  <span>
                    {formatDateTime(
                      transaction.created_at
                    )}
                  </span>
                </div>
              );
            })
          ) : (
            <div
              style={{
                padding: "22px",
                textAlign: "center",
                color: "#9aa0af",
              }}
            >
              لا توجد حركات مخزون حتى الآن.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div
      style={{
        padding: "18px",
        border: "1px solid #e7e9f2",
        borderRadius: "16px",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        gap: "12px",
      }}
    >
      <div
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "12px",
          background: "#f5f3ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6257ff",
        }}
      >
        {icon}
      </div>

      <div>
        <span
          style={{
            display: "block",
            color: "#9aa0af",
            fontSize: "11px",
          }}
        >
          {label}
        </span>

        <strong
          style={{
            display: "block",
            marginTop: "4px",
            fontSize: "18px",
          }}
        >
          {value}
        </strong>
      </div>
    </div>
  );
}
