<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * منظومة الضرائب والفاتورة الإلكترونية.
 * ٤٨ حقل جدول tax_invoices مستخرجين من $fillable و$casts
 * بموديل TaxInvoice، ولقطات الكميات من TaxInvoiceController.
 *
 * مهم: لازم يجي قبل الهجرة الموجودة عندك
 *   2026_08_31_010000_add_accounting_links_to_tax_invoice_payments
 * لأنها بتضيف ٣ أعمدة على tax_invoice_payments.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_tax_profiles', function (Blueprint $table) {
            $table->id();

            $table->string('legal_name_ar');
            $table->string('legal_name_en')->nullable();

            $table->string('vat_number', 20);
            $table->string('commercial_register', 30)->nullable();

            // العنوان بالحقول اللي تطلبها الفاتورة الإلكترونية
            $table->string('building_number', 10)->nullable();
            $table->string('street_name')->nullable();
            $table->string('district')->nullable();
            $table->string('city')->nullable();
            $table->string('postal_code', 10)->nullable();
            $table->string('country_code', 2)->default('SA');
            $table->string('additional_number', 10)->nullable();

            $table->string('logo_path')->nullable();
            $table->string('currency', 3)->default('SAR');
            $table->decimal('default_tax_rate', 5, 2)->default(15);

            // بيانات شهادة زاتكا
            $table->text('zatca_certificate')->nullable();
            $table->text('zatca_private_key')->nullable();
            $table->string('zatca_csid')->nullable();
            $table->string('zatca_environment', 20)->default('sandbox');

            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index('is_default');
        });

        Schema::create('customer_tax_profiles', function (Blueprint $table) {
            $table->id();

            // المفتاح اللي TaxInvoiceController::refreshBuyer بيطابق بيه
            $table->string('customer_code', 50)->unique();

            $table->string('name');
            $table->string('name_en')->nullable();

            $table->string('vat_number', 20)->nullable();
            $table->string('commercial_register', 30)->nullable();

            $table->string('building_number', 10)->nullable();
            $table->string('street_name')->nullable();
            $table->string('district')->nullable();
            $table->string('city')->nullable();
            $table->string('postal_code', 10)->nullable();
            $table->string('country_code', 2)->default('SA');

            $table->string('phone', 30)->nullable();
            $table->string('email')->nullable();

            $table->boolean('is_active')->default(true);

            $table->timestamps();

            $table->index('vat_number');
        });

        Schema::create('tax_codes', function (Blueprint $table) {
            $table->id();

            $table->string('code', 30)->unique();
            $table->string('name');
            $table->string('name_en')->nullable();

            $table->decimal('rate', 5, 2)->default(15);

            // standard | zero_rated | exempt | out_of_scope
            $table->string('category', 20)->default('standard');

            // مطلوب زاتكويًا للإعفاء والصفري
            $table->string('exemption_reason_code', 20)->nullable();
            $table->text('exemption_reason')->nullable();

            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(true);

            $table->timestamps();
        });

        Schema::create('tax_invoices', function (Blueprint $table) {
            $table->id();

            $table->string('invoice_number', 50)->unique();
            $table->uuid('uuid')->nullable()->unique();

            // standard | simplified
            $table->string('invoice_type', 20)->default('standard');

            // tax_invoice | credit_note | debit_note
            $table->string('document_type', 20)->default('tax_invoice');

            // milestone | full | advance
            $table->string('billing_type', 20)->default('milestone');

            $table->foreignId('company_tax_profile_id')
                ->nullable()
                ->constrained('company_tax_profiles')
                ->nullOnDelete();

            $table->foreignId('project_id')
                ->nullable()
                ->constrained('projects')
                ->nullOnDelete();

            $table->foreignId('quotation_id')
                ->nullable()
                ->constrained('project_quotations')
                ->nullOnDelete();

            $table->foreignId('original_invoice_id')
                ->nullable()
                ->constrained('tax_invoices')
                ->nullOnDelete();

            $table->unsignedBigInteger('customer_id')->nullable();

            // لقطة بيانات المشتري وقت الإصدار — لا تتغيّر بعد كده
            $table->string('buyer_name')->nullable();
            $table->string('buyer_vat_number', 20)->nullable();
            $table->string('buyer_commercial_register', 30)->nullable();
            $table->string('buyer_building_number', 10)->nullable();
            $table->string('buyer_street_name')->nullable();
            $table->string('buyer_district')->nullable();
            $table->string('buyer_city')->nullable();
            $table->string('buyer_postal_code', 10)->nullable();
            $table->string('buyer_country_code', 2)->default('SA');

            $table->date('issue_date');
            $table->time('issue_time')->nullable();
            $table->date('supply_date')->nullable();
            $table->date('due_date')->nullable();

            $table->string('currency', 3)->default('SAR');

            // لقطات الفوترة المرحلية من عرض السعر
            $table->decimal('quotation_total_snapshot', 15, 2)->nullable();
            $table->decimal('invoiced_before_snapshot', 15, 2)->default(0);
            $table->decimal('remaining_before_snapshot', 15, 2)->nullable();
            $table->decimal('billing_percentage', 9, 4)->nullable();

            // المبالغ — الأسماء دي لازم تطابق مخرجات TaxInvoiceCalculator
            $table->decimal('subtotal', 15, 2)->default(0);
            $table->decimal('discount_total', 15, 2)->default(0);
            $table->decimal('taxable_amount', 15, 2)->default(0);
            $table->decimal('tax_total', 15, 2)->default(0);
            $table->decimal('total', 15, 2)->default(0);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('remaining_amount', 15, 2)->default(0);

            // unpaid | partially_paid | paid
            $table->string('payment_status', 20)->default('unpaid');

            // draft | issued | cancelled
            $table->string('status', 20)->default('draft');

            // not_submitted | pending | cleared | reported | rejected
            $table->string('zatca_status', 20)->default('not_submitted');

            $table->text('notes')->nullable();
            $table->text('terms')->nullable();
            $table->string('reference_number')->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->foreignId('issued_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamp('issued_at')->nullable();

            $table->timestamps();

            $table->index('status');
            $table->index('zatca_status');
            $table->index(['quotation_id', 'status']);
            $table->index('project_id');
            $table->index(['payment_status', 'due_date']);
        });

        Schema::create('tax_invoice_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('tax_invoice_id')
                ->constrained('tax_invoices')
                ->cascadeOnDelete();

            $table->foreignId('quotation_item_id')
                ->nullable()
                ->constrained('project_quotation_items')
                ->nullOnDelete();

            $table->foreignId('product_id')
                ->nullable()
                ->constrained('products')
                ->nullOnDelete();

            $table->foreignId('tax_code_id')
                ->nullable()
                ->constrained('tax_codes')
                ->nullOnDelete();

            $table->string('name');
            $table->text('description')->nullable();
            $table->string('unit', 30)->nullable();

            $table->decimal('quantity', 15, 4)->default(1);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->decimal('discount', 15, 2)->default(0);
            $table->decimal('taxable_amount', 15, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(15);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('line_total', 15, 2)->default(0);

            // لقطات الكميات — أساس منع الفوترة المزدوجة لكل بند
            $table->decimal('source_quantity_snapshot', 15, 4)->nullable();
            $table->decimal('previously_invoiced_quantity_snapshot', 15, 4)->nullable();
            $table->decimal('remaining_quantity_before_snapshot', 15, 4)->nullable();

            $table->unsignedInteger('sort_order')->default(0);

            $table->timestamps();

            $table->index('tax_invoice_id');
            $table->index('quotation_item_id');
        });

        Schema::create('tax_invoice_payments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('tax_invoice_id')
                ->constrained('tax_invoices')
                ->cascadeOnDelete();

            $table->foreignId('project_id')
                ->nullable()
                ->constrained('projects')
                ->nullOnDelete();

            /*
             * الأعمدة finance_account_id و receivable_account_id
             * و finance_journal_entry_id بتُضاف في الهجرة الموجودة عندك:
             * 2026_08_31_010000_add_accounting_links_to_tax_invoice_payments
             * فمتضيفهاش هنا.
             */

            $table->string('payment_number', 50)->unique();

            $table->decimal('amount', 15, 2);
            $table->date('payment_date');

            // bank_transfer | cash | card | cheque | other
            $table->string('payment_method', 50)->default('bank_transfer');

            $table->string('reference_number')->nullable();
            $table->text('notes')->nullable();

            $table->foreignId('created_by')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->timestamps();

            $table->index('tax_invoice_id');
            $table->index('payment_date');
        });

        Schema::create('zatca_documents', function (Blueprint $table) {
            $table->id();

            $table->foreignId('tax_invoice_id')
                ->constrained('tax_invoices')
                ->cascadeOnDelete();

            $table->uuid('uuid');

            // clearance | reporting
            $table->string('submission_type', 20);

            // not_generated | generated | submitted | cleared | rejected
            $table->string('status', 30)->default('not_generated');

            $table->longText('xml')->nullable();
            $table->string('invoice_hash')->nullable();
            $table->string('previous_invoice_hash')->nullable();
            $table->longText('qr_code')->nullable();
            $table->longText('signature')->nullable();

            $table->unsignedBigInteger('counter_value')->nullable();

            $table->json('response_payload')->nullable();
            $table->text('response_message')->nullable();
            $table->timestamp('submitted_at')->nullable();

            $table->timestamps();

            $table->unique('tax_invoice_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('zatca_documents');
        Schema::dropIfExists('tax_invoice_payments');
        Schema::dropIfExists('tax_invoice_items');
        Schema::dropIfExists('tax_invoices');
        Schema::dropIfExists('tax_codes');
        Schema::dropIfExists('customer_tax_profiles');
        Schema::dropIfExists('company_tax_profiles');
    }
};
