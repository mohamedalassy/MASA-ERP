<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupplierInvoice;
use App\Models\TaxInvoice;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VatCenterController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'zatca_status' => ['nullable', 'in:not_submitted,pending,cleared,reported,warning,rejected'],
        ]);

        $from = Carbon::parse($validated['from'] ?? now()->startOfYear())->startOfDay();
        $to = Carbon::parse($validated['to'] ?? now()->endOfYear())->endOfDay();

        $salesQuery = TaxInvoice::query()
            ->where('status', 'issued')
            ->whereBetween('issue_date', [$from->toDateString(), $to->toDateString()]);

        if (!empty($validated['zatca_status'])) {
            $salesQuery->where('zatca_status', $validated['zatca_status']);
        }

        $salesInvoices = $salesQuery
            ->with('project:id,name,project_code')
            ->orderByDesc('issue_date')
            ->orderByDesc('id')
            ->get();

        $purchaseInvoices = SupplierInvoice::query()
            ->where('status', 'posted')
            ->whereBetween('invoice_date', [$from->toDateString(), $to->toDateString()])
            ->with([
                'supplier',
                'project:id,name,project_code',
            ])
            ->orderByDesc('invoice_date')
            ->orderByDesc('id')
            ->get();

        $outputTax = round((float) $salesInvoices->sum(function ($invoice) {
            $sign = $invoice->document_type === 'credit_note' ? -1 : 1;
            return $sign * (float) $invoice->tax_total;
        }), 2);

        $outputTaxable = round((float) $salesInvoices->sum(function ($invoice) {
            $sign = $invoice->document_type === 'credit_note' ? -1 : 1;
            return $sign * (float) $invoice->taxable_amount;
        }), 2);

        $inputTax = round((float) $purchaseInvoices->sum('tax'), 2);
        $inputTaxable = round((float) $purchaseInvoices->sum(function ($invoice) {
            return max(0, (float) $invoice->subtotal - (float) $invoice->discount);
        }), 2);

        $netVat = round($outputTax - $inputTax, 2);
        $salesTotal = round((float) $salesInvoices->sum(function ($invoice) {
            $sign = $invoice->document_type === 'credit_note' ? -1 : 1;
            return $sign * (float) $invoice->total;
        }), 2);
        $purchaseTotal = round((float) $purchaseInvoices->sum('total'), 2);

        $zatcaStatuses = [
            'not_submitted' => 'لم ترسل',
            'pending' => 'قيد الإرسال',
            'cleared' => 'تمت الموافقة',
            'reported' => 'تم الإبلاغ',
            'warning' => 'تحذير',
            'rejected' => 'مرفوضة',
        ];

        $zatca = collect($zatcaStatuses)->map(function ($label, $status) use ($salesInvoices) {
            $rows = $salesInvoices->where('zatca_status', $status);
            return [
                'status' => $status,
                'label' => $label,
                'count' => $rows->count(),
                'total' => round((float) $rows->sum('total'), 2),
            ];
        })->values();

        $salesRows = $salesInvoices->map(function ($invoice) {
            return [
                'id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'buyer_name' => $invoice->buyer_name,
                'issue_date' => $invoice->issue_date?->toDateString(),
                'document_type' => $invoice->document_type,
                'taxable_amount' => (float) $invoice->taxable_amount,
                'tax_total' => (float) $invoice->tax_total,
                'total' => (float) $invoice->total,
                'zatca_status' => $invoice->zatca_status,
                'project' => $invoice->project,
            ];
        });

        $purchaseRows = $purchaseInvoices->map(function ($invoice) {
            return [
                'id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'supplier_invoice_number' => $invoice->supplier_invoice_number,
                'supplier_name' => $invoice->supplier?->name
                    ?: $invoice->supplier?->company_name
                    ?: $invoice->supplier?->supplier_name
                    ?: 'مورد غير محدد',
                'invoice_date' => $invoice->invoice_date?->toDateString(),
                'taxable_amount' => max(0, (float) $invoice->subtotal - (float) $invoice->discount),
                'tax_total' => (float) $invoice->tax,
                'total' => (float) $invoice->total,
                'project' => $invoice->project,
            ];
        });

        return response()->json([
            'success' => true,
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
            'summary' => [
                'output_tax' => $outputTax,
                'input_tax' => $inputTax,
                'net_vat' => $netVat,
                'position' => $netVat >= 0 ? 'payable' : 'credit',
                'output_taxable' => $outputTaxable,
                'input_taxable' => $inputTaxable,
                'sales_total' => $salesTotal,
                'purchase_total' => $purchaseTotal,
                'sales_invoices_count' => $salesInvoices->count(),
                'purchase_invoices_count' => $purchaseInvoices->count(),
                'zatca_attention_count' => $salesInvoices
                    ->whereIn('zatca_status', ['not_submitted', 'warning', 'rejected'])
                    ->count(),
            ],
            'monthly' => $this->monthlyAnalysis($from, $to),
            'zatca' => $zatca,
            'sales_invoices' => $salesRows,
            'purchase_invoices' => $purchaseRows,
            'attention_queue' => $salesRows
                ->whereIn('zatca_status', ['not_submitted', 'warning', 'rejected'])
                ->values(),
        ]);
    }

    private function monthlyAnalysis(Carbon $from, Carbon $to): array
    {
        $result = [];
        $cursor = $from->copy()->startOfMonth();
        $last = $to->copy()->startOfMonth();

        while ($cursor->lte($last)) {
            $start = $cursor->copy()->startOfMonth()->max($from)->toDateString();
            $end = $cursor->copy()->endOfMonth()->min($to)->toDateString();

            $sales = TaxInvoice::query()
                ->where('status', 'issued')
                ->whereBetween('issue_date', [$start, $end])
                ->get(['document_type', 'tax_total']);

            $output = (float) $sales->sum(function ($invoice) {
                return ($invoice->document_type === 'credit_note' ? -1 : 1)
                    * (float) $invoice->tax_total;
            });

            $input = (float) SupplierInvoice::query()
                ->where('status', 'posted')
                ->whereBetween('invoice_date', [$start, $end])
                ->sum('tax');

            $result[] = [
                'month' => $cursor->format('Y-m'),
                'label' => $cursor->locale('ar')->translatedFormat('M Y'),
                'output_tax' => round($output, 2),
                'input_tax' => round($input, 2),
                'net_vat' => round($output - $input, 2),
            ];

            $cursor->addMonth();
        }

        return array_slice($result, -12);
    }
}
