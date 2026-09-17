<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProjectFinancialTransaction;
use Illuminate\Http\Request;

class ProjectFinancialTransactionController extends Controller
{
    public function index(Request $request)
    {
        $query = ProjectFinancialTransaction::query()
            ->with([
                'project:id,project_code,name',
                'quotation:id,quotation_number,total',
                'purchaseOrder:id,po_number,total',
                'creator:id,name',
                'approver:id,name',
            ])
            ->latest('transaction_date')
            ->latest('id');

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('direction')) {
            $query->where('direction', $request->direction);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('from')) {
            $query->whereDate(
                'transaction_date',
                '>=',
                $request->from
            );
        }

        if ($request->filled('to')) {
            $query->whereDate(
                'transaction_date',
                '<=',
                $request->to
            );
        }

        if ($request->filled('search')) {
            $search = trim($request->search);

            $query->where(function ($q) use ($search) {
                $q->where(
                    'reference_number',
                    'like',
                    "%{$search}%"
                )
                    ->orWhere(
                        'title',
                        'like',
                        "%{$search}%"
                    )
                    ->orWhere(
                        'description',
                        'like',
                        "%{$search}%"
                    );
            });
        }

        $transactions = $query->get();

        return response()->json([
            'success' => true,
            'count' => $transactions->count(),
            'data' => $transactions,
        ]);
    }

    public function show(
        ProjectFinancialTransaction $financialTransaction
    ) {
        $financialTransaction->load([
            'project:id,project_code,name',
            'quotation:id,quotation_number,total',
            'purchaseOrder:id,po_number,total',
            'creator:id,name',
            'approver:id,name',
        ]);

        return response()->json([
            'success' => true,
            'data' => $financialTransaction,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateTransaction($request);

        $subtotal = round(
            (float) ($validated['subtotal'] ?? 0),
            2
        );

        $tax = round(
            (float) ($validated['tax'] ?? 0),
            2
        );

        $total = round(
            (float) (
                $validated['total']
                ?? ($subtotal + $tax)
            ),
            2
        );

        $paidAmount = round(
            (float) ($validated['paid_amount'] ?? 0),
            2
        );

        if ($paidAmount > $total) {
            return response()->json([
                'success' => false,
                'message' =>
                    'المبلغ المدفوع لا يمكن أن يكون أكبر من إجمالي المعاملة.',
            ], 422);
        }

        $remainingAmount = round(
            max($total - $paidAmount, 0),
            2
        );

        $status = $this->resolvePaymentStatus(
            $total,
            $paidAmount,
            $validated['status'] ?? null
        );

        $transaction =
            ProjectFinancialTransaction::create([
                'project_id' =>
                    $validated['project_id'],

                'type' =>
                    $validated['type'],

                'direction' =>
                    $validated['direction'],

                'reference_number' =>
                    $validated['reference_number']
                    ?? $this->generateReferenceNumber(),

                'title' =>
                    $validated['title'],

                'description' =>
                    $validated['description']
                    ?? null,

                'subtotal' =>
                    $subtotal,

                'tax' =>
                    $tax,

                'total' =>
                    $total,

                'paid_amount' =>
                    $paidAmount,

                'remaining_amount' =>
                    $remainingAmount,

                'status' =>
                    $status,

                'payment_method' =>
                    $validated['payment_method']
                    ?? null,

                'transaction_date' =>
                    $validated['transaction_date'],

                'due_date' =>
                    $validated['due_date']
                    ?? null,

                'paid_at' =>
                    $paidAmount >= $total && $total > 0
                        ? now()
                        : null,

                'quotation_id' =>
                    $validated['quotation_id']
                    ?? null,

                'purchase_order_id' =>
                    $validated['purchase_order_id']
                    ?? null,

                'created_by' =>
                    $request->user()?->id,

                'notes' =>
                    $validated['notes']
                    ?? null,
            ]);

        return response()->json([
            'success' => true,
            'message' =>
                'تم إنشاء المعاملة المالية بنجاح.',
            'data' =>
                $transaction->load([
                    'project',
                    'quotation',
                    'purchaseOrder',
                ]),
        ], 201);
    }

    public function update(
        Request $request,
        ProjectFinancialTransaction $financialTransaction
    ) {
        if ($financialTransaction->status === 'cancelled') {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن تعديل معاملة مالية ملغاة.',
            ], 422);
        }

        $validated = $this->validateTransaction(
            $request,
            true
        );

        $subtotal = round(
            (float) (
                $validated['subtotal']
                ?? $financialTransaction->subtotal
            ),
            2
        );

        $tax = round(
            (float) (
                $validated['tax']
                ?? $financialTransaction->tax
            ),
            2
        );

        $total = round(
            (float) (
                $validated['total']
                ?? ($subtotal + $tax)
            ),
            2
        );

        $paidAmount = round(
            (float) (
                $validated['paid_amount']
                ?? $financialTransaction->paid_amount
            ),
            2
        );

        if ($paidAmount > $total) {
            return response()->json([
                'success' => false,
                'message' =>
                    'المبلغ المدفوع لا يمكن أن يكون أكبر من إجمالي المعاملة.',
            ], 422);
        }

        $remainingAmount = round(
            max($total - $paidAmount, 0),
            2
        );

        $status = $this->resolvePaymentStatus(
            $total,
            $paidAmount,
            $validated['status']
                ?? $financialTransaction->status
        );

        $financialTransaction->update([
            'project_id' =>
                $validated['project_id']
                ?? $financialTransaction->project_id,

            'type' =>
                $validated['type']
                ?? $financialTransaction->type,

            'direction' =>
                $validated['direction']
                ?? $financialTransaction->direction,

            'reference_number' =>
                $validated['reference_number']
                ?? $financialTransaction->reference_number,

            'title' =>
                $validated['title']
                ?? $financialTransaction->title,

            'description' =>
                array_key_exists(
                    'description',
                    $validated
                )
                    ? $validated['description']
                    : $financialTransaction->description,

            'subtotal' =>
                $subtotal,

            'tax' =>
                $tax,

            'total' =>
                $total,

            'paid_amount' =>
                $paidAmount,

            'remaining_amount' =>
                $remainingAmount,

            'status' =>
                $status,

            'payment_method' =>
                array_key_exists(
                    'payment_method',
                    $validated
                )
                    ? $validated['payment_method']
                    : $financialTransaction->payment_method,

            'transaction_date' =>
                $validated['transaction_date']
                ?? $financialTransaction->transaction_date,

            'due_date' =>
                array_key_exists(
                    'due_date',
                    $validated
                )
                    ? $validated['due_date']
                    : $financialTransaction->due_date,

            'paid_at' =>
                $paidAmount >= $total && $total > 0
                    ? ($financialTransaction->paid_at ?? now())
                    : null,

            'quotation_id' =>
                array_key_exists(
                    'quotation_id',
                    $validated
                )
                    ? $validated['quotation_id']
                    : $financialTransaction->quotation_id,

            'purchase_order_id' =>
                array_key_exists(
                    'purchase_order_id',
                    $validated
                )
                    ? $validated['purchase_order_id']
                    : $financialTransaction->purchase_order_id,

            'notes' =>
                array_key_exists(
                    'notes',
                    $validated
                )
                    ? $validated['notes']
                    : $financialTransaction->notes,
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'تم تحديث المعاملة المالية بنجاح.',
            'data' =>
                $financialTransaction
                    ->fresh()
                    ->load([
                        'project',
                        'quotation',
                        'purchaseOrder',
                    ]),
        ]);
    }

    public function recordPayment(
        Request $request,
        ProjectFinancialTransaction $financialTransaction
    ) {
        if ($financialTransaction->status === 'cancelled') {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن تسجيل دفعة على معاملة ملغاة.',
            ], 422);
        }

        if ($financialTransaction->status === 'paid') {
            return response()->json([
                'success' => false,
                'message' =>
                    'المعاملة مدفوعة بالكامل بالفعل.',
            ], 422);
        }

        $validated = $request->validate([
            'amount' => [
                'required',
                'numeric',
                'gt:0',
            ],

            'payment_method' => [
                'nullable',
                'string',
                'max:50',
            ],

            'paid_at' => [
                'nullable',
                'date',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:5000',
            ],
        ]);

        $amount = round(
            (float) $validated['amount'],
            2
        );

        $remainingBefore =
            (float) $financialTransaction
                ->remaining_amount;

        if ($amount > $remainingBefore) {
            return response()->json([
                'success' => false,
                'message' =>
                    'قيمة الدفعة أكبر من المبلغ المتبقي.',
            ], 422);
        }

        $newPaid = round(
            (float) $financialTransaction->paid_amount
            + $amount,
            2
        );

        $newRemaining = round(
            max(
                (float) $financialTransaction->total
                - $newPaid,
                0
            ),
            2
        );

        $newStatus =
            $newRemaining <= 0
                ? 'paid'
                : 'partially_paid';

        $financialTransaction->update([
            'paid_amount' =>
                $newPaid,

            'remaining_amount' =>
                $newRemaining,

            'status' =>
                $newStatus,

            'payment_method' =>
                $validated['payment_method']
                ?? $financialTransaction
                    ->payment_method,

            'paid_at' =>
                $newStatus === 'paid'
                    ? (
                        $validated['paid_at']
                        ?? now()
                    )
                    : $financialTransaction
                        ->paid_at,

            'notes' =>
                $this->appendPaymentNote(
                    $financialTransaction->notes,
                    $amount,
                    $validated['notes']
                        ?? null
                ),
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'تم تسجيل الدفعة بنجاح.',
            'data' =>
                $financialTransaction->fresh(),
        ]);
    }

    public function approve(
        Request $request,
        ProjectFinancialTransaction $financialTransaction
    ) {
        if (
            !in_array(
                $financialTransaction->status,
                [
                    'draft',
                    'pending',
                    'overdue',
                    'partially_paid',
                ],
                true
            )
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن اعتماد المعاملة في حالتها الحالية.',
            ], 422);
        }

        $financialTransaction->update([
            'approved_by' =>
                $request->user()?->id,

            'approved_at' =>
                now(),

            'status' =>
                $financialTransaction->status === 'draft'
                    ? 'pending'
                    : $financialTransaction->status,
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'تم اعتماد المعاملة المالية.',
            'data' =>
                $financialTransaction->fresh(),
        ]);
    }

    public function cancel(
        ProjectFinancialTransaction $financialTransaction
    ) {
        if ($financialTransaction->status === 'paid') {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن إلغاء معاملة مدفوعة بالكامل.',
            ], 422);
        }

        if ($financialTransaction->status === 'cancelled') {
            return response()->json([
                'success' => false,
                'message' =>
                    'المعاملة ملغاة بالفعل.',
            ], 422);
        }

        $financialTransaction->update([
            'status' => 'cancelled',
        ]);

        return response()->json([
            'success' => true,
            'message' =>
                'تم إلغاء المعاملة المالية.',
            'data' =>
                $financialTransaction->fresh(),
        ]);
    }

    public function destroy(
        ProjectFinancialTransaction $financialTransaction
    ) {
        if (
            !in_array(
                $financialTransaction->status,
                ['draft', 'cancelled'],
                true
            )
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'يمكن حذف المسودات أو المعاملات الملغاة فقط.',
            ], 422);
        }

        $financialTransaction->delete();

        return response()->json([
            'success' => true,
            'message' =>
                'تم حذف المعاملة المالية بنجاح.',
        ]);
    }

    private function validateTransaction(
        Request $request,
        bool $partial = false
    ): array {
        $required =
            $partial
                ? 'sometimes'
                : 'required';

        return $request->validate([
            'project_id' => [
                $required,
                'integer',
                'exists:projects,id',
            ],

            'type' => [
                $required,
                'string',
                'max:50',
            ],

            'direction' => [
                $required,
                'in:income,expense',
            ],

            'reference_number' => [
                'nullable',
                'string',
                'max:100',
            ],

            'title' => [
                $required,
                'string',
                'max:255',
            ],

            'description' => [
                'nullable',
                'string',
                'max:5000',
            ],

            'subtotal' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'tax' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'total' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'paid_amount' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'status' => [
                'nullable',
                'in:draft,pending,partially_paid,paid,overdue,cancelled',
            ],

            'payment_method' => [
                'nullable',
                'in:cash,bank_transfer,card,cheque,other',
            ],

            'transaction_date' => [
                $required,
                'date',
            ],

            'due_date' => [
                'nullable',
                'date',
            ],

            'quotation_id' => [
                'nullable',
                'integer',
                'exists:project_quotations,id',
            ],

            'purchase_order_id' => [
                'nullable',
                'integer',
                'exists:purchase_orders,id',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:5000',
            ],
        ]);
    }

    private function resolvePaymentStatus(
        float $total,
        float $paidAmount,
        ?string $requestedStatus
    ): string {
        if ($requestedStatus === 'cancelled') {
            return 'cancelled';
        }

        if ($total > 0 && $paidAmount >= $total) {
            return 'paid';
        }

        if ($paidAmount > 0) {
            return 'partially_paid';
        }

        return $requestedStatus
            ?? 'draft';
    }

    private function generateReferenceNumber(): string
    {
        $lastId =
            ProjectFinancialTransaction::query()
                ->max('id') ?? 0;

        return
            'FT-' .
            now()->format('Y') .
            '-' .
            str_pad(
                $lastId + 1,
                6,
                '0',
                STR_PAD_LEFT
            );
    }

    private function appendPaymentNote(
        ?string $existingNotes,
        float $amount,
        ?string $paymentNote
    ): string {
        $line =
            'دفعة مسجلة بقيمة ' .
            number_format(
                $amount,
                2,
                '.',
                ''
            );

        if ($paymentNote) {
            $line .=
                ' - ' .
                trim($paymentNote);
        }

        return trim(
            ($existingNotes
                ? $existingNotes . "\n"
                : '') .
            $line
        );
    }
}