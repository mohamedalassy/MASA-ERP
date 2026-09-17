<?php

/*
|--------------------------------------------------------------------------
| مسارات الكنترولرات الجديدة
|--------------------------------------------------------------------------
|
| المسارات دي متقسّمة لقسمين:
|
|   ١. مسارات كانت معرّفة في api.php لكن كنترولراتها مفقودة —
|      دلوقتي الكنترولرات موجودة، فالمسارات القديمة هتشتغل زي ما هي
|      ومحتاجة بس تتأكد إن الـ use statements موجودة في أول api.php.
|
|   ٢. مسارات جديدة تمامًا (الأصول الثابتة · البدائل · الإهلاك) —
|      دي اللي في الملف ده.
|
| ضمّه في routes/api.php:
|     require __DIR__ . '/additional-routes.php';
|
*/

use AppHttpControllersApiFixedAssetController;
use AppHttpControllersApiProductAlternativeController;
use IlluminateSupportFacadesRoute;

/*
|--------------------------------------------------------------------------
| الأصول الثابتة — جديدة بالكامل
|--------------------------------------------------------------------------
*/
Route::prefix('finance/fixed-assets')->group(function () {
    // المسار الثابت قبل المتغيّر
    Route::post('run-depreciation', [FixedAssetController::class, 'runDepreciation']);

    Route::get('/', [FixedAssetController::class, 'index']);
    Route::post('/', [FixedAssetController::class, 'store']);

    Route::get('{fixedAsset}', [FixedAssetController::class, 'show']);
    Route::put('{fixedAsset}', [FixedAssetController::class, 'update']);

    Route::post('{fixedAsset}/dispose', [FixedAssetController::class, 'dispose']);
});

/*
|--------------------------------------------------------------------------
| بدائل المنتجات
|--------------------------------------------------------------------------
| المسارات دي معرّفة في api.php عندك بالفعل — الكنترولر بس كان مفقودًا.
| مسجّلة هنا للتوثيق؛ لو موجودة عندك متكررهاش.
|--------------------------------------------------------------------------
*/
// Route::get('/product-alternatives', [ProductAlternativeController::class, 'index']);
// Route::get('/products/{product}/alternatives', [ProductAlternativeController::class, 'productAlternatives']);
// Route::post('/product-alternatives', [ProductAlternativeController::class, 'store']);
// Route::put('/product-alternatives/{productAlternative}', [ProductAlternativeController::class, 'update']);
// Route::delete('/product-alternatives/{productAlternative}', [ProductAlternativeController::class, 'destroy']);
