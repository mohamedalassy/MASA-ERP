<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaxInvoice;
use App\Models\TaxInvoicePayment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CollectionsCenterController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'customer_id' => ['nullable', 'integer'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'payment_status' => ['nullable', 'string', 'max:50'],
            'aging_bucket' => ['nullable', 'in:current,1_30,31_60,61_90,90_plus'],
            'risk' => ['nullable', 'in:low,medium,high'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $today = now()->startOfDay();

        $query = TaxInvoice::query()
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->where('remaining_amount', '>', 0)
            ->with([
                'project:id,name,project_code',
            ]);

        if (!empty($validated['search'])) {
            $search = $validated['search'];

            $query->where(function ($q) use ($search) {
                $q->where('invoice_number', 'like', "%{$search}%")
                    ->orWhere('buyer_name', 'like', "%{$search}%")
                    ->orWhere('buyer_vat_number', 'like', "%{$search}%")
                    ->orWhere('reference_number', 'like', "%{$search}%");
            });
        }

        if (!empty($validated['customer_id'])) {
            $query->where('customer_id', $validated['customer_id']);
        }

        if (!empty($validated['project_id'])) {
            $query->where('project_id', $validated['project_id']);
        }

        if (!empty($validated['payment_status'])) {
            $query->where('payment_status', $validated['payment_status']);
        }

        if (!empty($validated['from'])) {
            $query->whereDate('issue_date', '>=', $validated['from']);
        }

        if (!empty($validated['to'])) {
            $query->whereDate('issue_date', '<=', $validated['to']);
        }

        $invoices = $query
            ->orderByRaw('due_date IS NULL')
            ->orderBy('due_date')
            ->orderByDesc('id')
            ->get();

        $paymentsByInvoice = TaxInvoicePayment::query()
            ->whereIn('tax_invoice_id', $invoices->pluck('id'))
            ->orderByDesc('payment_date')
            ->get()
            ->groupBy('tax_invoice_id');

        $invoiceRows = $invoices->map(function ($invoice) use ($today, $paymentsByInvoice) {
            $dueDate = $invoice->due_date?->copy()->startOfDay();
            $daysOverdue = $dueDate && $dueDate->lt($today)
                ? (int) $dueDate->diffInDays($today)
                : 0;

            $bucket = $this->agingBucket($daysOverdue);
            $risk = $this->riskLevel(
                $daysOverdue,
                (float) $invoice->remaining_amount,
                (float) $invoice->total
            );

            $payments = $paymentsByInvoice->get($invoice->id, collect());
            $lastPayment = $payments->first();

            return [
                'id' => $invoice->id,
                'invoice_number' => $invoice->invoice_number,
                'reference_number' => $invoice->reference_number,
                'customer_id' => $invoice->customer_id,
                'buyer_name' => $invoice->buyer_name ?: 'عميل غير محدد',
                'buyer_vat_number' => $invoice->buyer_vat_number,
                'project' => $invoice->project,
                'issue_date' => $invoice->issue_date?->toDateString(),
                'due_date' => $invoice->due_date?->toDateString(),
                'total' => round((float) $invoice->total, 2),
                'paid_amount' => round((float) $invoice->paid_amount, 2),
                'remaining_amount' => round((float) $invoice->remaining_amount, 2),
                'payment_status' => $invoice->payment_status,
                'status' => $invoice->status,
                'days_overdue' => $daysOverdue,
                'aging_bucket' => $bucket,
                'risk' => $risk,
                'payment_count' => $payments->count(),
                'last_payment_date' => $lastPayment?->payment_date?->toDateString(),
                'last_payment_amount' => $lastPayment
                    ? round((float) $lastPayment->amount, 2)
                    : 0,
                'recommended_action' => $this->recommendedAction(
                    $daysOverdue,
                    $invoice->due_date,
                    $invoice->payment_status
                ),
            ];
        });

        if (!empty($validated['aging_bucket'])) {
            $invoiceRows = $invoiceRows
                ->where('aging_bucket', $validated['aging_bucket'])
                ->values();
        }

        if (!empty($validated['risk'])) {
            $invoiceRows = $invoiceRows
                ->where('risk', $validated['risk'])
                ->values();
        }

        $agingLabels = [
            'current' => 'غير مستحق',
            '1_30' => '1 - 30 يوم',
            '31_60' => '31 - 60 يوم',
            '61_90' => '61 - 90 يوم',
            '90_plus' => 'أكثر من 90 يوم',
        ];

        $aging = collect($agingLabels)->map(function ($label, $key) use ($invoiceRows) {
            $bucketRows = $invoiceRows->where('aging_bucket', $key);

            return [
                'key' => $key,
                'label' => $label,
                'amount' => round((float) $bucketRows->sum('remaining_amount'), 2),
                'invoices_count' => $bucketRows->count(),
            ];
        })->values();

        $customerRows = $invoiceRows
            ->groupBy(function ($invoice) {
                return $invoice['customer_id']
                    ? 'id:' . $invoice['customer_id']
                    : 'name:' . mb_strtolower(trim($invoice['buyer_name']));
            })
            ->map(function ($rows, $key) {
                $first = $rows->first();
                $outstanding = round((float) $rows->sum('remaining_amount'), 2);
                $overdue = round(
                    (float) $rows->where('days_overdue', '>', 0)->sum('remaining_amount'),
                    2
                );
                $maxDays = (int) $rows->max('days_overdue');

                return [
                    'key' => $key,
                    'customer_id' => $first['customer_id'],
                    'buyer_name' => $first['buyer_name'],
                    'buyer_vat_number' => $first['buyer_vat_number'],
                    'outstanding' => $outstanding,
                    'overdue' => $overdue,
                    'invoices_count' => $rows->count(),
                    'max_days_overdue' => $maxDays,
                    'risk' => $this->customerRisk($rows),
                    'overdue_ratio' => $outstanding > 0
                        ? round(($overdue / $outstanding) * 100, 1)
                        : 0,
                ];
            })
            ->sortByDesc('outstanding')
            ->values();

        $monthlyCollections = $this->monthlyCollections();

        $totalReceivables = round(
            (float) $invoiceRows->sum('remaining_amount'),
            2
        );

        $overdueReceivables = round(
            (float) $invoiceRows
                ->where('days_overdue', '>', 0)
                ->sum('remaining_amount'),
            2
        );

        $dueNext30 = round(
            (float) $invoiceRows->filter(function ($invoice) use ($today) {
                if (empty($invoice['due_date'])) {
                    return false;
                }

                $due = Carbon::parse($invoice['due_date'])->startOfDay();

                return $due->gte($today)
                    && $due->lte($today->copy()->addDays(30));
            })->sum('remaining_amount'),
            2
        );

        $collectedThisMonth = round(
            (float) TaxInvoicePayment::query()
                ->whereBetween('payment_date', [
                    now()->startOfMonth()->toDateString(),
                    now()->endOfMonth()->toDateString(),
                ])
                ->sum('amount'),
            2
        );

        $allIssuedTotal = (float) TaxInvoice::query()
            ->whereNotIn('status', ['draft', 'cancelled'])
            ->sum('total');

        $allCollected = (float) TaxInvoicePayment::query()->sum('amount');

        $collectionRate = $allIssuedTotal > 0
            ? round(min(100, ($allCollected / $allIssuedTotal) * 100), 1)
            : 0;

        return response()->json([
            'success' => true,
            'summary' => [
                'total_receivables' => $totalReceivables,
                'overdue_receivables' => $overdueReceivables,
                'current_receivables' => round(
                    $totalReceivables - $overdueReceivables,
                    2
                ),
                'due_next_30_days' => $dueNext30,
                'collected_this_month' => $collectedThisMonth,
                'collection_rate' => $collectionRate,
                'open_invoices_count' => $invoiceRows->count(),
                'overdue_invoices_count' => $invoiceRows
                    ->where('days_overdue', '>', 0)
                    ->count(),
                'high_risk_invoices_count' => $invoiceRows
                    ->where('risk', 'high')
                    ->count(),
                'customers_count' => $customerRows->count(),
            ],
            'aging' => $aging,
            'monthly_collections' => $monthlyCollections,
            'customers' => $customerRows,
            'invoices' => $invoiceRows
                ->sortByDesc('days_overdue')
                ->values(),
            'action_queue' => $invoiceRows
                ->filter(function ($invoice) {
                    return $invoice['days_overdue'] > 0
                        || $invoice['risk'] === 'high';
                })
                ->sortByDesc('days_overdue')
                ->take(10)
                ->values(),
        ]);
    }

    private function agingBucket(int $daysOverdue): string
    {
        return match (true) {
            $daysOverdue <= 0 => 'current',
            $daysOverdue <= 30 => '1_30',
            $daysOverdue <= 60 => '31_60',
            $daysOverdue <= 90 => '61_90',
            default => '90_plus',
        };
    }

    private function riskLevel(
        int $daysOverdue,
        float $remaining,
        float $total
    ): string {
        $remainingRatio = $total > 0 ? $remaining / $total : 0;

        if ($daysOverdue > 60 || ($daysOverdue > 30 && $remainingRatio >= 0.75)) {
            return 'high';
        }

        if ($daysOverdue > 0 || $remainingRatio >= 0.75) {
            return 'medium';
        }

        return 'low';
    }

    private function customerRisk($rows): string
    {
        if ($rows->contains('risk', 'high')) {
            return 'high';
        }

        if ($rows->contains('risk', 'medium')) {
            return 'medium';
        }

        return 'low';
    }

    private function recommendedAction(
        int $daysOverdue,
        $dueDate,
        ?string $paymentStatus
    ): string {
        if ($daysOverdue > 90) {
            return 'تصعيد للإدارة وإيقاف ائتماني';
        }

        if ($daysOverdue > 60) {
            return 'اتصال عاجل وتأكيد موعد السداد';
        }

        if ($daysOverdue > 30) {
            return 'إرسال مطالبة رسمية ومتابعة العميل';
        }

        if ($daysOverdue > 0) {
            return 'تذكير العميل بالفاتورة المتأخرة';
        }

        if ($paymentStatus === 'partially_paid') {
            return 'متابعة الدفعة المتبقية';
        }

        if ($dueDate) {
            return 'متابعة قبل تاريخ الاستحقاق';
        }

        return 'تحديد تاريخ استحقاق للفاتورة';
    }

    private function monthlyCollections(): array
    {
        $result = [];

        for ($i = 5; $i >= 0; $i--) {
            $month = now()->copy()->subMonths($i);
            $start = $month->copy()->startOfMonth()->toDateString();
            $end = $month->copy()->endOfMonth()->toDateString();

            $amount = (float) TaxInvoicePayment::query()
                ->whereBetween('payment_date', [$start, $end])
                ->sum('amount');

            $result[] = [
                'month' => $month->format('Y-m'),
                'label' => $month->locale('ar')->translatedFormat('M'),
                'amount' => round($amount, 2),
            ];
        }

        return $result;
    }
}
