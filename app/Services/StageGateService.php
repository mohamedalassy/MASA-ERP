<?php

namespace App\Services;

use App\Models\Project;
use App\Models\ProjectStageGateCheck;
use App\Models\ProjectStageRequirement;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * بوابة الانتقال بين الأقسام.
 *
 * دلوقتي الانتقال زر واحد بينقل المرحلة فورًا. الخدمة دي بتخليه
 * بوابة: بتفحص الشروط، وبترجع اللي ناقص، وبتمنع الانتقال لو فيه
 * شرط إلزامي مش متحقق — إلا بتجاوز مسجَّل بمن أجازه والسبب.
 */
class StageGateService
{
    public function __construct(
        private readonly ProjectEventService $events
    ) {}

    /**
     * حالة البوابة لمشروع — دي اللي الواجهة بتعرضها كـ checklist.
     *
     * @return array{can_advance:bool,requirements:array,blocking_count:int}
     */
    public function evaluate(Project $project, ?string $toStage = null): array
    {
        $requirements = ProjectStageRequirement::query()
            ->where('from_stage', $project->current_stage)
            ->where('is_active', true)
            ->when(
                $toStage,
                fn ($q) => $q->where(function ($inner) use ($toStage) {
                    $inner->whereNull('to_stage')
                        ->orWhere('to_stage', $toStage);
                })
            )
            ->orderBy('sort_order')
            ->get();

        $checks = ProjectStageGateCheck::query()
            ->where('project_id', $project->id)
            ->whereIn('requirement_id', $requirements->pluck('id'))
            ->get()
            ->keyBy('requirement_id');

        $rows = $requirements->map(function ($requirement) use ($project, $checks) {
            $check = $checks->get($requirement->id);

            $status = $check?->status ?? 'pending';

            // الفحص الآلي يُحسب لحظيًا، لا يُنتظر من المستخدم
            if ($requirement->check_mode === 'automatic') {
                $status = $this->runAutomaticCheck($requirement, $project)
                    ? 'satisfied'
                    : 'pending';
            }

            return [
                'requirement_id' => $requirement->id,
                'code' => $requirement->code,
                'label' => $requirement->label,
                'note' => $requirement->note,
                'check_mode' => $requirement->check_mode,
                'is_mandatory' => (bool) $requirement->is_mandatory,
                'is_overridable' => (bool) $requirement->is_overridable,
                'status' => $status,
                'satisfied_at' => $check?->satisfied_at,
                'waived_by' => $check?->waived_by,
                'waiver_reason' => $check?->waiver_reason,
                'is_blocking' => $requirement->is_mandatory
                    && !in_array($status, ['satisfied', 'waived'], true),
            ];
        });

        $blocking = $rows->where('is_blocking', true);

        return [
            'can_advance' => $blocking->isEmpty(),
            'blocking_count' => $blocking->count(),
            'requirements' => $rows->values()->all(),
        ];
    }

    /** يرفض الانتقال لو فيه شرط إلزامي مش متحقق. */
    public function assertCanAdvance(Project $project, ?string $toStage = null): void
    {
        $gate = $this->evaluate($project, $toStage);

        if ($gate['can_advance']) {
            return;
        }

        $labels = collect($gate['requirements'])
            ->where('is_blocking', true)
            ->pluck('label')
            ->implode(' · ');

        throw ValidationException::withMessages([
            'stage' => [
                'لا يمكن الانتقال — شروط ناقصة: ' . $labels,
            ],
        ]);
    }

    /** تعليم شرط يدوي كمتحقق. */
    public function satisfy(
        Project $project,
        ProjectStageRequirement $requirement,
        ?string $evidence = null,
        ?int $userId = null
    ): ProjectStageGateCheck {
        return DB::transaction(function () use (
            $project,
            $requirement,
            $evidence,
            $userId
        ) {
            $check = ProjectStageGateCheck::updateOrCreate(
                [
                    'project_id' => $project->id,
                    'requirement_id' => $requirement->id,
                ],
                [
                    'status' => 'satisfied',
                    'satisfied_by' => $userId,
                    'satisfied_at' => now(),
                    'evidence' => $evidence,
                ]
            );

            $this->events->log(
                $project,
                'system',
                'تم استيفاء شرط الانتقال: ' . $requirement->label,
                meta: $evidence,
                userId: $userId,
                isSystem: true
            );

            return $check;
        });
    }

    /**
     * تجاوز شرط — السبب إلزامي والتجاوز يُسجَّل في السجل الموحّد
     * كحدث دائم لا يمكن حذفه.
     */
    public function waive(
        Project $project,
        ProjectStageRequirement $requirement,
        string $reason,
        ?int $userId = null
    ): ProjectStageGateCheck {
        if (!$requirement->is_overridable) {
            throw ValidationException::withMessages([
                'requirement' => ['الشرط ده غير قابل للتجاوز.'],
            ]);
        }

        return DB::transaction(function () use (
            $project,
            $requirement,
            $reason,
            $userId
        ) {
            $check = ProjectStageGateCheck::updateOrCreate(
                [
                    'project_id' => $project->id,
                    'requirement_id' => $requirement->id,
                ],
                [
                    'status' => 'waived',
                    'waived_by' => $userId,
                    'waived_at' => now(),
                    'waiver_reason' => $reason,
                ]
            );

            $this->events->log(
                $project,
                'approval',
                'تجاوز شرط الانتقال: ' . $requirement->label,
                meta: 'السبب: ' . $reason,
                userId: $userId,
                isSystem: true
            );

            return $check;
        });
    }

    /** الفحوص الآلية — كل واحد بيقرأ من الداتا الموجودة. */
    private function runAutomaticCheck(
        ProjectStageRequirement $requirement,
        Project $project
    ): bool {
        return match ($requirement->handler) {
            'approved_quotation' => DB::table('project_quotations')
                ->where('project_id', $project->id)
                ->where('status', 'approved')
                ->exists(),

            'purchase_orders_received' => !DB::table('purchase_orders')
                ->where('project_id', $project->id)
                ->whereNotIn('status', ['received', 'cancelled'])
                ->exists(),

            'no_pending_supplier_invoices' => !DB::table('supplier_invoices')
                ->where('project_id', $project->id)
                ->whereIn('status', ['draft', 'pending'])
                ->exists(),

            'fully_invoiced' => $this->isFullyInvoiced($project),

            'fully_collected' => !DB::table('tax_invoices')
                ->where('project_id', $project->id)
                ->whereIn('status', ['issued', 'partially_paid'])
                ->where('remaining_amount', '>', 0.01)
                ->exists(),

            'has_signed_handover' => DB::table('project_attachments')
                ->where('project_id', $project->id)
                ->where('category', 'handover')
                ->exists(),

            default => false,
        };
    }

    private function isFullyInvoiced(Project $project): bool
    {
        $approved = (float) DB::table('project_quotations')
            ->where('project_id', $project->id)
            ->where('status', 'approved')
            ->sum('total');

        if ($approved <= 0) {
            return false;
        }

        $invoiced = (float) DB::table('tax_invoices')
            ->where('project_id', $project->id)
            ->whereIn('status', ['issued', 'paid', 'partially_paid'])
            ->selectRaw("
                COALESCE(SUM(
                    CASE WHEN document_type = 'credit_note'
                    THEN -total ELSE total END
                ), 0) as total
            ")
            ->value('total');

        return $approved - $invoiced < 0.01;
    }
}
