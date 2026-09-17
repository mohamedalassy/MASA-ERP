<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CompanyTaxProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'legal_name_ar', 'legal_name_en', 'vat_number', 'commercial_register',
        'building_number', 'street_name', 'district', 'city',
        'postal_code', 'country_code', 'additional_number',
        'logo_path', 'currency', 'default_tax_rate',
        'zatca_certificate', 'zatca_private_key', 'zatca_csid',
        'zatca_environment', 'is_default', 'is_active',
    ];

    protected $casts = [
        'default_tax_rate' => 'decimal:2',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];

    /** إخفاء بيانات التوقيع من أي ردّ JSON. */
    protected $hidden = ['zatca_private_key', 'zatca_certificate'];

    public function invoices(): HasMany
    {
        return $this->hasMany(TaxInvoice::class, 'company_tax_profile_id');
    }

    public static function default(): ?self
    {
        return self::where('is_default', true)
            ->where('is_active', true)
            ->first();
    }

    /** جاهزية الإصدار — الحقول اللي بدونها الفاتورة ترفض. */
    public function missingRequiredFields(): array
    {
        $required = [
            'legal_name_ar' => 'الاسم القانوني',
            'vat_number' => 'الرقم الضريبي',
            'building_number' => 'رقم المبنى',
            'street_name' => 'الشارع',
            'district' => 'الحي',
            'city' => 'المدينة',
            'postal_code' => 'الرمز البريدي',
        ];

        $missing = [];

        foreach ($required as $field => $label) {
            if (blank($this->{$field})) {
                $missing[] = $label;
            }
        }

        return $missing;
    }

    public function isZatcaReady(): bool
    {
        return empty($this->missingRequiredFields())
            && filled($this->zatca_csid);
    }
}
