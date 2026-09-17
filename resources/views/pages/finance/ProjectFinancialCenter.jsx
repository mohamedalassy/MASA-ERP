import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Building2,
  CircleDollarSign,
  CreditCard,
  FileText,
  FolderKanban,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { money } from "./FinancePageShared";
import "./project-financial-center.css";

const API = "http://127.0.0.1:8000/api";

function ProjectFinancialCenter({
  projectId,
  onNavigate,
}) {
  const [project, setProject] = useState(null);
  const [billing, setBilling] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_method: "bank_transfer",
    payment_date: new Date().toISOString().slice(0, 10),
    reference_number: "",
    notes: "",
    deposit_account_id: "",
    receivable_account_id: "",
  });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [accounts, setAccounts] = useState([]);

  const load = async () => {
    if (!projectId) {
      setError("لم يتم تحديد المشروع.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [projectRes, billingRes, invoicesRes, accountsRes] = await Promise.all([
        fetch(`${API}/projects/${projectId}`, {
          headers: { Accept: "application/json" },
        }),
        fetch(`${API}/finance/projects/${projectId}/billing`, {
          headers: { Accept: "application/json" },
        }),
        fetch(`${API}/finance/tax-invoices?project_id=${projectId}`, {
          headers: { Accept: "application/json" },
        }),
        fetch(`${API}/finance/accounts?active=true`, {
          headers: { Accept: "application/json" },
        }),
      ]);

      const [projectJson, billingJson, invoicesJson, accountsJson] = await Promise.all([
        projectRes.json(),
        billingRes.json(),
        invoicesRes.json(),
        accountsRes.json(),
      ]);

      if (!projectRes.ok) {
        throw new Error(projectJson?.message || "تعذر تحميل بيانات المشروع.");
      }

      if (!billingRes.ok) {
        throw new Error(
          billingJson?.message || "تعذر تحميل بيانات فوترة المشروع."
        );
      }

      if (!invoicesRes.ok) {
        throw new Error(
          invoicesJson?.message || "تعذر تحميل فواتير المشروع."
        );
      }

      setProject(projectJson?.data || projectJson || null);
      setBilling(billingJson?.data || billingJson || null);

      const invoiceRows =
        invoicesJson?.data?.data ||
        invoicesJson?.data ||
        invoicesJson ||
        [];

      setInvoices(Array.isArray(invoiceRows) ? invoiceRows : []);

      const accountRows = accountsJson?.data || [];
      setAccounts(
        Array.isArray(accountRows)
          ? accountRows.filter(
              (account) => account.is_active && account.is_postable
            )
          : []
      );
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل المركز المالي.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const summary = billing?.billing || billing?.summary || billing || {};

  const financials = useMemo(() => {
    const issuedInvoices = invoices.filter(
      (invoice) =>
        invoice.status === "issued" &&
        (invoice.document_type || "invoice") === "invoice"
    );

    const issuedTotal = issuedInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total || 0),
      0
    );

    const paidTotal = issuedInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.paid_amount || 0),
      0
    );

    const remainingCollectTotal = issuedInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.remaining_amount || 0),
      0
    );

    const contract = Number(
      summary.contract_value ??
      summary.quotation_total ??
      billing?.active_quotation?.total ??
      billing?.quotation?.total ??
      0
    );

    // Issued invoices are the source of truth for current V1 billing/collection.
    // This intentionally overrides stale zero values returned by older summaries.
    const hasIssuedInvoices = issuedInvoices.length > 0;

    const invoiced = hasIssuedInvoices
      ? issuedTotal
      : Number(summary.invoiced ?? summary.net_invoiced ?? 0);

    const paid = hasIssuedInvoices
      ? paidTotal
      : Number(summary.paid ?? summary.paid_amount ?? 0);

    const remainingBilling =
      contract > 0
        ? Math.max(0, contract - invoiced)
        : Number(summary.remaining_to_invoice ?? 0);

    const remainingCollection = hasIssuedInvoices
      ? remainingCollectTotal
      : Number(summary.remaining_to_collect ?? 0);

    const billingRate = contract > 0 ? (invoiced / contract) * 100 : 0;
    const collectionRate = invoiced > 0 ? (paid / invoiced) * 100 : 0;

    return {
      contract,
      invoiced,
      remainingBilling,
      paid,
      remainingCollection,
      billingRate,
      collectionRate,
    };
  }, [summary, billing, invoices]);

  const quotation =
    billing?.active_quotation ||
    billing?.quotation ||
    billing?.approved_quotation ||
    project?.quotations?.find?.((q) => q.status === "approved") ||
    null;

  const purchaseOrders = project?.purchase_orders || project?.purchaseOrders || [];
  const financialTransactions =
    project?.financial_transactions ||
    project?.financialTransactions ||
    [];

  const totalPurchases = purchaseOrders.reduce(
    (sum, po) => sum + Number(po.total || 0),
    0
  );

  const actualExpenses = financialTransactions
    .filter(
      (tx) =>
        tx.direction === "out" ||
        tx.type === "expense" ||
        tx.type === "supplier_bill"
    )
    .reduce((sum, tx) => sum + Number(tx.total || tx.amount || 0), 0);

  const accountingCost = Math.max(totalPurchases, actualExpenses);
  const accountingProfit = financials.invoiced - accountingCost;
  const margin =
    financials.invoiced > 0
      ? (accountingProfit / financials.invoiced) * 100
      : 0;

  const openPayment = (invoice) => {
    if (invoice?.status !== "issued") return;
    const remaining = Number(invoice?.remaining_amount || 0);
    if (remaining <= 0) return;

    setPaymentInvoice(invoice);
    setPaymentError("");
    const assetAccounts = accounts.filter(
      (account) =>
        account.type === "asset" &&
        account.is_active &&
        account.is_postable
    );

    const findByWords = (words) =>
      assetAccounts.find((account) => {
        const haystack = `${account.code || ""} ${account.name || ""} ${account.name_en || ""}`.toLowerCase();
        return words.some((word) => haystack.includes(word));
      });

    const suggestedDeposit =
      findByWords(["bank", "بنك", "cash", "نقد", "صندوق"]) ||
      assetAccounts[0];

    const suggestedReceivable =
      findByWords(["receivable", "ذمم", "عملاء", "customer"]) ||
      assetAccounts.find((account) => account.id !== suggestedDeposit?.id);

    setPaymentForm({
      amount: String(remaining),
      payment_method: "bank_transfer",
      payment_date: new Date().toISOString().slice(0, 10),
      reference_number: "",
      notes: "",
      deposit_account_id: suggestedDeposit ? String(suggestedDeposit.id) : "",
      receivable_account_id: suggestedReceivable
        ? String(suggestedReceivable.id)
        : "",
    });
  };

  const closePayment = () => {
    if (paymentSaving) return;
    setPaymentInvoice(null);
    setPaymentError("");
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    if (!paymentInvoice) return;

    const amount = Number(paymentForm.amount || 0);
    const remaining = Number(paymentInvoice.remaining_amount || 0);

    if (amount <= 0) {
      setPaymentError("أدخل مبلغ تحصيل أكبر من صفر.");
      return;
    }
    if (amount > remaining) {
      setPaymentError(`المبلغ أكبر من المتبقي على الفاتورة (${money(remaining)} ر.س).`);
      return;
    }

    if (!paymentForm.deposit_account_id) {
      setPaymentError("اختر حساب البنك / الصندوق الذي استلم المبلغ.");
      return;
    }

    if (!paymentForm.receivable_account_id) {
      setPaymentError("اختر حساب الذمم المدينة.");
      return;
    }

    if (paymentForm.deposit_account_id === paymentForm.receivable_account_id) {
      setPaymentError("حساب الإيداع وحساب الذمم المدينة يجب أن يكونا مختلفين.");
      return;
    }

    setPaymentSaving(true);
    setPaymentError("");

    try {
      const res = await fetch(
        `${API}/finance/tax-invoices/${paymentInvoice.id}/payments`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount,
            payment_method: paymentForm.payment_method,
            payment_date: paymentForm.payment_date,
            reference_number: paymentForm.reference_number || null,
            notes: paymentForm.notes || null,
            deposit_account_id: Number(paymentForm.deposit_account_id),
            receivable_account_id: Number(paymentForm.receivable_account_id),
          }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        const validation =
          json?.errors && Object.values(json.errors).flat().filter(Boolean)[0];
        throw new Error(validation || json?.message || "تعذر تسجيل التحصيل.");
      }

      setPaymentInvoice(null);
      await load();
    } catch (err) {
      setPaymentError(err.message || "حدث خطأ أثناء تسجيل التحصيل.");
    } finally {
      setPaymentSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="pfc-state">
        <Loader2 className="pfc-spin" size={22} />
        جاري تحميل المركز المالي للمشروع...
      </div>
    );
  }

  if (error) {
    return (
      <div className="pfc-state error">
        <strong>تعذر فتح المركز المالي</strong>
        <span>{error}</span>
        <button type="button" onClick={load}>
          <RefreshCw size={16} />
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div className="pfc-page" dir="rtl">
      <div className="pfc-topline">
        <button
          className="pfc-back"
          type="button"
          onClick={() => onNavigate?.("finance-projects")}
        >
          <ArrowRight size={17} />
          محاسبة المشاريع
        </button>

        <div className="pfc-top-actions">
          <button
            className="pfc-secondary"
            type="button"
            onClick={() =>
              onNavigate?.("finance-tax-invoices", {
                projectId,
              })
            }
          >
            <ReceiptText size={16} />
            عرض الفواتير
          </button>

          <button
            className="pfc-primary"
            type="button"
            onClick={() =>
              onNavigate?.("finance-tax-create", {
                projectId,
                quotationId: quotation?.id || null,
              })
            }
          >
            <Plus size={16} />
            إنشاء فاتورة
          </button>
        </div>
      </div>

      <section className="pfc-hero">
        <div className="pfc-project-mark">
          <FolderKanban size={24} />
        </div>

        <div className="pfc-project-copy">
          <span>Project Financial Center</span>
          <h1>{project?.name || "المشروع"}</h1>
          <p>
            {project?.project_code || "-"} ·{" "}
            {project?.customer_name || "بدون عميل"}
          </p>
        </div>

        <div className="pfc-hero-status">
          <span
            className={`pfc-status ${
              summary.status ||
              summary.billing_status ||
              "not_invoiced"
            }`}
          >
            {summary.status_label ||
              summary.billing_status_label ||
              "غير مفوتر"}
          </span>
          <small>
            المرحلة الحالية: {project?.current_stage || project?.stage || "-"}
          </small>
        </div>
      </section>

      <div className="pfc-kpis">
        <Kpi
          icon={WalletCards}
          label="قيمة العقد المعتمد"
          value={`${money(financials.contract)} ر.س`}
          tone="purple"
        />
        <Kpi
          icon={ReceiptText}
          label="إجمالي المفوتر"
          value={`${money(financials.invoiced)} ر.س`}
          tone="green"
        />
        <Kpi
          icon={FileText}
          label="المتبقي للفوترة"
          value={`${money(financials.remainingBilling)} ر.س`}
          tone="orange"
        />
        <Kpi
          icon={CircleDollarSign}
          label="إجمالي المحصل"
          value={`${money(financials.paid)} ر.س`}
          tone="cyan"
        />
        <Kpi
          icon={Banknote}
          label="المتبقي للتحصيل"
          value={`${money(financials.remainingCollection)} ر.س`}
          tone="pink"
        />
        <Kpi
          icon={ShoppingCart}
          label="المشتريات / التكلفة"
          value={`${money(accountingCost)} ر.س`}
          tone="blue"
        />
      </div>

      <div className="pfc-main-grid">
        <section className="pfc-card pfc-span-7">
          <CardHead
            eyebrow="Billing & Collection"
            title="تقدم الفوترة والتحصيل"
            icon={TrendingUp}
          />

          <ProgressRow
            label="نسبة الفوترة"
            value={financials.billingRate}
            amount={`${money(financials.invoiced)} / ${money(
              financials.contract
            )} ر.س`}
          />

          <ProgressRow
            label="نسبة التحصيل"
            value={financials.collectionRate}
            amount={`${money(financials.paid)} / ${money(
              financials.invoiced
            )} ر.س`}
          />

          <div className="pfc-progress-stats">
            <Metric
              label="عدد الفواتير"
              value={summary.invoice_count || 0}
            />
            <Metric
              label="عدد المسودات"
              value={summary.draft_count || 0}
            />
            <Metric
              label="المتبقي للفوترة"
              value={`${money(financials.remainingBilling)} ر.س`}
            />
          </div>
        </section>

        <section className="pfc-card pfc-span-5">
          <CardHead
            eyebrow="Approved Contract"
            title="العقد / العرض المعتمد"
            icon={FileText}
          />

          <InfoRow
            label="رقم العرض"
            value={quotation?.quotation_number || "-"}
          />
          <InfoRow
            label="الحالة"
            value={quotation?.status || "approved"}
          />
          <InfoRow
            label="قيمة العرض"
            value={`${money(
              quotation?.total || financials.contract
            )} ر.س`}
          />
          <InfoRow
            label="تاريخ الصلاحية"
            value={formatDate(quotation?.valid_until)}
          />
        </section>
      </div>

      <div className="pfc-main-grid">
        <section className="pfc-card pfc-span-8">
          <CardHead
            eyebrow="Tax Invoices"
            title="فواتير المشروع"
            icon={ReceiptText}
          />

          <div className="pfc-table-wrap">
            <table className="pfc-table">
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>النوع</th>
                  <th>الإجمالي</th>
                  <th>المحصل</th>
                  <th>المتبقي</th>
                  <th>الحالة</th>
                  <th>ZATCA</th>
                  <th>التحصيل</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="9">
                      <div className="pfc-empty">
                        لا توجد فواتير للمشروع حتى الآن.
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoices.slice(0, 8).map((invoice) => (
                    <tr key={invoice.id}>
                      <td>
                        <strong>{invoice.invoice_number}</strong>
                      </td>
                      <td>{invoice.document_type || "invoice"}</td>
                      <td>{money(invoice.total)} ر.س</td>
                      <td>{money(invoice.paid_amount)} ر.س</td>
                      <td>{money(invoice.remaining_amount)} ر.س</td>
                      <td>
                        <span
                          className={`pfc-invoice-badge ${
                            invoice.status || "draft"
                          }`}
                        >
                          {invoice.status === "issued"
                            ? "صادرة"
                            : "مسودة"}
                        </span>
                      </td>
                      <td>{invoice.zatca_status || "not_submitted"}</td>
                      <td>
                        {invoice.status === "issued" &&
                        Number(invoice.remaining_amount || 0) > 0 ? (
                          <button
                            className="pfc-payment-btn"
                            type="button"
                            onClick={() => openPayment(invoice)}
                          >
                            <CreditCard size={15} />
                            تسجيل تحصيل
                          </button>
                        ) : invoice.status !== "issued" ? (
                          <span className="pfc-payment-muted">بعد الإصدار</span>
                        ) : (
                          <span className="pfc-payment-done">مكتملة</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="pfc-link-btn"
                          type="button"
                          onClick={() =>
                            onNavigate?.("finance-tax-details", {
                              taxInvoiceId: invoice.id,
                            })
                          }
                        >
                          فتح
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="pfc-card pfc-span-4">
          <CardHead
            eyebrow="Profitability"
            title="الربحية الفعلية"
            icon={TrendingUp}
          />

          <div className="pfc-profit">
            <Metric
              label="الإيراد المحاسبي"
              value={`${money(financials.invoiced)} ر.س`}
            />
            <Metric
              label="التكلفة الفعلية"
              value={`${money(accountingCost)} ر.س`}
            />
            <Metric
              label="الربح الحالي"
              value={`${money(accountingProfit)} ر.س`}
              tone={accountingProfit >= 0 ? "positive" : "negative"}
            />
            <Metric
              label="هامش الربح"
              value={`${Math.round(margin * 100) / 100}%`}
              tone={margin >= 0 ? "positive" : "negative"}
            />
          </div>

          <div className="pfc-note">
            قيمة العقد لا تُعتبر إيرادًا محاسبيًا حتى إصدار الفاتورة.
          </div>
        </section>
      </div>

      <div className="pfc-main-grid">
        <section className="pfc-card pfc-span-6">
          <CardHead
            eyebrow="Purchasing"
            title="المشتريات والتكاليف"
            icon={ShoppingCart}
          />

          <div className="pfc-list">
            <Metric
              label="أوامر الشراء"
              value={purchaseOrders.length}
            />
            <Metric
              label="إجمالي أوامر الشراء"
              value={`${money(totalPurchases)} ر.س`}
            />
            <Metric
              label="حركات مالية مسجلة"
              value={financialTransactions.length}
            />
          </div>
        </section>

        <section className="pfc-card pfc-span-6">
          <CardHead
            eyebrow="Project Actions"
            title="إجراءات المشروع المالية"
            icon={Building2}
          />

          <div className="pfc-action-grid">
            <ActionButton
              label="إنشاء فاتورة جزئية"
              icon={Plus}
              onClick={() =>
                onNavigate?.("finance-tax-create", {
                  projectId,
                  quotationId: quotation?.id || null,
                })
              }
            />
            <ActionButton
              label="عرض كل الفواتير"
              icon={ReceiptText}
              onClick={() =>
                onNavigate?.("finance-tax-invoices", {
                  projectId,
                })
              }
            />
            <ActionButton
              label="فتح المشروع"
              icon={FolderKanban}
              onClick={() =>
                onNavigate?.("project", {
                  projectId,
                })
              }
            />
            <ActionButton
              label="تحديث البيانات"
              icon={RefreshCw}
              onClick={load}
            />
          </div>
        </section>
      </div>

      {paymentInvoice && (
        <div className="pfc-payment-overlay" onMouseDown={closePayment}>
          <div
            className="pfc-payment-modal"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="pfc-payment-head">
              <div>
                <span>Collection</span>
                <h3>تسجيل تحصيل</h3>
                <p>
                  الفاتورة {paymentInvoice.invoice_number} · المتبقي{" "}
                  {money(paymentInvoice.remaining_amount)} ر.س
                </p>
              </div>
              <button type="button" onClick={closePayment} disabled={paymentSaving}>
                ×
              </button>
            </div>

            <form className="pfc-payment-form" onSubmit={submitPayment}>
              <label>
                <span>مبلغ التحصيل</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={Number(paymentInvoice.remaining_amount || 0)}
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm((old) => ({ ...old, amount: e.target.value }))
                  }
                  required
                />
              </label>

              <label>
                <span>طريقة الدفع</span>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) =>
                    setPaymentForm((old) => ({
                      ...old,
                      payment_method: e.target.value,
                    }))
                  }
                >
                  <option value="bank_transfer">تحويل بنكي</option>
                  <option value="cash">نقدي</option>
                  <option value="card">بطاقة</option>
                  <option value="cheque">شيك</option>
                  <option value="other">أخرى</option>
                </select>
              </label>

              <label>
                <span>حساب البنك / الصندوق (مدين)</span>
                <select
                  value={paymentForm.deposit_account_id}
                  onChange={(e) =>
                    setPaymentForm((old) => ({
                      ...old,
                      deposit_account_id: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">اختر الحساب...</option>
                  {accounts
                    .filter((account) => account.type === "asset")
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} — {account.name}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <span>حساب الذمم المدينة (دائن)</span>
                <select
                  value={paymentForm.receivable_account_id}
                  onChange={(e) =>
                    setPaymentForm((old) => ({
                      ...old,
                      receivable_account_id: e.target.value,
                    }))
                  }
                  required
                >
                  <option value="">اختر الحساب...</option>
                  {accounts
                    .filter((account) => account.type === "asset")
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.code} — {account.name}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                <span>تاريخ التحصيل</span>
                <input
                  type="date"
                  value={paymentForm.payment_date}
                  onChange={(e) =>
                    setPaymentForm((old) => ({
                      ...old,
                      payment_date: e.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label>
                <span>رقم المرجع</span>
                <input
                  type="text"
                  placeholder="رقم التحويل / الشيك..."
                  value={paymentForm.reference_number}
                  onChange={(e) =>
                    setPaymentForm((old) => ({
                      ...old,
                      reference_number: e.target.value,
                    }))
                  }
                />
              </label>

              <label className="pfc-payment-full">
                <span>ملاحظات</span>
                <textarea
                  rows="3"
                  placeholder="ملاحظات اختيارية..."
                  value={paymentForm.notes}
                  onChange={(e) =>
                    setPaymentForm((old) => ({ ...old, notes: e.target.value }))
                  }
                />
              </label>

              {paymentError && (
                <div className="pfc-payment-error">{paymentError}</div>
              )}

              <div className="pfc-payment-actions">
                <button
                  className="pfc-secondary"
                  type="button"
                  onClick={closePayment}
                  disabled={paymentSaving}
                >
                  إلغاء
                </button>
                <button
                  className="pfc-primary"
                  type="submit"
                  disabled={paymentSaving}
                >
                  {paymentSaving ? (
                    <Loader2 className="pfc-spin" size={16} />
                  ) : (
                    <CreditCard size={16} />
                  )}
                  {paymentSaving ? "جاري التسجيل..." : "تسجيل التحصيل"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }) {
  return (
    <article className={`pfc-kpi ${tone}`}>
      <span>
        <Icon size={19} />
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function CardHead({ eyebrow, title, icon: Icon }) {
  return (
    <div className="pfc-card-head">
      <div>
        <span>{eyebrow}</span>
        <h3>{title}</h3>
      </div>
      <Icon size={19} />
    </div>
  );
}

function ProgressRow({ label, value, amount }) {
  const safe = Math.max(0, Math.min(100, Number(value || 0)));

  return (
    <div className="pfc-progress-row">
      <div>
        <span>{label}</span>
        <strong>{Math.round(safe)}%</strong>
      </div>
      <div className="pfc-track">
        <span style={{ width: `${safe}%` }} />
      </div>
      <small>{amount}</small>
    </div>
  );
}

function Metric({ label, value, tone = "" }) {
  return (
    <div className={`pfc-metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="pfc-info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionButton({ label, icon: Icon, onClick }) {
  return (
    <button className="pfc-action-btn" type="button" onClick={onClick}>
      <span>
        <Icon size={18} />
      </span>
      {label}
    </button>
  );
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default ProjectFinancialCenter;
