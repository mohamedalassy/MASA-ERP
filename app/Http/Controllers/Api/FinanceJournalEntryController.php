<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinanceAccount;
use App\Models\FinanceJournalEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinanceJournalEntryController extends Controller
{
    public function index(Request $request)
    {
        $query = FinanceJournalEntry::query()
            ->with([
                'project:id,project_code,name',
                'creator:id,name',
                'approver:id,name',
                'poster:id,name',
            ]);

        if ($request->filled('status')) {
            $query->where(
                'status',
                $request->status
            );
        }

        if ($request->filled('project_id')) {
            $query->where(
                'project_id',
                $request->project_id
            );
        }

        if ($request->filled('from')) {
            $query->whereDate(
                'entry_date',
                '>=',
                $request->from
            );
        }

        if ($request->filled('to')) {
            $query->whereDate(
                'entry_date',
                '<=',
                $request->to
            );
        }

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where(
                    'entry_number',
                    'like',
                    "%{$search}%"
                )
                    ->orWhere(
                        'description',
                        'like',
                        "%{$search}%"
                    )
                    ->orWhere(
                        'reference_number',
                        'like',
                        "%{$search}%"
                    );
            });
        }

        $entries = $query
            ->latest('entry_date')
            ->latest('id')
            ->get();

        return response()->json([
            'success' => true,
            'count' => $entries->count(),
            'data' => $entries,
        ]);
    }

    public function show(
        FinanceJournalEntry $journalEntry
    ) {
        $journalEntry->load([
            'lines.account',
            'lines.costCenter',
            'lines.project:id,project_code,name',
            'project:id,project_code,name',
            'creator:id,name',
            'approver:id,name',
            'poster:id,name',
        ]);

        return response()->json([
            'success' => true,
            'data' => $journalEntry,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateEntry(
            $request
        );

        $entry = DB::transaction(
            function () use ($validated, $request) {
                $this->validateAccountingLines(
                    $validated['lines']
                );

                [$debit, $credit] =
                    $this->calculateTotals(
                        $validated['lines']
                    );

                $entry =
                    FinanceJournalEntry::create([
                        'entry_number' =>
                            $this->generateEntryNumber(),

                        'entry_date' =>
                            $validated['entry_date'],

                        'description' =>
                            $validated['description']
                            ?? null,

                        'reference_type' =>
                            $validated['reference_type']
                            ?? 'manual',

                        'reference_id' =>
                            $validated['reference_id']
                            ?? null,

                        'reference_number' =>
                            $validated['reference_number']
                            ?? null,

                        'project_id' =>
                            $validated['project_id']
                            ?? null,

                        'status' => 'draft',

                        'total_debit' =>
                            $debit,

                        'total_credit' =>
                            $credit,

                        'created_by' =>
                            $request->user()?->id,

                        'notes' =>
                            $validated['notes']
                            ?? null,
                    ]);

                foreach (
                    $validated['lines']
                    as $line
                ) {
                    $entry->lines()->create([
                        'account_id' =>
                            $line['account_id'],

                        'cost_center_id' =>
                            $line['cost_center_id']
                            ?? null,

                        'project_id' =>
                            $line['project_id']
                            ?? $validated['project_id']
                            ?? null,

                        'description' =>
                            $line['description']
                            ?? null,

                        'debit' =>
                            round(
                                (float) (
                                    $line['debit'] ?? 0
                                ),
                                2
                            ),

                        'credit' =>
                            round(
                                (float) (
                                    $line['credit'] ?? 0
                                ),
                                2
                            ),
                    ]);
                }

                return $entry;
            }
        );

        return response()->json([
            'success' => true,
            'message' =>
                'تم إنشاء القيد المحاسبي بنجاح.',
            'data' =>
                $entry->load([
                    'lines.account',
                    'lines.costCenter',
                    'project',
                ]),
        ], 201);
    }

    public function update(
        Request $request,
        FinanceJournalEntry $journalEntry
    ) {
        if ($journalEntry->status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' =>
                    'يمكن تعديل القيود المسودة فقط.',
            ], 422);
        }

        $validated = $this->validateEntry(
            $request
        );

        DB::transaction(
            function () use (
                $validated,
                $journalEntry
            ) {
                $this->validateAccountingLines(
                    $validated['lines']
                );

                [$debit, $credit] =
                    $this->calculateTotals(
                        $validated['lines']
                    );

                $journalEntry->update([
                    'entry_date' =>
                        $validated['entry_date'],

                    'description' =>
                        $validated['description']
                        ?? null,

                    'reference_type' =>
                        $validated['reference_type']
                        ?? 'manual',

                    'reference_id' =>
                        $validated['reference_id']
                        ?? null,

                    'reference_number' =>
                        $validated['reference_number']
                        ?? null,

                    'project_id' =>
                        $validated['project_id']
                        ?? null,

                    'total_debit' =>
                        $debit,

                    'total_credit' =>
                        $credit,

                    'notes' =>
                        $validated['notes']
                        ?? null,
                ]);

                $journalEntry
                    ->lines()
                    ->delete();

                foreach (
                    $validated['lines']
                    as $line
                ) {
                    $journalEntry
                        ->lines()
                        ->create([
                            'account_id' =>
                                $line['account_id'],

                            'cost_center_id' =>
                                $line['cost_center_id']
                                ?? null,

                            'project_id' =>
                                $line['project_id']
                                ?? $validated[
                                    'project_id'
                                ]
                                ?? null,

                            'description' =>
                                $line['description']
                                ?? null,

                            'debit' =>
                                round(
                                    (float) (
                                        $line['debit']
                                        ?? 0
                                    ),
                                    2
                                ),

                            'credit' =>
                                round(
                                    (float) (
                                        $line['credit']
                                        ?? 0
                                    ),
                                    2
                                ),
                        ]);
                }
            }
        );

        return response()->json([
            'success' => true,
            'message' =>
                'تم تحديث القيد المحاسبي بنجاح.',
            'data' =>
                $journalEntry
                    ->fresh()
                    ->load([
                        'lines.account',
                        'lines.costCenter',
                        'project',
                    ]),
        ]);
    }

    public function submit(
        FinanceJournalEntry $journalEntry
    ) {
        if ($journalEntry->status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' =>
                    'يمكن إرسال القيود المسودة فقط للمراجعة.',
            ], 422);
        }

        if (!$journalEntry->isBalanced()) {
            return response()->json([
                'success' => false,
                'message' =>
                    'القيد غير متوازن.',
            ], 422);
        }

        if ($journalEntry->lines()->count() < 2) {
            return response()->json([
                'success' => false,
                'message' =>
                    'يجب أن يحتوي القيد على طرفين على الأقل.',
            ], 422);
        }

        $journalEntry->update([
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'تم إرسال القيد للمراجعة.',
            'data' =>
                $journalEntry->fresh(),
        ]);
    }

    public function approve(
        Request $request,
        FinanceJournalEntry $journalEntry
    ) {
        if ($journalEntry->status !== 'pending') {
            return response()->json([
                'success' => false,
                'message' =>
                    'يمكن اعتماد القيود قيد المراجعة فقط.',
            ], 422);
        }

        if (!$journalEntry->isBalanced()) {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن اعتماد قيد غير متوازن.',
            ], 422);
        }

        $journalEntry->update([
            'status' => 'approved',
            'approved_by' =>
                $request->user()?->id,
            'approved_at' =>
                now(),
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'تم اعتماد القيد بنجاح.',
            'data' =>
                $journalEntry->fresh(),
        ]);
    }

    public function post(
        Request $request,
        FinanceJournalEntry $journalEntry
    ) {
        if ($journalEntry->status !== 'approved') {
            return response()->json([
                'success' => false,
                'message' =>
                    'يجب اعتماد القيد قبل الترحيل.',
            ], 422);
        }

        if (!$journalEntry->isBalanced()) {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن ترحيل قيد غير متوازن.',
            ], 422);
        }

        $journalEntry->update([
            'status' => 'posted',
            'posted_by' =>
                $request->user()?->id,
            'posted_at' =>
                now(),
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'تم ترحيل القيد بنجاح.',
            'data' =>
                $journalEntry->fresh(),
        ]);
    }

    public function reject(
        Request $request,
        FinanceJournalEntry $journalEntry
    ) {
        if (
            !in_array(
                $journalEntry->status,
                ['pending', 'approved'],
                true
            )
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن رفض القيد في حالته الحالية.',
            ], 422);
        }

        $validated = $request->validate([
            'reason' => [
                'required',
                'string',
                'max:5000',
            ],
        ]);

        $journalEntry->update([
            'status' => 'rejected',
            'notes' =>
                trim(
                    ($journalEntry->notes
                        ? $journalEntry->notes . "\n"
                        : '') .
                    'سبب الرفض: ' .
                    $validated['reason']
                ),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم رفض القيد.',
            'data' =>
                $journalEntry->fresh(),
        ]);
    }

    public function destroy(
        FinanceJournalEntry $journalEntry
    ) {
        if (
            !in_array(
                $journalEntry->status,
                ['draft', 'rejected'],
                true
            )
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن حذف القيد في حالته الحالية.',
            ], 422);
        }

        $journalEntry->delete();

        return response()->json([
            'success' => true,
            'message' =>
                'تم حذف القيد بنجاح.',
        ]);
    }

    private function validateEntry(
        Request $request
    ): array {
        return $request->validate([
            'entry_date' => [
                'required',
                'date',
            ],

            'description' => [
                'nullable',
                'string',
                'max:5000',
            ],

            'reference_type' => [
                'nullable',
                'string',
                'max:50',
            ],

            'reference_id' => [
                'nullable',
                'integer',
            ],

            'reference_number' => [
                'nullable',
                'string',
                'max:255',
            ],

            'project_id' => [
                'nullable',
                'integer',
                'exists:projects,id',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:5000',
            ],

            'lines' => [
                'required',
                'array',
                'min:2',
            ],

            'lines.*.account_id' => [
                'required',
                'integer',
                'exists:finance_accounts,id',
            ],

            'lines.*.cost_center_id' => [
                'nullable',
                'integer',
                'exists:cost_centers,id',
            ],

            'lines.*.project_id' => [
                'nullable',
                'integer',
                'exists:projects,id',
            ],

            'lines.*.description' => [
                'nullable',
                'string',
                'max:5000',
            ],

            'lines.*.debit' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'lines.*.credit' => [
                'nullable',
                'numeric',
                'min:0',
            ],
        ]);
    }

    private function validateAccountingLines(
        array $lines
    ): void {
        foreach ($lines as $index => $line) {
            $debit =
                round(
                    (float) ($line['debit'] ?? 0),
                    2
                );

            $credit =
                round(
                    (float) ($line['credit'] ?? 0),
                    2
                );

            if ($debit <= 0 && $credit <= 0) {
                throw ValidationException::withMessages([
                    "lines.{$index}" =>
                        'يجب إدخال قيمة مدينة أو دائنة.',
                ]);
            }

            if ($debit > 0 && $credit > 0) {
                throw ValidationException::withMessages([
                    "lines.{$index}" =>
                        'لا يمكن أن يكون نفس السطر مدينًا ودائنًا في نفس الوقت.',
                ]);
            }

            $account =
                FinanceAccount::find(
                    $line['account_id']
                );

            if (!$account || !$account->is_active) {
                throw ValidationException::withMessages([
                    "lines.{$index}.account_id" =>
                        'الحساب غير متاح.',
                ]);
            }

            if (!$account->is_postable) {
                throw ValidationException::withMessages([
                    "lines.{$index}.account_id" =>
                        'لا يمكن الترحيل على حساب تجميعي.',
                ]);
            }
        }

        [$debit, $credit] =
            $this->calculateTotals($lines);

        if ($debit <= 0 || $credit <= 0) {
            throw ValidationException::withMessages([
                'lines' =>
                    'يجب أن يحتوي القيد على طرف مدين وطرف دائن.',
            ]);
        }

        if ($debit !== $credit) {
            throw ValidationException::withMessages([
                'lines' =>
                    "القيد غير متوازن. المدين {$debit} والدائن {$credit}.",
            ]);
        }
    }

    private function calculateTotals(
        array $lines
    ): array {
        $debit = 0;
        $credit = 0;

        foreach ($lines as $line) {
            $debit +=
                (float) ($line['debit'] ?? 0);

            $credit +=
                (float) ($line['credit'] ?? 0);
        }

        return [
            round($debit, 2),
            round($credit, 2),
        ];
    }

    private function generateEntryNumber(): string
    {
        $lastId =
            FinanceJournalEntry::query()
                ->max('id') ?? 0;

        return
            'JE-' .
            now()->format('Y') .
            '-' .
            str_pad(
                $lastId + 1,
                6,
                '0',
                STR_PAD_LEFT
            );
    }
}