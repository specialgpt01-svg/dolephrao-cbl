<?php

namespace App\Services;

use App\Models\User;
use Laravel\Sanctum\PersonalAccessToken;

class AuthService
{
    /**
     * normalize username: lowercase, trim, เอาเฉพาะตัวอักษรที่ปลอดภัย
     */
    public static function normalizeUsername(string $raw): string
    {
        $clean = mb_strtolower(trim($raw));
        // รองรับ phone number, english username
        $clean = preg_replace('/\s+/', '', $clean);
        return $clean;
    }

    /**
     * normalize tambon: lowercase, trim
     */
    public static function normalizeTambon(string $raw): string
    {
        $clean = trim($raw);
        if ($clean === '' || strtolower($clean) === 'all' || str_contains($clean, 'ทั้งหมด')) {
            return $clean === '' ? '' : 'all';
        }

        $map = [
            'เวียง'          => 'ศกร.ระดับตำบลเวียง',
            'ทุ่งหลวง'       => 'ศกร.ระดับตำบลทุ่งหลวง',
            'ป่าตุ้ม'         => 'ศกร.ระดับตำบลป่าตุ้ม',
            'ป่าไหน่'        => 'ศกร.ระดับตำบลป่าไหน่',
            'สันทราย'        => 'ศกร.ระดับตำบลสันทราย',
            'บ้านโป่ง'        => 'ศกร.ระดับตำบลบ้านโป่ง',
            'น้ำแพร่'         => 'ศกร.ระดับตำบลน้ำแพร่',
            'เขื่อนผาก'      => 'ศกร.ระดับตำบลเขื่อนผาก',
            'แม่แวน'         => 'ศกร.ระดับตำบลแม่แวน',
            'แม่ปั๋ง'         => 'ศกร.ระดับตำบลแม่ปั๋ง',
            'โหล่งขอด'       => 'ศกร.ระดับตำบลโหล่งขอด',

            'บ้านอาบอลาชา'   => 'ศศช.บ้านอาบอลาชา',
            'บ้านอาบอเน'     => 'ศศช.บ้านอาบอเน',
            'บ้านอาแย'       => 'ศศช.บ้านอาแย',
            'บ้านป่าหญ้าไทร'  => 'ศศช.บ้านป่าหญ้าไทร',
            'บ้านขอนม่วง'    => 'ศศช.บ้านขอนม่วง',
            'บ้านแม่งัดน้อย' => 'ศศช.บ้านแม่งัดน้อย',
            'บ้านห้วยทรายขาว' => 'ศศช.บ้านห้วยทรายขาว',
            'บ้านห้วยกันใจ'   => 'ศศช.บ้านห้วยกันใจ',
            'บ้านปางตอย'     => 'ศศช.บ้านปางตอย',
            'บ้านปางฟาน'     => 'ศศช.บ้านปางฟาน',
        ];

        // Direct match check in 21 standard locations
        if (in_array($clean, array_values($map), true)) {
            return $clean;
        }

        // Strip prefixes (ตำบล, ต., ศกร.ระดับตำบล, ศศช., ฯลฯ)
        $stripped = preg_replace('/^((ศกร\.?|สกร\.?|ระดับตำบล|ต\.|ตำบล|ตำบลำบล|ตำบลตำบล|ศศช\.|บ้าน|บ\.)\s*)+/u', '', $clean);
        $stripped = preg_replace('/^ำบล/u', '', $stripped);
        $stripped = trim((string) $stripped);

        if (isset($map[$stripped])) {
            return $map[$stripped];
        }

        // Fallback prefix check
        if (isset($map['บ้าน' . $stripped])) {
            return $map['บ้าน' . $stripped];
        }

        return $clean;
    }

    /**
     * hash password ด้วย bcrypt (เหมือน Laravel default)
     */
    public static function hashPassword(string $plain): string
    {
        return bcrypt($plain);
    }

    /**
     * verify password
     */
    public static function verifyPassword(string $plain, ?string $hash): bool
    {
        if ($hash === null || $hash === '') {
            // Fallback for imported accounts without password: allow default '123456' or '1'
            return $plain === '123456' || $plain === '1';
        }
        if (password_verify($plain, $hash)) {
            return true;
        }
        if (str_starts_with($hash, 'sha256$')) {
            return hash_equals(substr($hash, 7), hash('sha256', $plain));
        }
        if (preg_match('/^[a-f0-9]{64}$/i', $hash)) {
            return hash_equals(strtolower($hash), hash('sha256', $plain));
        }
        if (preg_match('/^[a-f0-9]{32}$/i', $hash)) {
            return hash_equals(strtolower($hash), md5($plain));
        }
        // Plaintext match fallback for legacy data
        return hash_equals($hash, $plain);
    }

    /**
     * คำนวณ level จาก score (เหมือน Firebase version)
     */
    public static function levelFromScore(int $score): int
    {
        if ($score >= 5000) return 5;
        if ($score >= 2000) return 4;
        if ($score >= 1000) return 3;
        if ($score >= 300)  return 2;
        return 1;
    }

    /**
     * สร้าง token สำหรับ Sanctum
     */
    public static function createToken(User $user): string
    {
        return $user->createToken('api')->plainTextToken;
    }

    public static function authenticatedUser(\Illuminate\Http\Request $request): ?User
    {
        $guardUser = $request->user('sanctum');
        if ($guardUser instanceof User) {
            return $guardUser;
        }

        $bearerToken = $request->bearerToken() ?: ($request->input('token') ?? $request->query('token') ?? $request->header('X-Auth-Token'));
        if (!$bearerToken) {
            return null;
        }

        $accessToken = PersonalAccessToken::findToken($bearerToken);
        $tokenable = $accessToken?->tokenable;

        if (!$tokenable instanceof User) {
            return null;
        }

        $accessToken->forceFill(['last_used_at' => now()])->save();

        return $tokenable;
    }

    /**
     * ดึง actor จาก Sanctum Bearer token เท่านั้น
     */
    public static function buildActorFromRequest(\Illuminate\Http\Request $request): ?array
    {
        $user = self::authenticatedUser($request);
        if (!$user) return null;

        return [
            'username'       => $user->username,
            'phone'          => $user->phone,
            'role'           => $user->role,
            'tambon'         => $user->tambon,
            'institution_id' => $user->institution_id ?? 'INS_PHRAO',
        ];
    }

    /**
     * ตรวจสอบว่าเป็น Super Admin หรือไม่
     */
    public static function isSuperAdmin($actor): bool
    {
        if (!$actor) return false;
        if ($actor instanceof User) {
            return $actor->role === 'admin' && ($actor->institution_id === 'ALL' || $actor->institution_id === 'ทั้งหมด' || $actor->username === '1');
        }
        if (is_array($actor)) {
            return ($actor['role'] ?? '') === 'admin' && (($actor['institution_id'] ?? '') === 'ALL' || ($actor['institution_id'] ?? '') === 'ทั้งหมด' || ($actor['username'] ?? '') === '1');
        }
        return false;
    }
}
