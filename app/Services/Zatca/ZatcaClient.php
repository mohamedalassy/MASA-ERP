<?php

namespace App\Services\Zatca;

use App\Models\CompanyTaxProfile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * عميل HTTP لمنصة فاتورة.
 *
 * ثلاث بيئات:
 *   sandbox      للتطوير
 *   simulation   لاختبار التكامل قبل الإنتاج
 *   production   الفعلي
 *
 * ثلاثة مسارات:
 *   compliance   فحص التوافق والحصول على CSID (مرة واحدة عند الربط)
 *   clearance    الفاتورة القياسية B2B — مزامن، قبل تسليم الفاتورة للعميل
 *   reporting    الفاتورة المبسطة B2C — خلال ٢٤ ساعة، يقبل التأجيل
 */
class ZatcaClient
{
    private const BASE_URLS = [
        'sandbox' => 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal',
        'simulation' => 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation',
        'production' => 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core',
    ];

    private const TIMEOUT = 60;

    /**
     * المقاصة — الفاتورة القياسية B2B.
     *
     * مزامن وحاجز: الفاتورة مينفعش تتسلّم للعميل قبل ما الهيئة
     * تعتمدها. الردّ بيحتوي على الفاتورة موقّعة من الهيئة ورمز QR
     * جاهزًا — استخدم اللي بترجعه ولا تولّد واحدًا بنفسك.
     */
    public function clearance(
        CompanyTaxProfile $seller,
        string $uuid,
        string $invoiceHash,
        string $signedXml
    ): array {
        return $this->send(
            $seller,
            'invoices/clearance/single',
            $uuid,
            $invoiceHash,
            $signedXml,
            ['Clearance-Status' => '1']
        );
    }

    /**
     * الإبلاغ — الفاتورة المبسطة B2C.
     * غير حاجز: يقبل التنفيذ في طابور خلال ٢٤ ساعة.
     */
    public function reporting(
        CompanyTaxProfile $seller,
        string $uuid,
        string $invoiceHash,
        string $signedXml
    ): array {
        return $this->send(
            $seller,
            'invoices/reporting/single',
            $uuid,
            $invoiceHash,
            $signedXml,
            ['Clearance-Status' => '0']
        );
    }

    /** فحص التوافق — يُستخدم مرة واحدة عند ربط النظام. */
    public function complianceCheck(
        CompanyTaxProfile $seller,
        string $uuid,
        string $invoiceHash,
        string $signedXml
    ): array {
        return $this->send(
            $seller,
            'compliance/invoices',
            $uuid,
            $invoiceHash,
            $signedXml
        );
    }

    /* ------------------------------------------------------------------ */

    private function send(
        CompanyTaxProfile $seller,
        string $path,
        string $uuid,
        string $invoiceHash,
        string $signedXml,
        array $extraHeaders = []
    ): array {
        $url = $this->baseUrl($seller) . '/' . $path;

        $payload = [
            'invoiceHash' => $invoiceHash,
            'uuid' => $uuid,
            'invoice' => base64_encode($signedXml),
        ];

        try {
            $response = Http::withHeaders([
                    'Accept' => 'application/json',
                    'Accept-Language' => 'ar',
                    'Content-Type' => 'application/json',
                    // إصدار المواصفة — بيتغيّر مع تحديثات الهيئة
                    'Accept-Version' => 'V2',
                    ...$extraHeaders,
                ])
                ->withBasicAuth(
                    (string) $seller->zatca_csid,
                    (string) $seller->zatca_secret
                )
                ->timeout(self::TIMEOUT)
                ->post($url, $payload);

            $body = $response->json() ?? [];

            /*
             * الهيئة بترجع 200 للمقبول، و202 للمقبول بتحذيرات،
             * و400 للمرفوض مع تفاصيل الأخطاء.
             */
            $status = match (true) {
                $response->status() === 200 => 'cleared',
                $response->status() === 202 => 'cleared_with_warnings',
                default => 'rejected',
            };

            if ($status === 'rejected') {
                Log::warning('ZATCA rejected invoice', [
                    'uuid' => $uuid,
                    'http_status' => $response->status(),
                    'body' => $body,
                ]);
            }

            return [
                'ok' => $response->successful(),
                'status' => $status,
                'http_status' => $response->status(),
                'payload' => $body,
                'cleared_invoice' => $body['clearedInvoice'] ?? null,
                'qr' => $this->extractQr($body),
                'message' => $this->extractMessage($body, $status),
            ];
        } catch (\Throwable $e) {
            Log::error('ZATCA request failed', [
                'uuid' => $uuid,
                'error' => $e->getMessage(),
            ]);

            return [
                'ok' => false,
                'status' => 'failed',
                'http_status' => 0,
                'payload' => [],
                'cleared_invoice' => null,
                'qr' => null,
                'message' => 'تعذر الاتصال بمنصة فاتورة: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * رمز QR من الفاتورة المعتمدة.
     * في المقاصة الهيئة بترجع الفاتورة موقّعة والـ QR جواها.
     */
    private function extractQr(array $body): ?string
    {
        $cleared = $body['clearedInvoice'] ?? null;

        if (!$cleared) {
            return null;
        }

        $xml = base64_decode($cleared, true);

        if ($xml === false) {
            return null;
        }

        if (preg_match(
            '/<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)<\/cbc:EmbeddedDocumentBinaryObject>/',
            $xml,
            $matches
        )) {
            return $matches[1];
        }

        return null;
    }

    /** يحوّل تفاصيل الأخطاء لرسالة عربية مقروءة. */
    private function extractMessage(array $body, string $status): string
    {
        $errors = $body['validationResults']['errorMessages'] ?? [];

        if (!empty($errors)) {
            $messages = array_map(
                fn ($error) => trim(
                    ($error['code'] ?? '') . ' — ' . ($error['message'] ?? '')
                ),
                array_slice($errors, 0, 5)
            );

            return implode(' | ', $messages);
        }

        $warnings = $body['validationResults']['warningMessages'] ?? [];

        if (!empty($warnings) && $status !== 'rejected') {
            return 'تم القبول بتحذيرات: '
                . ($warnings[0]['message'] ?? '');
        }

        return match ($status) {
            'cleared' => 'تمت المقاصة بنجاح.',
            'cleared_with_warnings' => 'تم القبول بتحذيرات.',
            default => 'تم رفض الفاتورة من الهيئة.',
        };
    }

    private function baseUrl(CompanyTaxProfile $seller): string
    {
        $environment = $seller->zatca_environment ?: 'sandbox';

        return self::BASE_URLS[$environment]
            ?? self::BASE_URLS['sandbox'];
    }
}
