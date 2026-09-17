<?php

namespace App\Services;

use App\Models\FinanceAccount;
use App\Models\FinanceJournalEntry;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * طبقة الترحيل الموحّدة.
 *
 * كل مستند بيولّد قيدًا آليًا لازم يمر من هنا — الفاتورة الضريبية،
 * تحصيلها، فاتورة المورد، دفعتها، وقيد الإهلاك. الفايدة:
 *   - منطق التوازن والترقيم والتحقق في مكان واحد
 *   - منع الترحيل المزدوج لنفس المرجع
 *   - نقطة واحدة لفرض إقفال الفترات لاحقًا
 */
class JournalPostingService
{
    public function __construct(
        private readonly DocumentNumberService $sequences
    ) {}

    /**
     * ترحيل قيد آلي مربوط بمستند.
     *
     * @param  array{type:string,id:int,number:?string}  $reference
     * @param  array<int,array{account_id:int,debit?:float,credit?:float,description?:string,cost_center_id?:int,project_id?:int}>  $lines
     */
    public function post(
        array $reference,
        array $lines,
        string $description,
        ?string $entryDate = null,
        ?int $projectId = null,
        ?int $userId = null,
        ?string $notes = null
    ): FinanceJournalEntry {
        $existing = $this->findExisting(
            $reference['type'],
            $reference['id']
        );

        if ($existing) {
            return $existing;
        }

        $lines = $this->normalizeLines($lines);

        [$debit, $credit] = $this->totals($lines);

        $this->assertBalanced($debit, $credit);

        return DB::transaction(function () use (
            $reference,
            $lines,
            $description,
            $entryDate,
            $projectId,
            $userId,
            $notes,
            $debit,
            $credit
        ) {
            $entry = FinanceJournalEntry::create([
                'entry_number' => $this->sequences->next('journal_entry'),
                'entry_date' => $entryDate ?: now()->toDateString(),
                'description' => $description,
                'reference_type' => $reference['type'],
                'reference_id' => $reference['id'],
                'reference_number' => $reference['number'] ?? null,
                'project_id' => $projectId,
                'status' => 'posted',
                'total_debit' => $debit,
                'total_credit' => $credit,
                'created_by' => $userId,
                'approved_by' => $userId,
                'approved_at' => now(),
                'posted_by' => $userId,
                'posted_at' => now(),
                'notes' => $notes ?: 'قيد آلي ناتج عن مستند النظام.',
            ]);

            foreach ($lines as $line) {
                $entry->lines()->create([
                    'account_id' => $line['account_id'],
                    'cost_center_id' => $line['cost_center_id'] ?? null,
                    'project_id' => $line['project_id'] ?? $projectId,
                    'description' => $line['description'] ?? null,
                    'debit' => $line['debit'],
                    'credit' => $line['credit'],
                ]);
            }

            return $entry;
        });
    }

    /** القيد المرحّل الموجود لنفس المستند، إن وُجد. */
    public function findExisting(
        string $referenceType,
        int $referenceId
    ): ?FinanceJournalEntry {
        return FinanceJournalEntry::query()
            ->where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->first();
    }

    /**
     * جلب حساب بكوده مع التحقق إنه صالح للترحيل.
     * بديل مؤقت لحد ما جدول ربط الحسابات (finance_account_mappings) يتعمل.
     */
    public function requireAccount(string $code, string $label): FinanceAccount
    {
        $account = FinanceAccount::query()
            ->where('code', $code)
            ->where('is_active', true)
            ->where('is_postable', true)
            ->first();

        if (!$account) {
            throw ValidationException::withMessages([
                'accounting' => [
                    "الحساب {$code} - {$label} غير موجود أو غير قابل للترحيل.",
                ],
            ]);
        }

        return $account;
    }

    private function normalizeLines(array $lines): array
    {
        $normalized = [];

        foreach ($lines as $index => $line) {
            $debit = round((float) ($line['debit'] ?? 0), 2);
            $credit = round((float) ($line['credit'] ?? 0), 2);

            if ($debit <= 0 && $credit <= 0) {
                continue;
            }

            if ($debit > 0 && $credit > 0) {
                throw ValidationException::withMessages([
                    "lines.{$index}" => [
                        'لا يمكن أن يكون نفس السطر مدينًا ودائنًا في نفس الوقت.',
                    ],
                ]);
            }

            $normalized[] = [
                ...$line,
                'debit' => $debit,
                'credit' => $credit,
            ];
        }

        if (count($normalized) < 2) {
            throw ValidationException::withMessages([
                'lines' => ['يجب أن يحتوي القيد على طرفين على الأقل.'],
            ]);
        }

        return $normalized;
    }

    private function totals(array $lines): array
    {
        $debit = 0;
        $credit = 0;

        foreach ($lines as $line) {
            $debit += (float) $line['debit'];
            $credit += (float) $line['credit'];
        }

        return [round($debit, 2), round($credit, 2)];
    }

    /** مقارنة بفرق مقبول — مش === على float. */
    private function assertBalanced(float $debit, float $credit): void
    {
        if ($debit <= 0 || $credit <= 0) {
            throw ValidationException::withMessages([
                'lines' => ['يجب أن يحتوي القيد على طرف مدين وطرف دائن.'],
            ]);
        }

        if (abs($debit - $credit) >= 0.01) {
            throw ValidationException::withMessages([
                'lines' => [
                    "القيد غير متوازن. المدين {$debit} والدائن {$credit}.",
                ],
            ]);
        }
    }
}
