<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalesOpportunity;
use App\Models\SalesStage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * لوحة المبيعات — الشاشة اللي كانت placeholder.
 *
 * المسارات:
 *   GET /api/sales/dashboard
 *   GET /api/sales/pipeline
 *   GET /api/sales/quotations-board
 *   GET /api/sales/forecast
 *   GET /api/sales/loss-analysis
 */
class SalesDashboardController extends Controller
{
    /** المؤشرات الستة + ملخص. */
    public function dashboard(Request $request)
    {
        $open = SalesOpportunity::query()
            ->where('status', 'open')
            ->when(
                $request->filled('owner_id'),
                fn ($q) => $q->where('owner_id', $request->owner_id)
            )
            ->get();

        $pipelineValue = round((float) $open->sum('estimated_value'), 2);

        // القيمة المرجَّحة بالاحتمالية — الرقم اللي المدير بيخطط عليه
        $weighted = round((float) $open->sum(
            fn ($o) => (float) $o->estimated_value * ((int) $o->probability / 100)
        ), 2);

        $closed = SalesOpportunity::query()
            ->whereIn('status', ['won', 'lost'])
            ->whereNotNull('closed_at')
            ->where('closed_at', '>=', now()->subMonths(12))
            ->get();

        $won = $closed->where('status', 'won');

        $conversionRate = $closed->count() > 0
            ? round(($won->count() / $closed->count()) * 100, 1)
            : 0;

        // متوسط مدة الإغلاق بالأيام
        $avgCycle = $won->isNotEmpty()
            ? round($won->avg(
                fn ($o) => $o->created_at->diffInDays($o->closed_at)
            ), 1)
            : 0;

        return response()->json([
            'success' => true,
            'data' => [
                'kpis' => [
                    'pipeline_value' => $pipelineValue,
                    'weighted_value' => $weighted,
                    'open_count' => $open->count(),

                    'awaiting_customer' => $this->awaitingCustomerCount(),

                    'conversion_rate' => $conversionRate,
                    'avg_cycle_days' => $avgCycle,
                    'avg_approved_margin' => $this->averageApprovedMargin(),

                    'won_value_ytd' => round((float) $won
                        ->filter(fn ($o) => $o->closed_at->year === now()->year)
                        ->sum('estimated_value'), 2),
                ],

                'stale' => $this->staleOpportunities(),
            ],
        ]);
    }

    /** خط الأنابيب بأعمدة — كل عمود بإجمالياته. */
    public function pipeline(Request $request)
    {
        $stages = SalesStage::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        $opportunities = SalesOpportunity::query()
            ->with(['owner:id,name', 'stage:id,code,name'])
            ->where('status', 'open')
            ->when(
                $request->filled('owner_id'),
                fn ($q) => $q->where('owner_id', $request->owner_id)
            )
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = trim($request->search);

                $q->where(function ($inner) use ($search) {
                    $inner->where('title', 'like', "%{$search}%")
                        ->orWhere('customer_name', 'like', "%{$search}%")
                        ->orWhere('opportunity_number', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('estimated_value')
            ->get();

        $columns = $stages->map(function ($stage) use ($opportunities) {
            $cards = $opportunities->where('stage_id', $stage->id);

            return [
                'stage' => [
                    'id' => $stage->id,
                    'code' => $stage->code,
                    'name' => $stage->name,
                    'color' => $stage->color,
                    'is_final' => $stage->is_final,
                    'default_probability' => $stage->default_probability,
                ],

                // إجماليات العمود — دي اللي بتخلي اللوحة مفيدة للمدير
                'count' => $cards->count(),
                'total_value' => round((float) $cards->sum('estimated_value'), 2),
                'weighted_value' => round((float) $cards->sum(
                    fn ($o) => (float) $o->estimated_value * ((int) $o->probability / 100)
                ), 2),

                'cards' => $cards->map(fn ($o) => $this->card($o, $stage))->values(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $columns,
        ]);
    }

    /**
     * لوحة العروض بحالاتها.
     * صفر جداول جديدة — الداتا والحالات موجودة بالفعل.
     */
    public function quotationsBoard(Request $request)
    {
        $statuses = [
            'draft' => 'مسودة',
            'pending' => 'قيد المراجعة',
            'approved' => 'معتمد',
            'changes_requested' => 'مطلوب تعديلات',
            'rejected' => 'مرفوض',
        ];

        $rows = DB::table('project_quotations as q')
            ->leftJoin('projects as p', 'p.id', '=', 'q.project_id')
            ->leftJoin('quotation_portal_tokens as t', function ($join) {
                $join->on('t.quotation_id', '=', 'q.id')
                    ->where('t.is_revoked', '=', false);
            })
            ->select(
                'q.id', 'q.quotation_number', 'q.status', 'q.version',
                'q.total', 'q.subtotal', 'q.discount', 'q.valid_until',
                'q.created_at', 'q.updated_at',
                'p.id as project_id', 'p.project_code', 'p.name as project_name',
                'p.customer_name',
                't.decision as portal_decision',
                't.first_viewed_at', 't.view_count'
            )
            ->orderByDesc('q.updated_at')
            ->get();

        // تكلفة كل عرض لحساب الهامش — استعلام واحد مجمّع
        $costs = DB::table('project_quotation_items')
            ->whereIn('quotation_id', $rows->pluck('id'))
            ->groupBy('quotation_id')
            ->selectRaw('quotation_id, SUM(quantity * cost_price) as cost')
            ->pluck('cost', 'quotation_id');

        $board = collect($statuses)->map(function ($label, $status) use ($rows, $costs) {
            $cards = $rows->where('status', $status)->map(function ($row) use ($costs) {
                $cost = (float) ($costs[$row->id] ?? 0);
                $net = round((float) $row->subtotal - (float) $row->discount, 2);

                $margin = $net > 0 ? (($net - $cost) / $net) * 100 : 0;

                // مدة الانتظار في الحالة الحالية
                $waitingDays = \Carbon\Carbon::parse($row->updated_at)
                    ->diffInDays(now());

                return [
                    'id' => $row->id,
                    'quotation_number' => $row->quotation_number,
                    'version' => (int) $row->version,
                    'project_id' => $row->project_id,
                    'project_code' => $row->project_code,
                    'project_name' => $row->project_name,
                    'customer_name' => $row->customer_name,
                    'total' => round((float) $row->total, 2),
                    'margin' => round($margin, 1),
                    'margin_is_low' => $margin < 15,
                    'valid_until' => $row->valid_until,
                    'is_expired' => $row->valid_until
                        && now()->gt($row->valid_until),

                    'waiting_days' => $waitingDays,
                    // العروض الواقفة أكتر من ٣ أيام في المراجعة
                    'is_stale' => $row->status === 'pending' && $waitingDays > 3,

                    'portal_decision' => $row->portal_decision,
                    'customer_viewed' => (bool) $row->first_viewed_at,
                    'view_count' => (int) ($row->view_count ?? 0),
                ];
            })->values();

            return [
                'status' => $status,
                'label' => $label,
                'count' => $cards->count(),
                'total_value' => round((float) $cards->sum('total'), 2),
                'stale_count' => $cards->where('is_stale', true)->count(),
                'cards' => $cards,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $board,
        ]);
    }

    /** التوقّع بشهر الإغلاق المتوقع. */
    public function forecast(Request $request)
    {
        $months = (int) $request->input('months', 6);

        $opportunities = SalesOpportunity::query()
            ->with(['owner:id,name'])
            ->where('status', 'open')
            ->whereNotNull('expected_close_date')
            ->where('expected_close_date', '<=', now()->addMonths($months))
            ->orderBy('expected_close_date')
            ->get();

        $columns = [];

        for ($i = 0; $i < $months; $i++) {
            $month = now()->addMonths($i);
            $key = $month->format('Y-m');

            $cards = $opportunities->filter(
                fn ($o) => $o->expected_close_date->format('Y-m') === $key
            );

            $columns[] = [
                'month' => $key,
                'label' => $month->translatedFormat('F Y'),
                'count' => $cards->count(),
                'total_value' => round((float) $cards->sum('estimated_value'), 2),
                'weighted_value' => round((float) $cards->sum(
                    fn ($o) => (float) $o->estimated_value * ((int) $o->probability / 100)
                ), 2),
                'cards' => $cards->map(fn ($o) => [
                    'id' => $o->id,
                    'opportunity_number' => $o->opportunity_number,
                    'title' => $o->title,
                    'customer_name' => $o->customer_name,
                    'estimated_value' => round((float) $o->estimated_value, 2),
                    'probability' => (int) $o->probability,
                    'owner' => $o->owner?->name,
                ])->values(),
            ];
        }

        // المتأخرة عن تاريخ إغلاقها
        $overdue = SalesOpportunity::query()
            ->where('status', 'open')
            ->whereNotNull('expected_close_date')
            ->where('expected_close_date', '<', now()->toDateString())
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'columns' => $columns,
                'overdue' => [
                    'count' => $overdue->count(),
                    'total_value' => round((float) $overdue->sum('estimated_value'), 2),
                ],
            ],
        ]);
    }

    /**
     * تحليل الخسارة — الجواب على أهم سؤال في المبيعات:
     * إحنا بنخسر بالسعر ولا بحاجة تانية؟
     */
    public function lossAnalysis(Request $request)
    {
        $from = $request->input('from', now()->subMonths(12)->toDateString());

        $lost = DB::table('sales_opportunities as o')
            ->leftJoin('sales_loss_reasons as r', 'r.id', '=', 'o.loss_reason_id')
            ->where('o.status', 'lost')
            ->where('o.closed_at', '>=', $from)
            ->select(
                'r.id', 'r.name', 'r.category',
                'o.estimated_value', 'o.competitor_price', 'o.competitor_name'
            )
            ->get();

        $total = $lost->count();

        $byReason = $lost
            ->groupBy('category')
            ->map(fn ($group, $category) => [
                'category' => $category ?: 'unspecified',
                'name' => $group->first()->name ?? 'غير محدد',
                'count' => $group->count(),
                'percentage' => $total > 0
                    ? round(($group->count() / $total) * 100, 1)
                    : 0,
                'lost_value' => round((float) $group->sum('estimated_value'), 2),
            ])
            ->sortByDesc('count')
            ->values();

        // فرق السعر مع المنافس — لما يكون مسجّل
        $priceLosses = $lost
            ->where('category', 'price')
            ->filter(fn ($row) => $row->competitor_price > 0);

        $avgGap = $priceLosses->isNotEmpty()
            ? round($priceLosses->avg(function ($row) {
                $ours = (float) $row->estimated_value;
                $theirs = (float) $row->competitor_price;

                return $ours > 0 ? (($ours - $theirs) / $ours) * 100 : 0;
            }), 1)
            : null;

        return response()->json([
            'success' => true,
            'data' => [
                'total_lost' => $total,
                'total_lost_value' => round((float) $lost->sum('estimated_value'), 2),
                'by_reason' => $byReason,

                'price_analysis' => [
                    'count' => $priceLosses->count(),
                    'avg_gap_percent' => $avgGap,
                    'insight' => $avgGap === null
                        ? 'مافيش بيانات أسعار منافسين كافية.'
                        : ($avgGap > 15
                            ? 'الفرق كبير — المشكلة في هيكل التكلفة مش في المندوبين.'
                            : 'الفرق بسيط — قابل للتغطية بتحسين العرض أو شروط السداد.'),
                ],

                'top_competitors' => $lost
                    ->whereNotNull('competitor_name')
                    ->groupBy('competitor_name')
                    ->map(fn ($g, $name) => [
                        'name' => $name,
                        'count' => $g->count(),
                        'lost_value' => round((float) $g->sum('estimated_value'), 2),
                    ])
                    ->sortByDesc('count')
                    ->take(5)
                    ->values(),
            ],
        ]);
    }

    private function card(SalesOpportunity $o, SalesStage $stage): array
    {
        $daysInStage = $o->stage_entered_at
            ? $o->stage_entered_at->diffInDays(now())
            : 0;

        return [
            'id' => $o->id,
            'opportunity_number' => $o->opportunity_number,
            'title' => $o->title,
            'customer_name' => $o->customer_name,
            'estimated_value' => round((float) $o->estimated_value, 2),
            'probability' => (int) $o->probability,
            'weighted_value' => round(
                (float) $o->estimated_value * ((int) $o->probability / 100),
                2
            ),
            'expected_close_date' => $o->expected_close_date?->toDateString(),
            'is_overdue' => $o->expected_close_date
                && $o->expected_close_date->lt(now()->startOfDay()),
            'owner' => $o->owner?->name,
            'source' => $o->source,

            'days_in_stage' => $daysInStage,
            'is_stale' => $stage->stale_after_days
                && $daysInStage > $stage->stale_after_days,
        ];
    }

    private function awaitingCustomerCount(): int
    {
        return (int) DB::table('quotation_portal_tokens')
            ->where('decision', 'pending')
            ->where('is_revoked', false)
            ->where(function ($q) {
                $q->whereNull('expires_at')
                    ->orWhere('expires_at', '>=', now());
            })
            ->count();
    }

    /**
     * متوسط الهامش المعتمد — المؤشر اللي بيخلي الشاشة دي مختلفة.
     * مافيش نظام بيع بيعرضه لأن أغلبهم مش عارفين التكلفة.
     */
    private function averageApprovedMargin(): float
    {
        $row = DB::table('project_quotations as q')
            ->join('project_quotation_items as i', 'i.quotation_id', '=', 'q.id')
            ->where('q.status', 'approved')
            ->where('q.approved_at', '>=', now()->subMonths(12))
            ->selectRaw('
                COALESCE(SUM(q.subtotal - q.discount), 0) as net,
                COALESCE(SUM(i.quantity * i.cost_price), 0) as cost
            ')
            ->first();

        $net = (float) ($row->net ?? 0);
        $cost = (float) ($row->cost ?? 0);

        return $net > 0 ? round((($net - $cost) / $net) * 100, 1) : 0;
    }

    private function staleOpportunities(): array
    {
        return SalesOpportunity::query()
            ->with(['stage:id,name,stale_after_days', 'owner:id,name'])
            ->where('status', 'open')
            ->whereNotNull('stage_entered_at')
            ->get()
            ->filter(function ($o) {
                $limit = $o->stage?->stale_after_days;

                return $limit && $o->stage_entered_at->diffInDays(now()) > $limit;
            })
            ->map(fn ($o) => [
                'id' => $o->id,
                'opportunity_number' => $o->opportunity_number,
                'title' => $o->title,
                'customer_name' => $o->customer_name,
                'stage' => $o->stage?->name,
                'days_in_stage' => $o->stage_entered_at->diffInDays(now()),
                'estimated_value' => round((float) $o->estimated_value, 2),
                'owner' => $o->owner?->name,
            ])
            ->sortByDesc('days_in_stage')
            ->take(10)
            ->values()
            ->all();
    }
}
