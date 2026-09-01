<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    /**
     * register — ลงทะเบียนผู้ใช้ใหม่
     */
    public function register(Request $request): JsonResponse
    {
        $data = $request->all();
        $username = AuthService::normalizeUsername($data['username'] ?? $data['phone'] ?? '');
        $phone    = trim($data['phone'] ?? '');
        $fullName = trim($data['fullName'] ?? $data['full_name'] ?? '');
        $password = $data['password'] ?? '';
        $tambon   = AuthService::normalizeTambon($data['tambon'] ?? '');
        $role     = 'user';

        if (!$username) {
            return response()->json(['status' => 'error', 'message' => 'กรุณากรอกชื่อผู้ใช้หรือเบอร์โทร']);
        }
        if (!$fullName) {
            return response()->json(['status' => 'error', 'message' => 'กรุณากรอกชื่อ-นามสกุล']);
        }
        if (!$tambon) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาระบุตำบล']);
        }
        if (!$password || strlen($password) < 6) {
            return response()->json(['status' => 'error', 'message' => 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร']);
        }

        if (User::where('username', $username)->exists()) {
            return response()->json(['status' => 'error', 'message' => 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว']);
        }

        $userCategory = trim($data['userCategory'] ?? $data['user_category'] ?? 'ประชาชนทั่วไป');
        $ageGroup     = trim($data['ageGroup'] ?? $data['age_group'] ?? '');
        $occupation   = trim($data['occupation'] ?? '');

        $institutionId = trim($data['institutionId'] ?? $data['institution_id'] ?? 'INS_PHRAO');

        $user = User::create([
            'username'       => $username,
            'phone'          => $phone ?: $username,
            'full_name'      => $fullName,
            'password'       => AuthService::hashPassword($password),
            'role'           => $role,
            'institution_id' => $institutionId,
            'tambon'         => $tambon,
            'user_category'  => $userCategory,
            'age_group'      => $ageGroup,
            'occupation'     => $occupation,
            'score'          => 0,
            'level'          => 1,
        ]);

        $token = AuthService::createToken($user);

        return response()->json([
            'status'  => 'success',
            'token'   => $token,
            'user'    => $user->toProfileArray(),
            'profile' => $user->toProfileArray(),
        ]);
    }

    /**
     * login — เข้าสู่ระบบ
     */
    public function login(Request $request): JsonResponse
    {
        $data     = $request->all();
        $username = AuthService::normalizeUsername($data['username'] ?? $data['phone'] ?? '');
        $password = $data['password'] ?? '';

        if (!$username || !$password) {
            return response()->json(['status' => 'error', 'message' => 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน']);
        }

        $user = User::where('username', $username)
            ->orWhere('phone', $username)
            ->first();

        if (!$user || !AuthService::verifyPassword($password, $user->password)) {
            return response()->json(['status' => 'error', 'message' => 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง']);
        }

        // ลบ token เก่าทั้งหมด แล้วสร้างใหม่
        $user->tokens()->delete();
        $token = AuthService::createToken($user);

        return response()->json([
            'status'  => 'success',
            'token'   => $token,
            'user'    => $user->toProfileArray(),
            'profile' => $user->toProfileArray(),
        ]);
    }

    /**
     * logout
     */
    public function logout(Request $request): JsonResponse
    {
        $token = $request->bearerToken();
        if ($token) {
            PersonalAccessToken::findToken($token)?->delete();
        }
        return response()->json(['status' => 'success']);
    }

    /**
     * changePassword — เปลี่ยนรหัสผ่านโดยต้องยืนยันรหัสผ่านเดิม
     */
    public function changePassword(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $user = null;
        if ($actor && !empty($actor['username'])) {
            $user = User::where('username', $actor['username'])->orWhere('phone', $actor['username'])->first();
        }

        if (!$user) {
            $fallbackUsername = trim((string)($request->input('username') ?? $request->input('phone') ?? $request->query('username') ?? $request->query('phone') ?? ''));
            if ($fallbackUsername) {
                $user = User::where('username', $fallbackUsername)->orWhere('phone', $fallbackUsername)->first();
            }
        }

        if (!$user) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบก่อนดำเนินการ'], 401);
        }

        $data = $request->input('data');
        if (!is_array($data)) $data = [];

        $oldPassword     = trim((string)($data['oldPassword'] ?? $data['currentPassword'] ?? $data['old_password'] ?? $data['current_password'] ?? $request->input('oldPassword') ?? $request->input('currentPassword') ?? $request->input('old_password') ?? $request->input('current_password') ?? $request->input('current') ?? ''));
        $newPassword     = trim((string)($data['newPassword'] ?? $data['password'] ?? $data['new_password'] ?? $request->input('newPassword') ?? $request->input('password') ?? $request->input('new_password') ?? $request->input('new') ?? ''));
        $confirmPassword = trim((string)($data['confirmPassword'] ?? $data['confirm_password'] ?? $request->input('confirmPassword') ?? $request->input('confirm_password') ?? $request->input('confirm') ?? ''));

        if (!$oldPassword) {
            return response()->json(['status' => 'error', 'message' => 'กรุณากรอกรหัสผ่านปัจจุบัน']);
        }

        if (!AuthService::verifyPassword($oldPassword, $user->password)) {
            return response()->json(['status' => 'error', 'message' => 'รหัสผ่านปัจจุบันไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านเดิมที่ใช้งานอยู่']);
        }

        if (!$newPassword || mb_strlen($newPassword) < 6) {
            return response()->json(['status' => 'error', 'message' => 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร']);
        }

        if ($confirmPassword && $newPassword !== $confirmPassword) {
            return response()->json(['status' => 'error', 'message' => 'รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน']);
        }

        // ล้าง token เก่าทั้งหมด แล้วสร้าง token ใหม่
        $user->tokens()->delete();
        $newToken = AuthService::createToken($user);

        $user->update([
            'password'                => AuthService::hashPassword($newPassword),
            'must_change_password'    => false,
            'password_reset_required' => false,
        ]);

        return response()->json([
            'status'  => 'success',
            'message' => 'เปลี่ยนรหัสผ่านสำเร็จแล้ว สามารถใช้รหัสผ่านใหม่ในการเข้าสู่ระบบครั้งถัดไปได้ทันที',
            'token'   => $newToken,
            'user'    => $user->toProfileArray(),
            'profile' => $user->toProfileArray(),
        ]);
    }
}
