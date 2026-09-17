<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryTransaction;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function index()
    {
        $products = Product::query()
            ->orderBy('name')
            ->get([
                'id',
                'sku',
                'name',
                'category',
                'brand',
                'model',
                'description',
                'unit',
                'cost_price',
                'default_sale_price',
                'tax_rate',
                'stock_quantity',
                'minimum_stock',
                'default_supplier',
                'barcode',
                'image_path',
                'is_active',
                'created_by',
                'created_at',
                'updated_at',
            ]);

        return response()->json([
            'success' => true,
            'count' => $products->count(),
            'data' => $products,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'sku' => [
                'required',
                'string',
                'max:100',
                Rule::unique('products', 'sku'),
            ],
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:150'],
            'brand' => ['nullable', 'string', 'max:150'],
            'model' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'unit' => ['nullable', 'string', 'max:50'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'default_sale_price' => ['nullable', 'numeric', 'min:0'],
            'tax_rate' => ['nullable', 'numeric', 'min:0'],
            'opening_stock' => ['nullable', 'numeric', 'min:0'],
            'minimum_stock' => ['nullable', 'numeric', 'min:0'],
            'default_supplier' => ['nullable', 'string', 'max:255'],
            'barcode' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('products', 'barcode'),
            ],
            'image_path' => ['nullable', 'string', 'max:500'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $imagePath = null;

        if ($request->hasFile('image')) {
            $storedPath = $request->file('image')->store('product-images', 'public');
            $imagePath = '/storage/' . $storedPath;
        } elseif (!empty($validated['image_path'])) {
            $imagePath = $validated['image_path'];
        }

        unset($validated['image'], $validated['image_path']);

        $product = DB::transaction(function () use ($validated, $imagePath) {
            $openingStock = (float) ($validated['opening_stock'] ?? 0);
            unset($validated['opening_stock']);

            $validated['stock_quantity'] = 0;
            $validated['unit'] = $validated['unit'] ?? 'قطعة';
            $validated['cost_price'] = $validated['cost_price'] ?? 0;
            $validated['default_sale_price'] =
                $validated['default_sale_price'] ?? 0;
            $validated['tax_rate'] = $validated['tax_rate'] ?? 0;
            $validated['minimum_stock'] =
                $validated['minimum_stock'] ?? 0;
            $validated['is_active'] =
                array_key_exists('is_active', $validated)
                    ? $validated['is_active']
                    : true;

            $validated['created_by'] = auth()->id();

            if ($imagePath) {
                $validated['image_path'] = $imagePath;
            }

            $product = Product::create($validated);

            if ($openingStock > 0) {
                $before = 0;
                $after = $openingStock;

                $product->update([
                    'stock_quantity' => $after,
                ]);

                InventoryTransaction::create([
                    'product_id' => $product->id,
                    'project_id' => null,
                    'purchase_order_id' => null,
                    'purchase_order_item_id' => null,
                    'type' => 'IN',
                    'quantity' => $openingStock,
                    'unit_cost' => (float) ($product->cost_price ?? 0),
                    'stock_before' => $before,
                    'stock_after' => $after,
                    'reference' => 'OPENING-' . $product->sku,
                    'notes' => 'رصيد افتتاحي للمنتج',
                    'created_by' => auth()->id(),
                ]);
            }

            return $product->fresh();
        });

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة المنتج بنجاح.',
            'data' => $product,
        ], 201);
    }

    public function update(Request $request, Product $product)
    {
        $validated = $request->validate([
            'sku' => [
                'sometimes',
                'required',
                'string',
                'max:100',
                Rule::unique('products', 'sku')->ignore($product->id),
            ],
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:150'],
            'brand' => ['nullable', 'string', 'max:150'],
            'model' => ['nullable', 'string', 'max:150'],
            'description' => ['nullable', 'string'],
            'unit' => ['nullable', 'string', 'max:50'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'default_sale_price' => ['nullable', 'numeric', 'min:0'],
            'tax_rate' => ['nullable', 'numeric', 'min:0'],
            'minimum_stock' => ['nullable', 'numeric', 'min:0'],
            'default_supplier' => ['nullable', 'string', 'max:255'],
            'barcode' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('products', 'barcode')->ignore($product->id),
            ],
            'image_path' => ['nullable', 'string', 'max:500'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        if ($request->hasFile('image')) {
            if (
                $product->image_path &&
                str_starts_with($product->image_path, '/storage/')
            ) {
                $oldPath = ltrim(str_replace('/storage/', '', $product->image_path), '/');
                Storage::disk('public')->delete($oldPath);
            }

            $storedPath = $request->file('image')->store('product-images', 'public');
            $validated['image_path'] = '/storage/' . $storedPath;
        }

        unset($validated['image']);
        unset($validated['stock_quantity'], $validated['opening_stock']);

        $product->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث المنتج بنجاح.',
            'data' => $product->fresh(),
        ]);
    }
}
