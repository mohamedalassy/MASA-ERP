<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CustomerTaxProfile;
use Illuminate\Validation\Rule;
use Illuminate\Http\Request;

class CustomerTaxProfileController extends Controller
{
    public function index(Request $request)
    {
        $query = CustomerTaxProfile::query();

        if ($request->filled('search')) {
            $search = trim($request->search);

            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%")
                    ->orWhere('vat_number', 'like', "%{$search}%");
            });
        }

        if ($request->filled('is_active')) {
            $query->where(
                'is_active',
                filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN)
            );
        }

        $rows = $query->orderBy('name')->get()->map(fn ($profile) => [
            ...$profile->toArray(),
            'is_complete' => $profile->isComplete(),
        ]);

        // فلتر البيانات الناقصة — الشاشة بتعرضه كتبويب
        if ($request->boolean('incomplete_only')) {
            $rows = $rows->where('is_complete', false)->values();
        }

        return response()->json([
            'success' => true,
            'count' => $rows->count(),
            'incomplete_count' => $rows->where('is_complete', false)->count(),
            'data' => $rows,
        ]);
    }

    public function show(CustomerTaxProfile $customerTaxProfile)
    {
        return response()->json([
            'success' => true,
            'data' => [
                ...$customerTaxProfile->toArray(),
                'is_complete' => $customerTaxProfile->isComplete(),
            ],
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $profile = CustomerTaxProfile::create($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الملف الضريبي للعميل بنجاح.',
            'data' => $profile,
        ], 201);
    }

    public function update(
        Request $request,
        CustomerTaxProfile $customerTaxProfile
    ) {
        $validated = $this->validatePayload(
            $request,
            $customerTaxProfile->id
        );

        $customerTaxProfile->update($validated);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث بيانات العميل الضريبية بنجاح.',
            'data' => $customerTaxProfile->fresh(),
        ]);
    }

    private function validatePayload(
        Request $request,
        ?int $ignoreId = null
    ): array {
        return $request->validate([
            'customer_code' => [
                'required',
                'string',
                'max:50',
                Rule::unique('customer_tax_profiles', 'customer_code')
                    ->ignore($ignoreId),
            ],

            'name' => ['required', 'string', 'max:255'],
            'name_en' => ['nullable', 'string', 'max:255'],

            /*
             * الرقم الضريبي للمشتري اختياري — الأفراد والجهات غير
             * المسجّلة ضريبيًا ليس لهم رقم، والفاتورة تبقى صحيحة بدونه.
             */
            'vat_number' => [
                'nullable',
                'string',
                'size:15',
                'regex:/^3\d{13}3$/',
            ],

            'commercial_register' => ['nullable', 'string', 'max:30'],

            'building_number' => ['nullable', 'string', 'size:4'],
            'street_name' => ['nullable', 'string', 'max:255'],
            'district' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'size:5'],
            'country_code' => ['nullable', 'string', 'size:2'],

            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],

            'is_active' => ['nullable', 'boolean'],
        ], [
            'vat_number.regex' =>
                'الرقم الضريبي يجب أن يكون 15 رقمًا يبدأ وينتهي بالرقم 3.',
        ]);
    }
}
