<?php

namespace App\Services\Zatca;

use App\Models\CompanyTaxProfile;
use App\Models\TaxInvoice;

/**
 * بانى XML بصيغة UBL 2.1.
 *
 * مبني بـ DOMDocument مش بدمج نصوص — لأن الهاش بيُحسب على XML
 * مُقنَّن، وأي فرق في الترميز أو ترتيب الخصائص بيكسر التحقق.
 *
 * ترتيب العناصر في UBL إلزامي بالمخطط (sequence مش choice)،
 * فمتغيّرش الترتيب في الدوال دي.
 */
class ZatcaInvoiceXmlBuilder
{
    private const NS_INVOICE = 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
    private const NS_CAC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2';
    private const NS_CBC = 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2';
    private const NS_EXT = 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2';

    /** أكواد نوع المستند حسب UN/CEFACT 1001. */
    private const TYPE_CODES = [
        'tax_invoice' => '388',
        'credit_note' => '381',
        'debit_note' => '383',
    ];

    private \DOMDocument $doc;

    public function build(
        TaxInvoice $invoice,
        CompanyTaxProfile $seller,
        string $previousInvoiceHash,
        int $counterValue
    ): string {
        $invoice->loadMissing('items');

        $this->doc = new \DOMDocument('1.0', 'UTF-8');
        $this->doc->preserveWhiteSpace = false;
        $this->doc->formatOutput = false;

        $root = $this->doc->createElementNS(self::NS_INVOICE, 'Invoice');
        $root->setAttributeNS(
            'http://www.w3.org/2000/xmlns/',
            'xmlns:cac',
            self::NS_CAC
        );
        $root->setAttributeNS(
            'http://www.w3.org/2000/xmlns/',
            'xmlns:cbc',
            self::NS_CBC
        );
        $root->setAttributeNS(
            'http://www.w3.org/2000/xmlns/',
            'xmlns:ext',
            self::NS_EXT
        );

        $this->doc->appendChild($root);

        // موضع التوقيع — يُملأ لاحقًا بواسطة ZatcaSigningService
        $root->appendChild(
            $this->doc->createElementNS(self::NS_EXT, 'ext:UBLExtensions')
        );

        $this->appendHeader($root, $invoice, $counterValue, $previousInvoiceHash);
        $this->appendSeller($root, $seller);
        $this->appendBuyer($root, $invoice);
        $this->appendDelivery($root, $invoice);
        $this->appendPaymentMeans($root, $invoice);
        $this->appendTaxTotals($root, $invoice);
        $this->appendLegalMonetaryTotal($root, $invoice);
        $this->appendLines($root, $invoice);

        return $this->doc->saveXML();
    }

    /* ------------------------------------------------------------------ */

    private function appendHeader(
        \DOMElement $root,
        TaxInvoice $invoice,
        int $counterValue,
        string $previousInvoiceHash
    ): void {
        $this->cbc($root, 'ProfileID', 'reporting:1.0');
        $this->cbc($root, 'ID', $invoice->invoice_number);
        $this->cbc($root, 'UUID', (string) $invoice->uuid);

        $this->cbc(
            $root,
            'IssueDate',
            $invoice->issue_date?->format('Y-m-d') ?? now()->format('Y-m-d')
        );

        $this->cbc(
            $root,
            'IssueTime',
            $invoice->issue_time ?: now()->format('H:i:s')
        );

        /*
         * InvoiceTypeCode:
         *   القيمة = كود نوع المستند (388 فاتورة / 381 إشعار دائن)
         *   الخاصية name = أربع خانات:
         *     الأولى  0 قياسية / 1 ملخصة (B2C)
         *     الباقي  أعلام الحالات الخاصة
         */
        $typeCode = self::TYPE_CODES[$invoice->document_type] ?? '388';

        $subtype = $invoice->invoice_type === 'simplified'
            ? '0200000'
            : '0100000';

        $element = $this->cbc($root, 'InvoiceTypeCode', $typeCode);
        $element->setAttribute('name', $subtype);

        $this->cbc($root, 'DocumentCurrencyCode', $invoice->currency ?: 'SAR');
        $this->cbc($root, 'TaxCurrencyCode', 'SAR');

        // الإشعار الدائن لازم يشير للفاتورة الأصلية
        if ($invoice->original_invoice_id && $invoice->originalInvoice) {
            $billing = $this->cac($root, 'BillingReference');
            $reference = $this->cac($billing, 'InvoiceDocumentReference');
            $this->cbc(
                $reference,
                'ID',
                $invoice->originalInvoice->invoice_number
            );
        }

        // الرقم التسلسلي في السلسلة (ICV)
        $icv = $this->cac($root, 'AdditionalDocumentReference');
        $this->cbc($icv, 'ID', 'ICV');
        $this->cbc($icv, 'UUID', (string) $counterValue);

        // هاش الفاتورة السابقة (PIH)
        $pih = $this->cac($root, 'AdditionalDocumentReference');
        $this->cbc($pih, 'ID', 'PIH');
        $attachment = $this->cac($pih, 'Attachment');

        $embedded = $this->cbc(
            $attachment,
            'EmbeddedDocumentBinaryObject',
            $previousInvoiceHash
        );
        $embedded->setAttribute('mimeCode', 'text/plain');

        // موضع رمز QR — يُملأ بعد التوقيع ويُستبعد من الهاش
        $qr = $this->cac($root, 'AdditionalDocumentReference');
        $this->cbc($qr, 'ID', 'QR');
        $qrAttachment = $this->cac($qr, 'Attachment');
        $qrObject = $this->cbc(
            $qrAttachment,
            'EmbeddedDocumentBinaryObject',
            ''
        );
        $qrObject->setAttribute('mimeCode', 'text/plain');

        // مرجع التوقيع
        $signature = $this->cac($root, 'Signature');
        $this->cbc($signature, 'ID', 'urn:oasis:names:specification:ubl:signature:Invoice');
        $this->cbc(
            $signature,
            'SignatureMethod',
            'urn:oasis:names:specification:ubl:dsig:enveloped:xades'
        );
    }

    private function appendSeller(
        \DOMElement $root,
        CompanyTaxProfile $seller
    ): void {
        $party = $this->cac($this->cac($root, 'AccountingSupplierParty'), 'Party');

        if (filled($seller->commercial_register)) {
            $identification = $this->cac($party, 'PartyIdentification');
            $id = $this->cbc(
                $identification,
                'ID',
                $seller->commercial_register
            );
            $id->setAttribute('schemeID', 'CRN');
        }

        $address = $this->cac($party, 'PostalAddress');
        $this->cbc($address, 'StreetName', (string) $seller->street_name);

        if (filled($seller->building_number)) {
            $this->cbc($address, 'BuildingNumber', $seller->building_number);
        }

        if (filled($seller->additional_number)) {
            $this->cbc(
                $address,
                'PlotIdentification',
                $seller->additional_number
            );
        }

        $this->cbc($address, 'CitySubdivisionName', (string) $seller->district);
        $this->cbc($address, 'CityName', (string) $seller->city);
        $this->cbc($address, 'PostalZone', (string) $seller->postal_code);

        $country = $this->cac($address, 'Country');
        $this->cbc(
            $country,
            'IdentificationCode',
            $seller->country_code ?: 'SA'
        );

        $scheme = $this->cac($party, 'PartyTaxScheme');
        $this->cbc($scheme, 'CompanyID', (string) $seller->vat_number);
        $taxScheme = $this->cac($scheme, 'TaxScheme');
        $this->cbc($taxScheme, 'ID', 'VAT');

        $legal = $this->cac($party, 'PartyLegalEntity');
        $this->cbc(
            $legal,
            'RegistrationName',
            (string) $seller->legal_name_ar
        );
    }

    private function appendBuyer(
        \DOMElement $root,
        TaxInvoice $invoice
    ): void {
        $party = $this->cac($this->cac($root, 'AccountingCustomerParty'), 'Party');

        if (filled($invoice->buyer_commercial_register)) {
            $identification = $this->cac($party, 'PartyIdentification');
            $id = $this->cbc(
                $identification,
                'ID',
                $invoice->buyer_commercial_register
            );
            $id->setAttribute('schemeID', 'CRN');
        }

        $address = $this->cac($party, 'PostalAddress');
        $this->cbc($address, 'StreetName', (string) $invoice->buyer_street_name);

        if (filled($invoice->buyer_building_number)) {
            $this->cbc(
                $address,
                'BuildingNumber',
                $invoice->buyer_building_number
            );
        }

        $this->cbc(
            $address,
            'CitySubdivisionName',
            (string) $invoice->buyer_district
        );
        $this->cbc($address, 'CityName', (string) $invoice->buyer_city);
        $this->cbc($address, 'PostalZone', (string) $invoice->buyer_postal_code);

        $country = $this->cac($address, 'Country');
        $this->cbc(
            $country,
            'IdentificationCode',
            $invoice->buyer_country_code ?: 'SA'
        );

        // الرقم الضريبي للمشتري اختياري — الأفراد ليس لهم رقم
        if (filled($invoice->buyer_vat_number)) {
            $scheme = $this->cac($party, 'PartyTaxScheme');
            $this->cbc($scheme, 'CompanyID', $invoice->buyer_vat_number);
            $taxScheme = $this->cac($scheme, 'TaxScheme');
            $this->cbc($taxScheme, 'ID', 'VAT');
        }

        $legal = $this->cac($party, 'PartyLegalEntity');
        $this->cbc(
            $legal,
            'RegistrationName',
            (string) ($invoice->buyer_name ?: 'عميل نقدي')
        );
    }

    private function appendDelivery(
        \DOMElement $root,
        TaxInvoice $invoice
    ): void {
        if (!$invoice->supply_date) {
            return;
        }

        $delivery = $this->cac($root, 'Delivery');
        $this->cbc(
            $delivery,
            'ActualDeliveryDate',
            $invoice->supply_date->format('Y-m-d')
        );
    }

    private function appendPaymentMeans(
        \DOMElement $root,
        TaxInvoice $invoice
    ): void {
        $means = $this->cac($root, 'PaymentMeans');

        // 30 = تحويل بنكي (UN/ECE 4461)
        $this->cbc($means, 'PaymentMeansCode', '30');

        if ($invoice->document_type === 'credit_note') {
            $this->cbc(
                $means,
                'InstructionNote',
                'إشعار دائن — تصحيح فاتورة'
            );
        }
    }

    private function appendTaxTotals(
        \DOMElement $root,
        TaxInvoice $invoice
    ): void {
        $currency = $invoice->currency ?: 'SAR';

        // TaxTotal الأول: الإجمالي فقط
        $total = $this->cac($root, 'TaxTotal');
        $amount = $this->cbc(
            $total,
            'TaxAmount',
            $this->amount($invoice->tax_total)
        );
        $amount->setAttribute('currencyID', $currency);

        // TaxTotal الثاني: مفصّل بالفئات الضريبية
        $detailed = $this->cac($root, 'TaxTotal');
        $detailedAmount = $this->cbc(
            $detailed,
            'TaxAmount',
            $this->amount($invoice->tax_total)
        );
        $detailedAmount->setAttribute('currencyID', $currency);

        foreach ($this->groupByTaxRate($invoice) as $group) {
            $subtotal = $this->cac($detailed, 'TaxSubtotal');

            $taxable = $this->cbc(
                $subtotal,
                'TaxableAmount',
                $this->amount($group['taxable'])
            );
            $taxable->setAttribute('currencyID', $currency);

            $tax = $this->cbc(
                $subtotal,
                'TaxAmount',
                $this->amount($group['tax'])
            );
            $tax->setAttribute('currencyID', $currency);

            $category = $this->cac($subtotal, 'TaxCategory');

            $categoryId = $this->cbc($category, 'ID', $group['category_code']);
            $categoryId->setAttribute('schemeID', 'UN/ECE 5305');
            $categoryId->setAttribute('schemeAgencyID', '6');

            $this->cbc(
                $category,
                'Percent',
                $this->amount($group['rate'])
            );

            // سبب الإعفاء إلزامي للصفري والمعفى
            if ($group['category_code'] !== 'S') {
                $this->cbc(
                    $category,
                    'TaxExemptionReasonCode',
                    (string) $group['exemption_code']
                );

                $this->cbc(
                    $category,
                    'TaxExemptionReason',
                    (string) $group['exemption_reason']
                );
            }

            $scheme = $this->cac($category, 'TaxScheme');
            $schemeId = $this->cbc($scheme, 'ID', 'VAT');
            $schemeId->setAttribute('schemeID', 'UN/ECE 5153');
            $schemeId->setAttribute('schemeAgencyID', '6');
        }
    }

    private function appendLegalMonetaryTotal(
        \DOMElement $root,
        TaxInvoice $invoice
    ): void {
        $currency = $invoice->currency ?: 'SAR';
        $totals = $this->cac($root, 'LegalMonetaryTotal');

        $map = [
            'LineExtensionAmount' => $invoice->taxable_amount,
            'TaxExclusiveAmount' => $invoice->taxable_amount,
            'TaxInclusiveAmount' => $invoice->total,
            'AllowanceTotalAmount' => $invoice->discount_total,
            'PrepaidAmount' => $invoice->paid_amount,
            'PayableAmount' => $invoice->total,
        ];

        foreach ($map as $name => $value) {
            $element = $this->cbc($totals, $name, $this->amount($value));
            $element->setAttribute('currencyID', $currency);
        }
    }

    private function appendLines(
        \DOMElement $root,
        TaxInvoice $invoice
    ): void {
        $currency = $invoice->currency ?: 'SAR';
        $index = 1;

        foreach ($invoice->items as $item) {
            $line = $this->cac($root, 'InvoiceLine');

            $this->cbc($line, 'ID', (string) $index);

            $quantity = $this->cbc(
                $line,
                'InvoicedQuantity',
                $this->amount($item->quantity)
            );
            $quantity->setAttribute('unitCode', $item->unit ?: 'PCE');

            $extension = $this->cbc(
                $line,
                'LineExtensionAmount',
                $this->amount($item->taxable_amount)
            );
            $extension->setAttribute('currencyID', $currency);

            $taxTotal = $this->cac($line, 'TaxTotal');

            $taxAmount = $this->cbc(
                $taxTotal,
                'TaxAmount',
                $this->amount($item->tax_amount)
            );
            $taxAmount->setAttribute('currencyID', $currency);

            $rounding = $this->cbc(
                $taxTotal,
                'RoundingAmount',
                $this->amount($item->line_total)
            );
            $rounding->setAttribute('currencyID', $currency);

            $itemElement = $this->cac($line, 'Item');
            $this->cbc($itemElement, 'Name', (string) $item->name);

            $classified = $this->cac(
                $itemElement,
                'ClassifiedTaxCategory'
            );

            $code = $this->taxCategoryCode($item);
            $this->cbc($classified, 'ID', $code);
            $this->cbc(
                $classified,
                'Percent',
                $this->amount($item->tax_rate)
            );

            $scheme = $this->cac($classified, 'TaxScheme');
            $this->cbc($scheme, 'ID', 'VAT');

            $price = $this->cac($line, 'Price');
            $priceAmount = $this->cbc(
                $price,
                'PriceAmount',
                $this->amount($item->unit_price)
            );
            $priceAmount->setAttribute('currencyID', $currency);

            if ((float) $item->discount > 0) {
                $charge = $this->cac($price, 'AllowanceCharge');
                $this->cbc($charge, 'ChargeIndicator', 'false');
                $this->cbc($charge, 'AllowanceChargeReason', 'discount');
                $chargeAmount = $this->cbc(
                    $charge,
                    'Amount',
                    $this->amount($item->discount)
                );
                $chargeAmount->setAttribute('currencyID', $currency);
            }

            $index++;
        }
    }

    /* ------------------------------------------------------------------ */

    /** يجمّع البنود بنسبة الضريبة وفئتها — مطلوب في TaxSubtotal. */
    private function groupByTaxRate(TaxInvoice $invoice): array
    {
        $groups = [];

        foreach ($invoice->items as $item) {
            $code = $this->taxCategoryCode($item);
            $rate = (float) $item->tax_rate;
            $key = $code . ':' . $rate;

            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'category_code' => $code,
                    'rate' => $rate,
                    'taxable' => 0,
                    'tax' => 0,
                    'exemption_code' => $item->taxCode?->exemption_reason_code,
                    'exemption_reason' => $item->taxCode?->exemption_reason,
                ];
            }

            $groups[$key]['taxable'] += (float) $item->taxable_amount;
            $groups[$key]['tax'] += (float) $item->tax_amount;
        }

        return array_values($groups);
    }

    /**
     * كود الفئة الضريبية (UN/ECE 5305):
     *   S  خاضع للنسبة القياسية
     *   Z  صفري
     *   E  معفى
     *   O  خارج النطاق
     */
    private function taxCategoryCode($item): string
    {
        return match ($item->taxCode?->category) {
            'zero_rated' => 'Z',
            'exempt' => 'E',
            'out_of_scope' => 'O',
            default => (float) $item->tax_rate > 0 ? 'S' : 'Z',
        };
    }

    private function amount($value): string
    {
        return number_format((float) $value, 2, '.', '');
    }

    private function cac(\DOMElement $parent, string $name): \DOMElement
    {
        $element = $this->doc->createElementNS(
            self::NS_CAC,
            'cac:' . $name
        );

        $parent->appendChild($element);

        return $element;
    }

    private function cbc(
        \DOMElement $parent,
        string $name,
        string $value
    ): \DOMElement {
        $element = $this->doc->createElementNS(
            self::NS_CBC,
            'cbc:' . $name,
            htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8')
        );

        $parent->appendChild($element);

        return $element;
    }
}
