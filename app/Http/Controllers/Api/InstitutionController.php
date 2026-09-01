<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Institution;
use App\Models\Source;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class InstitutionController extends Controller
{
    /**
     * getInstitutions — ดึงรายชื่อสถานศึกษาทั้งหมดในระบบพร้อมสถิติ
     */
    public function getInstitutions(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);

        $query = Institution::where('is_active', true)
            ->withCount(['users', 'sources', 'activities'])
            ->orderBy('name');

        $institutions = $query->get()->map(function ($inst) {
            $data = $inst->toArray();
            $subUnits = $inst->sub_units ?? [];
            $data['usersCount']      = (int) ($inst->users_count ?? 0);
            $data['sourcesCount']    = (int) ($inst->sources_count ?? 0);
            $data['activitiesCount'] = (int) ($inst->activities_count ?? 0);
            $data['subUnitsCount']   = is_array($subUnits) ? count($subUnits) : 0;
            return $data;
        });

        // Summary Stats
        $totalInstitutions = $institutions->count();
        $totalSubUnits = $institutions->sum('subUnitsCount');
        $totalUsers = User::where('role', 'user')->count();
        $totalSources = Source::count();

        return response()->json([
            'status'       => 'success',
            'institutions' => $institutions,
            'stats'        => [
                'totalInstitutions' => $totalInstitutions,
                'totalSubUnits'     => $totalSubUnits,
                'totalUsers'        => $totalUsers,
                'totalSources'      => $totalSources,
            ],
            'isSuperAdmin' => AuthService::isSuperAdmin($actor),
        ]);
    }

    /**
     * createOrUpdateInstitution — สร้าง หรือ แก้ไขสถานศึกษา (สำหรับ Super Admin / Admin)
     */
    public function createOrUpdateInstitution(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || $actor['role'] !== 'admin') {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์จัดการข้อมูลสถานศึกษา'], 403);
        }

        $id = trim($request->input('id') ?? '');
        $code = trim($request->input('code') ?? '');
        $name = trim($request->input('name') ?? '');
        $province = trim($request->input('province') ?? 'เชียงใหม่');
        $district = trim($request->input('district') ?? '');
        $logoUrl = trim($request->input('logoUrl') ?? '');
        $themeColor = trim($request->input('themeColor') ?? '#059669');

        // ตรวจสอบสิทธิ์กรณีไม่ใช่ Super Admin -> แก้ได้เฉพาะสถานศึกษาตนเอง
        if (!AuthService::isSuperAdmin($actor)) {
            if ($id && $id !== ($actor['institution_id'] ?? '')) {
                return response()->json(['status' => 'error', 'message' => 'คุณมีสิทธิ์จัดการเฉพาะสถานศึกษาในสังกัดของคุณเท่านั้น'], 403);
            }
            if (!$id) {
                return response()->json(['status' => 'error', 'message' => 'เฉพาะ Super Admin เท่านั้นที่สามารถเพิ่มสถานศึกษาใหม่ได้'], 403);
            }
        }

        $subUnits = null;
        $rawSubUnits = $request->input('subUnits') ?? $request->input('sub_units') ?? null;
        if (is_array($rawSubUnits)) {
            $subUnits = array_values(array_filter(array_map('trim', $rawSubUnits)));
        } elseif (is_string($rawSubUnits) && trim($rawSubUnits) !== '') {
            $lines = preg_split('/[\r\n,]+/u', $rawSubUnits);
            $subUnits = array_values(array_filter(array_map('trim', $lines)));
        }

        if (!$name) {
            return response()->json(['status' => 'error', 'message' => 'กรุณากรอกชื่อสถานศึกษา']);
        }

        if (!$id) {
            $id = 'INS_' . strtoupper(Str::slug($code ?: $name, '_'));
        }

        $updateData = [
            'code'        => $code ?: $id,
            'name'        => $name,
            'province'    => $province,
            'district'    => $district,
            'logo_url'    => $logoUrl,
            'theme_color' => $themeColor,
            'is_active'   => true,
        ];
        if ($subUnits !== null) {
            $updateData['sub_units'] = $subUnits;
        }

        $institution = Institution::updateOrCreate(
            ['id' => $id],
            $updateData
        );

        return response()->json([
            'status'      => 'success',
            'message'     => 'บันทึกข้อมูลสถานศึกษาเรียบร้อยแล้ว',
            'institution' => $institution->toArray(),
        ]);
    }

    /**
     * updateSubUnits — บันทึก/อัปเดตรายการสถานศึกษาในสังกัด (ศกร.ตำบล / ศศช.) โดยเฉพาะ
     */
    public function updateSubUnits(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || $actor['role'] !== 'admin') {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์จัดการข้อมูลสถานศึกษาในสังกัด'], 403);
        }

        $id = trim($request->input('id') ?? $request->input('institutionId') ?? '');
        if (!$id) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบรหัสสถานศึกษา']);
        }

        if (!AuthService::isSuperAdmin($actor) && $id !== ($actor['institution_id'] ?? '')) {
            return response()->json(['status' => 'error', 'message' => 'คุณมีสิทธิ์จัดการเฉพาะสถานศึกษาของตนเองเท่านั้น'], 403);
        }

        $institution = Institution::find($id);
        if (!$institution) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบสถานศึกษาในระบบ'], 404);
        }

        $subUnits = [];
        $rawSubUnits = $request->input('subUnits') ?? $request->input('sub_units') ?? [];
        if (is_array($rawSubUnits)) {
            $subUnits = array_values(array_unique(array_filter(array_map('trim', $rawSubUnits))));
        } elseif (is_string($rawSubUnits)) {
            $lines = preg_split('/[\r\n,]+/u', $rawSubUnits);
            $subUnits = array_values(array_unique(array_filter(array_map('trim', $lines))));
        }

        $institution->sub_units = $subUnits;
        $institution->save();

        return response()->json([
            'status'      => 'success',
            'message'     => 'บันทึกรายชื่อสถานศึกษาในสังกัดเรียบร้อยแล้ว (' . count($subUnits) . ' แห่ง)',
            'subUnits'    => $subUnits,
            'institution' => $institution->toArray(),
        ]);
    }

    /**
     * deleteInstitution — ลบสถานศึกษา (สำหรับ Super Admin)
     */
    public function deleteInstitution(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || $actor['role'] !== 'admin' || !AuthService::isSuperAdmin($actor)) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ลบสถานศึกษา เฉพาะ Super Admin เท่านั้น'], 403);
        }

        $id = trim($request->input('id') ?? $request->input('institutionId') ?? '');
        if (!$id) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบรหัสสถานศึกษาที่ต้องการลบ']);
        }

        if ($id === 'INS_PHRAO') {
            return response()->json(['status' => 'error', 'message' => 'ไม่สามารถลบสถานศึกษาหลักของระบบ (สกร.อำเภอพร้าว) ได้']);
        }

        $institution = Institution::find($id);
        if (!$institution) {
            return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูลสถานศึกษาในระบบ']);
        }

        $institution->delete();

        return response()->json([
            'status'  => 'success',
            'message' => 'ลบข้อมูลสถานศึกษาเรียบร้อยแล้ว',
        ]);
    }
}

