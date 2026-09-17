<?php

namespace App\Services;

/**
 * حاسبة الفاتورة الضريبية — كانت مفقودة من الحزمة المستعادة.
 *
 * TaxInvoiceController بيستوردها في الـ constructor، فبدونها الكنترولر
 * مش بيتكوّن أصلاً ووحدة الفواتير الضريبية كلها متوقفة.
 *
 * مفاتيح totals لازم تطابق أعمدة جدول tax_invoices بالظبط، لأن الكنترولر
 * بيفرّدها مباشرة في TaxInvoice::create عن طريق spread.
 */
class TaxInvoiceCalculator
{
    /**
     * @param  array<int,array<string,mixed>>  $items
     * @return array{items:array<int,array<string,mixed>>,totals:array<string,float>}
     */
    public function calculate(array $items): array
    {
        $calculated = [];

        $subtotal = 0.0;
        $discountTotal = 0.0;
        $taxableAmount = 0.0;
        $taxTotal = 0.0;

        foreach (array_values($items) as $index => $item) {
            $quantity = round((float) ($item['quantity'] ?? 0), 4);
            $unitPrice = round((float) ($item['unit_price'] ?? 0), 2);

            $gross = round($quantity * $unitPrice, 2);

            $discount = $this->lineDiscount($item, $gross);
            $taxable = round(max(0, $gross - $discount), 2);

            $taxRate = (float) ($item['tax_rate'] ?? 15);
            $taxAmount = round($taxable * ($taxRate / 100), 2);

            $lineTotal = round($taxable + $taxAmount, 2);

            $subtotal += $gross;
            $discountTotal += $discount;
            $taxableAmount += $taxable;
            $taxTotal += $taxAmount;

            $calculated[] = [
                'quotation_item_id' => $item['quotation_item_id'] ?? null,
                'product_id' => $item['product_id'] ?? null,
                'tax_code_id' => $item['tax_code_id'] ?? null,
                'name' => $item['name'] ?? ($item['description'] ?? 'بند'),
                'description' => $item['description'] ?? null,
                'unit' => $item['unit'] ?? null,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'discount' => $discount,
                'taxable_amount' => $taxable,
                'tax_rate' => round($taxRate, 2),
                'tax_amount' => $taxAmount,
                'line_total' => $lineTotal,
                'sort_order' => (int) ($item['sort_order'] ?? $index),
            ];
        }

        /*
         * التقريب على مرحلتين: سطر البند ثم إجمالي الفاتورة.
         * كده مجموع السطور = إجمالي الفاتورة بالظبط ومافيش فرق هللة
         * يخلي القيد المحاسبي غير متوازن.
         */
        $subtotal = round($subtotal, 2);
        $discountTotal = round($discountTotal, 2);
        $taxableAmount = round($taxableAmount, 2);
        $taxTotal = round($taxTotal, 2);
        $total = round($taxableAmount + $taxTotal, 2);

        return [
            'items' => $calculated,
            'totals' => [
                'subtotal' => $subtotal,
                'discount_total' => $discountTotal,
                'taxable_amount' => $taxableAmount,
                'tax_total' => $taxTotal,
                'total' => $total,
            ],
        ];
    }

    /** الخصم إما نسبة أو مبلغ، والنسبة لها الأولوية لو الاتنين موجودين. */
    private function lineDiscount(array $item, float $gross): float
    {
        $percent = (float) ($item['discount_percent'] ?? 0);

        if ($percent > 0) {
            return round($gross * (min($percent, 100) / 100), 2);
        }

        return round(
            min((float) ($item['discount'] ?? 0), $gross),
            2
        );
    }
}
