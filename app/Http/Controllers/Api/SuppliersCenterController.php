<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProjectFinancialTransaction;
use App\Models\PurchaseOrder;
use App\Models\SupplierInvoice;
use App\Models\SupplierInvoicePayment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class SuppliersCenterController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'aging_bucket' => ['nullable', 'in:current,1_30,31_60,61_90,90_plus'],
            'risk' => ['nullable', 'in:low,medium,high'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
        ]);

        $today = now()->startOfDay();
        $query = ProjectFinancialTransaction::query()
            ->where('direction', 'expense')
            ->whereNotIn('status', ['paid', 'cancelled'])
            ->where('remaining_amount', '>', 0)
            ->with(['project:id,name,project_code']);

        if (!empty($validated['project_id'])) {
            $query->where('project_id', $validated['project_id']);
        }

        if (!empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('reference_number', 'like', "%{$search}%");
            });
        }

        $transactions = $query
            ->orderByRaw('due_date IS NULL')
            ->orderBy('due_date')
            ->orderByDesc('id')
            ->get();

        $supplierNames = $this->supplierNames($transactions);
        $rows = $transactions->map(function ($transaction) use ($today, $supplierNames) {
            $dueDate = $transaction->due_date
                ? Carbon::parse($transaction->due_date)->startOfDay()
                : null;
            $daysOverdue = $dueDate && $dueDate->lt($today)
                ? (int) $dueDate->diffInDays($today)
                : 0;
            $remaining = round((float) $transaction->remaining_amount, 2);
            $total = round((float) $transaction->total, 2);
            $supplierId = $transaction->supplier_id ?? null;
            $supplierName = $supplierId && isset($supplierNames[$supplierId])
                ? $supplierNames[$supplierId]
                : ($transaction->supplier_name ?? 'مورد غير محدد');

            return [
                'id' => $transaction->id,
                'reference_number' => $transaction->reference_number,
                'title' => $transaction->title,
                'type' => $transaction->type,
                'supplier_id' => $supplierId,
                'supplier_name' => $supplierName,
                'project' => $transaction->project,
                'transaction_date' => $transaction->transaction_date
                    ? Carbon::parse($transaction->transaction_date)->toDateString()
                    : null,
                'due_date' => $dueDate?->toDateString(),
                'total' => $total,
                'paid_amount' => round(max(0, $total - $remaining), 2),
                'remaining_amount' => $remaining,
                'status' => $transaction->status,
                'days_overdue' => $daysOverdue,
                'aging_bucket' => $this->agingBucket($daysOverdue),
                'risk' => $this->riskLevel($daysOverdue, $remaining, $total),
                'recommended_action' => $this->recommendedAction($daysOverdue, $dueDate),
            ];
        });

        // Approved supplier invoices are the authoritative accounts-payable source.
        $invoiceQuery = SupplierInvoice::query()
            ->whereIn('status', ['approved', 'posted', 'partially_paid'])
            ->where('remaining_amount', '>', 0)
            ->with([
                'supplier',
                'project:id,name,project_code',
                'purchaseOrder:id,po_number,status,total',
            ]);

        if (!empty($validated['project_id'])) {
            $invoiceQuery->where('project_id', $validated['project_id']);
        }

        if (!empty($validated['search'])) {
            $search = $validated['search'];
            $invoiceQuery->where(function ($query) use ($search) {
                $query->where('invoice_number', 'like', "%{$search}%")
                    ->orWhere('supplier_invoice_number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', function ($supplier) use ($search) {
                        $supplier->where('name', 'like', "%{$search}%");
                    });
            });
        }

        $invoiceRows = $invoiceQuery->get()->map(function ($invoice) use ($today) {
            $dueDate = $invoice->due_date?->copy()->startOfDay();
            $daysOverdue = $dueDate && $dueDate->lt($today)
                ? (int) $dueDate->diffInDays($today)
                : 0;
            $remaining = round((float) $invoice->remaining_amount, 2);
            $total = round((float) $invoice->total, 2);

            return [
                'id' => 'supplier-invoice-' . $invoice->id,
                'supplier_invoice_id' => $invoice->id,
                'reference_number' => $invoice->invoice_number,
                'title' => 'فاتورة مورد ' . $invoice->supplier_invoice_number,
                'type' => 'supplier_invoice',
                'supplier_id' => $invoice->supplier_id,
                'supplier_name' => $invoice->supplier?->name ?: 'مورد غير محدد',
                'project' => $invoice->project,
                'purchase_order' => $invoice->purchaseOrder,
                'transaction_date' => $invoice->invoice_date?->toDateString(),
                'due_date' => $dueDate?->toDateString(),
                'total' => $total,
                'paid_amount' => round((float) $invoice->paid_amount, 2),
                'remaining_amount' => $remaining,
                'status' => $invoice->status,
                'match_status' => $invoice->match_status,
                'days_overdue' => $daysOverdue,
                'aging_bucket' => $this->agingBucket($daysOverdue),
                'risk' => $this->riskLevel($daysOverdue, $remaining, $total),
                'recommended_action' => $this->recommendedAction($daysOverdue, $dueDate),
            ];
        });

        $rows = $rows->concat($invoiceRows)->values();

        if (!empty($validated['aging_bucket'])) {
            $rows = $rows->where('aging_bucket', $validated['aging_bucket'])->values();
        }
        if (!empty($validated['risk'])) {
            $rows = $rows->where('risk', $validated['risk'])->values();
        }

        $agingLabels = [
            'current' => 'غير مستحق',
            '1_30' => '1 - 30 يوم',
            '31_60' => '31 - 60 يوم',
            '61_90' => '61 - 90 يوم',
            '90_plus' => 'أكثر من 90 يوم',
        ];
        $aging = collect($agingLabels)->map(function ($label, $key) use ($rows) {
            $bucket = $rows->where('aging_bucket', $key);
            return [
                'key' => $key,
                'label' => $label,
                'amount' => round((float) $bucket->sum('remaining_amount'), 2),
                'items_count' => $bucket->count(),
            ];
        })->values();

        $suppliers = $rows->groupBy(function ($row) {
            return $row['supplier_id']
                ? 'id:' . $row['supplier_id']
                : 'name:' . mb_strtolower($row['supplier_name']);
        })->map(function ($items, $key) {
            $first = $items->first();
            $outstanding = round((float) $items->sum('remaining_amount'), 2);
            $overdue = round((float) $items->where('days_overdue', '>', 0)->sum('remaining_amount'), 2);
            return [
                'key' => $key,
                'supplier_id' => $first['supplier_id'],
                'supplier_name' => $first['supplier_name'],
                'outstanding' => $outstanding,
                'overdue' => $overdue,
                'items_count' => $items->count(),
                'max_days_overdue' => (int) $items->max('days_overdue'),
                'risk' => $items->contains('risk', 'high')
                    ? 'high'
                    : ($items->contains('risk', 'medium') ? 'medium' : 'low'),
                'exposure_ratio' => 0,
            ];
        })->sortByDesc('outstanding')->values();

        $totalPayables = round((float) $rows->sum('remaining_amount'), 2);
        $suppliers = $suppliers->map(function ($supplier) use ($totalPayables) {
            $supplier['exposure_ratio'] = $totalPayables > 0
                ? round(($supplier['outstanding'] / $totalPayables) * 100, 1)
                : 0;
            return $supplier;
        });

        $overdue = round((float) $rows->where('days_overdue', '>', 0)->sum('remaining_amount'), 2);
        $dueNext30 = round((float) $rows->filter(function ($row) use ($today) {
            if (!$row['due_date']) return false;
            $due = Carbon::parse($row['due_date'])->startOfDay();
            return $due->gte($today) && $due->lte($today->copy()->addDays(30));
        })->sum('remaining_amount'), 2);

        $approvedPurchases = (float) PurchaseOrder::query()
            ->whereIn('status', ['approved', 'received', 'partially_received'])
            ->sum('total');
        $paidThisMonth = (float) ProjectFinancialTransaction::query()
            ->where('type', 'supplier_payment')
            ->whereNotIn('status', ['cancelled'])
            ->whereBetween('transaction_date', [
                now()->startOfMonth()->toDateString(),
                now()->endOfMonth()->toDateString(),
            ])->sum('total');
        $paidThisMonth += (float) SupplierInvoicePayment::query()
            ->whereBetween('payment_date', [
                now()->startOfMonth()->toDateString(),
                now()->endOfMonth()->toDateString(),
            ])
            ->sum('amount');

        $matching = $this->matchingReadiness();

        return response()->json([
            'success' => true,
            'summary' => [
                'total_payables' => $totalPayables,
                'overdue_payables' => $overdue,
                'current_payables' => round($totalPayables - $overdue, 2),
                'due_next_30_days' => $dueNext30,
                'paid_this_month' => round($paidThisMonth, 2),
                'approved_purchases' => round($approvedPurchases, 2),
                'open_items_count' => $rows->count(),
                'overdue_items_count' => $rows->where('days_overdue', '>', 0)->count(),
                'high_risk_items_count' => $rows->where('risk', 'high')->count(),
                'suppliers_count' => $suppliers->count(),
                'matching_rate' => $matching['rate'],
            ],
            'aging' => $aging,
            'monthly_payments' => $this->monthlyPayments(),
            'suppliers' => $suppliers,
            'payables' => $rows->sortByDesc('days_overdue')->values(),
            'payment_queue' => $rows->filter(fn ($row) =>
                $row['days_overdue'] > 0 ||
                ($row['due_date'] && Carbon::parse($row['due_date'])->lte($today->copy()->addDays(14)))
            )->sortByDesc('days_overdue')->take(12)->values(),
            'matching' => $matching,
        ]);
    }

    private function supplierNames($transactions): array
    {
        if (!Schema::hasColumn('project_financial_transactions', 'supplier_id') ||
            !Schema::hasTable('suppliers')) {
            return [];
        }

        $ids = $transactions->pluck('supplier_id')->filter()->unique()->values();
        if ($ids->isEmpty()) return [];

        $nameColumn = collect(['name', 'company_name', 'supplier_name'])
            ->first(fn ($column) => Schema::hasColumn('suppliers', $column));

        if (!$nameColumn) return [];

        return DB::table('suppliers')
            ->whereIn('id', $ids)
            ->pluck($nameColumn, 'id')
            ->all();
    }

    private function matchingReadiness(): array
    {
        $orders = PurchaseOrder::query()->whereNotIn('status', ['draft', 'cancelled'])->get();
        $readyStatuses = ['received', 'completed', 'closed'];
        $ready = $orders->whereIn('status', $readyStatuses)->count();
        $review = $orders->count() - $ready;

        return [
            'total' => $orders->count(),
            'ready' => $ready,
            'needs_review' => $review,
            'rate' => $orders->count() > 0 ? round(($ready / $orders->count()) * 100, 1) : 0,
            'note' => 'المطابقة الكاملة ستربط أمر الشراء والاستلام وفاتورة المورد.',
        ];
    }

    private function monthlyPayments(): array
    {
        $result = [];
        for ($i = 5; $i >= 0; $i--) {
            $month = now()->copy()->subMonths($i);
            $start = $month->copy()->startOfMonth()->toDateString();
            $end = $month->copy()->endOfMonth()->toDateString();
            $paid = (float) ProjectFinancialTransaction::query()
                ->where('type', 'supplier_payment')
                ->whereNotIn('status', ['cancelled'])
                ->whereBetween('transaction_date', [$start, $end])
                ->sum('total');
            $due = (float) ProjectFinancialTransaction::query()
                ->where('direction', 'expense')
                ->whereNotIn('status', ['paid', 'cancelled'])
                ->whereBetween('due_date', [$start, $end])
                ->sum('remaining_amount');
            $result[] = [
                'month' => $month->format('Y-m'),
                'label' => $month->locale('ar')->translatedFormat('M'),
                'paid' => round($paid, 2),
                'due' => round($due, 2),
            ];
        }
        return $result;
    }

    private function agingBucket(int $days): string
    {
        return match (true) {
            $days <= 0 => 'current',
            $days <= 30 => '1_30',
            $days <= 60 => '31_60',
            $days <= 90 => '61_90',
            default => '90_plus',
        };
    }

    private function riskLevel(int $days, float $remaining, float $total): string
    {
        $ratio = $total > 0 ? $remaining / $total : 0;
        if ($days > 60 || ($days > 30 && $ratio >= .75)) return 'high';
        if ($days > 0 || $ratio >= .75) return 'medium';
        return 'low';
    }

    private function recommendedAction(int $days, ?Carbon $dueDate): string
    {
        if ($days > 60) return 'اعتماد دفعة عاجلة والتواصل مع المورد';
        if ($days > 0) return 'إدراجها في أقرب تشغيل دفعات';
        if (!$dueDate) return 'تحديد تاريخ الاستحقاق';
        if ($dueDate->lte(now()->addDays(7))) return 'تجهيز واعتماد أمر الدفع';
        return 'جدولة حسب أولوية السيولة';
    }
}
