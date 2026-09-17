<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectExpense;
use App\Models\ProjectFinancialTransaction;
use App\Models\PurchaseOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class FinanceDashboardController extends Controller
{
    public function index(): JsonResponse
    {
        try {
            /*
            |--------------------------------------------------------------------------
            | Income
            |--------------------------------------------------------------------------
            */
            $income = (float) ProjectFinancialTransaction::query()
                ->where('direction', 'income')
                ->whereNotIn('status', ['cancelled'])
                ->sum('total');

            /*
            |--------------------------------------------------------------------------
            | Financial Expenses
            |--------------------------------------------------------------------------
            */
            $expenses = (float) ProjectFinancialTransaction::query()
                ->where('direction', 'expense')
                ->whereNotIn('status', ['cancelled'])
                ->sum('total');

            /*
            |--------------------------------------------------------------------------
            | Project Expenses
            |--------------------------------------------------------------------------
            */
            $projectExpenses = (float) ProjectExpense::query()
                ->sum('amount');

            /*
            |--------------------------------------------------------------------------
            | Net
            |--------------------------------------------------------------------------
            */
            $net = $income - $expenses - $projectExpenses;

            /*
            |--------------------------------------------------------------------------
            | Receivables
            |--------------------------------------------------------------------------
            */
            $receivables = (float) ProjectFinancialTransaction::query()
                ->where('direction', 'income')
                ->whereNotIn('status', ['paid', 'cancelled'])
                ->sum('remaining_amount');

            /*
            |--------------------------------------------------------------------------
            | Payables
            |--------------------------------------------------------------------------
            */
            $payables = (float) ProjectFinancialTransaction::query()
                ->where('direction', 'expense')
                ->whereNotIn('status', ['paid', 'cancelled'])
                ->sum('remaining_amount');

            /*
            |--------------------------------------------------------------------------
            | Overdue Transactions
            |--------------------------------------------------------------------------
            */
            $overdueTransactions = ProjectFinancialTransaction::query()
                ->whereNotIn('status', ['paid', 'cancelled'])
                ->whereNotNull('due_date')
                ->whereDate('due_date', '<', now()->toDateString())
                ->count();

            /*
            |--------------------------------------------------------------------------
            | Approved Purchase Orders
            |--------------------------------------------------------------------------
            */
            $approvedPurchases = (float) PurchaseOrder::query()
                ->where('status', 'approved')
                ->sum('total');

            /*
            |--------------------------------------------------------------------------
            | Projects Currently In Finance
            |--------------------------------------------------------------------------
            */
            $projectsInFinance = Project::query()
                ->where('stage', 'finance')
                ->count();

            /*
            |--------------------------------------------------------------------------
            | Journal Entries
            |--------------------------------------------------------------------------
            */
            $pendingEntries = 0;
            $postedEntries = 0;

            if (DB::getSchemaBuilder()->hasTable('finance_journal_entries')) {
                $pendingEntries = DB::table('finance_journal_entries')
                    ->whereIn('status', ['draft', 'pending'])
                    ->count();

                $postedEntries = DB::table('finance_journal_entries')
                    ->where('status', 'posted')
                    ->count();
            }

            /*
            |--------------------------------------------------------------------------
            | Recent Financial Transactions
            |--------------------------------------------------------------------------
            */
            $recentTransactions = ProjectFinancialTransaction::query()
                ->with([
                    'project:id,name',
                ])
                ->latest('id')
                ->limit(8)
                ->get();

            return response()->json([
                'success' => true,

                'data' => [
                    'kpis' => [
                        'income' => $income,
                        'expenses' => $expenses,
                        'project_expenses' => $projectExpenses,
                        'net' => $net,

                        'receivables' => $receivables,
                        'payables' => $payables,

                        'overdue_transactions' => $overdueTransactions,

                        'approved_purchases' => $approvedPurchases,

                        'projects_in_finance' => $projectsInFinance,

                        'pending_entries' => $pendingEntries,
                        'posted_entries' => $postedEntries,
                    ],

                    'recent_transactions' => $recentTransactions,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'تعذر تحميل بيانات مركز المالية.',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}