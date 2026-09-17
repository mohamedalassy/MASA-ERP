import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, ClipboardCheck, FileDown, FilePlus2, FileWarning, Printer,
  RefreshCw, Search, Send, ShieldCheck, Sparkles, Truck, X,
} from "lucide-react";
import "../../styles/financial-reports.css";
import "../../styles/supplier-invoices.css";

const API_BASE = "http://127.0.0.1:8000/api";
const money = (value) => Number(value || 0).toLocaleString("ar-SA", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const dateValue = () => new Date().toISOString().slice(0, 10);
const formatDate = (value) => {
  if (!value) return "غير محدد";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" });
};
const paymentMethodLabels = {
  bank_transfer: "تحويل بنكي", cash: "نقدي", cheque: "شيك", card: "بطاقة",
};
const statusLabels = {
  draft: "مسودة", pending: "قيد المراجعة", approved: "معتمدة",
  posted: "مرحلة", partially_paid: "مدفوعة جزئيًا", paid: "مدفوعة",
  rejected: "مرفوضة", cancelled: "ملغاة",
};
const matchLabels = {
  pending: "لم تُطابق", matched: "مطابقة", variance: "بها فروق", blocked: "محظورة",
};

function Badge({ value, type = "status" }) {
  const positive = value === "matched" || value === "approved" || value === "posted" || value === "paid";
  const danger = value === "variance" || value === "blocked" || value === "rejected";
  return <span className={`sinv-badge ${positive ? "success" : danger ? "danger" : "pending"}`}>
    {type === "match" ? matchLabels[value] || value : statusLabels[value] || value}
  </span>;
}

function SupplierInvoices() {
  const [invoices, setInvoices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    finance_account_id: "", amount: "", payment_date: dateValue(),
    payment_method: "bank_transfer", reference_number: "", notes: "",
  });
  const [form, setForm] = useState({
    purchase_order_id: "", supplier_invoice_number: "",
    invoice_date: dateValue(), due_date: "", notes: "", items: [],
  });

  const load = async () => {
    try {
      setLoading(true); setError("");
      const [invoiceResponse, orderResponse, accountResponse] = await Promise.all([
        fetch(`${API_BASE}/finance/supplier-invoices`),
        fetch(`${API_BASE}/finance/supplier-invoices/purchase-orders`),
        fetch(`${API_BASE}/finance/supplier-invoices/cash-accounts`),
      ]);
      const [invoiceResult, orderResult, accountResult] = await Promise.all([
        invoiceResponse.json(), orderResponse.json(), accountResponse.json(),
      ]);
      if (!invoiceResponse.ok || !invoiceResult.success) throw new Error(invoiceResult.message || "تعذر تحميل الفواتير.");
      if (!orderResponse.ok || !orderResult.success) throw new Error(orderResult.message || "تعذر تحميل أوامر الشراء.");
      setInvoices(invoiceResult.data || []);
      setOrders(orderResult.data || []);
      setCashAccounts(
        accountResponse.ok && accountResult.success
          ? accountResult.data || []
          : []
      );
    } catch (err) { setError(err.message || "تعذر تحميل شاشة فواتير الموردين."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const selectedOrder = orders.find((order) => String(order.id) === String(form.purchase_order_id));
  const totals = useMemo(() => form.items.reduce((sum, item) => {
    const gross = Number(item.quantity || 0) * Number(item.unit_cost || 0);
    const discount = Number(item.discount || 0);
    const taxable = Math.max(0, gross - discount);
    const tax = taxable * (Number(item.tax_rate || 0) / 100);
    return { subtotal: sum.subtotal + gross, discount: sum.discount + discount, tax: sum.tax + tax, total: sum.total + taxable + tax };
  }, { subtotal: 0, discount: 0, tax: 0, total: 0 }), [form.items]);

  const visibleInvoices = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter((row) => [row.invoice_number, row.supplier_invoice_number, row.purchase_order?.po_number, row.supplier?.name]
      .some((value) => String(value || "").toLowerCase().includes(term)));
  }, [invoices, search]);

  const chooseOrder = (id) => {
    const order = orders.find((row) => String(row.id) === String(id));
    setForm((current) => ({
      ...current,
      purchase_order_id: id,
      due_date: "",
      items: (order?.items || []).filter((item) => Number(item.available_to_invoice) > 0).map((item) => ({
        purchase_order_item_id: item.id,
        product_name: item.product_name,
        sku: item.sku,
        received_quantity: Number(item.received_quantity || 0),
        available_to_invoice: Number(item.available_to_invoice || 0),
        ordered_unit_cost: Number(item.unit_cost || 0),
        quantity: Number(item.available_to_invoice || 0),
        unit_cost: Number(item.unit_cost || 0),
        discount: 0,
        tax_rate: Number(item.tax_rate || 0),
      })),
    }));
  };

  const updateItem = (index, key, value) => setForm((current) => ({
    ...current,
    items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
  }));

  const createInvoice = async (event) => {
    event.preventDefault();
    try {
      setSaving(true); setError(""); setNotice("");
      const response = await fetch(`${API_BASE}/finance/supplier-invoices`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          purchase_order_id: Number(form.purchase_order_id),
          supplier_invoice_number: form.supplier_invoice_number,
          invoice_date: form.invoice_date, due_date: form.due_date || null,
          notes: form.notes || null,
          items: form.items.map((item) => ({
            purchase_order_item_id: item.purchase_order_item_id,
            quantity: Number(item.quantity), unit_cost: Number(item.unit_cost),
            discount: Number(item.discount || 0), tax_rate: Number(item.tax_rate || 0),
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        const validation = result.errors ? Object.values(result.errors).flat().join(" ") : "";
        throw new Error(validation || result.message || "تعذر إنشاء فاتورة المورد.");
      }
      setNotice(result.data?.match_status === "matched" ? "تم إنشاء الفاتورة والمطابقة بدون فروق." : "تم إنشاء الفاتورة، لكن توجد فروق تحتاج مراجعة.");
      setOpen(false); setForm({ purchase_order_id: "", supplier_invoice_number: "", invoice_date: dateValue(), due_date: "", notes: "", items: [] });
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const runAction = async (invoice, action) => {
    if (action === "rematch" && !["draft", "pending"].includes(invoice.status)) {
      setError("");
      setNotice("الفاتورة معتمدة والمطابقة مكتملة بالفعل.");
      return;
    }

    try {
      setError(""); setNotice("");
      const response = await fetch(`${API_BASE}/finance/supplier-invoices/${invoice.id}/${action}`, {
        method: "POST", headers: { Accept: "application/json" },
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "تعذر تنفيذ الإجراء.");
      setNotice(result.message); await load();
    } catch (err) { setError(err.message); }
  };

  const openPayment = (invoice) => {
    setError(""); setNotice(""); setPaymentInvoice(invoice);
    setPaymentForm({ finance_account_id: "", amount: String(Number(invoice.remaining_amount || 0)), payment_date: dateValue(), payment_method: "bank_transfer", reference_number: "", notes: "" });
  };

  const openDetails = async (invoice) => {
    try {
      setLoadingDetails(true); setError(""); setNotice("");
      const response = await fetch(`${API_BASE}/finance/supplier-invoices/${invoice.id}`, {
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "تعذر تحميل تفاصيل الفاتورة.");
      setDetailInvoice(result.data);
    } catch (err) { setError(err.message || "تعذر تحميل تفاصيل الفاتورة."); }
    finally { setLoadingDetails(false); }
  };

  const printPayment = (payment, invoice = detailInvoice) => {
    const account = payment.finance_account;
    const journal = payment.journal_entry;
    const receipt = window.open("", "_blank", "width=900,height=760");
    if (!receipt) return;
    receipt.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>سند صرف ${payment.payment_number}</title><style>body{font-family:Arial,sans-serif;color:#172033;margin:40px}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #6d5dfc;padding-bottom:18px;margin-bottom:25px}h1{margin:0 0 8px;font-size:25px}.brand{color:#6d5dfc;font-weight:900}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}.box{border:1px solid #e3e6ef;border-radius:12px;padding:14px}.box small{display:block;color:#7d879a;margin-bottom:7px}.amount{margin:25px 0;padding:20px;border-radius:14px;background:#f2efff;text-align:center;font-size:25px;font-weight:900;color:#5d4df0}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;margin-top:70px;text-align:center}.signatures span{display:block;border-top:1px solid #aab1bf;padding-top:10px}@media print{body{margin:20px}}</style></head><body><header><div><div class="brand">MASA ERP</div><h1>سند صرف دفعة مورد</h1><div>${invoice?.supplier?.name || "—"}</div></div><div><b>${payment.payment_number}</b><br><small>${formatDate(payment.payment_date)}</small></div></header><div class="grid"><div class="box"><small>فاتورة المورد</small><b>${invoice?.invoice_number || "—"}</b></div><div class="box"><small>رقم فاتورة المورد</small><b>${invoice?.supplier_invoice_number || "—"}</b></div><div class="box"><small>طريقة الدفع</small><b>${paymentMethodLabels[payment.payment_method] || payment.payment_method || "—"}</b></div><div class="box"><small>حساب الصرف</small><b>${account ? `${account.code} — ${account.name}` : "—"}</b></div><div class="box"><small>رقم المرجع</small><b>${payment.reference_number || "—"}</b></div><div class="box"><small>القيد المحاسبي</small><b>${journal?.entry_number || "—"}</b></div></div><div class="amount">${money(payment.amount)} ر.س</div><div class="box"><small>ملاحظات</small><b>${payment.notes || "لا توجد ملاحظات"}</b></div><div class="signatures"><span>المحاسب</span><span>المستلم</span><span>الاعتماد</span></div><script>window.onload=()=>window.print();<\/script></body></html>`);
    receipt.document.close();
  };

  const recordPayment = async (event) => {
    event.preventDefault();
    try {
      setSavingPayment(true); setError(""); setNotice("");
      const response = await fetch(`${API_BASE}/finance/supplier-invoices/${paymentInvoice.id}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...paymentForm, finance_account_id: Number(paymentForm.finance_account_id), amount: Number(paymentForm.amount), reference_number: paymentForm.reference_number || null, notes: paymentForm.notes || null }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        const validation = result.errors ? Object.values(result.errors).flat().join(" ") : "";
        throw new Error(validation || result.message || "تعذر تسجيل الدفعة.");
      }
      setPaymentInvoice(null); setNotice(result.message || "تم تسجيل الدفعة وإنشاء القيد المحاسبي."); await load();
    } catch (err) { setError(err.message); }
    finally { setSavingPayment(false); }
  };

  const summary = useMemo(() => ({
    total: invoices.reduce((sum, row) => sum + Number(row.remaining_amount || 0), 0),
    matched: invoices.filter((row) => row.match_status === "matched").length,
    variance: invoices.filter((row) => ["variance", "blocked"].includes(row.match_status)).length,
    pending: invoices.filter((row) => row.status === "pending").length,
  }), [invoices]);

  return <div className="fin-report-page sinv-page" dir="rtl">
    <section className="fin-report-hero"><div><span className="fin-report-kicker"><Sparkles size={15}/> المشتريات والمحاسبة</span><h1>فواتير الموردين والمطابقة الثلاثية</h1><p>مطابقة أمر الشراء والاستلام وفاتورة المورد قبل الاعتماد والترحيل.</p></div><div className="fin-report-actions"><button className="ghost" onClick={() => window.print()}><Printer size={17}/> طباعة</button><button className="ghost" onClick={() => window.print()}><FileDown size={17}/> PDF</button><button className="ghost" onClick={load}><RefreshCw size={17} className={loading ? "spin" : ""}/> تحديث</button><button className="primary" onClick={() => setOpen(true)}><FilePlus2 size={17}/> فاتورة مورد جديدة</button></div></section>
    <section className="fin-kpi-grid">
      <article className="fin-kpi-card expense"><span className="fin-kpi-icon"><Truck size={22}/></span><div><small>إجمالي المتبقي</small><strong>{money(summary.total)} <em>ر.س</em></strong></div></article>
      <article className="fin-kpi-card profit"><span className="fin-kpi-icon"><CheckCircle2 size={22}/></span><div><small>مطابقة بدون فروق</small><strong>{summary.matched}</strong></div></article>
      <article className="fin-kpi-card revenue"><span className="fin-kpi-icon"><FileWarning size={22}/></span><div><small>تحتاج معالجة</small><strong>{summary.variance}</strong></div></article>
      <article className="fin-kpi-card margin"><span className="fin-kpi-icon"><ClipboardCheck size={22}/></span><div><small>تنتظر الاعتماد</small><strong>{summary.pending}</strong></div></article>
    </section>
    {error && <div className="fin-report-error">{error}</div>}{notice && <div className="sinv-notice">{notice}</div>}
    <section className="fin-filter-bar"><div className="fin-date-field" style={{ flex: 1 }}><span><Search size={16}/> بحث في الفواتير والموردين</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="رقم الفاتورة، أمر الشراء، اسم المورد..."/></div><small>{visibleInvoices.length} فاتورة</small></section>
    <section className="fin-table-card"><div className="fin-card-head compact"><div><span>سجل الالتزامات</span><h2>فواتير الموردين</h2></div><ShieldCheck size={20}/></div><div className="fin-table-wrap"><table><thead><tr><th>رقم النظام</th><th>فاتورة المورد</th><th>المورد</th><th>أمر الشراء</th><th>الاستحقاق</th><th>الإجمالي</th><th>المتبقي</th><th>المطابقة</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>{visibleInvoices.length ? visibleInvoices.map((row) => <tr key={row.id}><td><b>{row.invoice_number}</b></td><td>{row.supplier_invoice_number}</td><td>{row.supplier?.name || "—"}</td><td>{row.purchase_order?.po_number || "—"}</td><td>{formatDate(row.due_date)}</td><td>{money(row.total)}</td><td className="orange"><b>{money(row.remaining_amount)}</b></td><td><Badge value={row.match_status} type="match"/></td><td><Badge value={row.status}/></td><td><div className="sinv-row-actions"><button onClick={() => openDetails(row)} disabled={loadingDetails}>التفاصيل</button>{["draft", "pending"].includes(row.status) && <button onClick={() => runAction(row, "rematch")}>مطابقة</button>}{row.status === "draft" && <button className="primary" onClick={() => runAction(row, "submit")}><Send size={13}/> إرسال</button>}{row.status === "pending" && <button className="success" onClick={() => runAction(row, "approve")}><CheckCircle2 size={13}/> اعتماد وترحيل</button>}{row.status === "approved" && <button className="success" onClick={() => runAction(row, "post")}><CheckCircle2 size={13}/> ترحيل</button>}{["posted", "partially_paid"].includes(row.status) && Number(row.remaining_amount) > 0 && <button className="payment" onClick={() => openPayment(row)}><FileDown size={13}/> تسجيل دفعة</button>}{row.status === "paid" && <span className="sinv-action-complete"><CheckCircle2 size={13}/> مسددة</span>}</div></td></tr>) : <tr><td colSpan="10" className="empty">لا توجد فواتير موردين حتى الآن.</td></tr>}</tbody></table></div></section>

    {open && <div className="sinv-overlay" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}><form className="sinv-modal" onSubmit={createInvoice}><header><div><span>مطابقة ثلاثية آلية</span><h2>إضافة فاتورة مورد</h2><p>اختر أمر شراء مكتملًا ثم راجع الكميات والأسعار.</p></div><button type="button" onClick={() => setOpen(false)}><X/></button></header><div className="sinv-form-grid"><label><span>أمر الشراء</span><select required value={form.purchase_order_id} onChange={(e) => chooseOrder(e.target.value)}><option value="">اختر أمر الشراء...</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.po_number} — {order.supplier?.name || "مورد"} — {money(order.total)} ر.س</option>)}</select></label><label><span>رقم فاتورة المورد</span><input required value={form.supplier_invoice_number} onChange={(e) => setForm({ ...form, supplier_invoice_number: e.target.value })} placeholder="مثال: SUP-INV-1025"/></label><label><span>تاريخ الفاتورة</span><input required type="date" value={form.invoice_date} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })}/></label><label><span>تاريخ الاستحقاق</span><input type="date" min={form.invoice_date} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}/></label></div>
      {selectedOrder && <div className="sinv-order-strip"><div><small>المورد</small><b>{selectedOrder.supplier?.name}</b></div><div><small>المشروع</small><b>{selectedOrder.project?.name || "—"}</b></div><div><small>حالة الأمر</small><b>{selectedOrder.status === "completed" ? "مستلم بالكامل" : "معتمد"}</b></div></div>}
      <div className="sinv-items"><table><thead><tr><th>الصنف</th><th>المتاح للفوترة</th><th>كمية الفاتورة</th><th>سعر الأمر</th><th>سعر الفاتورة</th><th>الضريبة</th><th>الإجمالي</th></tr></thead><tbody>{form.items.length ? form.items.map((item, index) => { const net = Number(item.quantity || 0) * Number(item.unit_cost || 0) - Number(item.discount || 0); const total = net + net * Number(item.tax_rate || 0) / 100; const hasQtyVariance = Number(item.quantity) > Number(item.available_to_invoice); const hasPriceVariance = Math.abs(Number(item.unit_cost) - Number(item.ordered_unit_cost)) > .01; return <tr key={item.purchase_order_item_id}><td><b>{item.product_name}</b><small>{item.sku}</small></td><td>{item.available_to_invoice}</td><td><input className={hasQtyVariance ? "invalid" : ""} type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)}/></td><td>{money(item.ordered_unit_cost)}</td><td><input className={hasPriceVariance ? "invalid" : ""} type="number" min="0" step="0.01" value={item.unit_cost} onChange={(e) => updateItem(index, "unit_cost", e.target.value)}/></td><td><input type="number" min="0" max="100" step="0.01" value={item.tax_rate} onChange={(e) => updateItem(index, "tax_rate", e.target.value)}/></td><td><b>{money(total)}</b></td></tr>; }) : <tr><td colSpan="7" className="empty">اختر أمر شراء لعرض البنود المستلمة.</td></tr>}</tbody></table></div>
      <div className="sinv-footer"><label><span>ملاحظات</span><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="ملاحظات داخلية اختيارية..."/></label><div className="sinv-totals"><span>قبل الضريبة <b>{money(totals.subtotal)}</b></span><span>الضريبة <b>{money(totals.tax)}</b></span><strong>الإجمالي <b>{money(totals.total)} ر.س</b></strong></div><button type="submit" disabled={saving || !form.items.length}><ShieldCheck size={18}/>{saving ? "جاري المطابقة..." : "حفظ وتنفيذ المطابقة"}</button></div>
    </form></div>}
    {detailInvoice && <div className="sinv-overlay" onMouseDown={(e) => e.target === e.currentTarget && setDetailInvoice(null)}><section className="sinv-modal sinv-detail-modal"><header><div><span>تفاصيل الفاتورة وسجل السداد</span><h2>{detailInvoice.invoice_number}</h2><p>{detailInvoice.supplier?.name || "—"} — فاتورة المورد {detailInvoice.supplier_invoice_number}</p></div><button type="button" onClick={() => setDetailInvoice(null)}><X/></button></header><div className="sinv-detail-summary"><span>إجمالي الفاتورة<b>{money(detailInvoice.total)} ر.س</b></span><span>إجمالي المدفوع<b>{money(detailInvoice.paid_amount)} ر.س</b></span><span>المتبقي<b>{money(detailInvoice.remaining_amount)} ر.س</b></span><span>الحالة<b><Badge value={detailInvoice.status}/></b></span></div><div className="sinv-detail-meta"><span>تاريخ الفاتورة <b>{formatDate(detailInvoice.invoice_date)}</b></span><span>الاستحقاق <b>{formatDate(detailInvoice.due_date)}</b></span><span>أمر الشراء <b>{detailInvoice.purchase_order?.po_number || "—"}</b></span><span>المشروع <b>{detailInvoice.project?.name || "—"}</b></span></div><div className="sinv-payment-history"><div className="sinv-section-title"><div><small>حركة السداد</small><h3>سجل دفعات الفاتورة</h3></div><strong>{detailInvoice.payments?.length || 0} دفعة</strong></div><div className="fin-table-wrap"><table><thead><tr><th>رقم الدفعة</th><th>التاريخ</th><th>الحساب</th><th>الطريقة</th><th>المرجع</th><th>المبلغ</th><th>القيد</th><th>السند</th></tr></thead><tbody>{detailInvoice.payments?.length ? detailInvoice.payments.map((payment) => <tr key={payment.id}><td><b>{payment.payment_number}</b></td><td>{formatDate(payment.payment_date)}</td><td>{payment.finance_account ? `${payment.finance_account.code} — ${payment.finance_account.name}` : "—"}</td><td>{paymentMethodLabels[payment.payment_method] || payment.payment_method || "—"}</td><td>{payment.reference_number || "—"}</td><td><b>{money(payment.amount)} ر.س</b></td><td>{payment.journal_entry?.entry_number || "—"}</td><td><button className="sinv-receipt-button" onClick={() => printPayment(payment)}><Printer size={14}/> طباعة</button></td></tr>) : <tr><td colSpan="8" className="empty">لم تُسجل دفعات على هذه الفاتورة بعد.</td></tr>}</tbody></table></div></div><footer className="sinv-detail-footer"><button type="button" onClick={() => setDetailInvoice(null)}>إغلاق</button>{["posted", "partially_paid"].includes(detailInvoice.status) && Number(detailInvoice.remaining_amount) > 0 && <button type="button" className="primary" onClick={() => { setDetailInvoice(null); openPayment(detailInvoice); }}><FileDown size={16}/> تسجيل دفعة جديدة</button>}</footer></section></div>}
    {paymentInvoice && <div className="sinv-overlay" onMouseDown={(e) => e.target === e.currentTarget && setPaymentInvoice(null)}><form className="sinv-modal sinv-payment-modal" onSubmit={recordPayment}><header><div><span>الخزينة والحسابات الدائنة</span><h2>تسجيل دفعة مورد</h2><p>{paymentInvoice.invoice_number} — {paymentInvoice.supplier?.name}</p></div><button type="button" onClick={() => setPaymentInvoice(null)}><X/></button></header><div className="sinv-payment-summary"><span>إجمالي الفاتورة <b>{money(paymentInvoice.total)} ر.س</b></span><span>المدفوع <b>{money(paymentInvoice.paid_amount)} ر.س</b></span><span>المتبقي <b>{money(paymentInvoice.remaining_amount)} ر.س</b></span></div><div className="sinv-form-grid"><label><span>حساب البنك أو الصندوق</span><select required value={paymentForm.finance_account_id} onChange={(e) => setPaymentForm({ ...paymentForm, finance_account_id: e.target.value })}><option value="">اختر الحساب...</option>{cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}</select></label><label><span>المبلغ</span><input required type="number" min="0.01" max={Number(paymentInvoice.remaining_amount)} step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}/></label><label><span>تاريخ الدفع</span><input required type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}/></label><label><span>طريقة الدفع</span><select value={paymentForm.payment_method} onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}><option value="bank_transfer">تحويل بنكي</option><option value="cash">نقدي</option><option value="cheque">شيك</option><option value="card">بطاقة</option></select></label><label><span>رقم المرجع</span><input value={paymentForm.reference_number} onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })} placeholder="رقم التحويل أو الشيك"/></label><label><span>ملاحظات</span><input value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}/></label></div>{!cashAccounts.length && <div className="fin-report-error">لا توجد حسابات بنك أو صندوق مفعّلة. فعّل is_cash_account لحساب قابل للترحيل.</div>}<footer className="sinv-payment-actions"><button type="button" className="ghost" onClick={() => setPaymentInvoice(null)}>إلغاء</button><button type="submit" disabled={savingPayment || !cashAccounts.length}><FileDown size={18}/>{savingPayment ? "جاري التسجيل..." : "تسجيل الدفعة وإنشاء القيد"}</button></footer></form></div>}
  </div>;
}

export default SupplierInvoices;
