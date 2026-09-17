<?php

/*
|--------------------------------------------------------------------------
| الموارد البشرية
|--------------------------------------------------------------------------
|
| الرواتب · الامتثال · الإجازات
|
| ضمّه في routes/api.php:
|     require __DIR__ . '/hr-routes.php';
|
*/

use AppHttpControllersApiHrComplianceController;
use AppHttpControllersApiHrLeaveController;
use AppHttpControllersApiHrPayrollController;
use IlluminateSupportFacadesRoute;

Route::prefix('hr')->group(function () {

    /* ===== تشغيل الرواتب ===== */
    Route::prefix('payroll-runs')->group(function () {
        Route::get('/', [HrPayrollController::class, 'index']);
        Route::post('/', [HrPayrollController::class, 'store']);

        Route::get('{payrollRun}', [HrPayrollController::class, 'show']);

        Route::post(
            '{payrollRun}/recalculate',
            [HrPayrollController::class, 'recalculate']
        );
        Route::post('{payrollRun}/approve', [HrPayrollController::class, 'approve']);
        Route::post('{payrollRun}/post', [HrPayrollController::class, 'post']);

        /* ملف حماية الأجور — مدد */
        Route::post(
            '{payrollRun}/wps/validate',
            [HrPayrollController::class, 'validateWps']
        );
        Route::post(
            '{payrollRun}/wps/generate',
            [HrPayrollController::class, 'generateWps']
        );
        Route::get(
            '{payrollRun}/wps/download',
            [HrPayrollController::class, 'downloadWps']
        );
    });

    /* ===== لوحة الامتثال ===== */
    Route::prefix('compliance')->group(function () {
        Route::get('/', [HrComplianceController::class, 'dashboard']);
        Route::post('scan', [HrComplianceController::class, 'scan']);
        Route::get('alerts', [HrComplianceController::class, 'alerts']);
        Route::post(
            'alerts/{alert}/resolve',
            [HrComplianceController::class, 'resolve']
        );
    });

    /* ===== الإجازات ===== */
    Route::get('leave-types', [HrLeaveController::class, 'types']);

    Route::prefix('leave-requests')->group(function () {
        Route::get('/', [HrLeaveController::class, 'index']);
        Route::post('/', [HrLeaveController::class, 'store']);
        Route::post('{leaveRequest}/decide', [HrLeaveController::class, 'decide']);
    });

    Route::get(
        'employees/{employee}/leave-balances',
        [HrLeaveController::class, 'balances']
    );
});
