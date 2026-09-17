<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\ProjectQuotation;
use App\Models\QuotationApprovalHistory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectQuotationController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | List All Quotations In System
    |--------------------------------------------------------------------------
    */
    public function all(Request $request)
    {
        $query = ProjectQuotation::query()
            ->with([
                'project',
                'creator',
                'approver',
                'items.product',
                'approvalHistories.actor',
            ])
            ->orderByDesc('created_at')
            ->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        if ($request->filled('version')) {
            $query->where('version', $request->version);
        }

        if ($request->filled('search')) {
            $search = trim((string) $request->search);

            $query->where(function ($quotationQuery) use ($search) {
                $quotationQuery
                    ->where(
                        'quotation_number',
                        'like',
                        "%{$search}%"
                    )
                    ->orWhereHas(
                        'project',
                        function ($projectQuery) use ($search) {
                            $projectQuery
                                ->where(
                                    'name',
                                    'like',
                                    "%{$search}%"
                                )
                                ->orWhere(
                                    'project_code',
                                    'like',
                                    "%{$search}%"
                                )
                                ->orWhere(
                                    'customer_name',
                                    'like',
                                    "%{$search}%"
                                )
                                ->orWhere(
                                    'customer_code',
                                    'like',
                                    "%{$search}%"
                                );
                        }
                    );
            });
        }

        $quotations = $query->get();

        return response()->json([
            'success' => true,
            'count' => $quotations->count(),
            'data' => $quotations,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | List Project Quotations
    |--------------------------------------------------------------------------
    */
    public function index(Project $project)
    {
        $quotations = ProjectQuotation::query()
            ->where('project_id', $project->id)
            ->with(['items.product', 'creator', 'approver', 'approvalHistories.actor'])
            ->orderByDesc('version')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $quotations,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Show One Quotation
    |--------------------------------------------------------------------------
    */
    public function show(Project $project, ProjectQuotation $quotation)
    {
        if ((int) $quotation->project_id !== (int) $project->id) {
            return response()->json([
                'success' => false,
                'message' => 'عرض السعر لا يخص هذا المشروع.',
            ], 404);
        }

        $quotation->load([
            'items.product',
            'creator',
            'approver',
            'approvalHistories.actor',
        ]);

        return response()->json([
            'success' => true,
            'data' => $quotation,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Create First Quotation - V1
    |--------------------------------------------------------------------------
    */
    public function store(Request $request, Project $project)
    {
        if ($project->current_stage !== 'pricing') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن إنشاء عرض السعر عندما يكون المشروع في قسم التسعير فقط.',
            ], 422);
        }

        $alreadyExists = ProjectQuotation::query()
            ->where('project_id', $project->id)
            ->exists();

        if ($alreadyExists) {
            return response()->json([
                'success' => false,
                'message' => 'يوجد عرض سعر لهذا المشروع بالفعل. استخدم إنشاء Revision جديد.',
            ], 422);
        }

        $validated = $this->validateQuotationPayload($request);

        $quotation = DB::transaction(function () use (
            $request,
            $project,
            $validated
        ) {
            $version = 1;

            $quotationNumber = sprintf(
                'QT-%s-%05d',
                now()->format('Y'),
                $project->id
            );

            $quotation = ProjectQuotation::create([
                'project_id' => $project->id,
                'quotation_number' => $quotationNumber,
                'status' => 'draft',
                'subtotal' => 0,
                'discount' => (float) ($validated['discount'] ?? 0),
                'tax' => 0,
                'total' => 0,
                'version' => $version,
                'parent_quotation_id' => null,
                'revision_reason' => null,
                'valid_until' => $validated['valid_until'] ?? null,
                'created_by' => $request->user()?->id,
                'approved_by' => null,
                'approved_at' => null,
                'notes' => $validated['notes'] ?? null,
                'target_margin' => (float) ($validated['target_margin'] ?? 25),
                'header_tax_rate' => (float) ($validated['header_tax_rate'] ?? 15),
                'extra_costs' => $validated['extra_costs'] ?? [],
                'commercial_terms' => $validated['commercial_terms'] ?? [],
            ]);

            $totals = $this->replaceQuotationItems(
                $quotation,
                $validated['items']
            );

            $headerDiscount = (float) ($validated['discount'] ?? 0);

            $quotation->update([
                'subtotal' => $totals['subtotal'],
                'discount' => $headerDiscount,
                'tax' => $totals['tax'],
                'total' => max(
                    $totals['subtotal']
                    - $headerDiscount
                    + $totals['tax'],
                    0
                ),
            ]);

            return $quotation;
        });

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء عرض السعر V1 بنجاح.',
            'data' => $quotation->fresh()->load('items.product'),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Update Draft Quotation
    |--------------------------------------------------------------------------
    */
    public function update(
        Request $request,
        Project $project,
        ProjectQuotation $quotation
    ) {
        if ((int) $quotation->project_id !== (int) $project->id) {
            return response()->json([
                'success' => false,
                'message' => 'عرض السعر لا يخص هذا المشروع.',
            ], 404);
        }

        if ($project->current_stage !== 'pricing') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن تعديل عرض السعر من قسم التسعير فقط.',
            ], 422);
        }

        if ($quotation->status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن تعديل عرض السعر عندما تكون حالته مسودة فقط.',
            ], 422);
        }

        $validated = $this->validateQuotationPayload($request);

        DB::transaction(function () use (
            $quotation,
            $validated
        ) {
            $quotation->items()->delete();

            $totals = $this->replaceQuotationItems(
                $quotation,
                $validated['items']
            );

            $headerDiscount = (float) ($validated['discount'] ?? 0);

            $quotation->update([
                'subtotal' => $totals['subtotal'],
                'discount' => $headerDiscount,
                'tax' => $totals['tax'],
                'total' => max(
                    $totals['subtotal']
                    - $headerDiscount
                    + $totals['tax'],
                    0
                ),
                'valid_until' =>
                    $validated['valid_until']
                    ?? $quotation->valid_until,
                'notes' =>
                    $validated['notes']
                    ?? $quotation->notes,
                'target_margin' =>
                    (float) ($validated['target_margin']
                    ?? $quotation->target_margin
                    ?? 25),
                'header_tax_rate' =>
                    (float) ($validated['header_tax_rate']
                    ?? $quotation->header_tax_rate
                    ?? 15),
                'extra_costs' =>
                    $validated['extra_costs']
                    ?? $quotation->extra_costs
                    ?? [],
                'commercial_terms' =>
                    $validated['commercial_terms']
                    ?? $quotation->commercial_terms
                    ?? [],
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث عرض السعر بنجاح.',
            'data' => $quotation->fresh()->load('items.product'),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Create Revision
    |--------------------------------------------------------------------------
    */
    public function createRevision(
        Request $request,
        Project $project,
        ProjectQuotation $quotation
    ) {
        if ((int) $quotation->project_id !== (int) $project->id) {
            return response()->json([
                'success' => false,
                'message' => 'عرض السعر لا يخص هذا المشروع.',
            ], 404);
        }

        if ($project->current_stage !== 'pricing') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن إنشاء Revision عندما يكون المشروع في قسم التسعير فقط.',
            ], 422);
        }

        /*
         * لا نسمح بإنشاء Revision عشوائي.
         * يجب أن يكون المشروع قد رجع رسميًا للتسعير.
         */
        if (!$project->quotation_revision_required) {
            return response()->json([
                'success' => false,
                'message' => 'لا يوجد طلب Revision مفتوح لهذا المشروع.',
            ], 422);
        }

        /*
         * الـRevision يجب أن يبدأ من أحدث عرض معتمد.
         */
        $latestApprovedQuotation = ProjectQuotation::query()
            ->where('project_id', $project->id)
            ->where('status', 'approved')
            ->orderByDesc('version')
            ->orderByDesc('id')
            ->first();

        if (!$latestApprovedQuotation) {
            return response()->json([
                'success' => false,
                'message' => 'لا يوجد عرض سعر معتمد يمكن إنشاء Revision منه.',
            ], 422);
        }

        if ((int) $quotation->id !== (int) $latestApprovedQuotation->id) {
            return response()->json([
                'success' => false,
                'message' => 'يجب إنشاء Revision من أحدث عرض سعر معتمد.',
            ], 422);
        }

        /*
         * لو فيه Draft موجود بالفعل، لا ننشئ نسخة إضافية.
         */
        $openDraft = ProjectQuotation::query()
            ->where('project_id', $project->id)
            ->where('status', 'draft')
            ->orderByDesc('version')
            ->first();

        if ($openDraft) {
            return response()->json([
                'success' => false,
                'message' => "يوجد Revision مفتوح بالفعل: V{$openDraft->version}.",
                'data' => $openDraft->load('items.product'),
            ], 422);
        }

        $newQuotation = DB::transaction(function () use (
            $request,
            $project,
            $latestApprovedQuotation
        ) {
            $latestApprovedQuotation->load('items');

            $latestVersion = (int) ProjectQuotation::query()
                ->where('project_id', $project->id)
                ->max('version');

            $newVersion = max(
                $latestVersion + 1,
                ((int) $latestApprovedQuotation->version) + 1
            );

            $baseNumber = preg_replace(
                '/-V\d+$/i',
                '',
                (string) $latestApprovedQuotation->quotation_number
            );

            $revisionReason =
                $project->quotation_revision_reason
                ?: 'تعديل مطلوب بعد رجوع المشروع للتسعير';

            $newQuotation = ProjectQuotation::create([
                'project_id' => $project->id,
                'quotation_number' => "{$baseNumber}-V{$newVersion}",
                'status' => 'draft',

                'subtotal' => $latestApprovedQuotation->subtotal,
                'discount' => $latestApprovedQuotation->discount,
                'tax' => $latestApprovedQuotation->tax,
                'total' => $latestApprovedQuotation->total,

                'version' => $newVersion,
                'parent_quotation_id' => $latestApprovedQuotation->id,
                'revision_reason' => $revisionReason,

                'valid_until' => $latestApprovedQuotation->valid_until,

                'created_by' => $request->user()?->id,
                'approved_by' => null,
                'approved_at' => null,

                'notes' => $latestApprovedQuotation->notes,
                'target_margin' => $latestApprovedQuotation->target_margin ?? 25,
                'header_tax_rate' => $latestApprovedQuotation->header_tax_rate ?? 15,
                'extra_costs' => $latestApprovedQuotation->extra_costs ?? [],
                'commercial_terms' => array_merge(
                    [
                        'customer_rfq' => '',
                        'prepared_by' => '',
                        'payment_terms' => 'حسب الاتفاق المعتمد مع العميل',
                        'delivery_period' => 'يتم تحديدها حسب توفر المواد وبعد اعتماد الطلب',
                        'execution_period' => 'يتم تحديدها حسب نطاق الأعمال والكميات وموقع المشروع',
                        'warranty' => 'حسب شروط الضمان الخاصة بالمنتجات والأعمال المقدمة',
                        'custom_terms' => '',
                    ],
                    is_array($latestApprovedQuotation->commercial_terms)
                        ? $latestApprovedQuotation->commercial_terms
                        : []
                ),
            ]);

            foreach ($latestApprovedQuotation->items as $item) {
                $newQuotation->items()->create([
                    'product_id' => $item->product_id,
                    'supplier_id' => $item->supplier_id,
                    'supplier_price_id' => $item->supplier_price_id,
                    'supplier_name_snapshot' => $item->supplier_name_snapshot,
                    'supplier_cost_snapshot' => $item->supplier_cost_snapshot,
                    'supplier_lead_time_snapshot' => $item->supplier_lead_time_snapshot,
                    'supplier_valid_until_snapshot' => $item->supplier_valid_until_snapshot,
                    'product_name' => $item->product_name,
                    'sku' => $item->sku,
                    'description' => $item->description,
                    'unit' => $item->unit,
                    'section' => $item->section,
                    'item_type' => $item->item_type,
                    'quantity' => $item->quantity,
                    'cost_price' => $item->cost_price,
                    'unit_price' => $item->unit_price,
                    'discount' => $item->discount,
                    'tax_rate' => $item->tax_rate,
                    'tax_amount' => $item->tax_amount,
                    'line_total' => $item->line_total,
                    'profit_amount' => $item->profit_amount,
                    'profit_margin' => $item->profit_margin,
                    'sort_order' => $item->sort_order,
                ]);
            }

            /*
             * الطلب تم استهلاكه بمجرد إنشاء Revision واحد.
             */
            $project->update([
                'quotation_revision_required' => false,
                'quotation_revision_reason' => null,
                'quotation_revision_requested_at' => null,
            ]);

            return $newQuotation;
        });

        return response()->json([
            'success' => true,
            'message' =>
                "تم إنشاء Revision V{$newQuotation->version} من آخر عرض معتمد بنجاح.",
            'data' =>
                $newQuotation->fresh()->load('items.product'),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | Submit Draft For Approval
    |--------------------------------------------------------------------------
    */
    public function submitForApproval(
        Request $request,
        Project $project,
        ProjectQuotation $quotation
    ) {
        if ((int) $quotation->project_id !== (int) $project->id) {
            return response()->json([
                'success' => false,
                'message' => 'عرض السعر لا يخص هذا المشروع.',
            ], 404);
        }

        if ($project->current_stage !== 'pricing') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن إرسال عرض السعر للموافقة من قسم التسعير فقط.',
            ], 422);
        }

        if ($quotation->status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن إرسال المسودة فقط للموافقة.',
            ], 422);
        }

        if (!$quotation->items()->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن إرسال عرض سعر بدون بنود.',
            ], 422);
        }

        $fromStatus = $quotation->status;

        $quotation->update([
            'status' => 'pending_approval',
        ]);

        $this->logApprovalAction(
            $request,
            $project,
            $quotation,
            'submitted',
            $fromStatus,
            'pending_approval',
            $request->input('reason')
        );

        return response()->json([
            'success' => true,
            'message' => "تم إرسال عرض السعر V{$quotation->version} للموافقة.",
            'data' => $quotation->fresh()->load('items.product'),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Request Changes
    |--------------------------------------------------------------------------
    */
    public function requestChanges(
        Request $request,
        Project $project,
        ProjectQuotation $quotation
    ) {
        if ((int) $quotation->project_id !== (int) $project->id) {
            return response()->json([
                'success' => false,
                'message' => 'عرض السعر لا يخص هذا المشروع.',
            ], 404);
        }

        if ($project->current_stage !== 'pricing') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن طلب تعديل عرض السعر من قسم التسعير فقط.',
            ], 422);
        }

        if ($quotation->status !== 'pending_approval') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن طلب تعديل عرض سعر بانتظار الموافقة فقط.',
            ], 422);
        }

        $validated = $request->validate([
            'reason' => [
                'nullable',
                'string',
                'max:2000',
            ],
        ]);

        $fromStatus = $quotation->status;
        $reason = $validated['reason'] ?? 'تم طلب تعديل قبل الاعتماد.';

        $quotation->update([
            'status' => 'draft',
            'revision_reason' => $reason,
            'approved_by' => null,
            'approved_at' => null,
        ]);

        $this->logApprovalAction(
            $request,
            $project,
            $quotation,
            'changes_requested',
            $fromStatus,
            'draft',
            $reason
        );

        return response()->json([
            'success' => true,
            'message' => "تم إرجاع عرض السعر V{$quotation->version} للتعديل.",
            'data' => $quotation->fresh()->load('items.product'),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Approve Quotation
    |--------------------------------------------------------------------------
    */
    public function approve(
        Request $request,
        Project $project,
        ProjectQuotation $quotation
    ) {
        if ((int) $quotation->project_id !== (int) $project->id) {
            return response()->json([
                'success' => false,
                'message' => 'عرض السعر لا يخص هذا المشروع.',
            ], 404);
        }

        if ($project->current_stage !== 'pricing') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن اعتماد عرض السعر من قسم التسعير فقط.',
            ], 422);
        }

        if ($quotation->status === 'approved') {
            return response()->json([
                'success' => true,
                'message' => 'عرض السعر معتمد بالفعل.',
                'data' => $quotation->fresh()->load('items.product'),
            ]);
        }

        if (!in_array($quotation->status, ['draft', 'pending_approval'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'حالة عرض السعر الحالية لا تسمح بالاعتماد.',
            ], 422);
        }

        DB::transaction(function () use (
            $request,
            $project,
            $quotation
        ) {
            /*
             * أي إصدار قديم يظل محفوظًا.
             * لا نحذفه ولا نغير بياناته المالية.
             */
            $quotation->update([
                'status' => 'approved',
                'approved_by' => $request->user()?->id,
                'approved_at' => now(),
            ]);

            /*
             * قيمة المشروع تتبع آخر عرض معتمد.
             */
            $project->update([
                'total_value' => $quotation->total,
            ]);

            $this->logApprovalAction(
                $request,
                $project,
                $quotation,
                'approved',
                $quotation->getOriginal('status') ?: 'pending_approval',
                'approved',
                $request->input('reason')
            );
        });

        return response()->json([
            'success' => true,
            'message' =>
                "تم اعتماد عرض السعر V{$quotation->version} بنجاح.",
            'data' =>
                $quotation->fresh()->load('items.product'),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Reject Quotation
    |--------------------------------------------------------------------------
    */
    public function reject(
        Request $request,
        Project $project,
        ProjectQuotation $quotation
    ) {
        if ((int) $quotation->project_id !== (int) $project->id) {
            return response()->json([
                'success' => false,
                'message' => 'عرض السعر لا يخص هذا المشروع.',
            ], 404);
        }

        if ($project->current_stage !== 'pricing') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن رفض عرض السعر من قسم التسعير فقط.',
            ], 422);
        }

        if ($quotation->status !== 'pending_approval') {
            return response()->json([
                'success' => false,
                'message' => 'يمكن رفض عرض سعر بانتظار الموافقة فقط.',
            ], 422);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $fromStatus = $quotation->status;

        $quotation->update([
            'status' => 'rejected',
            'revision_reason' => $validated['reason'],
            'approved_by' => null,
            'approved_at' => null,
        ]);

        $this->logApprovalAction(
            $request,
            $project,
            $quotation,
            'rejected',
            $fromStatus,
            'rejected',
            $validated['reason']
        );

        return response()->json([
            'success' => true,
            'message' => "تم رفض عرض السعر V{$quotation->version}.",
            'data' => $quotation->fresh()->load([
                'items.product',
                'creator',
                'approver',
                'approvalHistories.actor',
            ]),
        ]);
    }

    private function logApprovalAction(
        Request $request,
        Project $project,
        ProjectQuotation $quotation,
        string $action,
        ?string $fromStatus,
        ?string $toStatus,
        ?string $reason = null
    ): void {
        $quotation->loadMissing('items');

        $materialCost = $quotation->items->sum(function ($item) {
            return (float) $item->cost_price * (float) $item->quantity;
        });

        $saleBeforeTax = (float) $quotation->subtotal - (float) $quotation->discount;
        $profit = $saleBeforeTax - $materialCost;
        $margin = $saleBeforeTax > 0 ? ($profit / $saleBeforeTax) * 100 : 0;

        QuotationApprovalHistory::create([
            'quotation_id' => $quotation->id,
            'project_id' => $project->id,
            'action' => $action,
            'from_status' => $fromStatus,
            'to_status' => $toStatus,
            'reason' => $reason,
            'acted_by' => $request->user()?->id,
            'acted_at' => now(),
            'snapshot' => [
                'quotation_number' => $quotation->quotation_number,
                'version' => $quotation->version,
                'subtotal' => (float) $quotation->subtotal,
                'discount' => (float) $quotation->discount,
                'tax' => (float) $quotation->tax,
                'total' => (float) $quotation->total,
                'material_cost' => round($materialCost, 2),
                'profit' => round($profit, 2),
                'margin' => round($margin, 2),
                'target_margin' => (float) ($quotation->target_margin ?? 0),
                'extra_costs' => $quotation->extra_costs ?? [],
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Validation
    |--------------------------------------------------------------------------
    */
    private function validateQuotationPayload(
        Request $request
    ): array {
        return $request->validate([
            'discount' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'target_margin' => [
                'nullable',
                'numeric',
                'min:0',
                'max:99.99',
            ],

            'header_tax_rate' => [
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],

            'extra_costs' => [
                'nullable',
                'array',
            ],

            'extra_costs.*' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'commercial_terms' => [
                'nullable',
                'array',
            ],

            'commercial_terms.customer_rfq' => [
                'nullable',
                'string',
                'max:255',
            ],

            'commercial_terms.prepared_by' => [
                'nullable',
                'string',
                'max:255',
            ],

            'commercial_terms.payment_terms' => [
                'nullable',
                'string',
                'max:1000',
            ],

            'commercial_terms.delivery_period' => [
                'nullable',
                'string',
                'max:1000',
            ],

            'commercial_terms.execution_period' => [
                'nullable',
                'string',
                'max:1000',
            ],

            'commercial_terms.warranty' => [
                'nullable',
                'string',
                'max:1000',
            ],

            'commercial_terms.custom_terms' => [
                'nullable',
                'string',
                'max:5000',
            ],

            'valid_until' => [
                'nullable',
                'date',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:5000',
            ],

            'items' => [
                'required',
                'array',
                'min:1',
            ],

            'items.*.product_id' => [
                'nullable',
                'integer',
                'exists:products,id',
            ],

            'items.*.product_name' => [
                'required',
                'string',
                'max:255',
            ],

            'items.*.sku' => [
                'nullable',
                'string',
                'max:255',
            ],

            'items.*.description' => [
                'nullable',
                'string',
            ],

            'items.*.unit' => [
                'nullable',
                'string',
                'max:100',
            ],

            'items.*.section' => [
                'nullable',
                'string',
                'max:150',
            ],

            'items.*.item_type' => [
                'nullable',
                'in:inventory,custom,service',
            ],

            'items.*.supplier_id' => [
                'nullable',
                'integer',
                'exists:suppliers,id',
            ],

            'items.*.supplier_price_id' => [
                'nullable',
                'integer',
                'exists:supplier_prices,id',
            ],

            'items.*.supplier_name_snapshot' => [
                'nullable',
                'string',
                'max:255',
            ],

            'items.*.supplier_cost_snapshot' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'items.*.supplier_lead_time_snapshot' => [
                'nullable',
                'integer',
                'min:0',
            ],

            'items.*.supplier_valid_until_snapshot' => [
                'nullable',
                'date',
            ],

            'items.*.quantity' => [
                'required',
                'numeric',
                'gt:0',
            ],

            'items.*.cost_price' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'items.*.unit_price' => [
                'required',
                'numeric',
                'min:0',
            ],

            'items.*.discount' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'items.*.tax_rate' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'items.*.sort_order' => [
                'nullable',
                'integer',
                'min:0',
            ],
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Create Items + Calculate Totals
    |--------------------------------------------------------------------------
    */
    private function replaceQuotationItems(
        ProjectQuotation $quotation,
        array $items
    ): array {
        $subtotal = 0;
        $taxTotal = 0;
        $defaultTaxRate = (float) ($quotation->header_tax_rate ?? 15);

        foreach ($items as $index => $row) {
            $quantity =
                (float) $row['quantity'];

            $costPrice =
                (float) ($row['cost_price'] ?? 0);

            $unitPrice =
                (float) $row['unit_price'];

            $lineDiscount =
                (float) ($row['discount'] ?? 0);

            $taxRate =
                (float) ($row['tax_rate'] ?? $defaultTaxRate);

            /*
             * القيمة قبل الضريبة وبعد خصم السطر.
             */
            $lineSubtotal = max(
                ($quantity * $unitPrice)
                - $lineDiscount,
                0
            );

            $taxAmount =
                $lineSubtotal
                * ($taxRate / 100);

            $lineTotal =
                $lineSubtotal
                + $taxAmount;

            /*
             * الربح محسوب بدون الضريبة.
             */
            $profitAmount =
                $lineSubtotal
                - ($quantity * $costPrice);

            $profitMargin =
                $lineSubtotal > 0
                    ? ($profitAmount / $lineSubtotal) * 100
                    : 0;

            $quotation->items()->create([
                'product_id' =>
                    $row['product_id'] ?? null,

                'product_name' =>
                    $row['product_name'],

                'sku' =>
                    $row['sku'] ?? null,

                'description' =>
                    $row['description'] ?? null,

                'unit' =>
                    $row['unit'] ?? null,

                'section' =>
                    $row['section'] ?? null,

                'item_type' =>
                    $row['item_type']
                    ?? (empty($row['product_id']) ? 'custom' : 'inventory'),

                'quantity' =>
                    $quantity,

                'cost_price' =>
                    $costPrice,

                'unit_price' =>
                    $unitPrice,

                'discount' =>
                    $lineDiscount,

                'tax_rate' =>
                    $taxRate,

                'tax_amount' =>
                    $taxAmount,

                'line_total' =>
                    $lineTotal,

                'profit_amount' =>
                    $profitAmount,

                'profit_margin' =>
                    $profitMargin,

                'sort_order' =>
                    $row['sort_order'] ?? $index,
            ]);

            $subtotal +=
                $lineSubtotal;

            $taxTotal +=
                $taxAmount;
        }

        return [
            'subtotal' => $subtotal,
            'tax' => $taxTotal,
        ];
    }
}
