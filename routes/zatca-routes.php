<?php

/*
|--------------------------------------------------------------------------
| ZATCA — الفاتورة الإلكترونية
|--------------------------------------------------------------------------
|
| ضمّه في routes/api.php:
|     require __DIR__ . '/zatca-routes.php';
|
*/

use AppHttpControllersApiZatcaController;
use IlluminateSupportFacadesRoute;

Route::prefix('finance/zatca')->group(function () {
    // المسارات الثابتة قبل المتغيّرة
    Route::get('documents', [ZatcaController::class, 'index']);
    Route::get('verify-chain', [ZatcaController::class, 'verifyChain']);
    Route::post('retry-pending', [ZatcaController::class, 'retryPending']);
    Route::post('decode-qr', [ZatcaController::class, 'decodeQr']);

    Route::get('{taxInvoice}', [ZatcaController::class, 'show']);
    Route::get('{taxInvoice}/xml', [ZatcaController::class, 'downloadXml']);
    Route::post('{taxInvoice}/submit', [ZatcaController::class, 'submit']);
});
