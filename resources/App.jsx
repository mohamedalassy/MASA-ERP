import { Suspense, lazy, useState } from "react";
import FinanceDashboard from "./pages/finance/FinanceDashboard";
import "./styles/finance.css";
import ProductAlternatives from "./pages/ProductAlternatives";
import PricingPackages from "./pages/PricingPackages";
import HrEmployeeProfile from "./pages/HR/HrEmployeeProfile";
import SuggestedPriceCalculator from "./pages/SuggestedPriceCalculator";
import PricingRules from "./pages/PricingRules";
import PriceHistory from "./pages/PriceHistory";
import CostingEngine from "./pages/CostingEngine";
import PricingReports from "./pages/PricingReports";
import CashFlowStatement from "./pages/finance/CashFlowStatement";

import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import AppLauncher from "./components/apps/AppLauncher";
import ChatPanel from "./components/chat/ChatPanel";
import Dashboard from "./pages/Dashboard";
import HrDashboard from "./pages/HR/HrDashboard.jsx";
import HrOrganization from "./pages/HR/HrOrganization.jsx";
import HrAttendance from "./pages/HR/HrAttendance.jsx";
import HrAttendanceDevices from "./pages/HR/HrAttendanceDevices.jsx";
import WorkOrders from "./pages/WorkOrders";
import ProjectDetails from "./pages/ProjectDetails";
import PurchaseOrders from "./pages/PurchaseOrders";
import PurchaseOrderDetails from "./pages/PurchaseOrderDetails";
import Inventory from "./pages/Inventory";
import Quotations from "./pages/Quotations";
import PriceList from "./pages/PriceList";
import PricingDashboard from "./pages/PricingDashboard";
import QuotationBuilder from "./pages/QuotationBuilder";
import SupplierPrices from "./pages/SupplierPrices";
import PricingApprovals from "./pages/PricingApprovals";
import ChartOfAccounts from "./pages/finance/ChartOfAccounts";
import JournalEntries from "./pages/finance/JournalEntries";
import GeneralLedger from "./pages/finance/GeneralLedger";
import IncomeStatement from "./pages/finance/IncomeStatement";
import "./styles/finance-enterprise.css";
import SupplierInvoices from "./pages/finance/SupplierInvoices";
import BalanceSheet from "./pages/finance/BalanceSheet";
import HrEmployees from "./pages/HR/HrEmployees";
const FinanceCustomers = lazy(() => import("./pages/finance/FinanceCustomers"));
const CollectionsCenter = lazy(() => import("./pages/finance/CollectionsCenter"));
const VatCenter = lazy(() => import("./pages/finance/VatCenter"));
const FinanceSuppliers = lazy(() => import("./pages/finance/FinanceSuppliers"));
const FinanceBanks = lazy(() => import("./pages/finance/FinanceBanks"));
const BankReconciliation = lazy(() => import("./pages/finance/BankReconciliation"));
const FixedAssets = lazy(() => import("./pages/finance/FixedAssets"));
const FinanceCostCenters = lazy(() => import("./pages/finance/FinanceCostCenters"));
const FinanceProjects = lazy(() => import("./pages/finance/FinanceProjects"));
const ProjectFinancialCenter = lazy(() => import("./pages/finance/ProjectFinancialCenter"));
const FinanceReports = lazy(() => import("./pages/finance/FinanceReports"));
const TaxInvoiceCenter = lazy(() => import("./pages/finance/TaxInvoiceCenter"));
const TaxInvoiceCreate = lazy(() => import("./pages/finance/TaxInvoiceCreate"));
const TaxInvoiceDetails = lazy(() => import("./pages/finance/TaxInvoiceDetails"));
const CompanyTaxProfile = lazy(() => import("./pages/finance/CompanyTaxProfile"));
const CustomerTaxProfile = lazy(() => import("./pages/finance/CustomerTaxProfile"));
import "./styles/accounting-core.css";

import "./styles/master.css";

function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [workOrderStage, setWorkOrderStage] = useState("all");
  const [activeWorkOrderSource, setActiveWorkOrderSource] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState(null);
  const [selectedQuotationId, setSelectedQuotationId] = useState(null);
  const [selectedTaxInvoiceId, setSelectedTaxInvoiceId] = useState(null);
  const [activeEmployeeId, setActiveEmployeeId] = useState(null);
  const [pendingPackageData, setPendingPackageData] = useState(null);
  const [packageHandoffToken, setPackageHandoffToken] = useState(0);

  const handleChangeView = (view, options = {}) => {
  console.log("ACTIVE VIEW:", view, options);
    if (view === "hr-employee-profile") {
      setActiveEmployeeId(options.employeeId || null);
      setActiveWorkOrderSource(null);
      setActiveView("hr-employee-profile");
      return;
    }

    if (view === "work-orders") {
      setWorkOrderStage(options.stage || "all");
      setActiveWorkOrderSource(options.source || null);
      setActiveView("work-orders");
      return;
    }

    if (view === "pricing-builder") {
      setSelectedQuotationId(options.quotationId || null);
      setPendingPackageData(options.packageData || null);

      if (options.packageData) {
        setPackageHandoffToken((current) => current + 1);
      }

      if (options.projectId) {
        setSelectedProjectId(options.projectId);
      }

      setActiveWorkOrderSource(null);
      setActiveView("pricing-builder");
      return;
    }

    if (view === "finance-project-center") {
      if (options.projectId) {
        setSelectedProjectId(options.projectId);
      }

      setActiveWorkOrderSource(null);
      setActiveView("finance-project-center");
      return;
    }

    if (view === "project") {
      if (options.projectId) {
        setSelectedProjectId(options.projectId);
      }

      setActiveWorkOrderSource(null);
      setActiveView("project");
      return;
    }

    if (view === "finance-tax-create") {
      if (options.projectId) {
        setSelectedProjectId(options.projectId);
      }

      if (options.quotationId) {
        setSelectedQuotationId(options.quotationId);
      }

      setActiveWorkOrderSource(null);
      setActiveView("finance-tax-create");
      return;
    }

    if (view === "finance-tax-details") {
      setSelectedTaxInvoiceId(options.taxInvoiceId || null);
      setActiveWorkOrderSource(null);
      setActiveView("finance-tax-details");
      return;
    }

    setActiveWorkOrderSource(null);
    setActiveView(view);
  };

  const handleOpenProject = (projectId) => {
    setSelectedProjectId(projectId);
    setActiveView("project");
  };

  const handleBackToWorkOrders = () => {
    setActiveView("work-orders");
  };

  const handleOpenPurchases = () => {
    setActiveView("purchase-orders");
  };

  const handleBackToProject = () => {
    setActiveView("project");
  };

  const handleOpenPurchaseOrder = (purchaseOrderId) => {
    setSelectedPurchaseOrderId(purchaseOrderId);
    setActiveView("purchase-order-details");
  };

  const handleBackToPurchaseOrders = () => {
    setActiveView("purchase-orders");
  };

  const pricingPlaceholderTitles = {
    
    
  };

  const hrPlaceholderTitles = {
    "hr-shifts": "إدارة الورديات",
    "hr-contracts": "عقود الموظفين",
    "hr-leaves": "الإجازات والطلبات",
    "hr-payroll": "الرواتب والاستحقاقات",
    "hr-performance": "تقييمات الأداء",
    "hr-reports": "تقارير الموارد البشرية",
  };

  return (
    <div className="erp-shell" dir="rtl">
      <Sidebar
        activeView={activeView}
        activeWorkOrderSource={activeWorkOrderSource}
        onChangeView={handleChangeView}
      />

      <main className="erp-main">
        <Topbar />

        <div className="erp-content">
          {activeView === "accounting" && (
              <FinanceDashboard onNavigate={handleChangeView} />
            )}
          {activeView === "dashboard" && (
            <Dashboard onChangeView={handleChangeView} />
          )}

          {activeView === "pricing-rules" && (
            <PricingRules onNavigate={handleChangeView} />
          )}

          {activeView === "pricing-calculator" && (
            <SuggestedPriceCalculator onNavigate={handleChangeView} />
          )}

          {activeView === "pricing-packages" && (
            <PricingPackages onNavigate={handleChangeView} />
          )}

          {activeView === "pricing-alternatives" && (
            <ProductAlternatives onNavigate={handleChangeView} />
          )}

          {activeView === "apps" && (
            <AppLauncher onChangeView={handleChangeView} />
          )}

          {activeView === "chat" && <ChatPanel />}

          {activeView === "pricing" && (
            <PricingDashboard onNavigate={handleChangeView} />
          )}

          {activeView === "pricing-builder" && (
            <QuotationBuilder
              key={`pricing-builder-${packageHandoffToken}-${selectedQuotationId || "new"}`}
              onNavigate={handleChangeView}
              initialProjectId={selectedProjectId}
              initialQuotationId={selectedQuotationId}
              initialPackageData={pendingPackageData}
            />
          )}
          {activeView === "pricing-reports" && (
                <PricingReports onNavigate={handleChangeView} />
              )}

          {activeView === "pricing-suppliers" && (
            <SupplierPrices onNavigate={handleChangeView} />
          )}

          {activeView === "pricing-history" && (
            <PriceHistory onNavigate={handleChangeView} />
          )}
          
          {activeView === "pricing-costing" && (
              <CostingEngine onNavigate={handleChangeView} />
            )}
            {activeView === "pricing-approvals" && (
                <PricingApprovals onNavigate={handleChangeView} />
              )}

          {activeView === "inventory" && <Inventory />}

          {activeView === "price-list" && <PriceList />}

          {activeView === "quotations" && (
            <Quotations onOpenProject={handleOpenProject} />
          )}

          {activeView === "work-orders" && (
            <WorkOrders
              stage={workOrderStage}
              onOpenProject={handleOpenProject}
            />
          )}

          {activeView === "project" && (
            <ProjectDetails
              projectId={selectedProjectId || 1}
              onBack={handleBackToWorkOrders}
              onOpenPurchases={handleOpenPurchases}
              onNavigate={handleChangeView}
            />
          )}

          {activeView === "purchase-orders" && (
            <PurchaseOrders
              projectId={selectedProjectId || 1}
              onBack={handleBackToProject}
              onOpenPurchaseOrder={handleOpenPurchaseOrder}
            />
          )}

          {activeView === "purchase-order-details" && (
            <PurchaseOrderDetails
              purchaseOrderId={selectedPurchaseOrderId}
              onBack={handleBackToPurchaseOrders}
              onOpenPurchaseOrder={handleOpenPurchaseOrder}
            />
          )}

          {pricingPlaceholderTitles[activeView] && (
            <div
              className="placeholder-page"
              style={{
                background: "#fff",
                border: "1px solid #e9ebf2",
                borderRadius: 18,
                padding: 28,
              }}
            >
              <div
                style={{
                  color: "#6b5bf5",
                  fontWeight: 800,
                  fontSize: 11,
                  marginBottom: 7,
                }}
              >
                مركز التسعير
              </div>

              <h2 style={{ marginTop: 0 }}>
                {pricingPlaceholderTitles[activeView]}
              </h2>

              <p style={{ color: "#939aaa" }}>
                تم تجهيز المسار داخل منظومة التسعير، وسيتم بناء تفاصيل هذه
                الوحدة في المرحلة التالية.
              </p>

              <button
                type="button"
                onClick={() => handleChangeView("pricing")}
                style={{
                  border: 0,
                  background: "#6657f5",
                  color: "#fff",
                  padding: "10px 16px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 800,
                }}
              >
                العودة للوحة التسعير
              </button>
            </div>
          )}

          {activeView === "notifications" && (
            <div className="placeholder-page">
              <h2>الإشعارات</h2>
              <p>سيتم بناء مركز الإشعارات هنا.</p>
            </div>
          )}

          {activeView === "favorites" && (
            <div className="placeholder-page">
              <h2>المفضلة</h2>
              <p>التطبيقات والصفحات المفضلة ستظهر هنا.</p>
            </div>
          )}

          {activeView === "sales" && (
            <div className="placeholder-page">
              <h2>المبيعات</h2>
            </div>
          )}

          {activeView === "invoices" && (
            <div className="placeholder-page">
              <h2>الفواتير</h2>
            </div>
          )}

          {activeView === "hr-dashboard" && (
            <HrDashboard onNavigate={handleChangeView} />
          )}

          {activeView === "hr-organization" && (
            <HrOrganization onNavigate={handleChangeView} />
          )}

          {activeView === "hr-attendance" && (
            <HrAttendance onNavigate={handleChangeView} />
          )}

          {activeView === "hr-attendance-devices" && (
            <HrAttendanceDevices onNavigate={handleChangeView} />
          )}

          {hrPlaceholderTitles[activeView] && (
            <div
              className="placeholder-page"
              style={{
                background: "#fff",
                border: "1px solid #e9ebf2",
                borderRadius: 18,
                padding: 28,
              }}
            >
              <div
                style={{
                  color: "#3165ff",
                  fontWeight: 800,
                  fontSize: 11,
                  marginBottom: 7,
                }}
              >
                MASA People
              </div>

              <h2 style={{ marginTop: 0 }}>
                {hrPlaceholderTitles[activeView]}
              </h2>

              <p style={{ color: "#939aaa" }}>
                تم تجهيز المسار داخل منظومة الموارد البشرية، وسيتم بناء هذه
                الوحدة وربطها بالبيانات في المرحلة التالية.
              </p>

              <button
                type="button"
                onClick={() => handleChangeView("hr-dashboard")}
                style={{
                  border: 0,
                  background: "#3165ff",
                  color: "#fff",
                  padding: "10px 16px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 800,
                }}
              >
                العودة للوحة الموارد البشرية
              </button>
            </div>
          )}

          {activeView === "reports" && (
            <div className="placeholder-page">
              <h2>التقارير</h2>
            </div>
          )}

          {activeView === "settings" && (
            <div className="placeholder-page">
              <h2>الإعدادات</h2>
            </div>
          )}
          
          {activeView === "finance-chart-accounts" && (
            <ChartOfAccounts />
          )}

          {activeView === "finance-journal" && (
            <JournalEntries />
          )}

          {activeView === "finance-general-ledger" && (
            <GeneralLedger />
          )}
          {activeView === "finance-income-statement" && (
              <IncomeStatement />
            )}

          <Suspense
            fallback={
              <div className="placeholder-page">
                <h2>جاري تحميل صفحة المالية...</h2>
              </div>
            }
          >
            {activeView === "finance-customers" && (
                <FinanceCustomers onNavigate={handleChangeView} />
              )}
            {activeView === "finance-collections-center" && (
              <CollectionsCenter onChangeView={handleChangeView} />
            )}
            {activeView === "finance-vat-center" && (
              <VatCenter onChangeView={handleChangeView} />
            )}
            {activeView === "finance-suppliers" && <FinanceSuppliers />}
            {activeView === "finance-banks" && (
              <FinanceBanks onChangeView={handleChangeView} />
            )}
            {activeView === "finance-bank-reconciliation" && (
              <BankReconciliation onChangeView={handleChangeView} />
            )}
            {activeView === "finance-fixed-assets" && <FixedAssets />}
            {activeView === "finance-cost-centers" && <FinanceCostCenters />}
            {activeView === "finance-projects" && (
              <FinanceProjects onNavigate={handleChangeView} />
            )}
            {activeView === "finance-project-center" && (
              <ProjectFinancialCenter
                projectId={selectedProjectId}
                onNavigate={handleChangeView}
              />
            )}
            {activeView === "finance-reports" && (
              <FinanceReports onNavigate={handleChangeView} />
            )}
            {activeView === "finance-tax-invoices" && (
              <TaxInvoiceCenter onChangeView={handleChangeView} />
            )}
            {activeView === "finance-tax-create" && (
              <TaxInvoiceCreate
                onChangeView={handleChangeView}
                initialProjectId={selectedProjectId}
                initialQuotationId={selectedQuotationId}
              />
            )}
            {activeView === "finance-tax-details" && (
              <TaxInvoiceDetails
                taxInvoiceId={selectedTaxInvoiceId}
                onChangeView={handleChangeView}
              />
            )}
            {activeView === "finance-balance-sheet" && (
                <BalanceSheet />
              )}
            {activeView === "finance-tax-profile" && (
              <CompanyTaxProfile />
            )}
            {activeView === "finance-customer-tax-profile" && (
              <CustomerTaxProfile />
            )}
            {activeView === "finance-cash-flow" && (
              <CashFlowStatement />
            )}
            {activeView === "finance-supplier-invoices" && (
              <SupplierInvoices />
            )}
            {activeView === "hr-employees" && (
              <HrEmployees onNavigate={handleChangeView} />
            )}
            {activeView === "hr-employee-profile" && (
              <HrEmployeeProfile
                employeeId={activeEmployeeId}
                onNavigate={handleChangeView}
              />
            )}
          </Suspense>
         
        </div>
      </main>
    </div>
  );
}

export default App;
