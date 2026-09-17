<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProjectQuotation;
use App\Models\QuotationPortalToken;
use App\Services\QuotationPortalService;
use App\Services\QuotationWarningService;
use Illuminate\Http\Request;

/**
 * بوابة العميل واعتماد العرض أونلاين.
 *
 * مسارات داخلية (تحتاج مصادقة):
 *   POST /api/sales/quotations/{quotation}/warnings
 *   POST /api/sales/quotations/{quotation}/portal-link
 *   GET  /api/sales/quotations/{quotation}/portal-status
 *
 * مسارات عامة (بدون مصادقة — التوكن هو الإثبات):
 *   GET  /api/public/quotations/{token}
 *   POST /api/public/quotations/{token}/approve
 *   POST /api/public/quotations/{token}/request-changes
 */
class QuotationPortalController extends Controller
{
    public function __construct(
        private readonly QuotationPortalService $portal,
        private readonly QuotationWarningService $warnings
    ) {}

    /** الفحص قبل الإرسال — التحذيرات. */
    public function warnings(ProjectQuotation $quotation)
    {
        $result = $this->warnings->check($quotation);

        return response()->json([
            'success' => true,
            'message' => $result['count'] === 0
                ? 'العرض جاهز للإرسال — مافيش تحذيرات.'
                : sprintf(
                    'فيه %d تحذير%s.',
                    $result['count'],
                    $result['blocking'] > 0
                        ? " منهم {$result['blocking']} يمنع الإرسال"
                        : ''
                ),
            'data' => $result,
        ]);
    }

    /** توليد رابط الاعتماد. */
    public function createLink(Request $request, ProjectQuotation $quotation)
    {
        $validated = $request->validate([
            'valid_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'skip_warnings' => ['nullable', 'boolean'],
        ]);

        // التحذيرات المانعة توقف الإرسال إلا بتجاوز صريح
        if (!($validated['skip_warnings'] ?? false)) {
            $check = $this->warnings->check($quotation);

            if ($check['blocking'] > 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'فيه تحذيرات تمنع الإرسال — راجعها أولًا.',
                    'data' => $check,
                ], 422);
            }
        }

        $token = $this->portal->issueToken(
            $quotation,
            $validated['valid_days'] ?? 30,
            $request->user()?->id
        );

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء رابط الاعتماد.',
            'data' => [
                'token' => $token->token,
                'url' => url('/quotation/' . $token->token),
                'expires_at' => $token->expires_at,
            ],
        ], 201);
    }

    /** حالة الرابط — هل العميل شافه؟ قرّر؟ */
    public function status(ProjectQuotation $quotation)
    {
        $token = QuotationPortalToken::query()
            ->where('quotation_id', $quotation->id)
            ->where('is_revoked', false)
            ->latest()
            ->first();

        if (!$token) {
            return response()->json([
                'success' => true,
                'data' => ['has_link' => false],
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'has_link' => true,
                'url' => url('/quotation/' . $token->token),
                'decision' => $token->decision,
                'expires_at' => $token->expires_at,
                'is_expired' => $token->expires_at && now()->gt($token->expires_at),

                'viewed' => (bool) $token->first_viewed_at,
                'first_viewed_at' => $token->first_viewed_at,
                'last_viewed_at' => $token->last_viewed_at,
                'view_count' => (int) $token->view_count,

                'decided_at' => $token->decided_at,
                'decided_by_name' => $token->decided_by_name,
                'customer_note' => $token->customer_note,
            ],
        ]);
    }

    /* ================= المسارات العامة ================= */

    /** عرض السعر للعميل — بدون مصادقة. */
    public function publicShow(string $token)
    {
        $row = $this->portal->resolve($token);
        $quotation = $row->quotation;

        return response()->json([
            'success' => true,
            'data' => [
                'quotation' => [
                    'quotation_number' => $quotation->quotation_number,
                    'version' => $quotation->version,
                    'valid_until' => $quotation->valid_until,
                    'subtotal' => round((float) $quotation->subtotal, 2),
                    'discount' => round((float) $quotation->discount, 2),
                    'tax' => round((float) $quotation->tax, 2),
                    'total' => round((float) $quotation->total, 2),
                    'notes' => $quotation->notes,
                ],

                'project' => [
                    'name' => $quotation->project?->name,
                    'customer_name' => $quotation->project?->customer_name,
                ],

                // بنود بدون تكلفة — العميل ميشوفش تكلفتك
                'items' => $quotation->items->map(fn ($item) => [
                    'product_name' => $item->product_name,
                    'description' => $item->description,
                    'quantity' => (float) $item->quantity,
                    'unit_price' => round((float) $item->unit_price, 2),
                    'discount' => round((float) $item->discount, 2),
                    'tax_rate' => (float) $item->tax_rate,
                    'line_total' => round((float) $item->line_total, 2),
                ])->values(),

                'decision' => $row->decision,
                'decided_at' => $row->decided_at,
                'is_decidable' => $row->decision === 'pending',
            ],
        ]);
    }

    public function publicApprove(Request $request, string $token)
    {
        $validated = $request->validate([
            'signer_name' => ['required', 'string', 'max:255'],
        ], [
            'signer_name.required' => 'الاسم مطلوب لإثبات الاعتماد.',
        ]);

        $row = $this->portal->resolve($token);

        $updated = $this->portal->approve(
            $row,
            $request,
            $validated['signer_name']
        );

        return response()->json([
            'success' => true,
            'message' => 'تم اعتماد عرض السعر. شكرًا لك — فريقنا هيتواصل معك.',
            'data' => [
                'decision' => $updated->decision,
                'decided_at' => $updated->decided_at,
            ],
        ]);
    }

    public function publicRequestChanges(Request $request, string $token)
    {
        $validated = $request->validate([
            'note' => ['required', 'string', 'min:5', 'max:2000'],
            'requester_name' => ['nullable', 'string', 'max:255'],
        ], [
            'note.required' => 'اكتب التعديل المطلوب.',
        ]);

        $row = $this->portal->resolve($token);

        $updated = $this->portal->requestChanges(
            $row,
            $request,
            $validated['note'],
            $validated['requester_name'] ?? null
        );

        return response()->json([
            'success' => true,
            'message' => 'تم إرسال طلب التعديل لفريقنا.',
            'data' => ['decision' => $updated->decision],
        ]);
    }
}
