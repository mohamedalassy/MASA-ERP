<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PricingCosting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PricingCostingController extends Controller
{
    public function index(Request $request)
    {
        $query = PricingCosting::query()
            ->with(['project', 'components'])
            ->latest('id');

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->integer('project_id'));
        }

        return response()->json([
            'success' => true,
            'data' => $query->get()->map(fn ($costing) => $this->transform($costing)),
        ]);
    }

    public function show(PricingCosting $pricingCosting)
    {
        $pricingCosting->load(['project', 'components']);

        return response()->json([
            'success' => true,
            'data' => $this->transform($pricingCosting),
        ]);
    }

    public function calculate(Request $request)
    {
        $validated = $this->validatePayload($request, false);

        return response()->json([
            'success' => true,
            'data' => $this->calculateSummary(
                (float) ($validated['material_cost'] ?? 0),
                $validated['components'] ?? [],
                (float) ($validated['minimum_margin_percent'] ?? 15),
                (float) ($validated['target_margin_percent'] ?? 25),
                (float) ($validated['tax_rate'] ?? 15),
                (float) ($validated['current_sale'] ?? 0),
            ),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request, true);

        $costing = DB::transaction(function () use ($validated, $request) {
            $costing = PricingCosting::create([
                'project_id' => $validated['project_id'] ?? null,
                'quotation_id' => $validated['quotation_id'] ?? null,
                'title' => $validated['title'] ?? 'Project Costing',
                'currency' => $validated['currency'] ?? 'SAR',
                'material_cost' => $validated['material_cost'] ?? 0,
                'minimum_margin_percent' => $validated['minimum_margin_percent'] ?? 15,
                'target_margin_percent' => $validated['target_margin_percent'] ?? 25,
                'tax_rate' => $validated['tax_rate'] ?? 15,
                'status' => $validated['status'] ?? 'draft',
                'notes' => $validated['notes'] ?? null,
                'created_by' => optional($request->user())->id,
            ]);

            $this->syncComponents($costing, $validated['components'] ?? []);

            return $costing->fresh(['project', 'components']);
        });

        return response()->json([
            'success' => true,
            'message' => 'تم حفظ حساب تكلفة المشروع بنجاح.',
            'data' => $this->transform($costing),
        ], 201);
    }

    public function update(Request $request, PricingCosting $pricingCosting)
    {
        $validated = $this->validatePayload($request, true);

        $costing = DB::transaction(function () use ($validated, $pricingCosting) {
            $pricingCosting->update([
                'project_id' => $validated['project_id'] ?? null,
                'quotation_id' => $validated['quotation_id'] ?? null,
                'title' => $validated['title'] ?? $pricingCosting->title,
                'currency' => $validated['currency'] ?? $pricingCosting->currency,
                'material_cost' => $validated['material_cost'] ?? 0,
                'minimum_margin_percent' => $validated['minimum_margin_percent'] ?? 15,
                'target_margin_percent' => $validated['target_margin_percent'] ?? 25,
                'tax_rate' => $validated['tax_rate'] ?? 15,
                'status' => $validated['status'] ?? 'draft',
                'notes' => $validated['notes'] ?? null,
            ]);

            $this->syncComponents($pricingCosting, $validated['components'] ?? []);

            return $pricingCosting->fresh(['project', 'components']);
        });

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث حساب التكلفة بنجاح.',
            'data' => $this->transform($costing),
        ]);
    }

    public function destroy(PricingCosting $pricingCosting)
    {
        $pricingCosting->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف حساب التكلفة.',
        ]);
    }

    private function validatePayload(Request $request, bool $withMeta): array
    {
        $rules = [
            'material_cost' => ['nullable', 'numeric', 'min:0'],
            'minimum_margin_percent' => ['nullable', 'numeric', 'min:0', 'lt:100'],
            'target_margin_percent' => ['nullable', 'numeric', 'min:0', 'lt:100'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'current_sale' => ['nullable', 'numeric', 'min:0'],

            'components' => ['nullable', 'array'],
            'components.*.type' => ['required', 'string', 'max:50'],
            'components.*.label' => ['required', 'string', 'max:255'],
            'components.*.calculation_mode' => [
                'required',
                Rule::in(['fixed', 'percentage']),
            ],
            'components.*.percentage_basis' => [
                'nullable',
                Rule::in(['materials', 'running_subtotal']),
            ],
            'components.*.fixed_amount' => ['nullable', 'numeric', 'min:0'],
            'components.*.percentage' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'components.*.sort_order' => ['nullable', 'integer', 'min:0'],
            'components.*.notes' => ['nullable', 'string'],
        ];

        if ($withMeta) {
            $rules = array_merge($rules, [
                'project_id' => ['nullable', 'exists:projects,id'],
                'quotation_id' => ['nullable', 'integer', 'min:1'],
                'title' => ['nullable', 'string', 'max:255'],
                'currency' => ['nullable', 'string', 'max:10'],
                'status' => ['nullable', Rule::in(['draft', 'approved', 'archived'])],
                'notes' => ['nullable', 'string'],
            ]);
        }

        return $request->validate($rules);
    }

    private function syncComponents(PricingCosting $costing, array $components): void
    {
        $costing->components()->delete();

        foreach (array_values($components) as $index => $component) {
            $costing->components()->create([
                'type' => $component['type'],
                'label' => $component['label'],
                'calculation_mode' => $component['calculation_mode'] ?? 'fixed',
                'percentage_basis' => $component['percentage_basis'] ?? 'materials',
                'fixed_amount' => $component['fixed_amount'] ?? 0,
                'percentage' => $component['percentage'] ?? 0,
                'sort_order' => $component['sort_order'] ?? $index,
                'notes' => $component['notes'] ?? null,
            ]);
        }
    }

    private function calculateSummary(
        float $materialCost,
        array $components,
        float $minimumMargin,
        float $targetMargin,
        float $taxRate,
        float $currentSale = 0
    ): array {
        $runningSubtotal = max(0, $materialCost);
        $calculatedComponents = [];

        usort($components, fn ($a, $b) =>
            (int) ($a['sort_order'] ?? 0) <=> (int) ($b['sort_order'] ?? 0)
        );

        foreach ($components as $index => $component) {
            $mode = $component['calculation_mode'] ?? 'fixed';
            $basis = $component['percentage_basis'] ?? 'materials';

            if ($mode === 'percentage') {
                $basisAmount = $basis === 'running_subtotal'
                    ? $runningSubtotal
                    : $materialCost;

                $amount = $basisAmount * ((float) ($component['percentage'] ?? 0) / 100);
            } else {
                $basisAmount = null;
                $amount = (float) ($component['fixed_amount'] ?? 0);
            }

            $amount = max(0, round($amount, 2));
            $runningSubtotal += $amount;

            $calculatedComponents[] = [
                'type' => $component['type'] ?? 'other',
                'label' => $component['label'] ?? 'تكلفة إضافية',
                'calculation_mode' => $mode,
                'percentage_basis' => $basis,
                'percentage' => (float) ($component['percentage'] ?? 0),
                'fixed_amount' => (float) ($component['fixed_amount'] ?? 0),
                'basis_amount' => $basisAmount !== null ? round($basisAmount, 2) : null,
                'calculated_amount' => $amount,
                'sort_order' => (int) ($component['sort_order'] ?? $index),
            ];
        }

        $totalCost = round($runningSubtotal, 2);
        $breakEven = $totalCost;

        $minimumPrice = $minimumMargin < 100
            ? $totalCost / (1 - ($minimumMargin / 100))
            : 0;

        $targetPrice = $targetMargin < 100
            ? $totalCost / (1 - ($targetMargin / 100))
            : 0;

        $recommendedPrice = max($minimumPrice, $targetPrice);
        $targetProfit = $targetPrice - $totalCost;
        $targetMarkup = $totalCost > 0 ? ($targetProfit / $totalCost) * 100 : 0;

        $taxAmount = $recommendedPrice * ($taxRate / 100);
        $recommendedWithTax = $recommendedPrice + $taxAmount;

        $currentProfit = $currentSale - $totalCost;
        $currentMargin = $currentSale > 0 ? ($currentProfit / $currentSale) * 100 : 0;
        $currentMarkup = $totalCost > 0 ? ($currentProfit / $totalCost) * 100 : 0;

        return [
            'material_cost' => round($materialCost, 2),
            'components_total' => round($totalCost - $materialCost, 2),
            'components' => $calculatedComponents,
            'total_cost' => $totalCost,
            'break_even_price' => round($breakEven, 2),
            'minimum_price' => round($minimumPrice, 2),
            'target_price' => round($targetPrice, 2),
            'recommended_price' => round($recommendedPrice, 2),
            'recommended_tax_amount' => round($taxAmount, 2),
            'recommended_price_with_tax' => round($recommendedWithTax, 2),
            'target_profit' => round($targetProfit, 2),
            'target_margin_percent' => round($targetMargin, 4),
            'target_markup_percent' => round($targetMarkup, 4),
            'minimum_margin_percent' => round($minimumMargin, 4),
            'current_sale' => round($currentSale, 2),
            'current_profit' => round($currentProfit, 2),
            'current_margin_percent' => round($currentMargin, 4),
            'current_markup_percent' => round($currentMarkup, 4),
        ];
    }

    private function transform(PricingCosting $costing): array
    {
        $components = $costing->components->map(fn ($row) => [
            'id' => $row->id,
            'type' => $row->type,
            'label' => $row->label,
            'calculation_mode' => $row->calculation_mode,
            'percentage_basis' => $row->percentage_basis,
            'fixed_amount' => (float) $row->fixed_amount,
            'percentage' => (float) $row->percentage,
            'sort_order' => (int) $row->sort_order,
            'notes' => $row->notes,
        ])->values()->all();

        return [
            'id' => $costing->id,
            'project_id' => $costing->project_id,
            'quotation_id' => $costing->quotation_id,
            'title' => $costing->title,
            'currency' => $costing->currency,
            'material_cost' => (float) $costing->material_cost,
            'minimum_margin_percent' => (float) $costing->minimum_margin_percent,
            'target_margin_percent' => (float) $costing->target_margin_percent,
            'tax_rate' => (float) $costing->tax_rate,
            'status' => $costing->status,
            'notes' => $costing->notes,
            'project' => $costing->project,
            'components' => $components,
            'summary' => $this->calculateSummary(
                (float) $costing->material_cost,
                $components,
                (float) $costing->minimum_margin_percent,
                (float) $costing->target_margin_percent,
                (float) $costing->tax_rate,
                0
            ),
            'created_at' => optional($costing->created_at)->toISOString(),
            'updated_at' => optional($costing->updated_at)->toISOString(),
        ];
    }
}
