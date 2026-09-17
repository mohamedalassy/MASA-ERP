<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\PurchaseOrder;
use Illuminate\Http\Request;

class PurchaseOrderController extends Controller
{
    /**
     * عرض أوامر الشراء الخاصة بمشروع معين
     */
    public function index(Project $project)
    {
        $purchaseOrders = PurchaseOrder::query()
            ->where('project_id', $project->id)
            ->with([
                'supplier',
                'items',
            ])
            ->latest('id')
            ->get();

        return response()->json([
            'success' => true,
            'count' => $purchaseOrders->count(),
            'data' => $purchaseOrders,
        ]);
    }

    /**
     * إنشاء أمر شراء جديد للمشروع
     */
    public function store(Request $request, Project $project)
    {
        $validated = $request->validate([
            'supplier_id' => [
                'nullable',
                'integer',
                'exists:suppliers,id',
            ],

            'order_date' => [
                'nullable',
                'date',
            ],

            'expected_delivery_date' => [
                'nullable',
                'date',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:5000',
            ],
        ]);

        $lastOrder = PurchaseOrder::query()
            ->latest('id')
            ->first();

        $nextNumber = ($lastOrder?->id ?? 0) + 1;

        $poNumber =
            'PO-' .
            now()->format('Y') .
            '-' .
            str_pad(
                $nextNumber,
                5,
                '0',
                STR_PAD_LEFT
            );

        $purchaseOrder = PurchaseOrder::create([
            'project_id' => $project->id,

            'supplier_id' =>
                $validated['supplier_id'] ?? null,

            'po_number' => $poNumber,

            'status' => 'draft',

            'subtotal' => 0,
            'discount' => 0,
            'tax' => 0,
            'total' => 0,

            'order_date' =>
                $validated['order_date']
                ?? now()->toDateString(),

            'expected_delivery_date' =>
                $validated['expected_delivery_date']
                ?? null,

            'notes' =>
                $validated['notes'] ?? null,

            'created_by' =>
                $request->user()?->id,
        ]);

        $purchaseOrder->load([
            'supplier',
            'items',
            'project',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء أمر الشراء بنجاح.',
            'data' => $purchaseOrder,
        ], 201);
    }

    /**
     * عرض أمر شراء واحد بالتفاصيل
     */
    public function show(PurchaseOrder $purchaseOrder)
    {
        $purchaseOrder->load([
            'supplier',
            'items.product',
            'project',
        ]);

        return response()->json([
            'success' => true,
            'data' => $purchaseOrder,
        ]);
    }
}
