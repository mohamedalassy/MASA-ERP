<?php

/*
|--------------------------------------------------------------------------
| Bank Reconciliation
|--------------------------------------------------------------------------
|
| BankReconciliationController مستعاد وكامل بـ٩ دوال، لكن مافيش ولا
| route واحد له في api.php — فشاشة BankReconciliation.jsx بترجع 404
| على كل نداء. المسارات دي هي اللي الشاشة بتناديها بالظبط.
|
| ضمّ الملف ده في routes/api.php:
|     require __DIR__ . '/bank-reconciliation-routes.php';
| أو انسخ محتواه جوا api.php مباشرة.
|
| مهم: المسار الثابت (cash-accounts) لازم يتعرّف قبل المتغيّر
| {bankReconciliation}، وإلا Laravel يحاول يفسّر "cash-accounts"
| كـ id ويرجع 404.
|
*/

use AppHttpControllersApiBankReconciliationController;
use IlluminateSupportFacadesRoute;

Route::prefix('finance/bank-reconciliations')->group(function () {
    Route::get(
        'cash-accounts',
        [BankReconciliationController::class, 'accounts']
    );

    Route::get('/', [BankReconciliationController::class, 'index']);

    Route::post('/', [BankReconciliationController::class, 'store']);

    Route::get(
        '{bankReconciliation}',
        [BankReconciliationController::class, 'show']
    );

    Route::post(
        '{bankReconciliation}/import',
        [BankReconciliationController::class, 'import']
    );

    Route::post(
        '{bankReconciliation}/auto-match',
        [BankReconciliationController::class, 'autoMatch']
    );

    Route::post(
        '{bankReconciliation}/lines/{line}/match',
        [BankReconciliationController::class, 'match']
    );

    Route::delete(
        '{bankReconciliation}/lines/{line}/match',
        [BankReconciliationController::class, 'unmatch']
    );

    Route::post(
        '{bankReconciliation}/complete',
        [BankReconciliationController::class, 'complete']
    );
});
