<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaxInvoice;
use App\Models\ZatcaDocument;
use App\Services\Zatca\ZatcaHashService;
use App\Services\Zatca\ZatcaQrGenerator;
use App\Services\Zatca\ZatcaSubmissionService;
use Illuminate\Http\Request;

class ZatcaController extends Controller
{
    public function __construct(
        private readonly ZatcaSubmissionService $submission,
        private readonly ZatcaHashService $hashes,
        private readonly ZatcaQrGenerator $qr
    ) {}

    /** لوحة حالة الامتثال. */
    public function index(Request $request)
    {
        $query = ZatcaDocument::query()
            ->with([
                'taxInvoice:id,invoice_number,invoice_type,document_type,'
                . 'issue_date,total,tax_total,buyer_name,status',
            ]);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $documents = $query
            ->orderByDesc('counter_value')
            ->limit((int) $request->integer('limit', 100))
            ->get();

        $counts = ZatcaDocument::query()
            ->selectRaw('status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json([
            'success' => true,
            'summary' => [
                'total' => (int) $counts->sum(),
                'cleared' => (int) ($counts['cleared'] ?? 0),
                'reported' => (int) ($counts['reported'] ?? 0),
                'rejected' => (int) ($counts['rejected'] ?? 0),
                'pending' => (int) ($counts['generated'] ?? 0)
                    + (int) ($counts['not_generated'] ?? 0),
            ],
            'data' => $documents,
        ]);
    }

    public function show(TaxInvoice $taxInvoice)
    {
        $document = ZatcaDocument::query()
            ->where('tax_invoice_id', $taxInvoice->id)
            ->first();

        if (!$document) {
            return response()->json([
                'success' => false,
                'message' => 'لم يتم توليد مستند زاتكا لهذه الفاتورة بعد.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $document->id,
                'uuid' => $document->uuid,
                'submission_type' => $document->submission_type,
                'status' => $document->status,
                'invoice_hash' => $document->invoice_hash,
                'previous_invoice_hash' => $document->previous_invoice_hash,
                'counter_value' => $document->counter_value,
                'qr_code' => $document->qr_code,
                'response_message' => $document->response_message,
                'submitted_at' => $document->submitted_at,
                // الـ XML والتوقيع مستبعدين افتراضيًا — استخدم downloadXml
                'has_xml' => filled($document->getRawOriginal('xml')),
            ],
        ]);
    }

    /** إرسال الفاتورة للهيئة: مقاصة أو إبلاغ حسب نوعها. */
    public function submit(TaxInvoice $taxInvoice)
    {
        $document = $this->submission->submit($taxInvoice);

        $accepted = in_array(
            $document->status,
            ['cleared', 'reported'],
            true
        );

        return response()->json([
            'success' => $accepted,
            'message' => $document->response_message
                ?: ($accepted
                    ? 'تم إرسال الفاتورة للهيئة بنجاح.'
                    : 'تم رفض الفاتورة من الهيئة.'),
            'data' => [
                'status' => $document->status,
                'qr_code' => $document->qr_code,
                'invoice_hash' => $document->invoice_hash,
                'counter_value' => $document->counter_value,
                'errors' => $document->response_payload['validationResults']
                    ['errorMessages'] ?? [],
                'warnings' => $document->response_payload['validationResults']
                    ['warningMessages'] ?? [],
            ],
        ], $accepted ? 200 : 422);
    }

    /** تنزيل XML الموقّع — للأرشفة والمراجعة. */
    public function downloadXml(TaxInvoice $taxInvoice)
    {
        $document = ZatcaDocument::query()
            ->where('tax_invoice_id', $taxInvoice->id)
            ->first();

        if (!$document || blank($document->getRawOriginal('xml'))) {
            return response()->json([
                'success' => false,
                'message' => 'لا يوجد XML محفوظ لهذه الفاتورة.',
            ], 404);
        }

        return response(
            $document->getRawOriginal('xml'),
            200,
            [
                'Content-Type' => 'application/xml; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="'
                    . $taxInvoice->invoice_number . '.xml"',
            ]
        );
    }

    /**
     * التحقق من سلامة سلسلة الهاش.
     *
     * "هاش الفاتورة السابقة مفقود أو غير صحيح" هو أكثر خطأ شائع
     * عند التكامل — الأداة دي بتقول لك بالظبط فين السلسلة اتكسرت.
     */
    public function verifyChain()
    {
        $result = $this->hashes->verifyChain();

        return response()->json([
            'success' => true,
            'data' => $result,
            'message' => $result['is_valid']
                ? 'سلسلة الهاش سليمة.'
                : 'السلسلة مكسورة في '
                    . count($result['breaks']) . ' موضع.',
        ]);
    }

    /** إعادة إرسال المرفوض والمعلّق — تُنادى من مهمة مجدولة أو يدويًا. */
    public function retryPending(Request $request)
    {
        $results = $this->submission->retryPending(
            (int) $request->integer('limit', 50)
        );

        return response()->json([
            'success' => true,
            'message' => "نجح {$results['succeeded']}، فشل {$results['failed']}.",
            'data' => $results,
        ]);
    }

    /** فكّ ترميز رمز QR — للتشخيص. */
    public function decodeQr(Request $request)
    {
        $validated = $request->validate([
            'qr' => ['required', 'string'],
        ]);

        $decoded = $this->qr->decode($validated['qr']);

        $labels = [
            1 => 'اسم البائع',
            2 => 'الرقم الضريبي',
            3 => 'الطابع الزمني',
            4 => 'الإجمالي شامل الضريبة',
            5 => 'قيمة الضريبة',
            6 => 'هاش الفاتورة',
            7 => 'التوقيع الإلكتروني',
            8 => 'المفتاح العام',
            9 => 'توقيع الشهادة',
        ];

        $fields = [];

        foreach ($decoded as $tag => $value) {
            $isBinary = $tag >= 6;

            $fields[] = [
                'tag' => $tag,
                'label' => $labels[$tag] ?? 'وسم غير معروف',
                'value' => $isBinary ? base64_encode($value) : $value,
                'length' => strlen($value),
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'tags_count' => count($fields),
                'is_phase_two' => count($fields) >= 9,
                'fields' => $fields,
            ],
        ]);
    }
}
