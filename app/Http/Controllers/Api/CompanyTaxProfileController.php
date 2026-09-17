<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanyTaxProfile;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;

class CompanyTaxProfileController extends Controller
{
    public function index()
    {
        $profiles = CompanyTaxProfile::query()
            ->orderByDesc('is_default')
            ->orderBy('legal_name_ar')
            ->get()
            ->map(function ($profile) {
                $missing = $profile->missingRequiredFields();

                return [
                    ...$profile->toArray(),
                    'missing_fields' => $missing,
                    'is_complete' => empty($missing),
                    'is_zatca_ready' => $profile->isZatcaReady(),
                ];
            });

        return response()->json([
            'success' => true,
            'count' => $profiles->count(),
            'data' => $profiles,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $profile = DB::transaction(function () use ($validated) {
            $profile = CompanyTaxProfile::create($validated);

            if (!empty($validated['is_default'])) {
                $this->makeDefault($profile);
            }

            return $profile;
        });

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الملف الضريبي للشركة بنجاح.',
            'data' => $profile->fresh(),
        ], 201);
    }

    public function update(
        Request $request,
        CompanyTaxProfile $companyTaxProfile
    ) {
        $validated = $this->validatePayload(
            $request,
            $companyTaxProfile->id
        );

        DB::transaction(function () use ($validated, $companyTaxProfile) {
            $companyTaxProfile->update($validated);

            if (!empty($validated['is_default'])) {
                $this->makeDefault($companyTaxProfile);
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الملف الضريبي بنجاح.',
            'data' => $companyTaxProfile->fresh(),
        ]);
    }

    /** ملف افتراضي واحد فقط. */
    private function makeDefault(CompanyTaxProfile $profile): void
    {
        CompanyTaxProfile::query()
            ->whereKeyNot($profile->id)
            ->update(['is_default' => false]);

        $profile->update(['is_default' => true]);
    }

    private function validatePayload(
        Request $request,
        ?int $ignoreId = null
    ): array {
        return $request->validate([
            'legal_name_ar' => ['required', 'string', 'max:255'],
            'legal_name_en' => ['nullable', 'string', 'max:255'],

            'vat_number' => [
                'required',
                'string',
                'size:15',
                // الرقم الضريبي السعودي: 15 رقمًا يبدأ وينتهي بـ 3
                'regex:/^3\d{13}3$/',
            ],

            'commercial_register' => ['nullable', 'string', 'max:30'],

            'building_number' => ['required', 'string', 'size:4'],
            'street_name' => ['required', 'string', 'max:255'],
            'district' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'postal_code' => ['required', 'string', 'size:5'],
            'country_code' => ['nullable', 'string', 'size:2'],
            'additional_number' => ['nullable', 'string', 'size:4'],

            'logo_path' => ['nullable', 'string', 'max:255'],
            'currency' => ['nullable', 'string', 'size:3'],
            'default_tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],

            'zatca_certificate' => ['nullable', 'string'],
            'zatca_private_key' => ['nullable', 'string'],
            'zatca_csid' => ['nullable', 'string', 'max:255'],
            'zatca_environment' => [
                'nullable',
                'in:sandbox,simulation,production',
            ],

            'is_default' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ], [
            'vat_number.regex' =>
                'الرقم الضريبي يجب أن يكون 15 رقمًا يبدأ وينتهي بالرقم 3.',
            'building_number.size' => 'رقم المبنى يجب أن يكون 4 أرقام.',
            'postal_code.size' => 'الرمز البريدي يجب أن يكون 5 أرقام.',
        ]);
    }
}
