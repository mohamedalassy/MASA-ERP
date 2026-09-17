import { useEffect, useMemo, useState } from "react";

import {
  ShoppingCart,
  CalendarDays,
  Building2,
  ArrowRight,
  Plus,
  Package,
  X,
  RefreshCcw,
  Trash2,
  Pencil,
  Save,
  Send,
  CheckCircle2,
  Ban,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000/api";

const formatMoney = (value) => {
  return `${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ر.س`;
};

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

export default function PurchaseOrderDetails({
  purchaseOrderId,
  onBack,
}) {
  const [order, setOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [error, setError] = useState("");
  const [itemError, setItemError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState(null);
  const [updatingItem, setUpdatingItem] = useState(false);

  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [editingOrder, setEditingOrder] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderFormError, setOrderFormError] = useState("");
  const [orderSuccessMessage, setOrderSuccessMessage] = useState("");
  const [workflowAction, setWorkflowAction] = useState("");

  const [orderForm, setOrderForm] = useState({
    supplier_id: "",
    order_date: "",
    expected_delivery_date: "",
    payment_terms: "",
    notes: "",
  });

  const [editForm, setEditForm] = useState({
    quantity: 1,
    unit_cost: 0,
    discount: 0,
    tax_rate: 15,
    description: "",
  });

  const [itemForm, setItemForm] = useState({
    product_id: "",
    quantity: 1,
    unit_cost: 0,
    discount: 0,
    tax_rate: 15,
    description: "",
  });

  const loadOrder = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/purchase-orders/${purchaseOrderId}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "تعذر تحميل أمر الشراء"
        );
      }

      setOrder(result.data);

      setOrderForm({
        supplier_id: result.data?.supplier_id
          ? String(result.data.supplier_id)
          : "",
        order_date: result.data?.order_date
          ? String(result.data.order_date).slice(0, 10)
          : "",
        expected_delivery_date:
          result.data?.expected_delivery_date
            ? String(
                result.data.expected_delivery_date
              ).slice(0, 10)
            : "",
        payment_terms:
          result.data?.payment_terms || "",
        notes: result.data?.notes || "",
      });
    } catch (error) {
      console.error(error);
      setError(
        error.message ||
          "حدث خطأ أثناء تحميل أمر الشراء"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      setProductsLoading(true);
      setItemError("");

      const response = await fetch(
        `${API_URL}/products`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "تعذر تحميل المنتجات"
        );
      }

      setProducts(
        Array.isArray(result.data)
          ? result.data
          : []
      );
    } catch (error) {
      console.error(error);
      setItemError(
        error.message ||
          "حدث خطأ أثناء تحميل المنتجات"
      );
    } finally {
      setProductsLoading(false);
    }
  };

  const loadSuppliers = async () => {
    try {
      setSuppliersLoading(true);
      setOrderFormError("");

      const response = await fetch(
        `${API_URL}/suppliers`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "تعذر تحميل الموردين"
        );
      }

      setSuppliers(
        Array.isArray(result.data)
          ? result.data
          : []
      );
    } catch (error) {
      console.error(error);

      setOrderFormError(
        error.message ||
          "حدث خطأ أثناء تحميل الموردين"
      );
    } finally {
      setSuppliersLoading(false);
    }
  };

  useEffect(() => {
    if (purchaseOrderId) {
      loadOrder();
    }
  }, [purchaseOrderId]);

  useEffect(() => {
    if (showItemForm && products.length === 0) {
      loadProducts();
    }
  }, [showItemForm]);

  useEffect(() => {
    if (editingOrder && suppliers.length === 0) {
      loadSuppliers();
    }
  }, [editingOrder]);

  const selectedProduct = useMemo(() => {
    return products.find(
      (product) =>
        String(product.id) ===
        String(itemForm.product_id)
    );
  }, [products, itemForm.product_id]);

  const rawSubtotal = useMemo(() => {
    return (
      Number(itemForm.quantity || 0) *
      Number(itemForm.unit_cost || 0)
    );
  }, [itemForm.quantity, itemForm.unit_cost]);

  const afterDiscount = useMemo(() => {
    return Math.max(
      rawSubtotal - Number(itemForm.discount || 0),
      0
    );
  }, [rawSubtotal, itemForm.discount]);

  const itemTax = useMemo(() => {
    return (
      afterDiscount *
      (Number(itemForm.tax_rate || 0) / 100)
    );
  }, [afterDiscount, itemForm.tax_rate]);

  const itemTotal = useMemo(() => {
    return afterDiscount + itemTax;
  }, [afterDiscount, itemTax]);

  const resetItemForm = () => {
    setItemForm({
      product_id: "",
      quantity: 1,
      unit_cost: 0,
      discount: 0,
      tax_rate: 15,
      description: "",
    });
    setItemError("");
    setSuccessMessage("");
  };

  const handleSelectProduct = (event) => {
    const productId = event.target.value;

    const product = products.find(
      (item) =>
        String(item.id) ===
        String(productId)
    );

    setItemForm((current) => ({
      ...current,
      product_id: productId,
      unit_cost: product
        ? Number(product.cost_price || 0)
        : 0,
      tax_rate: product
        ? Number(product.tax_rate || 15)
        : 15,
      description:
        product?.description || "",
    }));
  };

  const handleStartOrderEdit = () => {
    setOrderForm({
      supplier_id: order?.supplier_id
        ? String(order.supplier_id)
        : "",
      order_date: order?.order_date
        ? String(order.order_date).slice(0, 10)
        : "",
      expected_delivery_date:
        order?.expected_delivery_date
          ? String(order.expected_delivery_date).slice(0, 10)
          : "",
      payment_terms: order?.payment_terms || "",
      notes: order?.notes || "",
    });

    setOrderFormError("");
    setOrderSuccessMessage("");
    setEditingOrder(true);
  };

  const handleCancelOrderEdit = () => {
    setEditingOrder(false);
    setOrderFormError("");
  };

  const handleSaveOrder = async (event) => {
    event.preventDefault();

    try {
      setSavingOrder(true);
      setOrderFormError("");
      setOrderSuccessMessage("");

      const response = await fetch(
        `${API_URL}/purchase-orders/${purchaseOrderId}`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            supplier_id: orderForm.supplier_id
              ? Number(orderForm.supplier_id)
              : null,
            order_date:
              orderForm.order_date || null,
            expected_delivery_date:
              orderForm.expected_delivery_date || null,
            payment_terms:
              orderForm.payment_terms || null,
            notes:
              orderForm.notes || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        let message =
          result.message ||
          "تعذر تحديث بيانات أمر الشراء.";

        if (result.errors) {
          const firstError = Object.values(result.errors)
            .flat()
            .find(Boolean);

          if (firstError) {
            message = firstError;
          }
        }

        throw new Error(message);
      }

      setOrder(result.data);

      setOrderForm({
        supplier_id: result.data?.supplier_id
          ? String(result.data.supplier_id)
          : "",
        order_date: result.data?.order_date
          ? String(result.data.order_date).slice(0, 10)
          : "",
        expected_delivery_date:
          result.data?.expected_delivery_date
            ? String(
                result.data.expected_delivery_date
              ).slice(0, 10)
            : "",
        payment_terms:
          result.data?.payment_terms || "",
        notes: result.data?.notes || "",
      });

      setEditingOrder(false);

      setOrderSuccessMessage(
        result.message ||
          "تم تحديث بيانات أمر الشراء بنجاح."
      );
    } catch (error) {
      console.error(error);

      setOrderFormError(
        error.message ||
          "حدث خطأ أثناء تحديث بيانات أمر الشراء."
      );
    } finally {
      setSavingOrder(false);
    }
  };

  const handleStartEdit = (item) => {
    setEditingItemId(item.id);

    setEditForm({
      quantity: Number(item.quantity || 1),
      unit_cost: Number(item.unit_cost || 0),
      discount: Number(item.discount || 0),
      tax_rate: Number(item.tax_rate || 0),
      description: item.description || "",
    });

    setItemError("");
    setSuccessMessage("");
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);

    setEditForm({
      quantity: 1,
      unit_cost: 0,
      discount: 0,
      tax_rate: 15,
      description: "",
    });

    setItemError("");
  };

  const handleUpdateItem = async (itemId) => {
    if (Number(editForm.quantity) <= 0) {
      setItemError("يجب أن تكون الكمية أكبر من صفر.");
      return;
    }

    try {
      setUpdatingItem(true);
      setItemError("");
      setSuccessMessage("");

      const response = await fetch(
        `${API_URL}/purchase-orders/${purchaseOrderId}/items/${itemId}`,
        {
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            quantity: Number(editForm.quantity),
            unit_cost: Number(editForm.unit_cost || 0),
            discount: Number(editForm.discount || 0),
            tax_rate: Number(editForm.tax_rate || 0),
            description: editForm.description || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        let message =
          result.message || "تعذر تعديل الصنف.";

        if (result.errors) {
          const firstError = Object.values(result.errors)
            .flat()
            .find(Boolean);

          if (firstError) {
            message = firstError;
          }
        }

        throw new Error(message);
      }

      if (result.data?.purchase_order) {
        setOrder(result.data.purchase_order);
      } else {
        await loadOrder();
      }

      setEditingItemId(null);

      setSuccessMessage(
        result.message || "تم تعديل الصنف بنجاح."
      );
    } catch (error) {
      console.error(error);

      setItemError(
        error.message ||
          "حدث خطأ أثناء تعديل الصنف."
      );
    } finally {
      setUpdatingItem(false);
    }
  };

  const handleDeleteItem = async (itemId) => {
    const confirmed = window.confirm(
      "هل تريد حذف هذا الصنف من أمر الشراء؟"
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingItemId(itemId);
      setItemError("");
      setSuccessMessage("");

      const response = await fetch(
        `${API_URL}/purchase-orders/${purchaseOrderId}/items/${itemId}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "تعذر حذف الصنف."
        );
      }

      if (result.data?.purchase_order) {
        setOrder(result.data.purchase_order);
      } else {
        await loadOrder();
      }

      setSuccessMessage(
        result.message || "تم حذف الصنف بنجاح."
      );
    } catch (error) {
      console.error(error);

      setItemError(
        error.message ||
          "حدث خطأ أثناء حذف الصنف."
      );
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleAddItem = async (event) => {
    event.preventDefault();

    if (!itemForm.product_id) {
      setItemError("اختر المنتج أولًا.");
      return;
    }

    if (Number(itemForm.quantity) <= 0) {
      setItemError(
        "يجب أن تكون الكمية أكبر من صفر."
      );
      return;
    }

    try {
      setSavingItem(true);
      setItemError("");
      setSuccessMessage("");

      const response = await fetch(
        `${API_URL}/purchase-orders/${purchaseOrderId}/items`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            product_id: Number(itemForm.product_id),
            quantity: Number(itemForm.quantity),
            unit_cost: Number(itemForm.unit_cost || 0),
            discount: Number(itemForm.discount || 0),
            tax_rate: Number(itemForm.tax_rate || 0),
            description:
              itemForm.description || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        let message =
          result.message ||
          "تعذر إضافة الصنف.";

        if (result.errors) {
          const firstError =
            Object.values(result.errors)
              .flat()
              .find(Boolean);

          if (firstError) {
            message = firstError;
          }
        }

        throw new Error(message);
      }

      if (result.data?.purchase_order) {
        setOrder(result.data.purchase_order);
      } else {
        await loadOrder();
      }

      setSuccessMessage(
        "تم إضافة الصنف إلى أمر الشراء بنجاح."
      );

      setItemForm({
        product_id: "",
        quantity: 1,
        unit_cost: 0,
        discount: 0,
        tax_rate: 15,
        description: "",
      });

      setShowItemForm(false);
    } catch (error) {
      console.error(error);

      setItemError(
        error.message ||
          "حدث خطأ أثناء إضافة الصنف."
      );
    } finally {
      setSavingItem(false);
    }
  };

  const canEditOrder = order?.status === "draft";
  const canSubmitForApproval = order?.status === "draft";
  const canApprove = order?.status === "pending";
  const canCancel = ["draft", "pending"].includes(order?.status);

  const runWorkflowAction = async ({
    action,
    method = "POST",
    confirmMessage,
    successFallback,
  }) => {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }

    try {
      setWorkflowAction(action);
      setError("");
      setItemError("");
      setSuccessMessage("");
      setOrderSuccessMessage("");

      const response = await fetch(
        `${API_URL}/purchase-orders/${purchaseOrderId}/${action}`,
        {
          method,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        let message = result.message || "تعذر تنفيذ العملية.";

        if (result.errors) {
          const firstError = Object.values(result.errors)
            .flat()
            .find(Boolean);

          if (firstError) message = firstError;
        }

        throw new Error(message);
      }

      const updatedOrder =
        result.data?.purchase_order ||
        (result.data?.id ? result.data : null);

      if (updatedOrder) {
        setOrder(updatedOrder);
      } else {
        await loadOrder();
      }

      setEditingOrder(false);
      setEditingItemId(null);
      setShowItemForm(false);

      setOrderSuccessMessage(
        result.message || successFallback
      );
    } catch (error) {
      console.error(error);
      setOrderFormError(
        error.message || "حدث خطأ أثناء تنفيذ العملية."
      );
    } finally {
      setWorkflowAction("");
    }
  };

  const handleSubmitForApproval = () =>
    runWorkflowAction({
      action: "submit-for-approval",
      confirmMessage:
        "هل تريد إرسال أمر الشراء للمراجعة؟ بعد الإرسال لن تتمكن من تعديل بياناته أو أصنافه.",
      successFallback: "تم إرسال أمر الشراء للمراجعة.",
    });

  const handleApproveOrder = () =>
    runWorkflowAction({
      action: "approve",
      confirmMessage: "هل تريد اعتماد أمر الشراء؟",
      successFallback: "تم اعتماد أمر الشراء بنجاح.",
    });

  const handleCancelPurchaseOrder = () =>
    runWorkflowAction({
      action: "cancel",
      confirmMessage:
        "هل أنت متأكد من إلغاء أمر الشراء؟",
      successFallback: "تم إلغاء أمر الشراء.",
    });

  if (loading) {
    return (
      <div className="purchase-order-page" dir="rtl">
        جاري تحميل أمر الشراء...
      </div>
    );
  }

  if (error) {
    return (
      <div className="purchase-order-page" dir="rtl">
        {error}
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="purchase-order-page" dir="rtl">
      <div className="purchase-order-header">
        <div>
          {onBack && (
            <button
              type="button"
              className="purchase-order-back"
              onClick={onBack}
            >
              <ArrowRight size={16} />
              الرجوع لأوامر الشراء
            </button>
          )}

          <span className="purchase-order-kicker">
            المشتريات
          </span>

          <h1>{order.po_number}</h1>
          <p>تفاصيل أمر الشراء</p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {canEditOrder && (
            <button
              type="button"
              onClick={
                editingOrder
                  ? handleCancelOrderEdit
                  : handleStartOrderEdit
              }
              className="purchase-order-back"
              style={{
                marginBottom: 0,
                height: "38px",
              }}
            >
              {editingOrder ? (
                <>
                  <X size={15} />
                  إلغاء التعديل
                </>
              ) : (
                <>
                  <Pencil size={15} />
                  تعديل أمر الشراء
                </>
              )}
            </button>
          )}

          {canSubmitForApproval && (
            <button
              type="button"
              className="po-open-button"
              style={{ minWidth: "145px", height: "38px" }}
              onClick={handleSubmitForApproval}
              disabled={Boolean(workflowAction)}
            >
              <Send size={16} />
              {workflowAction === "submit-for-approval"
                ? "جاري الإرسال..."
                : "إرسال للمراجعة"}
            </button>
          )}

          {canApprove && (
            <button
              type="button"
              className="po-open-button"
              style={{ minWidth: "125px", height: "38px" }}
              onClick={handleApproveOrder}
              disabled={Boolean(workflowAction)}
            >
              <CheckCircle2 size={16} />
              {workflowAction === "approve"
                ? "جاري الاعتماد..."
                : "اعتماد"}
            </button>
          )}

          {canCancel && (
            <button
              type="button"
              className="purchase-order-back"
              style={{
                marginBottom: 0,
                height: "38px",
                borderColor: "#fecaca",
                background: "#fff1f2",
                color: "#dc2626",
              }}
              onClick={handleCancelPurchaseOrder}
              disabled={Boolean(workflowAction)}
            >
              <Ban size={16} />
              {workflowAction === "cancel"
                ? "جاري الإلغاء..."
                : "إلغاء الأمر"}
            </button>
          )}

          <div className="purchase-order-status">
            {statusNames[order.status] || order.status}
          </div>
        </div>
      </div>

      <div className="purchase-order-info-grid">
        <div className="purchase-order-info-card">
          <ShoppingCart size={20} />
          <div>
            <span>رقم أمر الشراء</span>
            <strong>{order.po_number}</strong>
          </div>
        </div>

        <div className="purchase-order-info-card">
          <Building2 size={20} />
          <div>
            <span>المورد</span>
            <strong>
              {order.supplier?.name || "غير محدد"}
            </strong>
          </div>
        </div>

        <div className="purchase-order-info-card">
          <CalendarDays size={20} />
          <div>
            <span>تاريخ الطلب</span>
            <strong>
              {formatDate(order.order_date)}
            </strong>
          </div>
        </div>

        <div className="purchase-order-info-card">
          <CalendarDays size={20} />
          <div>
            <span>التوريد المتوقع</span>
            <strong>
              {formatDate(
                order.expected_delivery_date
              )}
            </strong>
          </div>
        </div>
      </div>

      {orderSuccessMessage && (
        <div
          style={{
            marginTop: "18px",
            marginBottom: "18px",
            padding: "12px 14px",
            borderRadius: "12px",
            background: "#ecfdf3",
            color: "#15803d",
            fontSize: "13px",
          }}
        >
          {orderSuccessMessage}
        </div>
      )}

      {editingOrder && canEditOrder && (
        <form
          onSubmit={handleSaveOrder}
          style={{
            marginTop: "18px",
            marginBottom: "18px",
            padding: "22px",
            border: "1px solid #e7e9f2",
            borderRadius: "16px",
            background: "#ffffff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
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
                تعديل بيانات أمر الشراء
              </h3>

              <span
                style={{
                  display: "block",
                  marginTop: "5px",
                  color: "#9aa0af",
                  fontSize: "12px",
                }}
              >
                المورد والتواريخ وشروط الدفع والملاحظات
              </span>
            </div>

            <Building2 size={20} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1.5fr 1fr 1fr",
              gap: "14px",
            }}
          >
            <label>
              <span
                style={{
                  display: "block",
                  marginBottom: "7px",
                  color: "#7c8394",
                  fontSize: "12px",
                }}
              >
                المورد
              </span>

              <select
                value={orderForm.supplier_id}
                onChange={(event) => {
                  const supplierId =
                    event.target.value;

                  const supplier =
                    suppliers.find(
                      (item) =>
                        String(item.id) ===
                        String(supplierId)
                    );

                  setOrderForm((current) => ({
                    ...current,
                    supplier_id: supplierId,
                    payment_terms:
                      supplier?.payment_terms ||
                      current.payment_terms,
                  }));
                }}
                disabled={suppliersLoading}
                style={{
                  width: "100%",
                  height: "44px",
                  border: "1px solid #dfe2ea",
                  borderRadius: "10px",
                  padding: "0 10px",
                  background: "#fff",
                  fontFamily: "inherit",
                }}
              >
                <option value="">
                  {suppliersLoading
                    ? "جاري تحميل الموردين..."
                    : "اختر المورد"}
                </option>

                {suppliers.map((supplier) => (
                  <option
                    key={supplier.id}
                    value={supplier.id}
                  >
                    {supplier.supplier_code
                      ? `${supplier.supplier_code} - `
                      : ""}
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  marginBottom: "7px",
                  color: "#7c8394",
                  fontSize: "12px",
                }}
              >
                تاريخ الطلب
              </span>

              <input
                type="date"
                value={orderForm.order_date}
                onChange={(event) =>
                  setOrderForm((current) => ({
                    ...current,
                    order_date:
                      event.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  height: "44px",
                  border: "1px solid #dfe2ea",
                  borderRadius: "10px",
                  padding: "0 10px",
                  fontFamily: "inherit",
                }}
              />
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  marginBottom: "7px",
                  color: "#7c8394",
                  fontSize: "12px",
                }}
              >
                التوريد المتوقع
              </span>

              <input
                type="date"
                value={
                  orderForm.expected_delivery_date
                }
                onChange={(event) =>
                  setOrderForm((current) => ({
                    ...current,
                    expected_delivery_date:
                      event.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  height: "44px",
                  border: "1px solid #dfe2ea",
                  borderRadius: "10px",
                  padding: "0 10px",
                  fontFamily: "inherit",
                }}
              />
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 2fr",
              gap: "14px",
              marginTop: "14px",
            }}
          >
            <label>
              <span
                style={{
                  display: "block",
                  marginBottom: "7px",
                  color: "#7c8394",
                  fontSize: "12px",
                }}
              >
                شروط الدفع
              </span>

              <input
                type="text"
                value={orderForm.payment_terms}
                onChange={(event) =>
                  setOrderForm((current) => ({
                    ...current,
                    payment_terms:
                      event.target.value,
                  }))
                }
                placeholder="مثال: 30 يوم"
                style={{
                  width: "100%",
                  height: "44px",
                  border: "1px solid #dfe2ea",
                  borderRadius: "10px",
                  padding: "0 10px",
                  fontFamily: "inherit",
                }}
              />
            </label>

            <label>
              <span
                style={{
                  display: "block",
                  marginBottom: "7px",
                  color: "#7c8394",
                  fontSize: "12px",
                }}
              >
                الملاحظات
              </span>

              <textarea
                value={orderForm.notes}
                onChange={(event) =>
                  setOrderForm((current) => ({
                    ...current,
                    notes:
                      event.target.value,
                  }))
                }
                placeholder="ملاحظات أمر الشراء..."
                rows={3}
                style={{
                  width: "100%",
                  minHeight: "82px",
                  border: "1px solid #dfe2ea",
                  borderRadius: "10px",
                  padding: "10px",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </label>
          </div>

          {orderFormError && (
            <div
              style={{
                marginTop: "12px",
                color: "#dc2626",
                fontSize: "12px",
              }}
            >
              {orderFormError}
            </div>
          )}

          <div
            style={{
              marginTop: "16px",
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
            }}
          >
            <button
              type="button"
              className="purchase-order-back"
              style={{
                marginBottom: 0,
              }}
              onClick={handleCancelOrderEdit}
            >
              <X size={15} />
              إلغاء
            </button>

            <button
              type="submit"
              className="po-open-button"
              style={{
                minWidth: "150px",
                height: "40px",
              }}
              disabled={savingOrder}
            >
              <Save size={16} />
              {savingOrder
                ? "جاري الحفظ..."
                : "حفظ التعديلات"}
            </button>
          </div>
        </form>
      )}

      <div className="purchase-order-summary">
        <div>
          <span>الإجمالي قبل الضريبة</span>
          <strong>
            {formatMoney(order.subtotal)}
          </strong>
        </div>

        <div>
          <span>الخصم</span>
          <strong>
            {formatMoney(order.discount)}
          </strong>
        </div>

        <div>
          <span>الضريبة</span>
          <strong>
            {formatMoney(order.tax)}
          </strong>
        </div>

        <div className="purchase-order-total">
          <span>الإجمالي</span>
          <strong>
            {formatMoney(order.total)}
          </strong>
        </div>
      </div>

      <div className="purchase-order-items-card">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "18px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Package size={20} />

            <div>
              <h3 style={{ margin: 0 }}>
                أصناف أمر الشراء
              </h3>

              <span
                style={{
                  color: "#9aa0af",
                  fontSize: "12px",
                }}
              >
                المنتجات والكميات والأسعار
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <button
              type="button"
              className="purchase-order-back"
              style={{ marginBottom: 0 }}
              onClick={loadOrder}
            >
              <RefreshCcw size={15} />
              تحديث
            </button>

            {canEditOrder && (
              <button
                type="button"
                className="po-open-button"
                style={{
                  minWidth: "120px",
                  height: "38px",
                }}
                onClick={() => {
                  setShowItemForm((value) => !value);
                  setItemError("");
                  setSuccessMessage("");
                }}
              >
                {showItemForm ? (
                  <>
                    <X size={16} />
                    إغلاق
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    إضافة صنف
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {showItemForm && canEditOrder && (
          <form
            onSubmit={handleAddItem}
            style={{
              marginBottom: "22px",
              padding: "18px",
              border: "1px solid #e7e9f2",
              borderRadius: "14px",
              background: "#fafbfe",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "2fr 0.8fr 1fr 0.8fr 0.8fr",
                gap: "12px",
                alignItems: "end",
              }}
            >
              <label>
                <span
                  style={{
                    display: "block",
                    marginBottom: "7px",
                    color: "#7c8394",
                    fontSize: "12px",
                  }}
                >
                  المنتج
                </span>

                <select
                  value={itemForm.product_id}
                  onChange={handleSelectProduct}
                  disabled={productsLoading}
                  style={{
                    width: "100%",
                    height: "42px",
                    border: "1px solid #dfe2ea",
                    borderRadius: "10px",
                    padding: "0 10px",
                    background: "#fff",
                    fontFamily: "inherit",
                  }}
                >
                  <option value="">
                    {productsLoading
                      ? "جاري تحميل المنتجات..."
                      : "اختر المنتج"}
                  </option>

                  {products.map((product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.sku
                        ? `${product.sku} - `
                        : ""}
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span
                  style={{
                    display: "block",
                    marginBottom: "7px",
                    color: "#7c8394",
                    fontSize: "12px",
                  }}
                >
                  الكمية
                </span>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={itemForm.quantity}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      quantity: event.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    height: "42px",
                    border: "1px solid #dfe2ea",
                    borderRadius: "10px",
                    padding: "0 10px",
                    fontFamily: "inherit",
                  }}
                />
              </label>

              <label>
                <span
                  style={{
                    display: "block",
                    marginBottom: "7px",
                    color: "#7c8394",
                    fontSize: "12px",
                  }}
                >
                  سعر الوحدة
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.unit_cost}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      unit_cost: event.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    height: "42px",
                    border: "1px solid #dfe2ea",
                    borderRadius: "10px",
                    padding: "0 10px",
                    fontFamily: "inherit",
                  }}
                />
              </label>

              <label>
                <span
                  style={{
                    display: "block",
                    marginBottom: "7px",
                    color: "#7c8394",
                    fontSize: "12px",
                  }}
                >
                  الخصم
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.discount}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      discount: event.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    height: "42px",
                    border: "1px solid #dfe2ea",
                    borderRadius: "10px",
                    padding: "0 10px",
                    fontFamily: "inherit",
                  }}
                />
              </label>

              <label>
                <span
                  style={{
                    display: "block",
                    marginBottom: "7px",
                    color: "#7c8394",
                    fontSize: "12px",
                  }}
                >
                  الضريبة %
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.tax_rate}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      tax_rate: event.target.value,
                    }))
                  }
                  style={{
                    width: "100%",
                    height: "42px",
                    border: "1px solid #dfe2ea",
                    borderRadius: "10px",
                    padding: "0 10px",
                    fontFamily: "inherit",
                  }}
                />
              </label>
            </div>

            {selectedProduct && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  background: "#f3f1ff",
                  color: "#6257ff",
                  fontSize: "12px",
                }}
              >
                {selectedProduct.name}
                {" • "}
                الوحدة: {selectedProduct.unit || "-"}
                {" • "}
                المخزون:{" "}
                {selectedProduct.stock_quantity || 0}
              </div>
            )}

            <div
              style={{
                marginTop: "14px",
                display: "grid",
                gridTemplateColumns:
                  "repeat(4, 1fr)",
                gap: "10px",
              }}
            >
              <div>
                <span>قبل الخصم</span>
                <strong>
                  {formatMoney(rawSubtotal)}
                </strong>
              </div>

              <div>
                <span>بعد الخصم</span>
                <strong>
                  {formatMoney(afterDiscount)}
                </strong>
              </div>

              <div>
                <span>الضريبة</span>
                <strong>
                  {formatMoney(itemTax)}
                </strong>
              </div>

              <div>
                <span>الإجمالي</span>
                <strong style={{ color: "#6257ff" }}>
                  {formatMoney(itemTotal)}
                </strong>
              </div>
            </div>

            {itemError && (
              <div
                style={{
                  marginTop: "12px",
                  color: "#dc2626",
                  fontSize: "12px",
                }}
              >
                {itemError}
              </div>
            )}

            <div
              style={{
                marginTop: "14px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "8px",
              }}
            >
              <button
                type="button"
                className="purchase-order-back"
                style={{ marginBottom: 0 }}
                onClick={() => {
                  resetItemForm();
                  setShowItemForm(false);
                }}
              >
                إلغاء
              </button>

              <button
                type="submit"
                className="po-open-button"
                style={{
                  minWidth: "120px",
                  height: "38px",
                }}
                disabled={savingItem}
              >
                <Plus size={16} />
                {savingItem
                  ? "جاري الإضافة..."
                  : "إضافة الصنف"}
              </button>
            </div>
          </form>
        )}

        {successMessage && (
          <div
            style={{
              marginBottom: "14px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "#ecfdf3",
              color: "#15803d",
              fontSize: "12px",
            }}
          >
            {successMessage}
          </div>
        )}

        {order.items?.length ? (
          <div>
            {order.items.map((item) => {
              const isEditing =
                editingItemId === item.id;

              const editSubtotal =
                Number(editForm.quantity || 0) *
                Number(editForm.unit_cost || 0);

              const editAfterDiscount = Math.max(
                editSubtotal -
                  Number(editForm.discount || 0),
                0
              );

              const editTax =
                editAfterDiscount *
                (Number(editForm.tax_rate || 0) / 100);

              const editTotal =
                editAfterDiscount + editTax;

              return (
                <div
                  key={item.id}
                  className="purchase-order-item-row"
                  style={{
                    alignItems: isEditing
                      ? "flex-end"
                      : "center",
                  }}
                >
                  <span>
                    {item.product?.name ||
                      item.product_name ||
                      "صنف"}
                  </span>

                  {isEditing ? (
                    <>
                      <label style={{ flex: 1 }}>
                        <small
                          style={{
                            display: "block",
                            color: "#9aa0af",
                            marginBottom: "5px",
                          }}
                        >
                          الكمية
                        </small>

                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={editForm.quantity}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              quantity:
                                event.target.value,
                            }))
                          }
                          style={{
                            width: "100%",
                            height: "38px",
                            border:
                              "1px solid #dfe2ea",
                            borderRadius: "9px",
                            padding: "0 9px",
                            fontFamily: "inherit",
                          }}
                        />
                      </label>

                      <label style={{ flex: 1 }}>
                        <small
                          style={{
                            display: "block",
                            color: "#9aa0af",
                            marginBottom: "5px",
                          }}
                        >
                          سعر الوحدة
                        </small>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.unit_cost}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              unit_cost:
                                event.target.value,
                            }))
                          }
                          style={{
                            width: "100%",
                            height: "38px",
                            border:
                              "1px solid #dfe2ea",
                            borderRadius: "9px",
                            padding: "0 9px",
                            fontFamily: "inherit",
                          }}
                        />
                      </label>

                      <label style={{ flex: 1 }}>
                        <small
                          style={{
                            display: "block",
                            color: "#9aa0af",
                            marginBottom: "5px",
                          }}
                        >
                          الخصم
                        </small>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.discount}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              discount:
                                event.target.value,
                            }))
                          }
                          style={{
                            width: "100%",
                            height: "38px",
                            border:
                              "1px solid #dfe2ea",
                            borderRadius: "9px",
                            padding: "0 9px",
                            fontFamily: "inherit",
                          }}
                        />
                      </label>

                      <label style={{ flex: 1 }}>
                        <small
                          style={{
                            display: "block",
                            color: "#9aa0af",
                            marginBottom: "5px",
                          }}
                        >
                          الضريبة %
                        </small>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.tax_rate}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              tax_rate:
                                event.target.value,
                            }))
                          }
                          style={{
                            width: "100%",
                            height: "38px",
                            border:
                              "1px solid #dfe2ea",
                            borderRadius: "9px",
                            padding: "0 9px",
                            fontFamily: "inherit",
                          }}
                        />
                      </label>

                      <div
                        style={{
                          minWidth: "120px",
                        }}
                      >
                        <small
                          style={{
                            display: "block",
                            color: "#9aa0af",
                            marginBottom: "5px",
                          }}
                        >
                          الإجمالي
                        </small>

                        <strong
                          style={{
                            color: "#6257ff",
                          }}
                        >
                          {formatMoney(editTotal)}
                        </strong>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateItem(item.id)
                        }
                        disabled={updatingItem}
                        title="حفظ التعديل"
                        style={{
                          width: "38px",
                          height: "38px",
                          border:
                            "1px solid #bbf7d0",
                          borderRadius: "9px",
                          background: "#ecfdf3",
                          color: "#15803d",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: updatingItem
                            ? "not-allowed"
                            : "pointer",
                        }}
                      >
                        <Save size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        title="إلغاء التعديل"
                        style={{
                          width: "38px",
                          height: "38px",
                          border:
                            "1px solid #e5e7eb",
                          borderRadius: "9px",
                          background: "#fff",
                          color: "#6b7280",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span>
                        الكمية: {item.quantity}
                      </span>

                      <span>
                        سعر الوحدة:{" "}
                        {formatMoney(
                          item.unit_cost
                        )}
                      </span>

                      <span>
                        الخصم:{" "}
                        {formatMoney(
                          item.discount
                        )}
                      </span>

                      <span>
                        الضريبة:{" "}
                        {Number(
                          item.tax_rate || 0
                        )}
                        %
                      </span>

                      <strong>
                        {formatMoney(
                          item.line_total
                        )}
                      </strong>

                      {canEditOrder && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleStartEdit(item)
                            }
                            title="تعديل الصنف"
                            style={{
                              width: "34px",
                              height: "34px",
                              border: "1px solid #ddd6fe",
                              borderRadius: "9px",
                              background: "#f5f3ff",
                              color: "#6257ff",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                            }}
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteItem(item.id)
                            }
                            disabled={
                              deletingItemId === item.id
                            }
                            title="حذف الصنف"
                            style={{
                              width: "34px",
                              height: "34px",
                              border: "1px solid #fecaca",
                              borderRadius: "9px",
                              background: "#fff1f2",
                              color: "#dc2626",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor:
                                deletingItemId === item.id
                                  ? "not-allowed"
                                  : "pointer",
                              opacity:
                                deletingItemId === item.id
                                  ? 0.6
                                  : 1,
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="purchase-order-empty">
            لا توجد أصناف مضافة حتى الآن.
          </div>
        )}
      </div>
    </div>
  );
}
