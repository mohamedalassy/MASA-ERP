<?php

namespace App\Services;

use App\Models\Project;
use App\Models\SalesOpportunity;
use App\Models\SalesStage;
use App\Services\DocumentNumberService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * إدارة الفرص — المرحلة اللي بتسبق المشروع.
 *
 * المشكلة اللي بتحلها: دلوقتي أول كيان في النظام هو "مشروع"، يعني
 * لازم تكون كسبت الصفقة عشان تسجّلها. فالاستفسارات اللي في مرحلة
 * التفاوض غير موجودة، ومافيش إجابة على «إيه اللي في الطريق؟».
 */
class OpportunityService
{
    public function __construct(
        private readonly DocumentNumberService $sequences
    ) {}

    /** نقل الفرصة لمرحلة جديدة مع تسجيل مدة البقاء. */
    public function moveToStage(
        SalesOpportunity $opportunity,
        SalesStage $stage,
        ?int $userId = null
    ): SalesOpportunity {
        if ($opportunity->status !== 'open') {
            throw ValidationException::withMessages([
                'stage_id' => ['لا يمكن نقل فرصة مغلقة.'],
            ]);
        }

        return DB::transaction(function () use ($opportunity, $stage, $userId) {
            $previousStage = $opportunity->stage;

            $daysInPrevious = $opportunity->stage_entered_at
                ? $opportunity->stage_entered_at->diffInDays(now())
                : null;

            DB::table('sales_opportunity_stage_history')->insert([
                'opportunity_id' => $opportunity->id,
                'from_stage_id' => $previousStage?->id,
                'to_stage_id' => $stage->id,
                'days_in_previous_stage' => $daysInPrevious,
                'moved_by' => $userId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $updates = [
                'stage_id' => $stage->id,
                'stage_entered_at' => now(),
            ];

            /*
             * الاحتمالية بتتحدّث من المرحلة — إلا لو المستخدم
             * عدّلها يدويًا، فنحترم قيمته.
             */
            if (!$opportunity->probability_overridden) {
                $updates['probability'] = $stage->default_probability;
            }

            // المرحلة النهائية بتقفل الفرصة
            if ($stage->is_final === 'won') {
                $updates['status'] = 'won';
                $updates['closed_at'] = now();
                $updates['probability'] = 100;
            }

            if ($stage->is_final === 'lost') {
                $updates['status'] = 'lost';
                $updates['closed_at'] = now();
                $updates['probability'] = 0;
            }

            $opportunity->update($updates);

            return $opportunity->fresh(['stage']);
        });
    }

    /** تسجيل الخسارة بسبب معرَّف — أساس التحليل. */
    public function markLost(
        SalesOpportunity $opportunity,
        int $lossReasonId,
        ?string $note = null,
        ?string $competitorName = null,
        ?float $competitorPrice = null,
        ?int $userId = null
    ): SalesOpportunity {
        $reason = DB::table('sales_loss_reasons')
            ->where('id', $lossReasonId)
            ->first();

        if (!$reason) {
            throw ValidationException::withMessages([
                'loss_reason_id' => ['سبب الخسارة غير موجود.'],
            ]);
        }

        if ($reason->requires_note && empty($note)) {
            throw ValidationException::withMessages([
                'loss_note' => ['السبب ده بيتطلب ملاحظة توضيحية.'],
            ]);
        }

        $lostStage = SalesStage::where('is_final', 'lost')->first();

        return DB::transaction(function () use (
            $opportunity,
            $lossReasonId,
            $note,
            $competitorName,
            $competitorPrice,
            $lostStage,
            $userId
        ) {
            $opportunity->update([
                'status' => 'lost',
                'loss_reason_id' => $lossReasonId,
                'loss_note' => $note,
                'competitor_name' => $competitorName,
                'competitor_price' => $competitorPrice,
                'closed_at' => now(),
                'probability' => 0,
                'stage_id' => $lostStage?->id ?? $opportunity->stage_id,
            ]);

            return $opportunity->fresh(['stage', 'lossReason']);
        });
    }

    /**
     * تحويل الفرصة المكسوبة لمشروع.
     * بيانات العميل بتنتقل، والفرصة بتتربط بالمشروع.
     */
    public function convertToProject(
        SalesOpportunity $opportunity,
        array $extra = [],
        ?int $userId = null
    ): Project {
        if ($opportunity->project_id) {
            throw ValidationException::withMessages([
                'opportunity' => ['الفرصة دي متحوّلة لمشروع بالفعل.'],
            ]);
        }

        $wonStage = SalesStage::where('is_final', 'won')->first();

        return DB::transaction(function () use (
            $opportunity,
            $extra,
            $wonStage,
            $userId
        ) {
            $project = Project::create([
                'project_code' => $this->sequences->next('project', 'PRJ'),
                'name' => $extra['name'] ?? $opportunity->title,

                'customer_name' => $opportunity->customer_name,
                'customer_code' => $opportunity->customer_code,
                'phone' => $opportunity->phone,
                'email' => $opportunity->email,

                'project_manager' => $extra['project_manager'] ?? null,
                'account_manager' => $extra['account_manager'] ?? null,

                'current_stage' => 'pricing',
                'status' => 'active',

                'project_type' => $opportunity->project_type,
                'priority' => $extra['priority'] ?? 'normal',
                'expected_start_date' => $extra['expected_start_date'] ?? null,
                'expected_end_date' => $extra['expected_end_date'] ?? null,
                'total_value' => $opportunity->estimated_value,

                'created_by' => $userId,
            ]);

            $opportunity->update([
                'status' => 'won',
                'project_id' => $project->id,
                'closed_at' => now(),
                'probability' => 100,
                'stage_id' => $wonStage?->id ?? $opportunity->stage_id,
            ]);

            return $project;
        });
    }

    /** إنشاء فرصة جديدة. */
    public function create(array $data, ?int $userId = null): SalesOpportunity
    {
        $stage = $data['stage_id']
            ? SalesStage::find($data['stage_id'])
            : SalesStage::where('is_active', true)
                ->whereNull('is_final')
                ->orderBy('sort_order')
                ->first();

        if (!$stage) {
            throw ValidationException::withMessages([
                'stage_id' => [
                    'مافيش مراحل معرَّفة — شغّل SalesStagesSeeder.',
                ],
            ]);
        }

        return SalesOpportunity::create([
            ...$data,
            'opportunity_number' => $this->sequences->next('opportunity', 'OPP'),
            'stage_id' => $stage->id,
            'probability' => $data['probability'] ?? $stage->default_probability,
            'stage_entered_at' => now(),
            'status' => 'open',
            'created_by' => $userId,
        ]);
    }
}
