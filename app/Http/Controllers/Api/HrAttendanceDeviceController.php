<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\HrAttendanceDevice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HrAttendanceDeviceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = HrAttendanceDevice::with('branch:id,code,name')->withCount('logs');

        if ($request->filled('provider')) $query->where('provider', $request->provider);
        if ($request->filled('branch_id')) $query->where('branch_id', $request->branch_id);
        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")
                ->orWhere('code', 'like', "%{$search}%")
                ->orWhere('serial_number', 'like', "%{$search}%")
                ->orWhere('ip_address', 'like', "%{$search}%"));
        }

        return response()->json($query->latest()->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateData($request);
        $data['created_by'] = $request->user()?->id;
        $device = HrAttendanceDevice::create($data);

        return response()->json($device->load('branch:id,code,name'), 201);
    }

    public function show(HrAttendanceDevice $hrAttendanceDevice): JsonResponse
    {
        return response()->json($hrAttendanceDevice->load('branch:id,code,name')->loadCount('logs'));
    }

    public function update(Request $request, HrAttendanceDevice $hrAttendanceDevice): JsonResponse
    {
        $data = $this->validateData($request, $hrAttendanceDevice->id);
        $data['updated_by'] = $request->user()?->id;
        $hrAttendanceDevice->update($data);

        return response()->json($hrAttendanceDevice->fresh()->load('branch:id,code,name'));
    }

    public function destroy(HrAttendanceDevice $hrAttendanceDevice): JsonResponse
    {
        $hrAttendanceDevice->update(['is_active' => false, 'status' => 'offline']);
        return response()->json(['message' => 'تم تعطيل جهاز الحضور بنجاح.']);
    }

    public function testConnection(HrAttendanceDevice $hrAttendanceDevice): JsonResponse
    {
        if (!$hrAttendanceDevice->ip_address) {
            return response()->json(['message' => 'عنوان IP غير مسجل لهذا الجهاز.'], 422);
        }

        $target = "tcp://{$hrAttendanceDevice->ip_address}:{$hrAttendanceDevice->port}";
        $socket = @stream_socket_client($target, $errorNumber, $errorMessage, 3);
        $connected = is_resource($socket);
        if ($connected) fclose($socket);

        $hrAttendanceDevice->update([
            'status' => $connected ? 'online' : 'offline',
            'last_seen_at' => $connected ? now() : $hrAttendanceDevice->last_seen_at,
        ]);

        return response()->json([
            'connected' => $connected,
            'status' => $connected ? 'online' : 'offline',
            'message' => $connected ? 'تم الوصول إلى الجهاز بنجاح.' : ($errorMessage ?: 'تعذر الوصول إلى الجهاز.'),
        ], $connected ? 200 : 422);
    }

    private function validateData(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'branch_id' => ['nullable', 'integer', 'exists:hr_branches,id'],
            'code' => ['required', 'string', 'max:30', Rule::unique('hr_attendance_devices', 'code')->ignore($id)],
            'name' => ['required', 'string', 'max:255'],
            'provider' => ['required', Rule::in(['hikvision', 'zkteco', 'suprema', 'dahua', 'other'])],
            'model' => ['nullable', 'string', 'max:100'],
            'serial_number' => ['nullable', 'string', 'max:100', Rule::unique('hr_attendance_devices', 'serial_number')->ignore($id)],
            'ip_address' => ['nullable', 'ip'],
            'port' => ['required', 'integer', 'between:1,65535'],
            'protocol' => ['required', Rule::in(['http', 'https', 'adms', 'push', 'sdk'])],
            'username' => ['nullable', 'string', 'max:100'],
            'password' => ['nullable', 'string', 'max:500'],
            'api_url' => ['nullable', 'url', 'max:255'],
            'api_token' => ['nullable', 'string'],
            'timezone' => ['required', 'timezone'],
            'location' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(['offline', 'online', 'error', 'maintenance'])],
            'sync_interval_minutes' => ['required', 'integer', 'between:1,1440'],
            'auto_sync' => ['boolean'],
            'is_active' => ['boolean'],
            'settings' => ['nullable', 'array'],
            'notes' => ['nullable', 'string'],
        ]);
    }
}
