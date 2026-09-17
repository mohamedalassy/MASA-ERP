<?php

/*
|--------------------------------------------------------------------------
| المبيعات
|--------------------------------------------------------------------------
|
| لوحة المبيعات · خط الأنابيب · الفرص · بوابة العميل
|
| ضمّه في routes/api.php:
|     require __DIR__ . '/sales-routes.php';
|
*/

use AppHttpControllersApiQuotationPortalController;
use AppHttpControllersApiSalesDashboardController;
use AppHttpControllersApiSalesOpportunityController;
use IlluminateSupportFacadesRoute;

Route::prefix('sales')->group(function () {

    /* ===== اللوحات ===== */
    Route::get('dashboard', [SalesDashboardController::class, 'dashboard']);
    Route::get('pipeline', [SalesDashboardController::class, 'pipeline']);
    Route::get('quotations-board', [SalesDashboardController::class, 'quotationsBoard']);
    Route::get('forecast', [SalesDashboardController::class, 'forecast']);
    Route::get('loss-analysis', [SalesDashboardController::class, 'lossAnalysis']);

    /* ===== البيانات المرجعية ===== */
    Route::get('stages', [SalesOpportunityController::class, 'stages']);
    Route::get('loss-reasons', [SalesOpportunityController::class, 'lossReasons']);

    /* ===== الفرص ===== */
    Route::prefix('opportunities')->group(function () {
        Route::get('/', [SalesOpportunityController::class, 'index']);
        Route::post('/', [SalesOpportunityController::class, 'store']);

        Route::get('{opportunity}', [SalesOpportunityController::class, 'show']);
        Route::put('{opportunity}', [SalesOpportunityController::class, 'update']);

        Route::post('{opportunity}/move', [SalesOpportunityController::class, 'move']);
        Route::post('{opportunity}/lose', [SalesOpportunityController::class, 'lose']);
        Route::post('{opportunity}/convert', [SalesOpportunityController::class, 'convert']);
    });

    /* ===== بوابة العميل — الجانب الداخلي ===== */
    Route::prefix('quotations/{quotation}')->group(function () {
        Route::post('warnings', [QuotationPortalController::class, 'warnings']);
        Route::post('portal-link', [QuotationPortalController::class, 'createLink']);
        Route::get('portal-status', [QuotationPortalController::class, 'status']);
    });
});

/*
|--------------------------------------------------------------------------
| المسارات العامة — بدون مصادقة
|--------------------------------------------------------------------------
|
| التوكن نفسه هو الإثبات. لازم تكون بره أي middleware مصادقة،
| ويُنصح بإضافة throttle عليها.
|
*/
Route::prefix('public/quotations')
    ->middleware('throttle:30,1')
    ->group(function () {
        Route::get('{token}', [QuotationPortalController::class, 'publicShow']);

        Route::post(
            '{token}/approve',
            [QuotationPortalController::class, 'publicApprove']
        );

        Route::post(
            '{token}/request-changes',
            [QuotationPortalController::class, 'publicRequestChanges']
        );
    });
