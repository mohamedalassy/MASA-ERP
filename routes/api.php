<?php
use App\Http\Controllers\Api\SupplierPriceHistoryController;
use App\Http\Controllers\Api\PricingRuleController;
use App\Http\Controllers\Api\PricingPackageController;
use App\Http\Controllers\Api\ProductAlternativeController;
use App\Http\Controllers\Api\PricingCostingController;
use App\Http\Controllers\Api\FinanceLedgerController;
use App\Http\Controllers\Api\ProjectQuotationController;
use App\Http\Controllers\Api\CompanyTaxProfileController;
use App\Http\Controllers\Api\QuotationBillingController;
use App\Http\Controllers\Api\TaxCodeController;
use App\Http\Controllers\Api\TaxInvoiceController;
use App\Http\Controllers\Api\CustomerTaxProfileController;
// Add import:

use App\Http\Controllers\Api\SupplierInvoiceController;
use App\Http\Controllers\Api\FinanceProjectBillingController;
use App\Http\Controllers\Api\FinanceProjectsBillingController;
use App\Http\Controllers\Api\TaxInvoicePaymentController;
use App\Http\Controllers\Api\CollectionsCenterController;
use App\Http\Controllers\Api\VatCenterController;
use App\Http\Controllers\Api\SuppliersCenterController;
use App\Http\Controllers\Api\SupplierPriceController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ProjectExpenseController;
use App\Http\Controllers\Api\InventoryTransactionController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\PurchaseOrderController;
use App\Http\Controllers\Api\PurchaseOrderItemController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\FinanceDashboardController;
use App\Http\Controllers\Api\FinanceAccountController;
use App\Http\Controllers\Api\FinanceJournalEntryController;
use App\Http\Controllers\Api\CostCenterController;
use App\Http\Controllers\Api\ProjectFinancialTransactionController;

/*
|--------------------------------------------------------------------------
HR API USE|--------------------------------------------------------------------------
*/
use App\Http\Controllers\Api\HrBranchController;
use App\Http\Controllers\Api\HrDepartmentController;
use App\Http\Controllers\Api\HrEmployeeController;
use App\Http\Controllers\Api\HrJobTitleController;
use App\Http\Controllers\Api\HrShiftController;
use App\Http\Controllers\Api\HrAttendanceDeviceController;
use App\Http\Controllers\Api\HrAttendanceSummaryController;
use App\Http\Controllers\Api\HrPayrollController;


Route::get('/test', function () {
    return response()->json([
        'success' => true,
        'message' => 'MASA ERP API is working',
    ]);
});

Route::get(
    '/projects',
    [ProjectController::class, 'index']
);

Route::get(
    '/projects/{project}',
    [ProjectController::class, 'show']
);

Route::post(
    '/projects/{project}/next-stage',
    [ProjectController::class, 'moveToNextStage']
);

Route::post(
    '/projects/{project}/previous-stage',
    [ProjectController::class, 'moveToPreviousStage']
);

Route::get(
    '/projects/{project}/purchase-orders',
    [PurchaseOrderController::class, 'index']
);

Route::post(
    '/projects/{project}/purchase-orders',
    [PurchaseOrderController::class, 'store']
);

Route::get('/purchase-test', function () {
    return response()->json([
        'success' => true,
        'message' => 'purchase routes loaded',
    ]);
});

Route::get(
    '/purchase-orders/{purchaseOrder}',
    [PurchaseOrderController::class, 'show']
);

Route::put(
    '/purchase-orders/{purchaseOrder}',
    [PurchaseOrderController::class, 'update']
);

Route::post(
    '/purchase-orders/{purchaseOrder}/submit-for-approval',
    [PurchaseOrderController::class, 'submitForApproval']
);

Route::post(
    '/purchase-orders/{purchaseOrder}/approve',
    [PurchaseOrderController::class, 'approve']
);

Route::post(
    '/purchase-orders/{purchaseOrder}/cancel',
    [PurchaseOrderController::class, 'cancel']
);

Route::post(
    '/purchase-orders/{purchaseOrder}/receive',
    [PurchaseOrderController::class, 'receive']
);

Route::post(
    '/purchase-orders/{purchaseOrder}/items',
    [PurchaseOrderItemController::class, 'store']
);

Route::put(
    '/purchase-orders/{purchaseOrder}/items/{item}',
    [PurchaseOrderItemController::class, 'update']
);

Route::delete(
    '/purchase-orders/{purchaseOrder}/items/{item}',
    [PurchaseOrderItemController::class, 'destroy']
);

Route::get(
    '/suppliers',
    [SupplierController::class, 'index']
);

/*
|--------------------------------------------------------------------------
| Inventory
|--------------------------------------------------------------------------
*/

Route::get(
    '/inventory-transactions',
    [InventoryTransactionController::class, 'index']
);

Route::get(
    '/products/{product}/inventory-transactions',
    [InventoryTransactionController::class, 'productHistory']
);
Route::post(
    '/inventory/issue-to-project',
    [InventoryTransactionController::class, 'issueToProject']
);

Route::get(
    '/projects/{project}/expenses',
    [ProjectExpenseController::class, 'index']
);

Route::post(
    '/projects/{project}/expenses',
    [ProjectExpenseController::class, 'store']
);

Route::delete(
    '/projects/{project}/expenses/{expense}',
    [ProjectExpenseController::class, 'destroy']
);
Route::put(
    '/projects/{project}/execution-status',
    [ProjectController::class, 'updateExecutionStatus']
);

Route::post(
    '/projects/{project}/hold-execution',
    [ProjectController::class, 'holdExecution']
);

Route::post(
    '/projects/{project}/resume-execution',
    [ProjectController::class, 'resumeExecution']
);

Route::post(
    '/projects/{project}/return-to-stage',
    [ProjectController::class, 'returnToStage']
);
Route::get(
    '/projects/{project}/quotations',
    [ProjectQuotationController::class, 'index']
);

Route::get(
    '/projects/{project}/quotations/{quotation}',
    [ProjectQuotationController::class, 'show']
);

Route::post(
    '/projects/{project}/quotations/{quotation}/revision',
    [ProjectQuotationController::class, 'createRevision']
);

Route::post(
    '/projects/{project}/quotations/{quotation}/approve',
    [ProjectQuotationController::class, 'approve']
);
Route::post(
    '/projects/{project}/quotations',
    [ProjectQuotationController::class, 'store']
);
Route::put(
    '/projects/{project}/quotations/{quotation}',
    [ProjectQuotationController::class, 'update']
);
Route::get(
    '/quotations',
    [ProjectQuotationController::class, 'all']
);
Route::get('/products', [ProductController::class, 'index']);
Route::post('/products', [ProductController::class, 'store']);
Route::put('/products/{product}', [ProductController::class, 'update']);

Route::post(
    '/projects/{project}/quotations/{quotation}/submit-for-approval',
    [ProjectQuotationController::class, 'submitForApproval']
);
Route::post(
    '/projects/{project}/quotations/{quotation}/request-changes',
    [ProjectQuotationController::class, 'requestChanges']
);



Route::get('/supplier-prices', [SupplierPriceController::class, 'index']);
Route::get('/products/{product}/supplier-prices', [SupplierPriceController::class, 'productPrices']);
Route::post('/supplier-prices', [SupplierPriceController::class, 'store']);
Route::put('/supplier-prices/{supplierPrice}', [SupplierPriceController::class, 'update']);



Route::get(
    '/supplier-price-history',
    [SupplierPriceHistoryController::class, 'index']
);

Route::get('/pricing-rules', [PricingRuleController::class, 'index']);
Route::post('/pricing-rules', [PricingRuleController::class, 'store']);
Route::put('/pricing-rules/{pricingRule}', [PricingRuleController::class, 'update']);
Route::delete('/pricing-rules/{pricingRule}', [PricingRuleController::class, 'destroy']);
Route::post('/pricing-rules/resolve', [PricingRuleController::class, 'resolve']);


Route::get('/pricing-packages', [PricingPackageController::class, 'index']);
Route::get('/pricing-packages/{pricingPackage}', [PricingPackageController::class, 'show']);
Route::post('/pricing-packages', [PricingPackageController::class, 'store']);
Route::put('/pricing-packages/{pricingPackage}', [PricingPackageController::class, 'update']);
Route::delete('/pricing-packages/{pricingPackage}', [PricingPackageController::class, 'destroy']);


Route::get('/product-alternatives', [ProductAlternativeController::class, 'index']);
Route::get('/products/{product}/alternatives', [ProductAlternativeController::class, 'productAlternatives']);
Route::post('/product-alternatives', [ProductAlternativeController::class, 'store']);
Route::put('/product-alternatives/{productAlternative}', [ProductAlternativeController::class, 'update']);
Route::delete('/product-alternatives/{productAlternative}', [ProductAlternativeController::class, 'destroy']);



Route::get('/pricing-costings', [PricingCostingController::class, 'index']);
Route::post('/pricing-costings/calculate', [PricingCostingController::class, 'calculate']);
Route::get('/pricing-costings/{pricingCosting}', [PricingCostingController::class, 'show']);
Route::post('/pricing-costings', [PricingCostingController::class, 'store']);
Route::put('/pricing-costings/{pricingCosting}', [PricingCostingController::class, 'update']);
Route::delete('/pricing-costings/{pricingCosting}', [PricingCostingController::class, 'destroy']);



Route::post('/projects/{project}/quotations/{quotation}/reject', [ProjectQuotationController::class, 'reject']);


/*
|--------------------------------------------------------------------------
| Finance
|--------------------------------------------------------------------------
*/
Route::get(
    '/finance/suppliers-center',
    [SuppliersCenterController::class, 'index']
);

Route::get(
    '/finance/dashboard',
    [FinanceDashboardController::class, 'index']
);

/*
|--------------------------------------------------------------------------
| Chart Of Accounts
|--------------------------------------------------------------------------
*/

Route::get(
    '/finance/accounts',
    [FinanceAccountController::class, 'index']
);

Route::post(
    '/finance/accounts',
    [FinanceAccountController::class, 'store']
);

Route::get(
    '/finance/accounts/{financeAccount}',
    [FinanceAccountController::class, 'show']
);

Route::put(
    '/finance/accounts/{financeAccount}',
    [FinanceAccountController::class, 'update']
);

Route::delete(
    '/finance/accounts/{financeAccount}',
    [FinanceAccountController::class, 'destroy']
);

/*
|--------------------------------------------------------------------------
| Cost Centers
|--------------------------------------------------------------------------
*/

Route::get(
    '/finance/cost-centers',
    [CostCenterController::class, 'index']
);

Route::post(
    '/finance/cost-centers',
    [CostCenterController::class, 'store']
);

Route::get(
    '/finance/cost-centers/{costCenter}',
    [CostCenterController::class, 'show']
);

Route::put(
    '/finance/cost-centers/{costCenter}',
    [CostCenterController::class, 'update']
);

Route::delete(
    '/finance/cost-centers/{costCenter}',
    [CostCenterController::class, 'destroy']
);

/*
|--------------------------------------------------------------------------
| Journal Entries
|--------------------------------------------------------------------------
*/

Route::get(
    '/finance/journal-entries',
    [FinanceJournalEntryController::class, 'index']
);

Route::post(
    '/finance/journal-entries',
    [FinanceJournalEntryController::class, 'store']
);

Route::get(
    '/finance/journal-entries/{journalEntry}',
    [FinanceJournalEntryController::class, 'show']
);

Route::put(
    '/finance/journal-entries/{journalEntry}',
    [FinanceJournalEntryController::class, 'update']
);

Route::delete(
    '/finance/journal-entries/{journalEntry}',
    [FinanceJournalEntryController::class, 'destroy']
);

Route::post(
    '/finance/journal-entries/{journalEntry}/submit',
    [FinanceJournalEntryController::class, 'submit']
);

Route::post(
    '/finance/journal-entries/{journalEntry}/approve',
    [FinanceJournalEntryController::class, 'approve']
);

Route::post(
    '/finance/journal-entries/{journalEntry}/post',
    [FinanceJournalEntryController::class, 'post']
);

Route::post(
    '/finance/journal-entries/{journalEntry}/reject',
    [FinanceJournalEntryController::class, 'reject']
);

/*
|--------------------------------------------------------------------------
| Project Financial Transactions
|--------------------------------------------------------------------------
*/
Route::get(
    '/finance/collections-center',
    [CollectionsCenterController::class, 'index']
);

Route::get(
    '/projects/{project}/financial-transactions',
    [ProjectFinancialTransactionController::class, 'index']
);

Route::post(
    '/projects/{project}/financial-transactions',
    [ProjectFinancialTransactionController::class, 'store']
);

Route::post(
    '/projects/{project}/financial-transactions/{transaction}/payment',
    [ProjectFinancialTransactionController::class, 'recordPayment']
);

Route::post(
    '/projects/{project}/financial-transactions/{transaction}/approve',
    [ProjectFinancialTransactionController::class, 'approve']
);

Route::post(
    '/projects/{project}/financial-transactions/{transaction}/cancel',
    [ProjectFinancialTransactionController::class, 'cancel']
);
/*
|--------------------------------------------------------------------------
| General Ledger & Trial Balance
|--------------------------------------------------------------------------
*/

Route::get(
    '/finance/general-ledger',
    [FinanceLedgerController::class, 'index']
);

Route::get(
    '/finance/trial-balance',
    [FinanceLedgerController::class, 'trialBalance']
);
Route::get(
    '/finance/income-statement',
    [FinanceLedgerController::class, 'incomeStatement']
);
Route::get(
    '/finance/balance-sheet',
    [FinanceLedgerController::class, 'balanceSheet']
);

Route::get(
    '/finance/cash-flow',
    [FinanceLedgerController::class, 'cashFlow']
);

/*
|--------------------------------------------------------------------------
| Tax / VAT / ZATCA
|--------------------------------------------------------------------------
*/

Route::prefix('finance')->group(function () {
    Route::get('/vat-center', [VatCenterController::class, 'index']);

    Route::get('/tax-profiles', [CompanyTaxProfileController::class, 'index']);
    Route::post('/tax-profiles', [CompanyTaxProfileController::class, 'store']);
    Route::put('/tax-profiles/{companyTaxProfile}', [CompanyTaxProfileController::class, 'update']);

    Route::get('/tax-codes', [TaxCodeController::class, 'index']);
    Route::post('/tax-codes', [TaxCodeController::class, 'store']);
    Route::put('/tax-codes/{taxCode}', [TaxCodeController::class, 'update']);

    Route::get('/quotations/{quotation}/billing', [QuotationBillingController::class, 'show']);

    Route::get('/tax-invoices', [TaxInvoiceController::class, 'index']);
    Route::post('/tax-invoices', [TaxInvoiceController::class, 'store']);
    Route::get(
        '/tax-invoices/payment-accounts',
        [TaxInvoicePaymentController::class, 'accounts']
    );
    Route::get('/tax-invoices/{taxInvoice}', [TaxInvoiceController::class, 'show']);
    Route::put('/tax-invoices/{taxInvoice}', [TaxInvoiceController::class, 'update']);
    Route::post('/tax-invoices/{taxInvoice}/issue', [TaxInvoiceController::class, 'issue']);
    Route::post(
        '/tax-invoices/{taxInvoice}/refresh-buyer',
        [TaxInvoiceController::class, 'refreshBuyer']
    );
    Route::delete('/tax-invoices/{taxInvoice}', [TaxInvoiceController::class, 'destroy']);

    // Customer Tax Profiles
    Route::get('/customer-tax-profiles', [CustomerTaxProfileController::class, 'index']);
    Route::post('/customer-tax-profiles', [CustomerTaxProfileController::class, 'store']);
    Route::get('/customer-tax-profiles/{customerTaxProfile}', [CustomerTaxProfileController::class, 'show']);
    Route::put('/customer-tax-profiles/{customerTaxProfile}', [CustomerTaxProfileController::class, 'update']);

    // Collections / Payments
    Route::get('/payments', [TaxInvoicePaymentController::class, 'index']);
    Route::post(
        '/tax-invoices/{taxInvoice}/payments',
        [TaxInvoicePaymentController::class, 'store']
    );
});
// Add finance billing routes:
Route::get(
    '/finance/projects/{project}/billing',
    [FinanceProjectBillingController::class, 'project']
);

Route::get(
    '/finance/quotations/{quotation}/billing-summary',
    [FinanceProjectBillingController::class, 'quotation']
);

Route::get(
    '/finance/projects-billing',
    [FinanceProjectsBillingController::class, 'index']
);

Route::get(
    '/finance/supplier-invoices',
    [SupplierInvoiceController::class, 'index']
);
Route::get(
    '/finance/supplier-invoices/purchase-orders',
    [SupplierInvoiceController::class, 'purchaseOrders']
);

Route::post(
    '/finance/supplier-invoices',
    [SupplierInvoiceController::class, 'store']
);
Route::get(
    '/finance/supplier-invoices/cash-accounts',
    [SupplierInvoiceController::class, 'cashAccounts']
);

Route::post(
    '/finance/supplier-invoices/{supplierInvoice}/payments',
    [SupplierInvoiceController::class, 'recordPayment']
);
Route::post(
    '/finance/supplier-invoices/{supplierInvoice}/post',
    [SupplierInvoiceController::class, 'post']
);

Route::get(
    '/finance/supplier-invoices/{supplierInvoice}',
    [SupplierInvoiceController::class, 'show']
);

Route::post(
    '/finance/supplier-invoices/{supplierInvoice}/rematch',
    [SupplierInvoiceController::class, 'rematch']
);

Route::post(
    '/finance/supplier-invoices/{supplierInvoice}/submit',
    [SupplierInvoiceController::class, 'submit']
);

Route::post(
    '/finance/supplier-invoices/{supplierInvoice}/approve',
    [SupplierInvoiceController::class, 'approve']
);

Route::post(
    '/finance/supplier-invoices/{supplierInvoice}/post',
    [SupplierInvoiceController::class, 'post']
);
/*
|--------------------------------------------------------------------------
HR API ROUTE |--------------------------------------------------------------------------
*/
Route::prefix('hr')->name('hr.')->group(function () {
    Route::post('payrolls/generate', [HrPayrollController::class, 'generate'])
        ->name('payrolls.generate');

    Route::apiResource('payrolls', HrPayrollController::class)
        ->only(['index', 'show', 'update'])
        ->parameters(['payrolls' => 'hrPayroll']);

    Route::apiResource('branches', HrBranchController::class)
        ->parameters(['branches' => 'hrBranch']);

    Route::apiResource('departments', HrDepartmentController::class)
        ->parameters(['departments' => 'hrDepartment']);

    Route::apiResource('job-titles', HrJobTitleController::class)
        ->parameters(['job-titles' => 'hrJobTitle']);

    Route::apiResource('shifts', HrShiftController::class)
        ->parameters(['shifts' => 'hrShift']);

    Route::apiResource('employees', HrEmployeeController::class)
        ->parameters(['employees' => 'hrEmployee']);
});
Route::prefix('hr')->name('hr.')->group(function () {
    Route::get('attendance/summary', [HrAttendanceSummaryController::class, 'index'])
        ->name('attendance.summary');

    Route::post('attendance-devices/{hrAttendanceDevice}/test-connection', [HrAttendanceDeviceController::class, 'testConnection'])
        ->name('attendance-devices.test-connection');

    Route::apiResource('attendance-devices', HrAttendanceDeviceController::class)
        ->parameters(['attendance-devices' => 'hrAttendanceDevice']);
});
