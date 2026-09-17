<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PricingPackage;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PricingPackageController extends Controller
{
    public function index(Request $request)
    {
        $query = PricingPackage::query()
            ->with(['items.product'])
            ->orderBy('priority')
            ->orderByDesc('id');

        if ($request->filled('is_active')) {
            $query->where(
                'is_active',
                filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN)
            );
        }

        $rows = $query->get()->map(
            fn ($row) => $this->appendTotals($row)
        );

        return response()->json([
            'success' => true,
            'count' => $rows->count(),
            'data' => $rows,
        ]);
    }

    public function show(PricingPackage $pricingPackage)
    {
        $pricingPackage->load(['items.product']);

        return response()->json([
            'success' => true,
            'data' => $this->appendTotals($pricingPackage),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $package = DB::transaction(function () use ($validated, $request) {
            $items = $validated['items'];
            unset($validated['items']);

            $package = PricingPackage::create([
                ...$validated,
                'created_by' => $request->user()?->id,
            ]);

            $this->replaceItems($package, $items);

            return $package;
        });

        $package->load(['items.product']);

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الباقة بنجاح.',
            'data' => $this->appendTotals($package),
        ], 201);
    }

    public function update(Request $request, PricingPackage $pricingPackage)
    {
        $validated = $this->validatePayload($request);

        DB::transaction(function () use ($validated, $pricingPackage) {
            $items = $validated['items'];
            unset($validated['items']);

            $pricingPackage->update($validated);
            $this->replaceItems($pricingPackage, $items);
        });

        $pricingPackage->load(['items.product']);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الباقة بنجاح.',
            'data' => $this->appendTotals($pricingPackage),
        ]);
    }

    public function destroy(PricingPackage $pricingPackage)
    {
        $pricingPackage->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الباقة.',
        ]);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:5000'],
            'target_margin_percent' => ['required', 'numeric', 'min:0', 'max:99.99'],
            'discount_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'priority' => ['nullable', 'integer', 'min:1', 'max:999999'],

            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'numeric', 'gt:0'],
            'items.*.cost_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.sale_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.discount_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);
    }

    private function replaceItems(PricingPackage $package, array $items): void
    {
        $package->items()->delete();

        foreach ($items as $index => $item) {
            $product = Product::findOrFail($item['product_id']);

            $package->items()->create([
                'product_id' => $product->id,
                'product_name_snapshot' => $product->name,
                'sku_snapshot' => $product->sku,
                'unit' => $product->unit ?: 'قطعة',
                'quantity' => $item['quantity'],
                'cost_price' => $item['cost_price'] ?? $product->cost_price ?? 0,
                'sale_price' => $item['sale_price'] ?? $product->default_sale_price ?? 0,
                'discount_percent' => $item['discount_percent'] ?? 0,
                'sort_order' => $index,
            ]);
        }
    }

    private function appendTotals(PricingPackage $package): array
    {
        $row = $package->toArray();

        $totalCost = 0;
        $grossSale = 0;

        foreach ($package->items as $item) {
            $qty = (float) $item->quantity;
            $cost = (float) $item->cost_price;
            $sale = (float) $item->sale_price;
            $discount = (float) $item->discount_percent;

            $totalCost += $qty * $cost;
            $grossSale += ($qty * $sale) * (1 - ($discount / 100));
        }

        $packageDiscount = (float) $package->discount_percent;
        $netSale = $grossSale * (1 - ($packageDiscount / 100));

        $profit = $netSale - $totalCost;
        $margin = $netSale > 0 ? ($profit / $netSale) * 100 : 0;
        $markup = $totalCost > 0 ? ($profit / $totalCost) * 100 : 0;

        $targetMargin = (float) $package->target_margin_percent;
        $targetSale = $targetMargin < 100 && $totalCost > 0
            ? $totalCost / (1 - ($targetMargin / 100))
            : 0;

        $row['totals'] = [
            'total_cost' => round($totalCost, 2),
            'gross_sale' => round($grossSale, 2),
            'net_sale' => round($netSale, 2),
            'profit' => round($profit, 2),
            'margin_percent' => round($margin, 2),
            'markup_percent' => round($markup, 2),
            'target_sale' => round($targetSale, 2),
        ];

        return $row;
    }
}
