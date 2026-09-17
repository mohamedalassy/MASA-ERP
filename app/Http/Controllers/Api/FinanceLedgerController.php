<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinanceAccount;
use App\Models\FinanceJournalLine;
use Illuminate\Http\Request;

class FinanceLedgerController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'account_id' => ['nullable', 'integer', 'exists:finance_accounts,id'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'cost_center_id' => ['nullable', 'integer', 'exists:cost_centers,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'search' => ['nullable', 'string', 'max:255'],
        ]);

        $query = FinanceJournalLine::query()
            ->select('finance_journal_lines.*')
            ->join('finance_journal_entries as e', 'e.id', '=', 'finance_journal_lines.journal_entry_id')
            ->where('e.status', 'posted')
            ->with([
                'journalEntry:id,entry_number,entry_date,description,reference_number,status',
                'account:id,code,name,name_en,type,normal_balance',
                'costCenter:id,code,name',
                'project:id,project_code,name',
            ]);

        if (!empty($validated['account_id'])) {
            $query->where('finance_journal_lines.account_id', $validated['account_id']);
        }

        if (!empty($validated['project_id'])) {
            $query->where('finance_journal_lines.project_id', $validated['project_id']);
        }

        if (!empty($validated['cost_center_id'])) {
            $query->where('finance_journal_lines.cost_center_id', $validated['cost_center_id']);
        }

        if (!empty($validated['from'])) {
            $query->whereDate('e.entry_date', '>=', $validated['from']);
        }

        if (!empty($validated['to'])) {
            $query->whereDate('e.entry_date', '<=', $validated['to']);
        }

        if (!empty($validated['search'])) {
            $search = $validated['search'];
            $query->where(function ($q) use ($search) {
                $q->where('finance_journal_lines.description', 'like', "%{$search}%")
                    ->orWhere('e.entry_number', 'like', "%{$search}%")
                    ->orWhere('e.reference_number', 'like', "%{$search}%");
            });
        }

        $lines = $query
            ->orderBy('e.entry_date')
            ->orderBy('e.id')
            ->orderBy('finance_journal_lines.id')
            ->get();

        $running = [];
        $data = $lines->map(function ($line) use (&$running) {
            $accountId = $line->account_id;
            $normal = $line->account?->normal_balance ?? 'debit';
            $movement = $normal === 'credit'
                ? (float) $line->credit - (float) $line->debit
                : (float) $line->debit - (float) $line->credit;

            $running[$accountId] = ($running[$accountId] ?? 0) + $movement;
            $line->running_balance = round($running[$accountId], 2);
            return $line;
        });

        return response()->json([
            'success' => true,
            'summary' => [
                'debit' => round((float) $lines->sum('debit'), 2),
                'credit' => round((float) $lines->sum('credit'), 2),
                'lines' => $lines->count(),
            ],
            'data' => $data,
        ]);
    }

    public function trialBalance(Request $request)
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $accounts = FinanceAccount::query()
            ->where('is_active', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name', 'name_en', 'type', 'normal_balance', 'is_postable']);

        $rows = $accounts->map(function ($account) use ($validated) {
            $query = FinanceJournalLine::query()
                ->join('finance_journal_entries as e', 'e.id', '=', 'finance_journal_lines.journal_entry_id')
                ->where('e.status', 'posted')
                ->where('finance_journal_lines.account_id', $account->id);

            if (!empty($validated['from'])) {
                $query->whereDate('e.entry_date', '>=', $validated['from']);
            }
            if (!empty($validated['to'])) {
                $query->whereDate('e.entry_date', '<=', $validated['to']);
            }

            $debit = (float) (clone $query)->sum('finance_journal_lines.debit');
            $credit = (float) (clone $query)->sum('finance_journal_lines.credit');

            return [
                'id' => $account->id,
                'code' => $account->code,
                'name' => $account->name,
                'type' => $account->type,
                'debit' => round($debit, 2),
                'credit' => round($credit, 2),
                'balance' => round(
                    $account->normal_balance === 'credit' ? $credit - $debit : $debit - $credit,
                    2
                ),
            ];
        })->filter(fn ($row) => $row['debit'] != 0 || $row['credit'] != 0)->values();

        return response()->json([
            'success' => true,
            'summary' => [
                'debit' => round((float) $rows->sum('debit'), 2),
                'credit' => round((float) $rows->sum('credit'), 2),
                'balanced' => round((float) $rows->sum('debit'), 2) === round((float) $rows->sum('credit'), 2),
            ],
            'data' => $rows,
        ]);
    }
    public function incomeStatement(Request $request)
{
    $validated = $request->validate([
        'from' => ['nullable', 'date'],
        'to' => ['nullable', 'date'],
        'project_id' => ['nullable', 'integer', 'exists:projects,id'],
        'cost_center_id' => ['nullable', 'integer', 'exists:cost_centers,id'],
    ]);

    $accounts = FinanceAccount::query()
        ->where('is_active', true)
        ->whereIn('type', ['revenue', 'expense'])
        ->orderBy('code')
        ->get([
            'id',
            'code',
            'name',
            'name_en',
            'type',
            'normal_balance',
        ]);

    $rows = $accounts->map(function ($account) use ($validated) {
        $query = FinanceJournalLine::query()
            ->join(
                'finance_journal_entries as e',
                'e.id',
                '=',
                'finance_journal_lines.journal_entry_id'
            )
            ->where('e.status', 'posted')
            ->where(
                'finance_journal_lines.account_id',
                $account->id
            );

        if (!empty($validated['from'])) {
            $query->whereDate(
                'e.entry_date',
                '>=',
                $validated['from']
            );
        }

        if (!empty($validated['to'])) {
            $query->whereDate(
                'e.entry_date',
                '<=',
                $validated['to']
            );
        }

        if (!empty($validated['project_id'])) {
            $query->where(
                'finance_journal_lines.project_id',
                $validated['project_id']
            );
        }

        if (!empty($validated['cost_center_id'])) {
            $query->where(
                'finance_journal_lines.cost_center_id',
                $validated['cost_center_id']
            );
        }

        $debit = (float) (clone $query)
            ->sum('finance_journal_lines.debit');

        $credit = (float) (clone $query)
            ->sum('finance_journal_lines.credit');

        $amount = $account->type === 'revenue'
            ? $credit - $debit
            : $debit - $credit;

        return [
            'id' => $account->id,
            'code' => $account->code,
            'name' => $account->name,
            'name_en' => $account->name_en,
            'type' => $account->type,
            'debit' => round($debit, 2),
            'credit' => round($credit, 2),
            'amount' => round($amount, 2),
        ];
    })
        ->filter(fn ($row) => $row['debit'] != 0 || $row['credit'] != 0)
        ->values();

    $revenues = $rows
        ->where('type', 'revenue')
        ->values();

    $expenses = $rows
        ->where('type', 'expense')
        ->values();

    $totalRevenue = round(
        (float) $revenues->sum('amount'),
        2
    );

    $totalExpenses = round(
        (float) $expenses->sum('amount'),
        2
    );

    $netProfit = round(
        $totalRevenue - $totalExpenses,
        2
    );
    $monthlyQuery = FinanceJournalLine::query()
    ->join(
        'finance_journal_entries as e',
        'e.id',
        '=',
        'finance_journal_lines.journal_entry_id'
    )
    ->join(
        'finance_accounts as a',
        'a.id',
        '=',
        'finance_journal_lines.account_id'
    )
    ->where('e.status', 'posted')
    ->whereIn('a.type', ['revenue', 'expense']);

if (!empty($validated['from'])) {
    $monthlyQuery->whereDate(
        'e.entry_date',
        '>=',
        $validated['from']
    );
}

if (!empty($validated['to'])) {
    $monthlyQuery->whereDate(
        'e.entry_date',
        '<=',
        $validated['to']
    );
}

if (!empty($validated['project_id'])) {
    $monthlyQuery->where(
        'finance_journal_lines.project_id',
        $validated['project_id']
    );
}

if (!empty($validated['cost_center_id'])) {
    $monthlyQuery->where(
        'finance_journal_lines.cost_center_id',
        $validated['cost_center_id']
    );
}

$monthlyTrend = $monthlyQuery
    ->selectRaw("
        DATE_FORMAT(e.entry_date, '%Y-%m') as month,
        SUM(
            CASE
                WHEN a.type = 'revenue'
                THEN finance_journal_lines.credit
                     - finance_journal_lines.debit
                ELSE 0
            END
        ) as revenue,
        SUM(
            CASE
                WHEN a.type = 'expense'
                THEN finance_journal_lines.debit
                     - finance_journal_lines.credit
                ELSE 0
            END
        ) as expenses
    ")
    ->groupByRaw("DATE_FORMAT(e.entry_date, '%Y-%m')")
    ->orderBy('month')
    ->get()
    ->map(function ($row) {
        $revenue = round((float) $row->revenue, 2);
        $expenses = round((float) $row->expenses, 2);

        return [
            'month' => $row->month,
            'revenue' => $revenue,
            'expenses' => $expenses,
            'net_profit' => round(
                $revenue - $expenses,
                2
            ),
        ];
    })
    ->values();

$profitMargin = $totalRevenue > 0
    ? round(($netProfit / $totalRevenue) * 100, 2)
    : 0;
    

    return response()->json([
        'success' => true,
        'summary' => [
            'total_revenue' => $totalRevenue,
            'total_expenses' => $totalExpenses,
            'net_profit' => $netProfit,
            'profit_margin' => $profitMargin,
            'result' => $netProfit >= 0 ? 'profit' : 'loss',
        ],
        'revenues' => $revenues,
        'expenses' => $expenses,
        'monthly_trend' => $monthlyTrend,
    ]);
}
public function balanceSheet(Request $request)
{
    $validated = $request->validate([
        'to' => ['nullable', 'date'],
    ]);

    $accounts = FinanceAccount::query()
        ->where('is_active', true)
        ->whereIn('type', [
            'asset',
            'liability',
            'equity',
            'revenue',
            'expense',
        ])
        ->orderBy('code')
        ->get([
            'id',
            'code',
            'name',
            'name_en',
            'type',
            'normal_balance',
        ]);

    $rows = $accounts->map(function ($account) use ($validated) {
        $query = FinanceJournalLine::query()
            ->join(
                'finance_journal_entries as e',
                'e.id',
                '=',
                'finance_journal_lines.journal_entry_id'
            )
            ->where('e.status', 'posted')
            ->where(
                'finance_journal_lines.account_id',
                $account->id
            );

        if (!empty($validated['to'])) {
            $query->whereDate(
                'e.entry_date',
                '<=',
                $validated['to']
            );
        }

        $debit = (float) (clone $query)
            ->sum('finance_journal_lines.debit');

        $credit = (float) (clone $query)
            ->sum('finance_journal_lines.credit');

        if ($account->type === 'asset') {
            $balance = $debit - $credit;
        } elseif (
            $account->type === 'liability' ||
            $account->type === 'equity' ||
            $account->type === 'revenue'
        ) {
            $balance = $credit - $debit;
        } else {
            $balance = $debit - $credit;
        }

        return [
            'id' => $account->id,
            'code' => $account->code,
            'name' => $account->name,
            'name_en' => $account->name_en,
            'type' => $account->type,
            'debit' => round($debit, 2),
            'credit' => round($credit, 2),
            'balance' => round($balance, 2),
        ];
    })
        ->filter(fn ($row) => $row['debit'] != 0 || $row['credit'] != 0)
        ->values();

    $assets = $rows
        ->where('type', 'asset')
        ->values();

    $liabilities = $rows
        ->where('type', 'liability')
        ->values();

    $equity = $rows
        ->where('type', 'equity')
        ->values();

    $totalRevenue = round(
        (float) $rows
            ->where('type', 'revenue')
            ->sum('balance'),
        2
    );

    $totalExpenses = round(
        (float) $rows
            ->where('type', 'expense')
            ->sum('balance'),
        2
    );

    $netIncome = round(
        $totalRevenue - $totalExpenses,
        2
    );

    $totalAssets = round(
        (float) $assets->sum('balance'),
        2
    );

    $totalLiabilities = round(
        (float) $liabilities->sum('balance'),
        2
    );

    $recordedEquity = round(
        (float) $equity->sum('balance'),
        2
    );

    $totalEquity = round(
        $recordedEquity + $netIncome,
        2
    );

    $liabilitiesAndEquity = round(
        $totalLiabilities + $totalEquity,
        2
    );

    $difference = round(
        $totalAssets - $liabilitiesAndEquity,
        2
    );

    return response()->json([
        'success' => true,
        'summary' => [
            'total_assets' => $totalAssets,
            'total_liabilities' => $totalLiabilities,
            'recorded_equity' => $recordedEquity,
            'net_income' => $netIncome,
            'total_equity' => $totalEquity,
            'liabilities_and_equity' => $liabilitiesAndEquity,
            'difference' => $difference,
            'balanced' => abs($difference) < 0.01,
        ],
        'assets' => $assets,
        'liabilities' => $liabilities,
        'equity' => $equity,
    ]);
}

    public function cashFlow(Request $request)
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'project_id' => ['nullable', 'integer', 'exists:projects,id'],
            'cost_center_id' => ['nullable', 'integer', 'exists:cost_centers,id'],
        ]);

        $cashAccounts = FinanceAccount::query()
            ->where('is_active', true)
            ->where('is_cash_account', true)
            ->orderBy('code')
            ->get(['id', 'code', 'name', 'name_en']);

        $cashAccountIds = $cashAccounts->pluck('id');

        if ($cashAccountIds->isEmpty()) {
            return response()->json([
                'success' => true,
                'summary' => [
                    'opening_balance' => 0,
                    'total_inflows' => 0,
                    'total_outflows' => 0,
                    'net_cash_flow' => 0,
                    'closing_balance' => 0,
                ],
                'categories' => [],
                'monthly_trend' => [],
                'cash_accounts' => [],
                'transactions' => [],
            ]);
        }

        $openingBalance = 0;

        if (!empty($validated['from'])) {
            $openingQuery = FinanceJournalLine::query()
                ->join(
                    'finance_journal_entries as e',
                    'e.id',
                    '=',
                    'finance_journal_lines.journal_entry_id'
                )
                ->where('e.status', 'posted')
                ->whereIn(
                    'finance_journal_lines.account_id',
                    $cashAccountIds
                )
                ->whereDate('e.entry_date', '<', $validated['from']);

            $openingDebit = (float) (clone $openingQuery)
                ->sum('finance_journal_lines.debit');

            $openingCredit = (float) (clone $openingQuery)
                ->sum('finance_journal_lines.credit');

            $openingBalance = round(
                $openingDebit - $openingCredit,
                2
            );
        }

        $query = FinanceJournalLine::query()
            ->select('finance_journal_lines.*')
            ->join(
                'finance_journal_entries as e',
                'e.id',
                '=',
                'finance_journal_lines.journal_entry_id'
            )
            ->where('e.status', 'posted')
            ->whereIn(
                'finance_journal_lines.account_id',
                $cashAccountIds
            )
            ->with([
                'journalEntry:id,entry_number,entry_date,description,reference_number',
                'account:id,code,name,name_en',
                'project:id,project_code,name',
                'costCenter:id,code,name',
            ]);

        if (!empty($validated['from'])) {
            $query->whereDate(
                'e.entry_date',
                '>=',
                $validated['from']
            );
        }

        if (!empty($validated['to'])) {
            $query->whereDate(
                'e.entry_date',
                '<=',
                $validated['to']
            );
        }

        if (!empty($validated['project_id'])) {
            $query->where(
                'finance_journal_lines.project_id',
                $validated['project_id']
            );
        }

        if (!empty($validated['cost_center_id'])) {
            $query->where(
                'finance_journal_lines.cost_center_id',
                $validated['cost_center_id']
            );
        }

        $cashLines = $query
            ->orderBy('e.entry_date')
            ->orderBy('e.id')
            ->orderBy('finance_journal_lines.id')
            ->get();

        $transactions = $cashLines->map(function ($line) use ($cashAccountIds) {
            $counterpartLines = FinanceJournalLine::query()
                ->where(
                    'journal_entry_id',
                    $line->journal_entry_id
                )
                ->whereNotIn('account_id', $cashAccountIds)
                ->with('account:id,code,name,name_en,type,cash_flow_category')
                ->get();

            $counterpart = $counterpartLines
                ->sortByDesc(function ($counterpartLine) {
                    return (float) $counterpartLine->debit
                        + (float) $counterpartLine->credit;
                })
                ->first();

            $counterpartAccount = $counterpart?->account;
            $category = $counterpartAccount?->cash_flow_category;

            if (empty($category)) {
                $category = match ($counterpartAccount?->type) {
                    'revenue', 'expense' => 'operating',
                    'asset' => 'investing',
                    'liability', 'equity' => 'financing',
                    default => 'operating',
                };
            }

            $amount = round(
                (float) $line->debit - (float) $line->credit,
                2
            );

            return [
                'id' => $line->id,
                'journal_entry_id' => $line->journal_entry_id,
                'entry_number' => $line->journalEntry?->entry_number,
                'entry_date' => $line->journalEntry?->entry_date,
                'reference_number' => $line->journalEntry?->reference_number,
                'description' => $line->description
                    ?: $line->journalEntry?->description,
                'cash_account' => $line->account,
                'counterpart_account' => $counterpartAccount,
                'project' => $line->project,
                'cost_center' => $line->costCenter,
                'category' => $category,
                'direction' => $amount >= 0 ? 'inflow' : 'outflow',
                'inflow' => $amount > 0 ? $amount : 0,
                'outflow' => $amount < 0 ? abs($amount) : 0,
                'net_amount' => $amount,
            ];
        })->values();

        $totalInflows = round(
            (float) $transactions->sum('inflow'),
            2
        );

        $totalOutflows = round(
            (float) $transactions->sum('outflow'),
            2
        );

        $netCashFlow = round(
            $totalInflows - $totalOutflows,
            2
        );

        $closingBalance = round(
            $openingBalance + $netCashFlow,
            2
        );

        $categoryLabels = [
            'operating' => 'التدفقات التشغيلية',
            'investing' => 'التدفقات الاستثمارية',
            'financing' => 'التدفقات التمويلية',
        ];

        $categories = collect($categoryLabels)
            ->map(function ($label, $key) use ($transactions) {
                $categoryTransactions = $transactions
                    ->where('category', $key);

                $inflows = round(
                    (float) $categoryTransactions->sum('inflow'),
                    2
                );

                $outflows = round(
                    (float) $categoryTransactions->sum('outflow'),
                    2
                );

                return [
                    'key' => $key,
                    'label' => $label,
                    'inflows' => $inflows,
                    'outflows' => $outflows,
                    'net' => round($inflows - $outflows, 2),
                    'transactions_count' => $categoryTransactions->count(),
                ];
            })
            ->values();

        $monthlyTrend = $transactions
            ->groupBy(function ($transaction) {
                return substr(
                    (string) $transaction['entry_date'],
                    0,
                    7
                );
            })
            ->map(function ($monthTransactions, $month) {
                $inflows = round(
                    (float) $monthTransactions->sum('inflow'),
                    2
                );

                $outflows = round(
                    (float) $monthTransactions->sum('outflow'),
                    2
                );

                return [
                    'month' => $month,
                    'inflows' => $inflows,
                    'outflows' => $outflows,
                    'net' => round($inflows - $outflows, 2),
                ];
            })
            ->sortBy('month')
            ->values();

        $cashAccountBalances = $cashAccounts->map(function ($account) use ($validated) {
            $accountQuery = FinanceJournalLine::query()
                ->join(
                    'finance_journal_entries as e',
                    'e.id',
                    '=',
                    'finance_journal_lines.journal_entry_id'
                )
                ->where('e.status', 'posted')
                ->where(
                    'finance_journal_lines.account_id',
                    $account->id
                );

            if (!empty($validated['to'])) {
                $accountQuery->whereDate(
                    'e.entry_date',
                    '<=',
                    $validated['to']
                );
            }

            $debit = (float) (clone $accountQuery)
                ->sum('finance_journal_lines.debit');

            $credit = (float) (clone $accountQuery)
                ->sum('finance_journal_lines.credit');

            return [
                'id' => $account->id,
                'code' => $account->code,
                'name' => $account->name,
                'balance' => round($debit - $credit, 2),
            ];
        })->values();

        return response()->json([
            'success' => true,
            'summary' => [
                'opening_balance' => $openingBalance,
                'total_inflows' => $totalInflows,
                'total_outflows' => $totalOutflows,
                'net_cash_flow' => $netCashFlow,
                'closing_balance' => $closingBalance,
            ],
            'categories' => $categories,
            'monthly_trend' => $monthlyTrend,
            'cash_accounts' => $cashAccountBalances,
            'transactions' => $transactions->sortByDesc('entry_date')->values(),
        ]);
    }
}
