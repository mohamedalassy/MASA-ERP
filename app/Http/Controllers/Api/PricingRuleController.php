<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PricingRule;
use Illuminate\Http\Request;

class PricingRuleController extends Controller
{
    public function index(Request $request)
    {
        $query = PricingRule::query()
            ->with('creator:id,name')
            ->orderBy('priority')
            ->orderByDesc('id');

        if ($request->filled('scope_type')) {
            $query->where('scope_type', $request->string('scope_type'));
        }

        if ($request->filled('is_active')) {
            $query->where(
                'is_active',
                filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN)
            );
        }

        $rows = $query->get();

        return response()->json([
            'success' => true,
            'count' => $rows->count(),
            'data' => $rows,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $row = PricingRule::create([
            ...$validated,
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء قاعدة التسعير بنجاح.',
            'data' => $row->fresh('creator:id,name'),
        ], 201);
    }

    public function update(Request $request, PricingRule $pricingRule)
    {
        $validated = $this->validatePayload($request);

        $pricingRule->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث قاعدة التسعير بنجاح.',
            'data' => $pricingRule->fresh('creator:id,name'),
        ]);
    }

    public function destroy(PricingRule $pricingRule)
    {
        $pricingRule->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف قاعدة التسعير.',
        ]);
    }

    public function resolve(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['nullable', 'integer', 'exists:products,id'],
            'category' => ['nullable', 'string', 'max:255'],
            'customer_id' => ['nullable', 'integer'],
            'cost' => ['required', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'discount_percent' => ['nullable', 'numeric', 'min:0'],
        ]);

        $rules = PricingRule::query()
            ->where('is_active', true)
            ->orderBy('priority')
            ->orderByDesc('id')
            ->get();

        $matched = $rules->first(function ($rule) use ($validated) {
            if ($rule->scope_type === 'product') {
                return (int) $rule->scope_id === (int) ($validated['product_id'] ?? 0);
            }

            if ($rule->scope_type === 'customer') {
                return (int) $rule->scope_id === (int) ($validated['customer_id'] ?? 0);
            }

            if ($rule->scope_type === 'global') {
                return true;
            }

            return false;
        });

        $cost = (float) $validated['cost'];
        $salePrice = array_key_exists('sale_price', $validated)
            ? (float) $validated['sale_price']
            : 0;

        $minimumMargin = (float) ($matched?->minimum_margin_percent ?? 0);
        $targetMargin = (float) ($matched?->target_margin_percent ?? 0);
        $markup = (float) ($matched?->default_markup_percent ?? 0);
        $maximumDiscount = (float) ($matched?->maximum_discount_percent ?? 0);

        $minimumPrice = $minimumMargin >= 100
            ? null
            : ($cost > 0 ? $cost / (1 - ($minimumMargin / 100)) : 0);

        $targetPrice = $targetMargin >= 100
            ? null
            : ($cost > 0 ? $cost / (1 - ($targetMargin / 100)) : 0);

        $markupPrice = $cost * (1 + ($markup / 100));

        $recommendedPrice = max(
            (float) ($targetPrice ?? 0),
            (float) $markupPrice
        );

        $currentMargin = $salePrice > 0
            ? (($salePrice - $cost) / $salePrice) * 100
            : null;

        $warnings = [];

        if ($salePrice > 0 && $currentMargin !== null) {
            if ($currentMargin < $minimumMargin) {
                $warnings[] = 'هامش الربح الحالي أقل من الحد الأدنى.';
            } elseif ($currentMargin < $targetMargin) {
                $warnings[] = 'هامش الربح الحالي أقل من الهامش المستهدف.';
            }
        }

        $discountPercent = (float) ($validated['discount_percent'] ?? 0);

        if ($discountPercent > $maximumDiscount) {
            $warnings[] = 'الخصم المطلوب يتجاوز الحد الأقصى المسموح.';
        }

        return response()->json([
            'success' => true,
            'data' => [
                'rule' => $matched,
                'cost' => round($cost, 2),
                'minimum_price' => $minimumPrice === null ? null : round($minimumPrice, 2),
                'target_price' => $targetPrice === null ? null : round($targetPrice, 2),
                'markup_price' => round($markupPrice, 2),
                'recommended_price' => round($recommendedPrice, 2),
                'current_margin_percent' => $currentMargin === null
                    ? null
                    : round($currentMargin, 2),
                'maximum_discount_percent' => round($maximumDiscount, 2),
                'block_below_minimum_margin' => (bool) ($matched?->block_below_minimum_margin ?? false),
                'require_approval_below_target' => (bool) ($matched?->require_approval_below_target ?? false),
                'warnings' => $warnings,
            ],
        ]);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'scope_type' => ['required', 'in:global,product,customer'],
            'scope_id' => ['nullable', 'integer', 'min:1'],
            'minimum_margin_percent' => ['required', 'numeric', 'min:0', 'max:99.99'],
            'target_margin_percent' => ['required', 'numeric', 'min:0', 'max:99.99'],
            'default_markup_percent' => ['required', 'numeric', 'min:0', 'max:10000'],
            'maximum_discount_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'block_below_minimum_margin' => ['nullable', 'boolean'],
            'require_approval_below_target' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'priority' => ['nullable', 'integer', 'min:1', 'max:999999'],
        ]);
    }
}
