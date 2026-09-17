import { useEffect, useMemo, useState } from "react";
import { FileDown, Printer, RefreshCw, Scale, Search } from "lucide-react";

const API_BASE = "http://127.0.0.1:8000/api";

const money = (value) =>
  Number(value || 0).toLocaleString("ar-SA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function GeneralLedger() {
  const [lines, setLines] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({});
  const [trialBalance, setTrialBalance] = useState([]);
  const [trialSummary, setTrialSummary] = useState({});
  const [accountId, setAccountId] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("ledger");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();

      if (accountId) {
        params.set("account_id", accountId);
      }

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const [ledgerResponse, accountsResponse, trialResponse] =
        await Promise.all([
          fetch(`${API_BASE}/finance/general-ledger?${params.toString()}`),
          fetch(`${API_BASE}/finance/accounts?active=true`),
          fetch(`${API_BASE}/finance/trial-balance`),
        ]);

      const [ledgerResult, accountsResult, trialResult] = await Promise.all([
        ledgerResponse.json(),
        accountsResponse.json(),
        trialResponse.json(),
      ]);

      if (!ledgerResponse.ok || !ledgerResult.success) {
        throw new Error(
          ledgerResult.message || "تعذر تحميل دفتر الأستاذ العام."
        );
      }

      if (!accountsResponse.ok || !accountsResult.success) {
        throw new Error(
          accountsResult.message || "تعذر تحميل دليل الحسابات."
        );
      }

      if (!trialResponse.ok || !trialResult.success) {
        throw new Error(
          trialResult.message || "تعذر تحميل ميزان المراجعة."
        );
      }

      setLines(ledgerResult.data || []);
      setSummary(ledgerResult.summary || {});
      setAccounts(accountsResult.data || []);
      setTrialBalance(trialResult.data || []);
      setTrialSummary(trialResult.summary || {});
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء تحميل البيانات.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [accountId]);

  const selectedAccount = useMemo(
    () =>
      accounts.find(
        (account) => String(account.id) === String(accountId)
      ),
    [accounts, accountId]
  );

  return (
    <div className="acc-page" dir="rtl">
      <div className="acc-head">
        <div>
          <span className="acc-kicker">
            <Scale size={15} />
            المحاسبة العامة
          </span>

          <h1>دفتر الأستاذ العام</h1>

          <p>
            عرض الحركات المرحلة فقط، مع الرصيد الجاري وميزان المراجعة.
          </p>
        </div>

        <div className="acc-head-actions">
          <button type="button" className="acc-print-btn" onClick={() => window.print()}>
            <Printer size={16} /> طباعة {activeTab === "ledger" ? "دفتر الأستاذ" : "ميزان المراجعة"}
          </button>
          <button type="button" className="acc-pdf-btn" onClick={() => window.print()}>
            <FileDown size={16} /> حفظ PDF
          </button>
        </div>
      </div>

      <div className="acc-tabs">
        <button
          type="button"
          className={activeTab === "ledger" ? "active" : ""}
          onClick={() => setActiveTab("ledger")}
        >
          دفتر الأستاذ
        </button>

        <button
          type="button"
          className={activeTab === "trial" ? "active" : ""}
          onClick={() => setActiveTab("trial")}
        >
          ميزان المراجعة
        </button>
      </div>

      {error && (
        <div className="acc-card" style={{ padding: 18, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {activeTab === "ledger" ? (
        <>
          <div className="acc-stats">
            <div className="acc-stat">
              <span>إجمالي المدين</span>
              <strong>{money(summary.debit)} ر.س</strong>
            </div>

            <div className="acc-stat">
              <span>إجمالي الدائن</span>
              <strong>{money(summary.credit)} ر.س</strong>
            </div>

            <div className="acc-stat">
              <span>عدد الحركات</span>
              <strong>{summary.lines || 0}</strong>
            </div>

            <div className="acc-stat">
              <span>الحساب المحدد</span>
              <strong>{selectedAccount?.code || "الكل"}</strong>
            </div>
          </div>

          <div className="acc-card">
            <div className="acc-toolbar">
              <label>
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      loadData();
                    }
                  }}
                  placeholder="رقم القيد أو المرجع أو البيان..."
                />
              </label>

              <select
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">كل الحسابات</option>

                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="acc-icon-btn"
                onClick={loadData}
                title="تحديث"
              >
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="acc-table-wrap">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>رقم القيد</th>
                    <th>الحساب</th>
                    <th>البيان</th>
                    <th>المشروع</th>
                    <th>مدين</th>
                    <th>دائن</th>
                    <th>الرصيد</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="acc-empty">
                        جاري التحميل...
                      </td>
                    </tr>
                  ) : lines.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="acc-empty">
                        لا توجد حركات مرحلة حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line) => (
                      <tr key={line.id}>
                        <td>{line.journal_entry?.entry_date || "—"}</td>

                        <td>
                          <strong>
                            {line.journal_entry?.entry_number || "—"}
                          </strong>
                        </td>

                        <td>
                          {line.account?.code || "—"} -{" "}
                          {line.account?.name || "—"}
                        </td>

                        <td>
                          {line.description ||
                            line.journal_entry?.description ||
                            "—"}
                        </td>

                        <td>{line.project?.name || "—"}</td>

                        <td>{money(line.debit)}</td>

                        <td>{money(line.credit)}</td>

                        <td>
                          <strong>{money(line.running_balance)}</strong>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="acc-stats">
            <div className="acc-stat">
              <span>إجمالي المدين</span>
              <strong>{money(trialSummary.debit)} ر.س</strong>
            </div>

            <div className="acc-stat">
              <span>إجمالي الدائن</span>
              <strong>{money(trialSummary.credit)} ر.س</strong>
            </div>

            <div className="acc-stat">
              <span>حالة الميزان</span>
              <strong
                className={
                  trialSummary.balanced
                    ? "acc-positive"
                    : "acc-negative"
                }
              >
                {trialSummary.balanced ? "متوازن" : "غير متوازن"}
              </strong>
            </div>
          </div>

          <div className="acc-card">
            <div className="acc-table-wrap">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>الكود</th>
                    <th>الحساب</th>
                    <th>النوع</th>
                    <th>مدين</th>
                    <th>دائن</th>
                    <th>الرصيد</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="acc-empty">
                        جاري التحميل...
                      </td>
                    </tr>
                  ) : trialBalance.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="acc-empty">
                        لا توجد أرصدة مرحلة حتى الآن.
                      </td>
                    </tr>
                  ) : (
                    trialBalance.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.code}</strong>
                        </td>

                        <td>{row.name}</td>

                        <td>{row.type}</td>

                        <td>{money(row.debit)}</td>

                        <td>{money(row.credit)}</td>

                        <td>
                          <strong>{money(row.balance)}</strong>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default GeneralLedger;
