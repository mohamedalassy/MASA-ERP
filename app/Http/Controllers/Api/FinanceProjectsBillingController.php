<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\TaxInvoice;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * دفتر فوترة المشاريع — شاشة FinanceProjects.
 *
 * المسار: GET /api/finance/projects-billing
 *
 * ملاحظة أداء: الأرقام محسوبة بـ٣ استعلامات مجمّعة بدل استعلام
 * لكل مشروع — مهم لأن المشاريع بتكبر بسرعة.
 */
class FinanceProjectsBillingController extends Controller
{
    private const COUNTED = ['issued', 'paid', 'partially_paid'];

    public function index(Request $request)
    {
        $projects = Project::query()
            ->when(
                $request->filled('stage'),
                fn ($q) => $q->where('current_stage', $request->stage)
            )
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = trim($request->search);

                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('project_code', 'like', "%{$search}%")
                        ->orWhere('customer_name', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('id')
            ->get([
                'id', 'project_code', 'name',
                'customer_name', 'current_stage', 'total_value',
            ]);

        $projectIds = $projects->pluck('id');

        // إجمالي عروض السعر المعتمدة لكل مشروع
        $approvedQuotations = DB::table('project_quotations')
            ->whereIn('project_id', $projectIds)
            ->where('status', 'approved')
            ->groupBy('project_id')
            ->selectRaw('project_id, SUM(total) as total')
            ->pluck('total', 'project_id');

        // المفوتر صافي إشعارات الدائن
        $invoiced = DB::table('tax_invoices')
            ->whereIn('project_id', $projectIds)
            ->whereIn('status', self::COUNTED)
            ->groupBy('project_id')
            ->selectRaw("
                project_id,
                SUM(
                    CASE
                        WHEN document_type = 'credit_note'
                        THEN -total
                        ELSE total
                    END
                ) as total,
                SUM(
                    CASE
                        WHEN document_type = 'credit_note'
                        THEN -paid_amount
                        ELSE paid_amount
                    END
                ) as collected,
                COUNT(*) as invoices_count
            ")
            ->get()
            ->keyBy('project_id');

        $rows = $projects->map(function ($project) use (
            $approvedQuotations,
            $invoiced
        ) {
            $approved = round(
                (float) ($approvedQuotations[$project->id] ?? 0),
                2
            );

            $stats = $invoiced->get($project->id);

            $billed = round((float) ($stats->total ?? 0), 2);
            $collected = round((float) ($stats->collected ?? 0), 2);

            $remaining = round(max(0, $approved - $billed), 2);

            return [
                'id' => $project->id,
                'project_code' => $project->project_code,
                'name' => $project->name,
                'customer_name' => $project->customer_name,
                'current_stage' => $project->current_stage,

                'approved_quotations_total' => $approved,
                'invoiced_total' => $billed,
                'remaining_to_invoice' => $remaining,
                'collected_total' => $collected,
                'outstanding_total' => round($billed - $collected, 2),

                'invoices_count' => (int) ($stats->invoices_count ?? 0),

                'billing_percentage' => $approved > 0
                    ? round(($billed / $approved) * 100, 1)
                    : 0,

                'collection_percentage' => $billed > 0
                    ? round(($collected / $billed) * 100, 1)
                    : 0,

                'is_fully_invoiced' => $approved > 0 && $remaining < 0.01,
            ];
        });

        return response()->json([
            'success' => true,
            'summary' => [
                'projects_count' => $rows->count(),
                'approved_total' => round(
                    (float) $rows->sum('approved_quotations_total'),
                    2
                ),
                'invoiced_total' => round(
                    (float) $rows->sum('invoiced_total'),
                    2
                ),
                'remaining_to_invoice' => round(
                    (float) $rows->sum('remaining_to_invoice'),
                    2
                ),
                'collected_total' => round(
                    (float) $rows->sum('collected_total'),
                    2
                ),
                'outstanding_total' => round(
                    (float) $rows->sum('outstanding_total'),
                    2
                ),
            ],
            'data' => $rows->values(),
        ]);
    }
}
