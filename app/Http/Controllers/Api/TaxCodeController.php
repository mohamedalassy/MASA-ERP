<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TaxCode;
use Illuminate\Validation\Rule;
use Illuminate\Http\Request;

class TaxCodeController extends Controller
{
    public function index(Request $request)
    {
        $query = TaxCode::query();

        if ($request->boolean('active')) {
            $query->where('is_active', true);
        }

        return response()->json([
            'success' => true,
            'data' => $query
                ->orderByDesc('is_default')
                ->orderBy('code')
                ->get(),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $code = TaxCode::create($validated);

        if (!empty($validated['is_default'])) {
            $this->makeDefault($code);
        }

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء كود الضريبة بنجاح.',
            'data' => $code->fresh(),
        ], 201);
    }

    public function update(Request $request, TaxCode $taxCode)
    {
        $validated = $this->validatePayload($request, $taxCode->id);

        $taxCode->update($validated);

        if (!empty($validated['is_default'])) {
            $this->makeDefault($taxCode);
        }

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث كود الضريبة بنجاح.',
            'data' => $taxCode->fresh(),
        ]);
    }

    private function makeDefault(TaxCode $code): void
    {
        TaxCode::query()
            ->whereKeyNot($code->id)
            ->update(['is_default' => false]);

        $code->update(['is_default' => true]);
    }

    private function validatePayload(
        Request $request,
        ?int $ignoreId = null
    ): array {
        return $request->validate([
            'code' => [
                'required',
                'string',
                'max:30',
                Rule::unique('tax_codes', 'code')->ignore($ignoreId),
            ],

            'name' => ['required', 'string', 'max:255'],
            'name_en' => ['nullable', 'string', 'max:255'],

            'rate' => ['required', 'numeric', 'min:0', 'max:100'],

            'category' => [
                'required',
                'in:standard,zero_rated,exempt,out_of_scope',
            ],

            /*
             * زاتكا بتطلب سبب إعفاء مع الصفري والمعفى وخارج النطاق.
             * والنسبة لازم تكون صفرًا في الحالات دي.
             */
            'exemption_reason_code' => [
                'nullable',
                'required_unless:category,standard',
                'string',
                'max:20',
            ],

            'exemption_reason' => [
                'nullable',
                'required_unless:category,standard',
                'string',
                'max:1000',
            ],

            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ], [
            'exemption_reason_code.required_unless' =>
                'سبب الإعفاء مطلوب للأكواد الصفرية والمعفاة وخارج النطاق.',
            'exemption_reason.required_unless' =>
                'نص سبب الإعفاء مطلوب للأكواد الصفرية والمعفاة وخارج النطاق.',
        ]);
    }
}
