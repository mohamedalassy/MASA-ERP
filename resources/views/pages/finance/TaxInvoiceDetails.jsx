import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileCheck2,
  Loader2,
  MapPin,
  CircleDollarSign,
  Printer,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import "./tax-invoices.css";

const API = "http://127.0.0.1:8000/api";

const money = (value) =>
  new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const joinAddress = (parts = []) =>
  parts.filter((x) => String(x || "").trim()).join("، ") || "—";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date.toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const paymentMethodLabels = {
  bank_transfer: "تحويل بنكي", cash: "نقدي", card: "بطاقة",
  cheque: "شيك", other: "أخرى",
};

export default function TaxInvoiceDetails({
  onChangeView,
  taxInvoiceId,
  viewData,
}) {
  const id = taxInvoiceId || viewData?.taxInvoiceId;
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [refreshingBuyer, setRefreshingBuyer] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [receivableAccounts, setReceivableAccounts] = useState([]);
  const [paymentForm, setPaymentForm] = useState({
    deposit_account_id: "", receivable_account_id: "", amount: "",
    payment_method: "bank_transfer", payment_date: new Date().toISOString().slice(0, 10),
    reference_number: "", notes: "",
  });
  const [error, setError] = useState("");

  const load = async () => {
    if (!id) {
      setError("لم يتم تحديد الفاتورة.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [res, accountsRes] = await Promise.all([
        fetch(`${API}/finance/tax-invoices/${id}`, { headers: { Accept: "application/json" } }),
        fetch(`${API}/finance/tax-invoices/payment-accounts`, { headers: { Accept: "application/json" } }),
      ]);
      const [json, accountsJson] = await Promise.all([res.json(), accountsRes.json()]);
      if (!res.ok) throw new Error(json?.message || "تعذر تحميل الفاتورة");
      setInvoice(json.data);
      if (accountsRes.ok && accountsJson?.success) {
        const cash = accountsJson.data?.cash_accounts || [];
        const receivables = accountsJson.data?.receivable_accounts || [];
        setCashAccounts(cash);
        setReceivableAccounts(receivables);
        setPaymentForm((old) => ({
          ...old,
          deposit_account_id: old.deposit_account_id || String(cash[0]?.id || ""),
          receivable_account_id: old.receivable_account_id || String(receivables[0]?.id || ""),
        }));
      }
    } catch (e) {
      setError(e.message || "تعذر تحميل الفاتورة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const refreshBuyer = async () => {
    setRefreshingBuyer(true);
    setError("");

    try {
      const res = await fetch(
        `${API}/finance/tax-invoices/${id}/refresh-buyer`,
        {
          method: "POST",
          headers: { Accept: "application/json" },
        }
      );

      const json = await res.json();

      if (!res.ok) {
        const firstValidation =
          json?.errors && Object.values(json.errors).flat().find(Boolean);

        throw new Error(
          firstValidation ||
            json?.message ||
            "تعذر تحديث بيانات المشتري"
        );
      }

      setInvoice(json.data);
    } catch (e) {
      setError(e.message || "تعذر تحديث بيانات المشتري");
    } finally {
      setRefreshingBuyer(false);
    }
  };

  const issue = async () => {
    if (!window.confirm("تأكيد إصدار الفاتورة؟ بعد الإصدار لن يمكن تعديلها.")) return;

    setIssuing(true);
    setError("");

    try {
      const res = await fetch(`${API}/finance/tax-invoices/${id}/issue`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const json = await res.json();

      if (!res.ok) {
        const firstValidation =
          json?.errors && Object.values(json.errors).flat().find(Boolean);
        throw new Error(firstValidation || json?.message || "تعذر إصدار الفاتورة");
      }

      await load();
    } catch (e) {
      setError(e.message || "تعذر إصدار الفاتورة");
    } finally {
      setIssuing(false);
    }
  };

  const openPayment = () => {
    setError("");
    setPaymentForm((old) => ({
      ...old,
      amount: String(Number(invoice?.remaining_amount || 0)),
      payment_date: new Date().toISOString().slice(0, 10),
      reference_number: "",
      notes: "",
    }));
    setPaymentOpen(true);
  };

  const recordPayment = async (event) => {
    event.preventDefault();
    setSavingPayment(true);
    setError("");
    try {
      const res = await fetch(`${API}/finance/tax-invoices/${id}/payments`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          ...paymentForm,
          deposit_account_id: Number(paymentForm.deposit_account_id),
          receivable_account_id: Number(paymentForm.receivable_account_id),
          amount: Number(paymentForm.amount),
          reference_number: paymentForm.reference_number || null,
          notes: paymentForm.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        const firstValidation = json?.errors && Object.values(json.errors).flat().find(Boolean);
        throw new Error(firstValidation || json?.message || "تعذر تسجيل التحصيل");
      }
      setPaymentOpen(false);
      await load();
    } catch (e) {
      setError(e.message || "تعذر تسجيل التحصيل");
    } finally {
      setSavingPayment(false);
    }
  };

  const printReceipt = (payment) => {
    const receipt = window.open("", "_blank", "width=900,height=760");
    if (!receipt) return;
    const account = payment.finance_account;
    const journal = payment.journal_entry;
    receipt.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>سند قبض ${payment.payment_number}</title><style>@page{size:A4;margin:15mm}*{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#172033;margin:0}.sheet{border:1px solid #e4e7ef;padding:28px;min-height:260mm}.top{display:flex;justify-content:space-between;border-bottom:3px solid #6f52d9;padding-bottom:18px}.brand{color:#6f52d9;font-weight:900}.top h1{margin:5px 0}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:24px}.box{border:1px solid #e5e7ef;border-radius:12px;padding:14px}.box small{display:block;color:#81899a;margin-bottom:7px}.amount{margin:24px 0;padding:22px;text-align:center;border-radius:14px;background:#f1edff;color:#5c42c7;font-size:26px;font-weight:900}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:35px;margin-top:75px;text-align:center}.signatures span{border-top:1px solid #abb1bf;padding-top:10px}@media print{.sheet{border:0}}</style></head><body><main class="sheet"><header class="top"><div><div class="brand">MASA ERP</div><h1>سند قبض</h1><span>${invoice?.buyer_name || "—"}</span></div><div><b>${payment.payment_number}</b><br><small>${formatDate(payment.payment_date)}</small></div></header><section class="grid"><div class="box"><small>فاتورة العميل</small><b>${invoice?.invoice_number || "—"}</b></div><div class="box"><small>طريقة التحصيل</small><b>${paymentMethodLabels[payment.payment_method] || payment.payment_method || "—"}</b></div><div class="box"><small>حساب الإيداع</small><b>${account ? `${account.code} — ${account.name}` : "—"}</b></div><div class="box"><small>رقم المرجع</small><b>${payment.reference_number || "—"}</b></div><div class="box"><small>المشروع</small><b>${invoice?.project?.name || "—"}</b></div><div class="box"><small>القيد المحاسبي</small><b>${journal?.entry_number || "—"}</b></div></section><div class="amount">${money(payment.amount)}</div><div class="box"><small>ملاحظات</small><b>${payment.notes || "لا توجد ملاحظات"}</b></div><div class="signatures"><span>المحاسب</span><span>المستلم</span><span>الاعتماد</span></div></main><script>window.onload=()=>window.print();<\/script></body></html>`);
    receipt.document.close();
  };

  if (loading) {
    return (
      <div className="tax-state" dir="rtl">
        <Loader2 className="tax-spin" />
        جاري تحميل الفاتورة...
      </div>
    );
  }

  const seller = invoice?.company_tax_profile || invoice?.companyTaxProfile || {};

  const sellerAddress = joinAddress([
    seller.building_number,
    seller.street_name,
    seller.district,
    seller.city,
    seller.postal_code,
    seller.country_code,
  ]);

  const buyerAddress = joinAddress([
    invoice?.buyer_building_number,
    invoice?.buyer_street_name,
    invoice?.buyer_district,
    invoice?.buyer_city,
    invoice?.buyer_postal_code,
    invoice?.buyer_country_code,
  ]);

  return (
    <div className="tax-page" dir="rtl">
      <div className="tax-page-head">
        <div>
          <button
            className="tax-back"
            onClick={() => onChangeView?.("finance-tax-invoices")}
          >
            <ArrowRight size={17} />
            مركز الفواتير
          </button>

          <h1>{invoice?.invoice_number || "تفاصيل الفاتورة"}</h1>
          <p>
            تفاصيل المستند الضريبي وبيانات البائع والمشتري وحالة الإصدار.
          </p>
        </div>

        <div className="tax-head-actions">
          {invoice?.status === "draft" && (
            <>
            <button
              className="tax-secondary-btn"
              onClick={refreshBuyer}
              disabled={refreshingBuyer || issuing}
            >
              {refreshingBuyer ? (
                <Loader2 className="tax-spin" size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
              تحديث بيانات المشتري
            </button>

            <button
              className="tax-primary-btn"
              onClick={issue}
              disabled={issuing || refreshingBuyer}
            >
              {issuing ? (
                <Loader2 className="tax-spin" size={18} />
              ) : (
                <FileCheck2 size={18} />
              )}
              إصدار الفاتورة
            </button>
            </>
          )}
          {invoice?.status === "issued" && Number(invoice?.remaining_amount || 0) > 0 && (
            <button className="tax-primary-btn" onClick={openPayment}>
              <CircleDollarSign size={18} /> تسجيل تحصيل
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="tax-alert">
          <TriangleAlert size={18} />
          {error}
        </div>
      )}

      {invoice && (
        <>
          <div className="tax-kpis">
            <Info
              title="الحالة"
              value={invoice.status === "draft" ? "مسودة" : "صادرة"}
            />
            <Info
              title="نوع الفوترة"
              value={
                invoice.billing_type === "full"
                  ? "كاملة"
                  : invoice.billing_type === "progress"
                  ? "مرحلية"
                  : "جزئية"
              }
            />
            <Info title="الإجمالي" value={money(invoice.total)} />
            <Info
              title="المتبقي للتحصيل"
              value={money(invoice.remaining_amount)}
            />
            <Info title="حالة ZATCA" value={invoice.zatca_status} />
          </div>

          <section className="tax-card tax-document-card">
            <div className="tax-document-title">
              <div>
                <span className="tax-document-icon">
                  <ReceiptText size={21} />
                </span>
                <div>
                  <h3>بيانات المستند</h3>
                  <p>المعلومات المرجعية الخاصة بالفاتورة الحالية.</p>
                </div>
              </div>
            </div>

            <div className="tax-doc-grid">
              <DocItem label="رقم الفاتورة" value={invoice.invoice_number} />
              <DocItem label="UUID" value={invoice.uuid || "يُنشأ عند الإصدار"} ltr />
              <DocItem label="تاريخ الإصدار" value={formatDate(invoice.issue_date)} />
              <DocItem label="تاريخ التوريد" value={formatDate(invoice.supply_date)} />
              <DocItem label="العملة" value={invoice.currency || "SAR"} ltr />
              <DocItem
                label="عرض السعر"
                value={invoice.quotation?.quotation_number || "—"}
                ltr
              />
            </div>
          </section>

          <div className="tax-parties-grid">
            <PartyCard
              kind="seller"
              title="بيانات البائع"
              subtitle="المنشأة المصدرة للفاتورة"
              icon={Building2}
              name={seller.legal_name_ar || seller.legal_name_en || "—"}
              vat={seller.vat_number}
              cr={seller.commercial_register}
              branch={
                [seller.branch_name, seller.branch_code]
                  .filter(Boolean)
                  .join(" · ") || "—"
              }
              address={sellerAddress}
            />

            <PartyCard
              kind="buyer"
              title="بيانات المشتري"
              subtitle="العميل المستلم للفاتورة"
              icon={UserRound}
              name={invoice.buyer_name || "—"}
              vat={invoice.buyer_vat_number}
              cr={invoice.buyer_commercial_register}
              branch="—"
              address={buyerAddress}
            />
          </div>

          <div className="tax-detail-grid">
            <section className="tax-card">
              <h3>بيانات المشروع</h3>
              <dl className="tax-dl">
                <div>
                  <dt>المشروع</dt>
                  <dd>
                    {invoice.project?.name ||
                      invoice.project?.project_code ||
                      "—"}
                  </dd>
                </div>
                <div>
                  <dt>كود المشروع</dt>
                  <dd>{invoice.project?.project_code || "—"}</dd>
                </div>
                <div>
                  <dt>عرض السعر</dt>
                  <dd>{invoice.quotation?.quotation_number || "—"}</dd>
                </div>
                <div>
                  <dt>نوع المستند</dt>
                  <dd>
                    {invoice.document_type === "credit_note"
                      ? "إشعار دائن"
                      : invoice.document_type === "debit_note"
                      ? "إشعار مدين"
                      : "فاتورة"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="tax-card">
              <h3>ملخص مالي</h3>
              <dl className="tax-dl">
                <div>
                  <dt>قبل الضريبة</dt>
                  <dd>{money(invoice.taxable_amount)}</dd>
                </div>
                <div>
                  <dt>الخصم</dt>
                  <dd>{money(invoice.discount_total)}</dd>
                </div>
                <div>
                  <dt>الضريبة</dt>
                  <dd>{money(invoice.tax_total)}</dd>
                </div>
                <div className="tax-dl-total">
                  <dt>الإجمالي</dt>
                  <dd>{money(invoice.total)}</dd>
                </div>
              </dl>
            </section>
          </div>

          <section className="tax-card">
            <h3>بنود الفاتورة</h3>
            <div className="tax-table-wrap">
              <table className="tax-table">
                <thead>
                  <tr>
                    <th>البند</th>
                    <th>الكمية</th>
                    <th>سعر الوحدة</th>
                    <th>الخصم</th>
                    <th>الضريبة</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {(invoice.items || []).map((line) => (
                    <tr key={line.id}>
                      <td>
                        <strong>{line.description}</strong>
                        <small>{line.item_code || ""}</small>
                      </td>
                      <td>{line.quantity}</td>
                      <td>{money(line.unit_price)}</td>
                      <td>{money(line.discount_amount)}</td>
                      <td>{money(line.tax_amount)}</td>
                      <td>{money(line.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="tax-card tax-payment-history">
            <div className="tax-payment-history-head">
              <div><span>التحصيلات</span><h3>سجل سندات القبض</h3></div>
              <b>{invoice.payments?.length || 0} سند</b>
            </div>
            <div className="tax-table-wrap">
              <table className="tax-table">
                <thead><tr><th>رقم السند</th><th>التاريخ</th><th>الحساب</th><th>الطريقة</th><th>المرجع</th><th>المبلغ</th><th>القيد</th><th>طباعة</th></tr></thead>
                <tbody>{invoice.payments?.length ? invoice.payments.map((payment) => <tr key={payment.id}><td className="tax-number">{payment.payment_number}</td><td>{formatDate(payment.payment_date)}</td><td>{payment.finance_account ? `${payment.finance_account.code} — ${payment.finance_account.name}` : "—"}</td><td>{paymentMethodLabels[payment.payment_method] || payment.payment_method || "—"}</td><td>{payment.reference_number || "—"}</td><td><strong>{money(payment.amount)}</strong></td><td>{payment.journal_entry?.entry_number || "—"}</td><td><button className="tax-receipt-btn" onClick={() => printReceipt(payment)}><Printer size={14}/> طباعة</button></td></tr>) : <tr><td colSpan="8" className="tax-empty-cell">لم تُسجل تحصيلات على هذه الفاتورة بعد.</td></tr>}</tbody>
              </table>
            </div>
          </section>

          {invoice.status === "issued" && (
            <div className="tax-success">
              <CheckCircle2 />
              <div>
                <strong>تم إصدار الفاتورة</strong>
                <span>
                  أصبحت الفاتورة غير قابلة للتعديل وتم تجهيز سجل ZATCA للمرحلة التالية.
                </span>
              </div>
            </div>
          )}

          {paymentOpen && <div className="tax-payment-overlay" onMouseDown={(e) => e.target === e.currentTarget && setPaymentOpen(false)}><form className="tax-payment-modal" onSubmit={recordPayment}><header><div><span>الخزينة وذمم العملاء</span><h2>تسجيل تحصيل عميل</h2><p>{invoice.invoice_number} — {invoice.buyer_name}</p></div><button type="button" onClick={() => setPaymentOpen(false)}><X/></button></header><div className="tax-payment-summary"><span>إجمالي الفاتورة<b>{money(invoice.total)}</b></span><span>المحصّل<b>{money(invoice.paid_amount)}</b></span><span>المتبقي<b>{money(invoice.remaining_amount)}</b></span></div><div className="tax-payment-form"><label><span>حساب البنك أو الصندوق</span><select required value={paymentForm.deposit_account_id} onChange={(e) => setPaymentForm({...paymentForm,deposit_account_id:e.target.value})}><option value="">اختر الحساب...</option>{cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label><label><span>حساب ذمم العملاء</span><select required value={paymentForm.receivable_account_id} onChange={(e) => setPaymentForm({...paymentForm,receivable_account_id:e.target.value})}><option value="">اختر الحساب...</option>{receivableAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label><label><span>المبلغ</span><input required type="number" min="0.01" max={Number(invoice.remaining_amount)} step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({...paymentForm,amount:e.target.value})}/></label><label><span>تاريخ التحصيل</span><input required type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({...paymentForm,payment_date:e.target.value})}/></label><label><span>طريقة التحصيل</span><select value={paymentForm.payment_method} onChange={(e) => setPaymentForm({...paymentForm,payment_method:e.target.value})}><option value="bank_transfer">تحويل بنكي</option><option value="cash">نقدي</option><option value="card">بطاقة</option><option value="cheque">شيك</option><option value="other">أخرى</option></select></label><label><span>رقم المرجع</span><input value={paymentForm.reference_number} onChange={(e) => setPaymentForm({...paymentForm,reference_number:e.target.value})} placeholder="رقم التحويل أو الشيك"/></label><label className="wide"><span>ملاحظات</span><input value={paymentForm.notes} onChange={(e) => setPaymentForm({...paymentForm,notes:e.target.value})}/></label></div>{(!cashAccounts.length || !receivableAccounts.length) && <div className="tax-alert">يجب تفعيل حساب بنك/صندوق وحساب 1121 قابلين للترحيل.</div>}<footer><button type="button" className="ghost" onClick={() => setPaymentOpen(false)}>إلغاء</button><button type="submit" disabled={savingPayment || !cashAccounts.length || !receivableAccounts.length}>{savingPayment ? <Loader2 className="tax-spin" size={17}/> : <CircleDollarSign size={17}/>} {savingPayment ? "جاري التسجيل..." : "تسجيل التحصيل وإنشاء القيد"}</button></footer></form></div>}
        </>
      )}
    </div>
  );
}

function Info({ title, value }) {
  return (
    <div className="tax-kpi">
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function DocItem({ label, value, ltr = false }) {
  return (
    <div className="tax-doc-item">
      <span>{label}</span>
      <strong dir={ltr ? "ltr" : undefined}>{value || "—"}</strong>
    </div>
  );
}

function PartyCard({
  kind,
  title,
  subtitle,
  icon: Icon,
  name,
  vat,
  cr,
  branch,
  address,
}) {
  return (
    <section className={`tax-card tax-party-card ${kind}`}>
      <div className="tax-party-head">
        <span className="tax-party-icon">
          <Icon size={20} />
        </span>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </div>

      <div className="tax-party-name">{name || "—"}</div>

      <dl className="tax-dl">
        <div>
          <dt>الرقم الضريبي</dt>
          <dd dir="ltr">{vat || "—"}</dd>
        </div>
        <div>
          <dt>السجل التجاري</dt>
          <dd dir="ltr">{cr || "—"}</dd>
        </div>
        <div>
          <dt>الفرع</dt>
          <dd>{branch || "—"}</dd>
        </div>
        <div>
          <dt>العنوان</dt>
          <dd>{address || "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
