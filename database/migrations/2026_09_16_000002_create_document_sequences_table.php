<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * يحل مشكلة ترقيم المستندات بـ max('id') + 1:
 *   - بعد أي حذف بيتولّد رقم مكرر ويضرب في قيد unique
 *   - وتحت التزامن ممكن مستخدمان ياخدا نفس الرقم
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_sequences', function (Blueprint $table) {
            $table->id();

            // journal_entry | tax_invoice | credit_note | receipt_voucher
            // payment_voucher | purchase_order | quotation | supplier_invoice
            $table->string('document_type', 50);

            $table->unsignedSmallInteger('year');

            $table->string('prefix', 20);

            $table->unsignedBigInteger('current_number')->default(0);

            $table->unsignedTinyInteger('padding')->default(6);

            $table->timestamps();

            $table->unique(['document_type', 'year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_sequences');
    }
};
