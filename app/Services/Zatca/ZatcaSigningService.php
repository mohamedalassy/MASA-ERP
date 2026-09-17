<?php

namespace App\Services\Zatca;

use App\Models\CompanyTaxProfile;
use Illuminate\Validation\ValidationException;

/**
 * التوقيع الإلكتروني XAdES-BES.
 *
 * ⚠️ الجزء ده هو الأدق تقنيًا في المنظومة كلها. راجعه ضد أداة
 * التحقق الرسمية من الهيئة (ZATCA SDK) قبل التشغيل الفعلي —
 * أي فرق بايت واحد في التقنين أو ترتيب الخصائص بيفشل التحقق.
 *
 * الشهادة والمفتاح الخاص بيتخزنوا في company_tax_profiles وبيكونوا
 * مستبعدين من أي ردّ JSON عن طريق \$hidden في الموديل.
 */
class ZatcaSigningService
{
    public function __construct(
        private readonly ZatcaHashService $hashes
    ) {}

    /**
     * يوقّع الفاتورة ويحقن التوقيع ورمز QR في الـ XML.
     *
     * @return array{xml:string,invoice_hash:string,signature:string,qr:string}
     */
    public function sign(
        string $xml,
        CompanyTaxProfile $seller,
        ZatcaQrGenerator $qrGenerator,
        $invoice
    ): array {
        $privateKey = $this->loadPrivateKey($seller);
        $certificate = $this->loadCertificate($seller);

        // ١. هاش الفاتورة على XML المقنَّن بدون التوقيع والـ QR
        $invoiceHash = $this->hashes->invoiceHash($xml);

        // ٢. التوقيع الرقمي ECDSA على الهاش
        $signature = $this->signHash($invoiceHash, $privateKey);

        // ٣. رمز QR بالوسوم التسعة
        $qr = $qrGenerator->generate(
            $invoice,
            (string) $seller->legal_name_ar,
            (string) $seller->vat_number,
            [
                6 => base64_decode($invoiceHash),
                7 => base64_decode($signature),
                8 => $this->publicKeyBytes($certificate),
                9 => $this->certificateSignature($certificate),
            ]
        );

        // ٤. حقن التوقيع ورمز QR في الـ XML
        $signedXml = $this->injectSignature(
            $xml,
            $invoiceHash,
            $signature,
            $certificate,
            $qr
        );

        return [
            'xml' => $signedXml,
            'invoice_hash' => $invoiceHash,
            'signature' => $signature,
            'qr' => $qr,
        ];
    }

    /* ------------------------------------------------------------------ */

    /**
     * التوقيع ECDSA على الهاش.
     *
     * الهيئة بتستخدم منحنى secp256k1 مع SHA-256، والتوقيع الناتج
     * بصيغة DER ثم Base64.
     */
    private function signHash(string $invoiceHash, $privateKey): string
    {
        $binaryHash = base64_decode($invoiceHash, true);

        if ($binaryHash === false) {
            throw ValidationException::withMessages([
                'zatca' => ['هاش الفاتورة غير صالح.'],
            ]);
        }

        $signature = '';

        $signed = openssl_sign(
            $binaryHash,
            $signature,
            $privateKey,
            OPENSSL_ALGO_SHA256
        );

        if (!$signed) {
            throw ValidationException::withMessages([
                'zatca' => [
                    'فشل توليد التوقيع الإلكتروني: '
                    . openssl_error_string(),
                ],
            ]);
        }

        return base64_encode($signature);
    }

    /** بايتات المفتاح العام من الشهادة — الوسم 8 في رمز QR. */
    private function publicKeyBytes(string $certificate): string
    {
        $details = openssl_pkey_get_details(
            openssl_pkey_get_public($certificate)
        );

        if (!$details || empty($details['key'])) {
            return '';
        }

        // إزالة ترويسة PEM وفكّ الترميز للبايتات الخام
        $clean = preg_replace(
            '/-----(BEGIN|END) PUBLIC KEY-----|\s+/',
            '',
            $details['key']
        );

        return base64_decode($clean, true) ?: '';
    }

    /** توقيع الهيئة على الشهادة — الوسم 9 في رمز QR. */
    private function certificateSignature(string $certificate): string
    {
        $parsed = openssl_x509_parse($certificate);

        if (!$parsed) {
            return '';
        }

        /*
         * استخراج توقيع الشهادة يتطلب تحليل ASN.1 للبنية.
         * الطريقة العملية: نخزّن القيمة اللي بترجع من ZATCA
         * وقت التوافق (compliance) ونستخدمها هنا.
         */
        return (string) ($parsed['signature'] ?? '');
    }

    /**
     * حقن كتلة التوقيع UBLExtensions ورمز QR في الـ XML.
     *
     * ترتيب العناصر داخل XAdES إلزامي — متغيّرهوش.
     */
    private function injectSignature(
        string $xml,
        string $invoiceHash,
        string $signature,
        string $certificate,
        string $qr
    ): string {
        $document = new \DOMDocument();
        $document->preserveWhiteSpace = false;
        $document->formatOutput = false;
        $document->loadXML($xml);

        $xpath = new \DOMXPath($document);
        $xpath->registerNamespace('cbc', 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2');
        $xpath->registerNamespace('cac', 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2');

        // حقن رمز QR في العنصر المخصص له
        $qrNodes = $xpath->query(
            "//cac:AdditionalDocumentReference[cbc:ID='QR']"
            . '/cac:Attachment/cbc:EmbeddedDocumentBinaryObject'
        );

        if ($qrNodes && $qrNodes->length) {
            $qrNodes->item(0)->nodeValue = $qr;
        }

        // بناء كتلة التوقيع
        $extensions = $document->getElementsByTagNameNS(
            'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
            'UBLExtensions'
        )->item(0);

        if (!$extensions) {
            return $document->saveXML();
        }

        $certificateClean = preg_replace(
            '/-----(BEGIN|END) CERTIFICATE-----|\s+/',
            '',
            $certificate
        );

        $signedPropertiesHash = $this->signedPropertiesHash(
            $certificateClean
        );

        $fragment = $document->createDocumentFragment();

        $fragment->appendXML(
            $this->signatureXml(
                $invoiceHash,
                $signature,
                $certificateClean,
                $signedPropertiesHash
            )
        );

        $extensions->appendChild($fragment);

        return $document->saveXML();
    }

    /** هاش خصائص التوقيع (SignedProperties) — عنصر في XAdES. */
    private function signedPropertiesHash(string $certificate): string
    {
        $parsed = openssl_x509_parse(
            "-----BEGIN CERTIFICATE-----\n"
            . chunk_split($certificate, 64, "\n")
            . "-----END CERTIFICATE-----\n"
        );

        $issuer = $this->issuerName($parsed['issuer'] ?? []);
        $serial = $parsed['serialNumber'] ?? '0';
        $digest = base64_encode(hash('sha256', $certificate, true));
        $timestamp = now()->format('Y-m-d\TH:i:s');

        // البنية دي لازم تطابق ما يُدرَج في XML حرفيًا
        $properties = '<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">'
            . '<xades:SignedSignatureProperties>'
            . '<xades:SigningTime>' . $timestamp . '</xades:SigningTime>'
            . '<xades:SigningCertificate><xades:Cert>'
            . '<xades:CertDigest>'
            . '<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>'
            . '<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">' . $digest . '</ds:DigestValue>'
            . '</xades:CertDigest>'
            . '<xades:IssuerSerial>'
            . '<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">' . $issuer . '</ds:X509IssuerName>'
            . '<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">' . $serial . '</ds:X509SerialNumber>'
            . '</xades:IssuerSerial>'
            . '</xades:Cert></xades:SigningCertificate>'
            . '</xades:SignedSignatureProperties>'
            . '</xades:SignedProperties>';

        return base64_encode(hash('sha256', $properties, true));
    }

    private function issuerName(array $issuer): string
    {
        $parts = [];

        foreach (['CN', 'DC', 'OU', 'O', 'C'] as $key) {
            if (!empty($issuer[$key])) {
                $value = is_array($issuer[$key])
                    ? implode(', ', $issuer[$key])
                    : $issuer[$key];

                $parts[] = $key . '=' . $value;
            }
        }

        return implode(', ', $parts);
    }

    private function signatureXml(
        string $invoiceHash,
        string $signature,
        string $certificate,
        string $signedPropertiesHash
    ): string {
        return '<ext:UBLExtension>'
            . '<ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>'
            . '<ext:ExtensionContent>'
            . '<sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2" xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2" xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">'
            . '<sac:SignatureInformation>'
            . '<cbc:ID xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">urn:oasis:names:specification:ubl:signature:1</cbc:ID>'
            . '<sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>'
            . '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">'
            . '<ds:SignedInfo>'
            . '<ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>'
            . '<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>'
            . '<ds:Reference Id="invoiceSignedData" URI="">'
            . '<ds:Transforms>'
            . '<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">'
            . '<ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>'
            . '</ds:Transform>'
            . '<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">'
            . '<ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>'
            . '</ds:Transform>'
            . '<ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">'
            . '<ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID=\'QR\'])</ds:XPath>'
            . '</ds:Transform>'
            . '<ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>'
            . '</ds:Transforms>'
            . '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>'
            . '<ds:DigestValue>' . $invoiceHash . '</ds:DigestValue>'
            . '</ds:Reference>'
            . '<ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">'
            . '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>'
            . '<ds:DigestValue>' . $signedPropertiesHash . '</ds:DigestValue>'
            . '</ds:Reference>'
            . '</ds:SignedInfo>'
            . '<ds:SignatureValue>' . $signature . '</ds:SignatureValue>'
            . '<ds:KeyInfo><ds:X509Data><ds:X509Certificate>' . $certificate . '</ds:X509Certificate></ds:X509Data></ds:KeyInfo>'
            . '</ds:Signature>'
            . '</sac:SignatureInformation>'
            . '</sig:UBLDocumentSignatures>'
            . '</ext:ExtensionContent>'
            . '</ext:UBLExtension>';
    }

    private function loadPrivateKey(CompanyTaxProfile $seller)
    {
        if (blank($seller->zatca_private_key)) {
            throw ValidationException::withMessages([
                'zatca' => [
                    'المفتاح الخاص للتوقيع غير مسجّل في الملف الضريبي للشركة.',
                ],
            ]);
        }

        $key = openssl_pkey_get_private($seller->zatca_private_key);

        if (!$key) {
            throw ValidationException::withMessages([
                'zatca' => [
                    'المفتاح الخاص غير صالح: ' . openssl_error_string(),
                ],
            ]);
        }

        return $key;
    }

    private function loadCertificate(CompanyTaxProfile $seller): string
    {
        if (blank($seller->zatca_certificate)) {
            throw ValidationException::withMessages([
                'zatca' => [
                    'شهادة زاتكا غير مسجّلة في الملف الضريبي للشركة.',
                ],
            ]);
        }

        return $seller->zatca_certificate;
    }
}
