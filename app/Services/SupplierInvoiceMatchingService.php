<?php

namespace App\Services;

use App\Models\SupplierInvoice;
use App\Models\SupplierInvoiceItem;

class SupplierInvoiceMatchingService
{
    private const QUANTITY_TOLERANCE = 0.01;
    private const PRICE_TOLERANCE = 0.01;

    public function match(SupplierInvoice $invoice): SupplierInvoice
    {
        $invoice->loadMissing([
            'purchaseOrder.items',
            'items.purchaseOrderItem',
        ]);

        if (!$invoice->purchase_order_id || !$invoice->purchaseOrder) {
            $invoice->items()->update(['match_status' => 'unlinked']);
            $invoice->update([
                'match_status' => 'blocked',
                'variance_amount' => (float) $invoice->total,
            ]);

            return $invoice->fresh(['items', 'purchaseOrder']);
        }

        $hasVariance = false;
        $hasBlockedItem = false;
        $varianceAmount = 0.0;

        foreach ($invoice->items as $invoiceItem) {
            $poItem = $invoiceItem->purchaseOrderItem;

            if (!$poItem ||
                (int) $poItem->purchase_order_id !== (int) $invoice->purchase_order_id) {
                $invoiceItem->update([
                    'match_status' => 'unlinked',
                    'quantity_variance' => (float) $invoiceItem->quantity,
                    'price_variance' => (float) $invoiceItem->unit_cost,
                    'line_variance' => (float) $invoiceItem->line_total,
                ]);
                $hasBlockedItem = true;
                $varianceAmount += abs((float) $invoiceItem->line_total);
                continue;
            }

            $previouslyInvoiced = (float) SupplierInvoiceItem::query()
                ->where('purchase_order_item_id', $poItem->id)
                ->where('supplier_invoice_id', '!=', $invoice->id)
                ->whereHas('supplierInvoice', function ($query) {
                    $query->whereNotIn('status', ['draft', 'rejected', 'cancelled']);
                })
                ->sum('quantity');

            $orderedQuantity = (float) $poItem->quantity;
            $receivedQuantity = (float) $poItem->received_quantity;
            $availableToInvoice = max(0, $receivedQuantity - $previouslyInvoiced);
            $invoiceQuantity = (float) $invoiceItem->quantity;
            $orderedUnitCost = (float) $poItem->unit_cost;
            $invoiceUnitCost = (float) $invoiceItem->unit_cost;

            // Partial supplier invoices are valid. Only quantities above the
            // received and not-yet-invoiced quantity are treated as variance.
            $quantityVariance = max(0, $invoiceQuantity - $availableToInvoice);
            $priceVariance = $invoiceUnitCost - $orderedUnitCost;
            $lineVariance =
                ($quantityVariance * $invoiceUnitCost) +
                ($invoiceQuantity * $priceVariance);

            $quantityMismatch =
                abs($quantityVariance) > self::QUANTITY_TOLERANCE;
            $priceMismatch =
                abs($priceVariance) > self::PRICE_TOLERANCE;

            $itemStatus = match (true) {
                $quantityMismatch && $priceMismatch => 'multiple_variances',
                $quantityMismatch => 'quantity_variance',
                $priceMismatch => 'price_variance',
                default => 'matched',
            };

            $invoiceItem->update([
                'product_id' => $invoiceItem->product_id ?: $poItem->product_id,
                'ordered_quantity_snapshot' => $orderedQuantity,
                'received_quantity_snapshot' => $receivedQuantity,
                'ordered_unit_cost_snapshot' => $orderedUnitCost,
                'quantity_variance' => round($quantityVariance, 2),
                'price_variance' => round($priceVariance, 2),
                'line_variance' => round($lineVariance, 2),
                'match_status' => $itemStatus,
            ]);

            if ($itemStatus !== 'matched') {
                $hasVariance = true;
                $varianceAmount += abs($lineVariance);
            }
        }

        $invoice->update([
            'match_status' => $hasBlockedItem
                ? 'blocked'
                : ($hasVariance ? 'variance' : 'matched'),
            'variance_amount' => round($varianceAmount, 2),
        ]);

        return $invoice->fresh([
            'supplier',
            'project',
            'purchaseOrder.items',
            'items.purchaseOrderItem',
        ]);
    }
}
