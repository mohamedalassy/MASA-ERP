<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FinanceAccount;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FinanceAccountController extends Controller
{
    public function index(Request $request)
    {
        $query = FinanceAccount::query()
            ->with([
                'parent:id,code,name',
                'children:id,code,name,parent_id,type,is_postable,is_active',
            ]);

        if ($request->filled('type')) {
            $query->where('type', $request->type);
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

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('name_en', 'like', "%{$search}%");
            });
        }

        $accounts = $query
            ->orderBy('code')
            ->get();

        return response()->json([
            'success' => true,
            'count' => $accounts->count(),
            'data' => $accounts,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => [
                'required',
                'string',
                'max:50',
                'unique:finance_accounts,code',
            ],

            'name' => [
                'required',
                'string',
                'max:255',
            ],

            'name_en' => [
                'nullable',
                'string',
                'max:255',
            ],

            'type' => [
                'required',
                'in:asset,liability,equity,revenue,expense',
            ],

            'parent_id' => [
                'nullable',
                'integer',
                'exists:finance_accounts,id',
            ],

            'normal_balance' => [
                'required',
                'in:debit,credit',
            ],

            'is_postable' => [
                'nullable',
                'boolean',
            ],

            'is_active' => [
                'nullable',
                'boolean',
            ],

            'description' => [
                'nullable',
                'string',
            ],
        ]);

        $level = 1;

        if (!empty($validated['parent_id'])) {
            $parent = FinanceAccount::findOrFail(
                $validated['parent_id']
            );

            $level = $parent->level + 1;
        }

        $account = FinanceAccount::create([
            ...$validated,

            'level' => $level,

            'is_postable' =>
                $validated['is_postable'] ?? true,

            'is_active' =>
                $validated['is_active'] ?? true,

            'created_by' =>
                $request->user()?->id,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء الحساب بنجاح.',
            'data' => $account->load('parent'),
        ], 201);
    }

    public function show(FinanceAccount $financeAccount)
    {
        $financeAccount->load([
            'parent',
            'children',
        ]);

        return response()->json([
            'success' => true,
            'data' => $financeAccount,
        ]);
    }

    public function update(
        Request $request,
        FinanceAccount $financeAccount
    ) {
        $validated = $request->validate([
            'code' => [
                'sometimes',
                'required',
                'string',
                'max:50',

                Rule::unique(
                    'finance_accounts',
                    'code'
                )->ignore($financeAccount->id),
            ],

            'name' => [
                'sometimes',
                'required',
                'string',
                'max:255',
            ],

            'name_en' => [
                'nullable',
                'string',
                'max:255',
            ],

            'type' => [
                'sometimes',
                'required',
                'in:asset,liability,equity,revenue,expense',
            ],

            'parent_id' => [
                'nullable',
                'integer',
                'exists:finance_accounts,id',
            ],

            'normal_balance' => [
                'sometimes',
                'required',
                'in:debit,credit',
            ],

            'is_postable' => [
                'nullable',
                'boolean',
            ],

            'is_active' => [
                'nullable',
                'boolean',
            ],

            'description' => [
                'nullable',
                'string',
            ],
        ]);

        if (
            array_key_exists('parent_id', $validated) &&
            (int) ($validated['parent_id'] ?? 0) ===
            (int) $financeAccount->id
        ) {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن جعل الحساب تابعًا لنفسه.',
            ], 422);
        }

        if (
            array_key_exists('parent_id', $validated) &&
            !empty($validated['parent_id'])
        ) {
            $parent = FinanceAccount::findOrFail(
                $validated['parent_id']
            );

            $validated['level'] =
                $parent->level + 1;
        }

        if (
            array_key_exists('parent_id', $validated) &&
            empty($validated['parent_id'])
        ) {
            $validated['level'] = 1;
        }

        $financeAccount->update($validated);

        return response()->json([
            'success' => true,
            'message' =>
                'تم تحديث الحساب بنجاح.',
            'data' =>
                $financeAccount
                    ->fresh()
                    ->load('parent'),
        ]);
    }

    public function destroy(
        FinanceAccount $financeAccount
    ) {
        if ($financeAccount->children()->exists()) {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن حذف حساب يحتوي على حسابات فرعية.',
            ], 422);
        }

        if ($financeAccount->journalLines()->exists()) {
            return response()->json([
                'success' => false,
                'message' =>
                    'لا يمكن حذف حساب مستخدم في قيود محاسبية.',
            ], 422);
        }

        $financeAccount->delete();

        return response()->json([
            'success' => true,
            'message' =>
                'تم حذف الحساب بنجاح.',
        ]);
    }
}