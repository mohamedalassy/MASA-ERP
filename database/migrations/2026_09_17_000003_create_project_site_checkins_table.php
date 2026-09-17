<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * بصمة المهندس من صفحة المشروع.
 *
 * الفكرة: مهندس الموقع يسجّل حضوره من المشروع نفسه بدل ما يجي
 * الشركة — والتسجيل بيتحقق من الموقع الجغرافي قبل القبول،
 * وبيتحوّل لسجل حضور في الموارد البشرية.
 *
 * الحقول المضافة على projects: إحداثيات موقع التنفيذ ونطاق البصمة.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            if (!Schema::hasColumn('projects', 'site_address')) {
                $table->string('site_address')->nullable()->after('address');
            }

            if (!Schema::hasColumn('projects', 'site_latitude')) {
                $table->decimal('site_latitude', 10, 7)->nullable();
                $table->decimal('site_longitude', 10, 7)->nullable();

                // نصف قطر النطاق المسموح بالتسجيل داخله
                $table->unsignedSmallInteger('site_geofence_meters')->default(200);

                // إلزام إرفاق صورة مع التسجيل
                $table->boolean('site_requires_photo')->default(false);
            }

            if (!Schema::hasColumn('projects', 'site_engineer_id')) {
                $table->foreignId('site_engineer_id')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();
            }
        });

        Schema::create('project_site_checkins', function (Blueprint $table) {
            $table->id();

            $table->foreignId('project_id')
                ->constrained('projects')
                ->cascadeOnDelete();

            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete();

            // الحضور
            $table->timestamp('checked_in_at');
            $table->decimal('checkin_latitude', 10, 7)->nullable();
            $table->decimal('checkin_longitude', 10, 7)->nullable();

            // المسافة المحسوبة من مركز الموقع — تُحفظ للتدقيق
            $table->unsignedInteger('checkin_distance_meters')->nullable();

            $table->string('checkin_photo_path')->nullable();

            // الانصراف
            $table->timestamp('checked_out_at')->nullable();
            $table->decimal('checkout_latitude', 10, 7)->nullable();
            $table->decimal('checkout_longitude', 10, 7)->nullable();
            $table->unsignedInteger('checkout_distance_meters')->nullable();

            // المدة بالدقائق — تُحسب عند الانصراف
            $table->unsignedInteger('duration_minutes')->nullable();

            /*
             * حالة التحقق:
             *   verified        = داخل النطاق
             *   outside_geofence = خارج النطاق (يحتاج اعتماد)
             *   no_location     = المتصفح رفض الموقع
             *   manual          = أُدخل يدويًا بواسطة مشرف
             */
            $table->string('verification_status', 30)->default('verified');

            $table->text('work_summary')->nullable();

            // open | closed | approved | rejected
            $table->string('status', 20)->default('open');

            $table->foreignId('approved_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('approved_at')->nullable();
            $table->text('rejection_reason')->nullable();

            /*
             * الربط بالموارد البشرية — سجل الحضور اليومي الناتج.
             * (hr_attendance_daily موجود عندك بالفعل)
             */
            $table->unsignedBigInteger('hr_attendance_daily_id')->nullable();

            $table->timestamps();

            $table->index(['project_id', 'checked_in_at']);
            $table->index(['user_id', 'checked_in_at']);
            $table->index(['status', 'verification_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_site_checkins');

        Schema::table('projects', function (Blueprint $table) {
            $table->dropConstrainedForeignKey('site_engineer_id');

            $table->dropColumn([
                'site_address',
                'site_latitude',
                'site_longitude',
                'site_geofence_meters',
                'site_requires_photo',
            ]);
        });
    }
};
