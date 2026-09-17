<?php

namespace App\Services\Zatca;

use App\Models\TaxInvoice;

/**
 * مولّد رمز QR بصيغة TLV.
 *
 * الرمز مش رابط ولا نص عادي — هو بنية Tag-Length-Value ثنائية
 * مرمّزة Base64. أشهر سبب لرفض الفواتير هو استخدام مولّد QR عادي
 * بدل بنية TLV الصحيحة: الكود يبان سليم بصريًا ويفشل عند التحقق.
 *
 * الوسوم:
 *   1  اسم البائع
 *   2  الرقم الضريبي للبائع
 *   3  الطابع الزمني (ISO 8601)
 *   4  الإجمالي شامل الضريبة
 *   5  قيمة الضريبة
 *   6  هاش الفاتورة (SHA-256، Base64)
 *   7  التوقيع الإلكتروني (ECDSA)
 *   8  المفتاح العام
 *   9  توقيع الهيئة على الشهادة
 *
 * الوسوم 1-5 كافية للفاتورة المبسطة في المرحلة الأولى.
 * المرحلة الثانية بتطلب التسعة كاملة.
 *
 * ملاحظة مهمة: في الفاتورة القياسية (B2B) منصة فاتورة بترجع
 * رمز QR جاهزًا مع ردّ المقاصة — استخدم اللي بترجعه الهيئة
 * ولا تولّد واحدًا بنفسك.
 */
class ZatcaQrGenerator
{
    /**
     * @param  array<int,string>  $cryptographic  الوسوم 6-9 إن وُجدت
     */
    public function generate(
        TaxInvoice $invoice,
        string $sellerName,
        string $sellerVatNumber,
        array $cryptographic = []
    ): string {
        $timestamp = $this->timestamp($invoice);

        $fields = [
            1 => $sellerName,
            2 => $sellerVatNumber,
            3 => $timestamp,
            4 => $this->amount($invoice->total),
            5 => $this->amount($invoice->tax_total),
        ];

        // الوسوم التشفيرية — المرحلة الثانية
        foreach ([6, 7, 8, 9] as $tag) {
            if (!empty($cryptographic[$tag])) {
                $fields[$tag] = $cryptographic[$tag];
            }
        }

        return base64_encode($this->encodeTlv($fields));
    }

    /**
     * ترميز TLV.
     *
     * الطول لازم يُحسب بالبايت (strlen) مش بالحروف (mb_strlen) —
     * الاسم العربي بيأخذ بايتين لكل حرف في UTF-8، فاستخدام
     * mb_strlen بيطلع طولًا غلط والرمز يترفض.
     */
    private function encodeTlv(array $fields): string
    {
        $tlv = '';

        foreach ($fields as $tag => $value) {
            $value = (string) $value;
            $length = strlen($value);

            /*
             * القيم اللي طولها أكبر من 255 بايت (زي التوقيع والمفتاح
             * العام) بتحتاج ترميز الطول الممتد.
             */
            if ($length > 255) {
                $tlv .= chr($tag)
                    . chr(0x82)
                    . chr(($length >> 8) & 0xFF)
                    . chr($length & 0xFF)
                    . $value;

                continue;
            }

            $tlv .= chr($tag) . chr($length) . $value;
        }

        return $tlv;
    }

    /** المبالغ بخانتين عشريتين بدون فواصل آلاف. */
    private function amount($value): string
    {
        return number_format((float) $value, 2, '.', '');
    }

    /** الطابع الزمني بصيغة ISO 8601 بتوقيت الرياض. */
    private function timestamp(TaxInvoice $invoice): string
    {
        $date = $invoice->issue_date
            ? $invoice->issue_date->format('Y-m-d')
            : now()->format('Y-m-d');

        $time = $invoice->issue_time ?: '00:00:00';

        return $date . 'T' . $time . 'Z';
    }

    /** يفكّ ترميز رمز موجود — للتشخيص والاختبارات. */
    public function decode(string $base64): array
    {
        $binary = base64_decode($base64, true);

        if ($binary === false) {
            return [];
        }

        $result = [];
        $offset = 0;
        $size = strlen($binary);

        while ($offset < $size - 1) {
            $tag = ord($binary[$offset]);
            $lengthByte = ord($binary[$offset + 1]);
            $offset += 2;

            if ($lengthByte === 0x82) {
                $length = (ord($binary[$offset]) << 8)
                    | ord($binary[$offset + 1]);
                $offset += 2;
            } else {
                $length = $lengthByte;
            }

            $result[$tag] = substr($binary, $offset, $length);
            $offset += $length;
        }

        return $result;
    }
}
