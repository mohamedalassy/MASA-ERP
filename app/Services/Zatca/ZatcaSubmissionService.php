<?php

namespace App\Services\Zatca;

use App\Models\CompanyTaxProfile;
use App\Models\TaxInvoice;
use App\Models\ZatcaDocument;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * منسّق دورة زاتكا الكاملة.
 *
 * الترتيب إلزامي:
 *   ١. بناء XML بصيغة UBL 2.1
 *   ٢. حساب هاش الفاتورة على XML مقنَّن (بدون التوقيع والـ QR)
 *   ٣. التوقيع الإلكتروني وتوليد رمز QR
 *   ٤. الإرسال: مقاصة للقياسية، إبلاغ للمبسطة
 *   ٥. تسجيل الردّ وتحديث حالة الفاتورة
 *
 * السلسلة (PIH) بتُحجز داخل ترانزاكشن بـ lock — عشان فاتورتين
 * متزامنتين ماياخداش نفس الرقم التسلسلي وتكسرا السلسلة.
 */
class ZatcaSubmissionService
{
    public function __construct(
        private readonly ZatcaInvoiceXmlBuilder $builder,
        private readonly ZatcaHashService $hashes,
        private readonly ZatcaSigningService $signer,
        private readonly ZatcaQrGenerator $qr,
        private readonly ZatcaClient $client
    ) {}

    public function submit(TaxInvoice $invoice): ZatcaDocument
    {
        if ($invoice->status !== 'issued') {
            throw ValidationException::withMessages([
                'zatca' => ['يجب إصدار الفاتورة قبل إرسالها للهيئة.'],
            ]);
        }

        if (blank($invoice->uuid)) {
            throw ValidationException::withMessages([
                'zatca' => ['الفاتورة بدون UUID — أعد إصدارها.'],
            ]);
        }

        $seller = $invoice->companyTaxProfile
            ?: CompanyTaxProfile::default();

        if (!$seller) {
            throw ValidationException::withMessages([
                'zatca' => ['الملف الضريبي للشركة غير معرّف.'],
            ]);
        }

        $missing = $seller->missingRequiredFields();

        if (!empty($missing)) {
            throw ValidationException::withMessages([
                'zatca' => [
                    'الملف الضريبي ناقص: ' . implode('، ', $missing),
                ],
            ]);
        }

        $invoice->loadMissing('items.taxCode', 'originalInvoice');

        // ١-٣ البناء والتوقيع داخل ترانزاكشن لحجز السلسلة
        $prepared = DB::transaction(function () use ($invoice, $seller) {
            $document = ZatcaDocument::lockForUpdate()
                ->firstOrNew(['tax_invoice_id' => $invoice->id]);

            if ($document->status === 'cleared') {
                throw ValidationException::withMessages([
                    'zatca' => ['الفاتورة معتمدة من الهيئة بالفعل.'],
                ]);
            }

            $previousHash = $document->previous_invoice_hash
                ?: $this->hashes->previousInvoiceHash($invoice);

            $counter = $document->counter_value
                ?: $this->hashes->nextCounterValue();

            $xml = $this->builder->build(
                $invoice,
                $seller,
                $previousHash,
                $counter
            );

            $signed = $this->signer->sign(
                $xml,
                $seller,
                $this->qr,
                $invoice
            );

            $document->fill([
                'uuid' => $invoice->uuid,
                'submission_type' => $this->submissionType($invoice),
                'status' => 'generated',
                'xml' => $signed['xml'],
                'invoice_hash' => $signed['invoice_hash'],
                'previous_invoice_hash' => $previousHash,
                'signature' => $signed['signature'],
                'qr_code' => $signed['qr'],
                'counter_value' => $counter,
            ])->save();

            return $document;
        });

        // ٤ الإرسال — بره الترانزاكشن، عشان نداء الشبكة ميحجزش صفوفًا
        $isStandard = $this->submissionType($invoice) === 'clearance';

        $response = $isStandard
            ? $this->client->clearance(
                $seller,
                (string) $invoice->uuid,
                (string) $prepared->invoice_hash,
                (string) $prepared->xml
            )
            : $this->client->reporting(
                $seller,
                (string) $invoice->uuid,
                (string) $prepared->invoice_hash,
                (string) $prepared->xml
            );

        // ٥ تسجيل الردّ
        return DB::transaction(function () use ($invoice, $prepared, $response, $isStandard) {
            $status = match ($response['status']) {
                'cleared', 'cleared_with_warnings' => $isStandard
                    ? 'cleared'
                    : 'reported',
                'rejected' => 'rejected',
                default => 'generated',
            };

            $prepared->update([
                'status' => $status,
                'response_payload' => $response['payload'],
                'response_message' => $response['message'],
                'submitted_at' => now(),
                /*
                 * في المقاصة الهيئة بترجع رمز QR جاهزًا —
                 * وهو اللي لازم يُطبع، مش اللي ولّدناه محليًا.
                 */
                'qr_code' => $response['qr'] ?: $prepared->qr_code,
            ]);

            $invoice->update([
                'zatca_status' => match ($status) {
                    'cleared' => 'cleared',
                    'reported' => 'reported',
                    'rejected' => 'rejected',
                    default => 'pending',
                },
            ]);

            return $prepared->fresh();
        });
    }

    /**
     * الفاتورة القياسية (B2B) تمر بالمقاصة قبل التسليم،
     * والمبسطة (B2C) تُبلَّغ خلال ٢٤ ساعة.
     */
    private function submissionType(TaxInvoice $invoice): string
    {
        return $invoice->invoice_type === 'simplified'
            ? 'reporting'
            : 'clearance';
    }

    /** إعادة إرسال الفواتير المرفوضة أو المعلّقة — لمهمة مجدولة. */
    public function retryPending(int $limit = 50): array
    {
        $documents = ZatcaDocument::query()
            ->whereIn('status', ['generated', 'rejected'])
            ->with('taxInvoice')
            ->orderBy('counter_value')
            ->limit($limit)
            ->get();

        $results = ['succeeded' => 0, 'failed' => 0, 'errors' => []];

        foreach ($documents as $document) {
            if (!$document->taxInvoice) {
                continue;
            }

            try {
                $result = $this->submit($document->taxInvoice);

                if (in_array($result->status, ['cleared', 'reported'], true)) {
                    $results['succeeded']++;
                } else {
                    $results['failed']++;
                    $results['errors'][] = [
                        'invoice_number' => $document->taxInvoice->invoice_number,
                        'message' => $result->response_message,
                    ];
                }
            } catch (\Throwable $e) {
                $results['failed']++;
                $results['errors'][] = [
                    'invoice_number' => $document->taxInvoice->invoice_number,
                    'message' => $e->getMessage(),
                ];
            }
        }

        return $results;
    }
}
