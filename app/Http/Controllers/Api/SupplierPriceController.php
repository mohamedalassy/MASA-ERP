<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\SupplierPrice;
use Illuminate\Http\Request;

class SupplierPriceController extends Controller
{
    public function index(Request $request)
    {
        $query = SupplierPrice::query()
            ->with(['product', 'supplier'])
            ->where('is_active', true);

        if ($request->filled('product_id')) {
            $query->where('product_id', $request->integer('product_id'));
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->integer('supplier_id'));
        }

        $rows = $query
            ->orderByDesc('is_preferred')
            ->orderBy('unit_price')
            ->orderByDesc('id')
            ->get()
            ->map(function ($row) {
                $isValid = !$row->valid_until || $row->valid_until->endOfDay()->isFuture();

                return [
                    ...$row->toArray(),
                    'is_valid' => $isValid,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }

    public function productPrices(Product $product)
    {
        $rows = SupplierPrice::query()
            ->with('supplier')
            ->where('product_id', $product->id)
            ->where('is_active', true)
            ->orderByDesc('is_preferred')
            ->orderBy('unit_price')
            ->get()
            ->map(function ($row) {
                $isValid = !$row->valid_until || $row->valid_until->endOfDay()->isFuture();

                return [
                    ...$row->toArray(),
                    'is_valid' => $isValid,
                ];
            });

        return response()->json([
            'success' => true,
            'product' => $product,
            'data' => $rows,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'supplier_id' => ['required', 'integer', 'exists:suppliers,id'],
            'unit_price' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'minimum_order_quantity' => ['nullable', 'numeric', 'min:0'],
            'lead_time_days' => ['nullable', 'integer', 'min:0'],
            'valid_from' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date'],
            'payment_terms' => ['nullable', 'string', 'max:1000'],
            'warranty_terms' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'is_preferred' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (!empty($validated['is_preferred'])) {
            SupplierPrice::where('product_id', $validated['product_id'])
                ->update(['is_preferred' => false]);
        }

        $row = SupplierPrice::create([
            ...$validated,
            'currency' => $validated['currency'] ?? 'SAR',
            'minimum_order_quantity' => $validated['minimum_order_quantity'] ?? 1,
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم حفظ سعر المورد بنجاح.',
            'data' => $row->load(['product', 'supplier']),
        ], 201);
    }

    public function update(Request $request, SupplierPrice $supplierPrice)
    {
        $validated = $request->validate([
            'unit_price' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'minimum_order_quantity' => ['nullable', 'numeric', 'min:0'],
            'lead_time_days' => ['nullable', 'integer', 'min:0'],
            'valid_from' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date'],
            'payment_terms' => ['nullable', 'string', 'max:1000'],
            'warranty_terms' => ['nullable', 'string', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'is_preferred' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if (!empty($validated['is_preferred'])) {
            SupplierPrice::where('product_id', $supplierPrice->product_id)
                ->whereKeyNot($supplierPrice->id)
                ->update(['is_preferred' => false]);
        }

        $supplierPrice->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث سعر المورد بنجاح.',
            'data' => $supplierPrice->fresh()->load(['product', 'supplier']),
        ]);
    }
}
