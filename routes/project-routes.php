<?php

/*
|--------------------------------------------------------------------------
| إضافات صفحة المشروع
|--------------------------------------------------------------------------
|
| السجل الموحّد · الأنشطة · بوابة المراحل · بصمة الموقع
|
| ضمّه في routes/api.php:
|     require __DIR__ . '/project-routes.php';
|
| ملاحظة: ProjectController نفسه لسه مفقود من الحزمة المستعادة —
| المسارات دي إضافية عليه، مش بديلة له.
|
*/

use AppHttpControllersApiProjectActivityController;
use AppHttpControllersApiProjectEventController;
use AppHttpControllersApiProjectSiteCheckinController;
use AppHttpControllersApiProjectStageGateController;
use IlluminateSupportFacadesRoute;

// مهامي عبر كل المشاريع — المسار الثابت قبل أي {project}
Route::get('my-activities', [ProjectActivityController::class, 'mine']);

Route::prefix('projects/{project}')->group(function () {

    /* السجل الموحّد والمحادثة */
    Route::get('events', [ProjectEventController::class, 'index']);
    Route::post('events', [ProjectEventController::class, 'store']);
    Route::delete('events/{event}', [ProjectEventController::class, 'destroy']);

    /* الأنشطة المجدولة */
    Route::get('activities', [ProjectActivityController::class, 'index']);
    Route::post('activities', [ProjectActivityController::class, 'store']);
    Route::put('activities/{activity}', [ProjectActivityController::class, 'update']);
    Route::post(
        'activities/{activity}/complete',
        [ProjectActivityController::class, 'complete']
    );

    /* بوابة الانتقال بين الأقسام */
    Route::get('stage-gate', [ProjectStageGateController::class, 'show']);
    Route::post(
        'stage-gate/{requirement}/satisfy',
        [ProjectStageGateController::class, 'satisfy']
    );
    Route::post(
        'stage-gate/{requirement}/waive',
        [ProjectStageGateController::class, 'waive']
    );

    /* بصمة المهندس */
    Route::prefix('site-checkins')->group(function () {
        Route::get('/', [ProjectSiteCheckinController::class, 'index']);
        Route::post('check-in', [ProjectSiteCheckinController::class, 'checkIn']);
        Route::post(
            '{checkin}/check-out',
            [ProjectSiteCheckinController::class, 'checkOut']
        );
        Route::post(
            '{checkin}/approve',
            [ProjectSiteCheckinController::class, 'approve']
        );
    });
});
