<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryTransaction;
use App\Models\Product;
use Illuminate\Http\Request;

class InventoryTransactionController extends Controller
{
    public function index(Request $request)
    {
        $query = InventoryTransaction::query()
            ->with([
                'product:id,sku,name,unit,stock_quantity',
                'project:id',
                'purchaseOrder:id,po_number',
                'purchaseOrderItem:id,product_name,sku',
            ])
            ->latest('id');

        if ($request->filled('product_id')) {
            $query->where(
                'product_id',
                $request->integer('product_id')
            );
        }

        if ($request->filled('project_id')) {
            $query->where(
                'project_id',
                $request->integer('project_id')
            );
        }

        if ($request->filled('purchase_order_id')) {
            $query->where(
                'purchase_order_id',
                $request->integer('purchase_order_id')
            );
        }

        if ($request->filled('type')) {
            $query->where(
                'type',
                $request->string('type')->toString()
            );
        }

        $transactions = $query
            ->limit(200)
            ->get();

        return response()->json([
            'success' => true,
            'count' => $transactions->count(),
            'data' => $transactions,
        ]);
    }

    public function productHistory(Product $product)
    {
        $transactions = $product
            ->inventoryTransactions()
            ->with([
                'project:id',
                'purchaseOrder:id,po_number',
            ])
            ->latest('id')
            ->limit(200)
            ->get();

        return response()->json([
            'success' => true,
            'product' => [
                'id' => $product->id,
                'sku' => $product->sku,
                'name' => $product->name,
                'stock_quantity' => $product->stock_quantity,
            ],
            'count' => $transactions->count(),
            'data' => $transactions,
        ]);
    }
}
