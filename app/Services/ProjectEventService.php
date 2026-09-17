<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectEvent;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * السجل الموحّد للمشروع.
 *
 * كل حاجة تحصل على المشروع تُسجَّل هنا: تعليقات المستخدمين وأحداث
 * النظام معًا في خط زمني واحد. ده اللي بيخلّي صفحة المشروع تجاوب
 * على «إيه اللي حصل؟» بدون ما حد يفتح خمس شاشات.
 *
 * الاستخدام من أي كنترولر:
 *   $events->log($project, 'finance', 'إصدار فاتورة INV-0087', meta: '123,750 ر.س');
 */
class ProjectEventService
{
    /** حدث نظام أو تعليق. */
    public function log(
        Project $project,
        string $category,
        string $body,
        ?string $meta = null,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?int $userId = null,
        bool $isSystem = false,
        bool $isInternal = false
    ): ProjectEvent {
        return ProjectEvent::create([
            'project_id' => $project->id,
            'category' => $category,
            'body' => $body,
            'meta' => $meta,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'is_system' => $isSystem,
            'is_internal' => $isInternal,
            'created_by' => $userId,
        ]);
    }

    /**
     * تعليق مستخدم مع استخراج الإشارات @.
     * الإشارة بتنشئ صف في project_event_mentions فالمستخدم يشوفها
     * في إشعاراته.
     */
    public function comment(
        Project $project,
        string $body,
        ?int $userId = null,
        bool $isInternal = false
    ): ProjectEvent {
        return DB::transaction(function () use (
            $project,
            $body,
            $userId,
            $isInternal
        ) {
            $event = $this->log(
                $project,
                $isInternal ? 'note' : 'message',
                $body,
                userId: $userId,
                isInternal: $isInternal
            );

            $this->attachMentions($event, $body, $userId);

            return $event;
        });
    }

    /** انتقال مرحلة — بيسجّل من وإلى ومين سلّم. */
    public function logStageTransfer(
        Project $project,
        ?string $fromStage,
        string $toStage,
        ?string $reason = null,
        ?int $userId = null
    ): ProjectEvent {
        $labels = [
            'crm' => 'إدارة العملاء',
            'sales' => 'المبيعات',
            'pricing' => 'التسعير',
            'purchasing' => 'المشتريات',
            'finance' => 'المالية',
            'execution' => 'التنفيذ',
            'closed' => 'الإغلاق',
        ];

        $from = $labels[$fromStage] ?? $fromStage ?? '—';
        $to = $labels[$toStage] ?? $toStage;

        return $this->log(
            $project,
            'stage',
            "تسليم المشروع من {$from} إلى {$to}",
            meta: $reason,
            userId: $userId,
            isSystem: true
        );
    }

    /** يستخرج @اسم_المستخدم ويربطها بالحدث. */
    private function attachMentions(
        ProjectEvent $event,
        string $body,
        ?int $authorId
    ): void {
        preg_match_all('/@([\p{Arabic}\w.\-]+)/u', $body, $matches);

        if (empty($matches[1])) {
            return;
        }

        $names = array_unique($matches[1]);

        $userIds = User::query()
            ->where(function ($q) use ($names) {
                foreach ($names as $name) {
                    $q->orWhere('name', 'like', '%' . $name . '%')
                        ->orWhere('email', 'like', $name . '%');
                }
            })
            ->whereKeyNot($authorId)
            ->pluck('id');

        foreach ($userIds as $userId) {
            DB::table('project_event_mentions')->insertOrIgnore([
                'project_event_id' => $event->id,
                'user_id' => $userId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
