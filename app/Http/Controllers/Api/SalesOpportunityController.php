<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesOpportunity;
use App\Models\SalesStage;
use App\Services\OpportunityService;
use Illuminate\Http\Request;

/**
 * الفرص.
 *
 * المسارات:
 *   GET    /api/sales/stages
 *   GET    /api/sales/loss-reasons
 *   GET    /api/sales/opportunities
 *   POST   /api/sales/opportunities
 *   GET    /api/sales/opportunities/{opportunity}
 *   PUT    /api/sales/opportunities/{opportunity}
 *   POST   /api/sales/opportunities/{opportunity}/move
 *   POST   /api/sales/opportunities/{opportunity}/lose
 *   POST   /api/sales/opportunities/{opportunity}/convert
 */
class SalesOpportunityController extends Controller
{
    public function __construct(
        private readonly OpportunityService $opportunities
    ) {}

    public function stages()
    {
        return response()->json([
            'success' => true,
            'data' => SalesStage::where('is_active', true)
                ->orderBy('sort_order')
                ->get(),
        ]);
    }

    public function lossReasons()
    {
        return response()->json([
            'success' => true,
            'data' => \DB::table('sales_loss_reasons')
                ->where('is_active', true)
                ->orderBy('category')
                ->get(),
        ]);
    }

    public function index(Request $request)
    {
        $rows = SalesOpportunity::query()
            ->with(['stage:id,code,name,color', 'owner:id,name', 'lossReason:id,name'])
            ->when(
                $request->filled('status'),
                fn ($q) => $q->where('status', $request->status),
                fn ($q) => $q->where('status', 'open')
            )
            ->when(
                $request->filled('owner_id'),
                fn ($q) => $q->where('owner_id', $request->owner_id)
            )
            ->when(
                $request->filled('source'),
                fn ($q) => $q->where('source', $request->source)
            )
            ->orderByDesc('estimated_value')
            ->get();

        return response()->json([
            'success' => true,
            'count' => $rows->count(),
            'total_value' => round((float) $rows->sum('estimated_value'), 2),
            'data' => $rows,
        ]);
    }

    public function show(SalesOpportunity $opportunity)
    {
        $opportunity->load([
            'stage', 'owner:id,name', 'lossReason', 'project:id,project_code,name',
        ]);

        $history = \DB::table('sales_opportunity_stage_history as h')
            ->leftJoin('sales_stages as f', 'f.id', '=', 'h.from_stage_id')
            ->leftJoin('sales_stages as t', 't.id', '=', 'h.to_stage_id')
            ->leftJoin('users as u', 'u.id', '=', 'h.moved_by')
            ->where('h.opportunity_id', $opportunity->id)
            ->orderByDesc('h.created_at')
            ->select(
                'h.created_at',
                'h.days_in_previous_stage',
                'f.name as from_stage',
                't.name as to_stage',
                'u.name as moved_by'
            )
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                ...$opportunity->toArray(),
                'weighted_value' => round(
                    (float) $opportunity->estimated_value
                    * ((int) $opportunity->probability / 100),
                    2
                ),
                'days_in_stage' => $opportunity->stage_entered_at
                    ? $opportunity->stage_entered_at->diffInDays(now())
                    : 0,
                'stage_history' => $history,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $opportunity = $this->opportunities->create(
            $validated,
            $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الفرصة.',
            'data' => $opportunity->load('stage'),
        ], 201);
    }

    public function update(Request $request, SalesOpportunity $opportunity)
    {
        $validated = $this->validatePayload($request, false);

        // لو المستخدم عدّل الاحتمالية يدويًا، احترم قيمته بعد كده
        if ($request->filled('probability')
            && (int) $request->probability !== (int) $opportunity->probability) {
            $validated['probability_overridden'] = true;
        }

        $opportunity->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الفرصة.',
            'data' => $opportunity->fresh(['stage', 'owner:id,name']),
        ]);
    }

    /** نقل بين المراحل — سحب الكارت في اللوحة. */
    public function move(Request $request, SalesOpportunity $opportunity)
    {
        $validated = $request->validate([
            'stage_id' => ['required', 'integer', 'exists:sales_stages,id'],
        ]);

        $stage = SalesStage::findOrFail($validated['stage_id']);

        $updated = $this->opportunities->moveToStage(
            $opportunity,
            $stage,
            $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'message' => 'تم نقل الفرصة إلى ' . $stage->name,
            'data' => $updated,
        ]);
    }

    public function lose(Request $request, SalesOpportunity $opportunity)
    {
        $validated = $request->validate([
            'loss_reason_id' => [
                'required', 'integer', 'exists:sales_loss_reasons,id',
            ],
            'loss_note' => ['nullable', 'string', 'max:2000'],
            'competitor_name' => ['nullable', 'string', 'max:255'],
            'competitor_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $updated = $this->opportunities->markLost(
            $opportunity,
            (int) $validated['loss_reason_id'],
            $validated['loss_note'] ?? null,
            $validated['competitor_name'] ?? null,
            $validated['competitor_price'] ?? null,
            $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الخسارة.',
            'data' => $updated,
        ]);
    }

    /** الفرصة المكسوبة بتتحوّل لمشروع. */
    public function convert(Request $request, SalesOpportunity $opportunity)
    {
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'project_manager' => ['nullable', 'string', 'max:255'],
            'account_manager' => ['nullable', 'string', 'max:255'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
            'expected_start_date' => ['nullable', 'date'],
            'expected_end_date' => ['nullable', 'date', 'after_or_equal:expected_start_date'],
        ]);

        $project = $this->opportunities->convertToProject(
            $opportunity,
            $validated,
            $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'message' => 'تم تحويل الفرصة لمشروع ' . $project->project_code,
            'data' => [
                'project' => $project,
                'opportunity' => $opportunity->fresh(),
            ],
        ], 201);
    }

    private function validatePayload(Request $request, bool $creating = true): array
    {
        return $request->validate([
            'title' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'customer_name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'customer_code' => ['nullable', 'string', 'max:50'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],

            'source' => [
                'nullable',
                'in:referral,website,walk_in,tender,existing_customer,exhibition,cold_call,social,other',
            ],

            'stage_id' => ['nullable', 'integer', 'exists:sales_stages,id'],

            'estimated_value' => ['nullable', 'numeric', 'min:0'],
            'probability' => ['nullable', 'integer', 'min:0', 'max:100'],
            'expected_close_date' => ['nullable', 'date'],

            'project_type' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'owner_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);
    }
}
