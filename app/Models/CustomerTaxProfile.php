<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomerTaxProfile extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_code', 'name', 'name_en', 'vat_number',
        'commercial_register', 'building_number', 'street_name',
        'district', 'city', 'postal_code', 'country_code',
        'phone', 'email', 'is_active',
    ];

    protected $casts = ['is_active' => 'boolean'];

    /** TaxInvoiceController::refreshBuyer بيطابق بكود العميل. */
    public static function findByCustomerCode(?string $code): ?self
    {
        if (blank($code)) {
            return null;
        }

        return self::where('customer_code', trim($code))
            ->where('is_active', true)
            ->first();
    }

    /** لقطة بيانات المشتري كما تُحفظ على الفاتورة. */
    public function toBuyerSnapshot(): array
    {
        return [
            'buyer_name' => $this->name,
            'buyer_vat_number' => $this->vat_number,
            'buyer_commercial_register' => $this->commercial_register,
            'buyer_building_number' => $this->building_number,
            'buyer_street_name' => $this->street_name,
            'buyer_district' => $this->district,
            'buyer_city' => $this->city,
            'buyer_postal_code' => $this->postal_code,
            'buyer_country_code' => $this->country_code ?: 'SA',
        ];
    }

    public function isComplete(): bool
    {
        return filled($this->vat_number)
            && filled($this->building_number)
            && filled($this->street_name)
            && filled($this->district)
            && filled($this->city)
            && filled($this->postal_code);
    }
}
