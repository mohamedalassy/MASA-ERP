<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectSiteCheckin;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * بصمة المهندس من صفحة المشروع.
 *
 * المهندس بيسجّل حضوره من المشروع نفسه بدل ما يجي الشركة،
 * والنظام بيتحقق من الموقع الجغرافي قبل القبول.
 */
class SiteCheckinService
{
    public function __construct(
        private readonly ProjectEventService $events
    ) {}

    /**
     * تسجيل حضور.
     *
     * @param  array{latitude?:float,longitude?:float,photo_path?:string}  $data
     */
    public function checkIn(
        Project $project,
        int $userId,
        array $data
    ): ProjectSiteCheckin {
        $open = ProjectSiteCheckin::query()
            ->where('project_id', $project->id)
            ->where('user_id', $userId)
            ->where('status', 'open')
            ->first();

        if ($open) {
            throw ValidationException::withMessages([
                'checkin' => [
                    'عندك تسجيل حضور مفتوح على المشروع ده — سجّل الانصراف أولًا.',
                ],
            ]);
        }

        if ($project->site_requires_photo && empty($data['photo_path'])) {
            throw ValidationException::withMessages([
                'photo_path' => [
                    'المشروع ده بيطلب صورة مع تسجيل الحضور.',
                ],
            ]);
        }

        $verification = $this->verifyLocation($project, $data);

        $checkin = ProjectSiteCheckin::create([
            'project_id' => $project->id,
            'user_id' => $userId,
            'checked_in_at' => now(),
            'checkin_latitude' => $data['latitude'] ?? null,
            'checkin_longitude' => $data['longitude'] ?? null,
            'checkin_distance_meters' => $verification['distance'],
            'checkin_photo_path' => $data['photo_path'] ?? null,
            'verification_status' => $verification['status'],
            'status' => 'open',
        ]);

        $this->events->log(
            $project,
            'site',
            'تسجيل حضور في الموقع',
            meta: $this->describeVerification($verification),
            referenceType: 'site_checkin',
            referenceId: $checkin->id,
            userId: $userId,
            isSystem: true
        );

        return $checkin;
    }

    /** تسجيل انصراف — بيحسب المدة ويقفل السجل. */
    public function checkOut(
        ProjectSiteCheckin $checkin,
        array $data = []
    ): ProjectSiteCheckin {
        if ($checkin->status !== 'open') {
            throw ValidationException::withMessages([
                'checkin' => ['السجل ده مقفول بالفعل.'],
            ]);
        }

        $project = $checkin->project;
        $verification = $this->verifyLocation($project, $data);

        $minutes = $checkin->checked_in_at->diffInMinutes(now());

        return DB::transaction(function () use (
            $checkin,
            $data,
            $verification,
            $minutes,
            $project
        ) {
            $checkin->update([
                'checked_out_at' => now(),
                'checkout_latitude' => $data['latitude'] ?? null,
                'checkout_longitude' => $data['longitude'] ?? null,
                'checkout_distance_meters' => $verification['distance'],
                'duration_minutes' => $minutes,
                'work_summary' => $data['work_summary'] ?? null,
                'status' => 'closed',
            ]);

            $this->events->log(
                $project,
                'site',
                'تسجيل انصراف من الموقع — المدة ' . $this->formatDuration($minutes),
                meta: $data['work_summary'] ?? null,
                referenceType: 'site_checkin',
                referenceId: $checkin->id,
                userId: $checkin->user_id,
                isSystem: true
            );

            return $checkin->fresh();
        });
    }

    /**
     * التحقق من الموقع بمعادلة haversine.
     *
     * @return array{status:string,distance:?int}
     */
    private function verifyLocation(Project $project, array $data): array
    {
        $lat = $data['latitude'] ?? null;
        $lng = $data['longitude'] ?? null;

        if ($lat === null || $lng === null) {
            return ['status' => 'no_location', 'distance' => null];
        }

        if ($project->site_latitude === null || $project->site_longitude === null) {
            // الموقع مش معرَّف على المشروع — نقبل ونسجّل
            return ['status' => 'verified', 'distance' => null];
        }

        $distance = $this->haversine(
            (float) $project->site_latitude,
            (float) $project->site_longitude,
            (float) $lat,
            (float) $lng
        );

        $allowed = (int) ($project->site_geofence_meters ?: 200);

        return [
            'status' => $distance <= $allowed ? 'verified' : 'outside_geofence',
            'distance' => (int) round($distance),
        ];
    }

    /** المسافة بالمتر بين نقطتين. */
    private function haversine(
        float $lat1,
        float $lng1,
        float $lat2,
        float $lng2
    ): float {
        $earthRadius = 6371000;

        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function describeVerification(array $verification): string
    {
        return match ($verification['status']) {
            'verified' => $verification['distance'] !== null
                ? 'داخل النطاق · ' . $verification['distance'] . ' م من مركز الموقع'
                : 'تم التحقق',
            'outside_geofence' => 'خارج النطاق · '
                . $verification['distance'] . ' م — يحتاج اعتماد',
            'no_location' => 'بدون موقع جغرافي — يحتاج اعتماد',
            default => 'إدخال يدوي',
        };
    }

    private function formatDuration(int $minutes): string
    {
        $hours = intdiv($minutes, 60);
        $rest = $minutes % 60;

        return $hours > 0
            ? "{$hours} س {$rest} د"
            : "{$rest} د";
    }
}
