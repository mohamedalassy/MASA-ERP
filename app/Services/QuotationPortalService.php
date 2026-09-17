<?php

namespace App\Services;

use App\Models\ProjectQuotation;
use App\Models\QuotationPortalToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * بوابة العميل — اعتماد عرض السعر أونلاين.
 *
 * بتحوّل دورة «PDF بالإيميل ← انتظار ← مكالمة متابعة ← توقيع ورق
 * ← سكان» لضغطة واحدة. وبتسجّل IP والوقت والاسم كإثبات اعتماد.
 *
 * أسرع مكسب في منظومة المبيعات: جدول واحد وصفحة عامة واحدة.
 */
class QuotationPortalService
{
    public function __construct(
        private readonly ProjectEventService $events
    ) {}

    /** إنشاء رابط اعتماد للعميل. */
    public function issueToken(
        ProjectQuotation $quotation,
        ?int $validDays = 30,
        ?int $userId = null
    ): QuotationPortalToken {
        if (!in_array($quotation->status, ['pending', 'approved'], true)) {
            throw ValidationException::withMessages([
                'quotation' => [
                    'لا يمكن إرسال عرض في حالة «' . $quotation->status . '» للعميل.',
                ],
            ]);
        }

        // إلغاء أي روابط سابقة لنفس العرض
        QuotationPortalToken::query()
            ->where('quotation_id', $quotation->id)
            ->where('decision', 'pending')
            ->update(['is_revoked' => true]);

        return QuotationPortalToken::create([
            'quotation_id' => $quotation->id,
            'token' => Str::random(48),
            'expires_at' => $validDays ? now()->addDays($validDays) : null,
            'decision' => 'pending',
            'created_by' => $userId,
        ]);
    }

    /** جلب العرض بالتوكن — للصفحة العامة. */
    public function resolve(string $token): QuotationPortalToken
    {
        $row = QuotationPortalToken::query()
            ->with(['quotation.project', 'quotation.items'])
            ->where('token', $token)
            ->first();

        if (!$row) {
            throw ValidationException::withMessages([
                'token' => ['الرابط غير صحيح.'],
            ]);
        }

        if ($row->is_revoked) {
            throw ValidationException::withMessages([
                'token' => ['الرابط ده تم إلغاؤه — تواصل معنا لطلب رابط جديد.'],
            ]);
        }

        if ($row->expires_at && now()->gt($row->expires_at)) {
            throw ValidationException::withMessages([
                'token' => ['انتهت صلاحية الرابط.'],
            ]);
        }

        // تسجيل المشاهدة — إثبات استلام
        $row->increment('view_count');

        $row->update([
            'first_viewed_at' => $row->first_viewed_at ?? now(),
            'last_viewed_at' => now(),
        ]);

        return $row->fresh(['quotation.project', 'quotation.items']);
    }

    /** اعتماد العميل — بإثبات. */
    public function approve(
        QuotationPortalToken $token,
        Request $request,
        ?string $signerName = null
    ): QuotationPortalToken {
        $this->assertDecidable($token);

        return DB::transaction(function () use ($token, $request, $signerName) {
            $token->update([
                'decision' => 'approved',
                'decided_at' => now(),
                'decided_by_name' => $signerName,
                'decided_ip' => $request->ip(),
                'decided_user_agent' => substr(
                    (string) $request->userAgent(),
                    0,
                    500
                ),
            ]);

            $quotation = $token->quotation;

            /*
             * الاعتماد الخارجي لا يُرحَّل مباشرة — بيسجّل قرار العميل
             * وبيسيب الاعتماد الداخلي لدورة الموافقات عندك، عشان
             * بوابة الهامش تفضل شغّالة.
             */
            $quotation->update([
                'customer_approved_at' => now(),
                'customer_approved_by' => $signerName,
            ]);

            if ($quotation->project) {
                $this->events->log(
                    $quotation->project,
                    'approval',
                    'اعتماد العميل لعرض السعر ' . $quotation->quotation_number . ' أونلاين',
                    meta: sprintf(
                        'الموقّع: %s · IP: %s',
                        $signerName ?: '—',
                        $request->ip()
                    ),
                    referenceType: 'quotation',
                    referenceId: $quotation->id,
                    isSystem: true
                );
            }

            return $token->fresh();
        });
    }

    /** العميل طلب تعديل — بملاحظة إلزامية. */
    public function requestChanges(
        QuotationPortalToken $token,
        Request $request,
        string $note,
        ?string $requesterName = null
    ): QuotationPortalToken {
        $this->assertDecidable($token);

        return DB::transaction(function () use (
            $token,
            $request,
            $note,
            $requesterName
        ) {
            $token->update([
                'decision' => 'changes_requested',
                'decided_at' => now(),
                'decided_by_name' => $requesterName,
                'decided_ip' => $request->ip(),
                'customer_note' => $note,
            ]);

            $quotation = $token->quotation;

            $quotation->update([
                'status' => 'changes_requested',
                'revision_reason' => 'طلب تعديل من العميل: ' . $note,
            ]);

            if ($quotation->project) {
                $this->events->log(
                    $quotation->project,
                    'message',
                    'العميل طلب تعديل على عرض السعر ' . $quotation->quotation_number,
                    meta: $note,
                    referenceType: 'quotation',
                    referenceId: $quotation->id,
                    isSystem: true
                );
            }

            return $token->fresh();
        });
    }

    private function assertDecidable(QuotationPortalToken $token): void
    {
        if ($token->decision !== 'pending') {
            throw ValidationException::withMessages([
                'decision' => ['تم البت في العرض ده بالفعل.'],
            ]);
        }

        if ($token->is_revoked) {
            throw ValidationException::withMessages([
                'token' => ['الرابط ملغي.'],
            ]);
        }

        if ($token->expires_at && now()->gt($token->expires_at)) {
            throw ValidationException::withMessages([
                'token' => ['انتهت صلاحية الرابط.'],
            ]);
        }
    }
}
