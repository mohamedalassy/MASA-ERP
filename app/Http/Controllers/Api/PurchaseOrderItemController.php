<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseOrderItemController extends Controller
{
    public function store(
        Request $request,
        PurchaseOrder $purchaseOrder
    ): JsonResponse {
        $data = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'product_name' => ['nullable', 'string', 'max:255'],
            'sku' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:2000'],
            'quantity' => ['required', 'numeric', 'min:0.01'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'tax_rate' => ['nullable', 'numeric', 'min:0'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        return DB::transaction(function () use ($purchaseOrder, $data) {
            $item = $this->createItem($purchaseOrder, $data);

            $this->recalculatePurchaseOrder($purchaseOrder);

            return response()->json([
                'success' => true,
                'message' => 'تمت إضافة البند بنجاح.',
                'data' => $item->fresh('product'),
                'purchase_order' => $purchaseOrder->fresh('items'),
            ], 201);
        });
    }

    public function update(
        Request $request,
        PurchaseOrder $purchaseOrder,
        PurchaseOrderItem $item
    ): JsonResponse {
        if ($item->purchase_order_id !== $purchaseOrder->id) {
            abort(404);
        }

        $data = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'product_name' => ['nullable', 'string', 'max:255'],
            'sku' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:2000'],
            'quantity' => ['sometimes', 'numeric', 'min:0.01'],
            'unit_cost' => ['sometimes', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'tax_rate' => ['nullable', 'numeric', 'min:0'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        return DB::transaction(function () use (
            $purchaseOrder,
            $item,
            $data
        ) {
            $merged = array_merge(
                $item->toArray(),
                $data
            );

            $calculated = $this->calculateLine($merged);

            $item->update(array_merge(
                $data,
                $calculated
            ));

            $this->recalculatePurchaseOrder($purchaseOrder);

            return response()->json([
                'success' => true,
                'message' => 'تم تحديث البند بنجاح.',
                'data' => $item->fresh('product'),
                'purchase_order' => $purchaseOrder->fresh('items'),
            ]);
        });
    }

    public function destroy(
        PurchaseOrder $purchaseOrder,
        PurchaseOrderItem $item
    ): JsonResponse {
        if ($item->purchase_order_id !== $purchaseOrder->id) {
            abort(404);
        }

        DB::transaction(function () use ($purchaseOrder, $item) {
            $item->delete();

            $this->recalculatePurchaseOrder($purchaseOrder);
        });

        return response()->json([
            'success' => true,
            'message' => 'تم حذف البند بنجاح.',
            'purchase_order' => $purchaseOrder->fresh('items'),
        ]);
    }

    private function createItem(
        PurchaseOrder $purchaseOrder,
        array $data
    ): PurchaseOrderItem {
        $calculated = $this->calculateLine($data);

        return $purchaseOrder->items()->create(array_merge(
            $data,
            $calculated,
            [
                'received_quantity' => 0,
            ]
        ));
    }

    private function calculateLine(array $data): array
    {
        $quantity = (float) ($data['quantity'] ?? 0);
        $unitCost = (float) ($data['unit_cost'] ?? 0);
        $discount = (float) ($data['discount'] ?? 0);
        $taxRate = (float) ($data['tax_rate'] ?? 0);

        $gross = $quantity * $unitCost;

        $net = max(
            0,
            $gross - $discount
        );

        $taxAmount = $net * ($taxRate / 100);

        $lineTotal = $net + $taxAmount;

        return [
            'tax_amount' => round($taxAmount, 2),
            'line_total' => round($lineTotal, 2),
        ];
    }

    private function recalculatePurchaseOrder(
        PurchaseOrder $purchaseOrder
    ): void {
        $purchaseOrder->load('items');

        $subtotal = $purchaseOrder->items->sum(function ($item) {
            return
                ((float) $item->quantity * (float) $item->unit_cost)
                - (float) $item->discount;
        });

        $discount = $purchaseOrder->items->sum(
            fn ($item) => (float) $item->discount
        );

        $tax = $purchaseOrder->items->sum(
            fn ($item) => (float) $item->tax_amount
        );

        $total = $purchaseOrder->items->sum(
            fn ($item) => (float) $item->line_total
        );

        $purchaseOrder->update([
            'subtotal' => round($subtotal, 2),
            'discount' => round($discount, 2),
            'tax' => round($tax, 2),
            'total' => round($total, 2),
        ]);
    }
}