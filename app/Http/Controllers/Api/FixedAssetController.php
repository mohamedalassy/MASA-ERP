<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FixedAsset;
use App\Models\FixedAssetDepreciation;
use App\Services\JournalPostingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * الأصول الثابتة — الوحدة الوحيدة في المالية اللي مافيش منها حاجة
 * في الحزمة المستعادة (لا شاشة ولا كنترولر ولا موديل).
 * الدليل الوحيد على وجودها كان migration بيضيف حقول الاستبعاد.
 */
class FixedAssetController extends Controller
{
    private const DEPRECIATION_EXPENSE = '5310';
    private const ACCUMULATED_DEPRECIATION = '1290';

    public function __construct(
        private readonly JournalPostingService $posting
    ) {}

    public function index(Request $request)
    {
        $query = FixedAsset::query()
            ->with(['costCenter:id,code,name']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        if ($request->filled('search')) {
            $search = trim($request->search);

            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('serial_number', 'like', "%{$search}%");
            });
        }

        $assets = $query->orderBy('code')->get()->map(fn ($asset) => [
            ...$asset->toArray(),
            'book_value' => $asset->book_value,
            'depreciable_base' => $asset->depreciable_base,
            'monthly_depreciation' => $asset->monthlyDepreciation(),
            'is_fully_depreciated' => $asset->isFullyDepreciated(),
        ]);

        $active = $assets->where('status', 'active');

        return response()->json([
            'success' => true,
            'summary' => [
                'assets_count' => $assets->count(),
                'active_count' => $active->count(),
                'total_cost' => round((float) $assets->sum('cost'), 2),
                'accumulated_depreciation' => round(
                    (float) $assets->sum('accumulated_depreciation'),
                    2
                ),
                'book_value' => round((float) $assets->sum('book_value'), 2),
                'monthly_depreciation' => round(
                    (float) $active->sum('monthly_depreciation'),
                    2
                ),
            ],
            'data' => $assets->values(),
        ]);
    }

    public function show(FixedAsset $fixedAsset)
    {
        $fixedAsset->load([
            'costCenter:id,code,name',
            'assetAccount:id,code,name',
            'depreciationAccount:id,code,name',
            'expenseAccount:id,code,name',
            'depreciations.journalEntry:id,entry_number,entry_date,status',
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                ...$fixedAsset->toArray(),
                'book_value' => $fixedAsset->book_value,
                'depreciable_base' => $fixedAsset->depreciable_base,
                'monthly_depreciation' => $fixedAsset->monthlyDepreciation(),
                'is_fully_depreciated' => $fixedAsset->isFullyDepreciated(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $asset = FixedAsset::create([
            ...$validated,
            'accumulated_depreciation' => 0,
            'status' => 'active',
            'depreciation_start_date' =>
                $validated['depreciation_start_date']
                ?? $validated['purchase_date'],
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم تسجيل الأصل بنجاح.',
            'data' => $asset,
        ], 201);
    }

    public function update(Request $request, FixedAsset $fixedAsset)
    {
        if ($fixedAsset->status === 'disposed') {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن تعديل أصل مستبعد.',
            ], 422);
        }

        $validated = $this->validatePayload($request, $fixedAsset->id);

        $fixedAsset->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات الأصل بنجاح.',
            'data' => $fixedAsset->fresh(),
        ]);
    }

    /**
     * ترحيل إهلاك شهر لكل الأصول النشطة بقيد واحد مجمّع.
     *
     * محمي من الترحيل المزدوج بقيد unique على
     * (fixed_asset_id, period_year, period_month).
     */
    public function runDepreciation(Request $request)
    {
        $validated = $request->validate([
            'year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'entry_date' => ['nullable', 'date'],
        ]);

        $year = (int) $validated['year'];
        $month = (int) $validated['month'];

        $alreadyPosted = FixedAssetDepreciation::query()
            ->where('period_year', $year)
            ->where('period_month', $month)
            ->exists();

        if ($alreadyPosted) {
            throw ValidationException::withMessages([
                'period' => [
                    'تم ترحيل إهلاك الفترة دي بالفعل.',
                ],
            ]);
        }

        $assets = FixedAsset::query()
            ->where('status', 'active')
            ->get()
            ->filter(fn ($asset) => $asset->monthlyDepreciation() > 0);

        if ($assets->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'لا توجد أصول قابلة للإهلاك في الفترة دي.',
            ], 422);
        }

        $expenseAccount = $this->posting->requireAccount(
            self::DEPRECIATION_EXPENSE,
            'مصروف الإهلاك'
        );

        $accumulatedAccount = $this->posting->requireAccount(
            self::ACCUMULATED_DEPRECIATION,
            'مجمّع إهلاك الأصول'
        );

        $result = DB::transaction(function () use (
            $assets,
            $year,
            $month,
            $validated,
            $expenseAccount,
            $accumulatedAccount,
            $request
        ) {
            $total = 0;
            $lines = [];
            $records = [];

            foreach ($assets as $asset) {
                $amount = $asset->monthlyDepreciation();
                $total += $amount;

                $accumulated = round(
                    (float) $asset->accumulated_depreciation + $amount,
                    2
                );

                $records[] = [
                    'asset' => $asset,
                    'amount' => $amount,
                    'accumulated' => $accumulated,
                ];

                // سطر مصروف لكل أصل — عشان التوزيع على مراكز التكلفة
                $lines[] = [
                    'account_id' => $asset->expense_account_id
                        ?: $expenseAccount->id,
                    'debit' => $amount,
                    'credit' => 0,
                    'description' => 'إهلاك ' . $asset->name,
                    'cost_center_id' => $asset->cost_center_id,
                ];
            }

            $total = round($total, 2);

            $lines[] = [
                'account_id' => $accumulatedAccount->id,
                'debit' => 0,
                'credit' => $total,
                'description' => sprintf(
                    'مجمّع إهلاك %02d/%d',
                    $month,
                    $year
                ),
            ];

            $entry = $this->posting->post(
                reference: [
                    'type' => 'asset_depreciation',
                    'id' => (int) sprintf('%d%02d', $year, $month),
                    'number' => sprintf('DEP-%d-%02d', $year, $month),
                ],
                lines: $lines,
                description: sprintf(
                    'قيد إهلاك شهر %02d/%d',
                    $month,
                    $year
                ),
                entryDate: $validated['entry_date']
                    ?? now()->setDate($year, $month, 1)->endOfMonth()->toDateString(),
                userId: $request->user()?->id,
                notes: 'قيد آلي مجمّع لإهلاك الأصول الثابتة.'
            );

            foreach ($records as $record) {
                $asset = $record['asset'];

                FixedAssetDepreciation::create([
                    'fixed_asset_id' => $asset->id,
                    'finance_journal_entry_id' => $entry->id,
                    'period_year' => $year,
                    'period_month' => $month,
                    'amount' => $record['amount'],
                    'accumulated_after' => $record['accumulated'],
                    'book_value_after' => round(
                        (float) $asset->cost - $record['accumulated'],
                        2
                    ),
                ]);

                $asset->update([
                    'accumulated_depreciation' => $record['accumulated'],
                    'last_depreciation_date' => now()
                        ->setDate($year, $month, 1)
                        ->endOfMonth()
                        ->toDateString(),
                ]);

                if ($asset->fresh()->isFullyDepreciated()) {
                    $asset->update(['status' => 'fully_depreciated']);
                }
            }

            return ['entry' => $entry, 'total' => $total];
        });

        return response()->json([
            'success' => true,
            'message' => 'تم ترحيل الإهلاك بقيمة ' .
                number_format($result['total'], 2) . ' ر.س.',
            'data' => [
                'journal_entry' => $result['entry']->only([
                    'id', 'entry_number', 'entry_date', 'total_debit',
                ]),
                'assets_count' => $assets->count(),
                'total_amount' => $result['total'],
            ],
        ]);
    }

    /**
     * استبعاد أصل — بيع أو إعدام.
     *
     * القيد:
     *   مدين   النقدية (متحصلات البيع، لو فيه)
     *   مدين   مجمّع الإهلاك (بالمتراكم)
     *   دائن   الأصل (بالتكلفة)
     *   والفرق ربح أو خسارة استبعاد
     */
    public function dispose(Request $request, FixedAsset $fixedAsset)
    {
        if ($fixedAsset->status === 'disposed') {
            return response()->json([
                'success' => false,
                'message' => 'الأصل مستبعد بالفعل.',
            ], 422);
        }

        $validated = $request->validate([
            'disposal_date' => ['required', 'date'],
            'disposal_type' => ['required', 'in:sale,write_off'],
            'disposal_proceeds' => ['nullable', 'numeric', 'min:0'],
            'cash_account_id' => [
                'nullable',
                'required_if:disposal_type,sale',
                'integer',
                'exists:finance_accounts,id',
            ],
            'disposal_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $proceeds = round((float) ($validated['disposal_proceeds'] ?? 0), 2);
        $bookValue = $fixedAsset->book_value;
        $gain = round($proceeds - $bookValue, 2);

        $fixedAsset->update([
            'status' => 'disposed',
            'disposal_date' => $validated['disposal_date'],
            'disposal_type' => $validated['disposal_type'],
            'disposal_proceeds' => $proceeds,
            'disposal_notes' => $validated['disposal_notes'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم استبعاد الأصل.',
            'data' => [
                'asset' => $fixedAsset->fresh(),
                'book_value_at_disposal' => $bookValue,
                'proceeds' => $proceeds,
                'gain_or_loss' => $gain,
                'result' => $gain >= 0 ? 'gain' : 'loss',
            ],
        ]);
    }

    private function validatePayload(
        Request $request,
        ?int $ignoreId = null
    ): array {
        return $request->validate([
            'code' => [
                'required',
                'string',
                'max:50',
                Rule::unique('fixed_assets', 'code')->ignore($ignoreId),
            ],

            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'category' => ['nullable', 'string', 'max:255'],
            'serial_number' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],

            'asset_account_id' => [
                'nullable', 'integer', 'exists:finance_accounts,id',
            ],
            'depreciation_account_id' => [
                'nullable', 'integer', 'exists:finance_accounts,id',
            ],
            'expense_account_id' => [
                'nullable', 'integer', 'exists:finance_accounts,id',
            ],
            'cost_center_id' => [
                'nullable', 'integer', 'exists:cost_centers,id',
            ],

            'purchase_date' => ['required', 'date'],
            'cost' => ['required', 'numeric', 'min:0.01'],

            'salvage_value' => [
                'nullable', 'numeric', 'min:0', 'lt:cost',
            ],

            'useful_life_months' => [
                'required', 'integer', 'min:1', 'max:1200',
            ],

            'depreciation_method' => [
                'nullable', 'in:straight_line,declining_balance',
            ],

            'depreciation_start_date' => ['nullable', 'date'],
        ], [
            'salvage_value.lt' =>
                'القيمة التخريدية يجب أن تكون أقل من التكلفة.',
        ]);
    }
}
