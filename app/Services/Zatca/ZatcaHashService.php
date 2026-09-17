<?php

namespace App\Services\Zatca;

use App\Models\TaxInvoice;
use App\Models\ZatcaDocument;

/**
 * هاش الفاتورة وسلسلة الهاش (PIH).
 *
 * كل فاتورة بتحمل هاش الفاتورة السابقة، فيتكوّن سجل متسلسل
 * لا يمكن حذف أو تعديل فاتورة في وسطه بدون كسر السلسلة.
 *
 * أكثر خطأ شائع عند التكامل: "هاش الفاتورة السابقة مفقود أو غير صحيح".
 * أسبابه المعتادة:
 *   - استخدام أول فاتورة بدون قيمة PIH الابتدائية الصحيحة
 *   - ترتيب الفواتير بـ created_at بدل التسلسل الفعلي (counter)
 *   - إعادة توليد الهاش بعد تعديل الفاتورة
 */
class ZatcaHashService
{
    /**
     * قيمة PIH الابتدائية لأول فاتورة في السلسلة.
     * هي هاش SHA-256 للقيمة صفر كما تحددها مواصفة الهيئة.
     */
    public const INITIAL_PIH =
        'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

    /**
     * هاش الفاتورة: SHA-256 على XML مُقنَّن، بصيغة Base64.
     *
     * التقنين (canonicalization) إلزامي — أي فرق في المسافات
     * أو ترتيب الخصائص بيغيّر الهاش ويفشل التحقق.
     */
    public function invoiceHash(string $xml): string
    {
        $canonical = $this->canonicalize($xml);

        return base64_encode(
            hash('sha256', $canonical, true)
        );
    }

    /**
     * التقنين C14N مع استبعاد العناصر اللي مواصفة الهيئة
     * بتستبعدها من حساب الهاش.
     */
    public function canonicalize(string $xml): string
    {
        $document = new \DOMDocument();
        $document->preserveWhiteSpace = false;
        $document->formatOutput = false;
        $document->loadXML($xml);

        $xpath = new \DOMXPath($document);

        $xpath->registerNamespace(
            'ext',
            'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2'
        );

        $xpath->registerNamespace(
            'cac',
            'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2'
        );

        /*
         * العناصر الثلاثة دي تُستبعد من حساب الهاش:
         *   - UBLExtensions (فيها التوقيع نفسه)
         *   - AdditionalDocumentReference بـ QR
         *   - cac:Signature
         */
        $excluded = [
            '//ext:UBLExtensions',
            "//cac:AdditionalDocumentReference[cbc:ID='QR']",
            '//cac:Signature',
        ];

        foreach ($excluded as $expression) {
            $nodes = $xpath->query($expression);

            if ($nodes === false) {
                continue;
            }

            foreach (iterator_to_array($nodes) as $node) {
                $node->parentNode?->removeChild($node);
            }
        }

        return $document->C14N(false, false);
    }

    /**
     * هاش الفاتورة السابقة في السلسلة.
     *
     * الترتيب بـ counter_value مش بـ id ولا created_at — عشان
     * السلسلة تفضل صحيحة لو فاتورة اتأخر إرسالها.
     */
    public function previousInvoiceHash(TaxInvoice $invoice): string
    {
        $previous = ZatcaDocument::query()
            ->whereNotNull('invoice_hash')
            ->when(
                $invoice->id,
                fn ($q) => $q->where('tax_invoice_id', '!=', $invoice->id)
            )
            ->orderByDesc('counter_value')
            ->orderByDesc('id')
            ->first();

        return $previous?->invoice_hash ?: self::INITIAL_PIH;
    }

    /** الرقم التسلسلي التالي في السلسلة. */
    public function nextCounterValue(): int
    {
        return (int) ZatcaDocument::max('counter_value') + 1;
    }

    /** يتحقق من سلامة السلسلة كلها — للتشخيص. */
    public function verifyChain(): array
    {
        $documents = ZatcaDocument::query()
            ->whereNotNull('invoice_hash')
            ->orderBy('counter_value')
            ->get(['id', 'tax_invoice_id', 'counter_value', 'invoice_hash', 'previous_invoice_hash']);

        $breaks = [];
        $expected = self::INITIAL_PIH;

        foreach ($documents as $document) {
            if ($document->previous_invoice_hash !== $expected) {
                $breaks[] = [
                    'tax_invoice_id' => $document->tax_invoice_id,
                    'counter_value' => $document->counter_value,
                    'expected_pih' => $expected,
                    'stored_pih' => $document->previous_invoice_hash,
                ];
            }

            $expected = $document->invoice_hash;
        }

        return [
            'documents_count' => $documents->count(),
            'is_valid' => empty($breaks),
            'breaks' => $breaks,
        ];
    }
}
