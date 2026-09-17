<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProjectQuotation;
use App\Services\QuotationBillingService;
use Illuminate\Http\Request;

/**
 * حالة الفوترة لعرض سعر واحد.
 *
 * دي اللي شاشة إنشاء الفاتورة الضريبية بتنادي عليها قبل ما المستخدم
 * يكتب أي رقم — عشان تعرض المتبقي المسموح وتوقف الكمية لكل بند.
 *
 * المسار: GET /api/finance/quotations/{quotation}/billing
 */
class QuotationBillingController extends Controller
{
    public function __construct(
        private readonly QuotationBillingService $billing
    ) {}

    public function show(ProjectQuotation $quotation)
    {
        $quotation->load([
            'project:id,project_code,name,customer_name,customer_code',
            'items',
        ]);

        $summary = $this->billing->summary($quotation);

        $items = $quotation->items->map(function ($item) use ($quotation) {
            $sourceQty = round((float) $item->quantity, 4);

            $previousQty = $this->billing->previouslyInvoicedQuantity(
                $quotation->id,
                $item->id
            );

            $remainingQty = round(max(0, $sourceQty - $previousQty), 4);

            return [
                'quotation_item_id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product_name,
                'sku' => $item->sku,
                'description' => $item->description,
                'unit_price' => round((float) $item->unit_price, 2),
                'tax_rate' => round((float) $item->tax_rate, 2),

                'source_quantity' => $sourceQty,
                'previously_invoiced_quantity' => $previousQty,
                'remaining_quantity' => $remainingQty,

                // الشاشة بتوقف الإدخال عند الرقم ده
                'is_fully_invoiced' => $remainingQty <= 0,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => [
                'quotation' => [
                    'id' => $quotation->id,
                    'quotation_number' => $quotation->quotation_number,
                    'status' => $quotation->status,
                    'version' => $quotation->version,
                    'total' => round((float) $quotation->total, 2),
                    'is_billable' => $quotation->status === 'approved',
                ],
                'project' => $quotation->project,
                'summary' => $summary,
                'items' => $items,
            ],
        ]);
    }
}
