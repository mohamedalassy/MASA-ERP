<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Supplier::query()
            ->withCount([
                'purchaseOrders',
                'invoices',
                'prices',
            ])
            ->latest('id');

        if ($request->filled('search')) {
            $search = trim($request->search);

            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('name_en', 'like', "%{$search}%")
                    ->orWhere('contact_person', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('vat_number', 'like', "%{$search}%")
                    ->orWhere('commercial_register', 'like', "%{$search}%");
            });
        }

        if ($request->filled('active')) {
            $query->where(
                'is_active',
                filter_var(
                    $request->active,
                    FILTER_VALIDATE_BOOLEAN
                )
            );
        }

        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        $perPage = max(
            1,
            min((int) $request->input('per_page', 100), 200)
        );

        return response()->json([
            'success' => true,
            'data' => $query->paginate($perPage),
        ]);
    }

    public function show(Supplier $supplier): JsonResponse
    {
        $supplier->load([
            'purchaseOrders',
            'invoices',
            'prices',
        ]);

        return response()->json([
            'success' => true,
            'data' => $supplier,
        ]);
    }
}