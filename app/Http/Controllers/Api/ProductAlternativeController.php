<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\ProductAlternative;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * بدائل المنتجات — الكنترولر كان مفقودًا تمامًا
 * بينما شاشة ProductAlternatives و٥ مسارات معرّفة في api.php.
 */
class ProductAlternativeController extends Controller
{
    private const WITH = [
        'product:id,sku,name,cost_price,default_sale_price,stock_quantity',
        'alternative:id,sku,name,cost_price,default_sale_price,stock_quantity',
    ];

    public function index(Request $request)
    {
        $query = ProductAlternative::query()->with(self::WITH);

        if ($request->filled('relation_type')) {
            $query->where('relation_type', $request->relation_type);
        }

        if ($request->boolean('active')) {
            $query->where('is_active', true);
        }

        if ($request->filled('search')) {
            $search = trim($request->search);

            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        $rows = $query
            ->orderBy('product_id')
            ->orderBy('preference_order')
            ->get()
            ->map(fn ($row) => $this->transform($row));

        return response()->json([
            'success' => true,
            'count' => $rows->count(),
            'data' => $rows,
        ]);
    }

    public function productAlternatives(Product $product)
    {
        $rows = ProductAlternative::query()
            ->with(self::WITH)
            ->where('product_id', $product->id)
            ->where('is_active', true)
            ->orderBy('preference_order')
            ->get()
            ->map(fn ($row) => $this->transform($row));

        return response()->json([
            'success' => true,
            'data' => [
                'product' => $product->only([
                    'id', 'sku', 'name', 'cost_price',
                    'default_sale_price', 'stock_quantity',
                ]),
                'alternatives' => $rows,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $row = ProductAlternative::create([
            ...$validated,
            'created_by' => $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة البديل بنجاح.',
            'data' => $this->transform($row->load(self::WITH)),
        ], 201);
    }

    public function update(
        Request $request,
        ProductAlternative $productAlternative
    ) {
        $validated = $this->validatePayload(
            $request,
            $productAlternative->id
        );

        $productAlternative->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث البديل بنجاح.',
            'data' => $this->transform(
                $productAlternative->fresh()->load(self::WITH)
            ),
        ]);
    }

    public function destroy(ProductAlternative $productAlternative)
    {
        $productAlternative->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف البديل.',
        ]);
    }

    /** يضيف فرق التكلفة والتوفّر — وهو سبب وجود الشاشة أصلاً. */
    private function transform(ProductAlternative $row): array
    {
        $original = (float) ($row->product?->cost_price ?? 0);
        $alternative = (float) ($row->alternative?->cost_price ?? 0);

        $difference = round($alternative - $original, 2);

        return [
            'id' => $row->id,
            'relation_type' => $row->relation_type,
            'preference_order' => $row->preference_order,
            'notes' => $row->notes,
            'is_active' => $row->is_active,

            'product' => $row->product,
            'alternative' => $row->alternative,

            'cost_difference' => $difference,
            'cost_difference_percent' => $original > 0
                ? round(($difference / $original) * 100, 2)
                : 0,
            'is_cheaper' => $difference < 0,

            'alternative_in_stock' =>
                (float) ($row->alternative?->stock_quantity ?? 0) > 0,
        ];
    }

    private function validatePayload(
        Request $request,
        ?int $ignoreId = null
    ): array {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],

            'alternative_product_id' => [
                'required',
                'integer',
                'exists:products,id',
                'different:product_id',
                Rule::unique('product_alternatives', 'alternative_product_id')
                    ->where(
                        fn ($q) => $q->where(
                            'product_id',
                            $request->input('product_id')
                        )
                    )
                    ->ignore($ignoreId),
            ],

            'relation_type' => [
                'nullable',
                'in:equivalent,upgrade,downgrade',
            ],

            'preference_order' => ['nullable', 'integer', 'min:1', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
        ], [
            'alternative_product_id.different' =>
                'لا يمكن أن يكون المنتج بديلًا لنفسه.',
            'alternative_product_id.unique' =>
                'البديل ده مسجّل بالفعل لنفس المنتج.',
        ]);

        return $validated;
    }
}
