<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectQuotation;
use App\Models\TaxInvoice;
use App\Services\QuotationBillingService;

/**
 * حالة الفوترة لمشروع واحد — شاشة ProjectFinancialCenter.
 *
 * المسارات:
 *   GET /api/finance/projects/{project}/billing
 *   GET /api/finance/quotations/{quotation}/billing-summary
 */
class FinanceProjectBillingController extends Controller
{
    private const COUNTED = ['issued', 'paid', 'partially_paid'];

    public function __construct(
        private readonly QuotationBillingService $billing
    ) {}

    public function project(Project $project)
    {
        $quotations = ProjectQuotation::query()
            ->where('project_id', $project->id)
            ->where('status', 'approved')
            ->orderByDesc('version')
            ->get();

        $quotationRows = $quotations->map(function ($quotation) {
            $summary = $this->billing->summary($quotation);

            return [
                'id' => $quotation->id,
                'quotation_number' => $quotation->quotation_number,
                'version' => $quotation->version,
                'total' => round((float) $quotation->total, 2),
                ...$summary,
            ];
        });

        $invoices = TaxInvoice::query()
            ->where('project_id', $project->id)
            ->orderByDesc('issue_date')
            ->orderByDesc('id')
            ->get([
                'id', 'invoice_number', 'document_type', 'status',
                'zatca_status', 'payment_status', 'issue_date', 'due_date',
                'total', 'paid_amount', 'remaining_amount', 'quotation_id',
            ]);

        $issued = $invoices->whereIn('status', self::COUNTED);

        $billed = round(
            (float) $issued->sum(
                fn ($i) => $i->document_type === 'credit_note'
                    ? -(float) $i->total
                    : (float) $i->total
            ),
            2
        );

        $collected = round((float) $issued->sum('paid_amount'), 2);
        $outstanding = round((float) $issued->sum('remaining_amount'), 2);

        $approvedTotal = round((float) $quotations->sum('total'), 2);

        return response()->json([
            'success' => true,
            'data' => [
                'project' => [
                    'id' => $project->id,
                    'project_code' => $project->project_code,
                    'name' => $project->name,
                    'customer_name' => $project->customer_name,
                    'customer_code' => $project->customer_code,
                    'current_stage' => $project->current_stage,
                    'total_value' => round((float) $project->total_value, 2),
                ],

                'summary' => [
                    'approved_quotations_total' => $approvedTotal,
                    'invoiced_total' => $billed,
                    'remaining_to_invoice' => round(
                        max(0, $approvedTotal - $billed),
                        2
                    ),
                    'collected_total' => $collected,
                    'outstanding_total' => $outstanding,
                    'billing_percentage' => $approvedTotal > 0
                        ? round(($billed / $approvedTotal) * 100, 1)
                        : 0,
                    'invoices_count' => $invoices->count(),
                    'draft_invoices_count' => $invoices
                        ->where('status', 'draft')
                        ->count(),
                ],

                'quotations' => $quotationRows->values(),
                'invoices' => $invoices,
            ],
        ]);
    }

    public function quotation(ProjectQuotation $quotation)
    {
        $this->billing->assertApproved($quotation);

        return response()->json([
            'success' => true,
            'data' => [
                'quotation' => [
                    'id' => $quotation->id,
                    'quotation_number' => $quotation->quotation_number,
                    'version' => $quotation->version,
                    'status' => $quotation->status,
                    'total' => round((float) $quotation->total, 2),
                ],
                'summary' => $this->billing->summary($quotation),
            ],
        ]);
    }
}
