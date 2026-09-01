<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\AuthService;
use Illuminate\Database\Seeder;

class LocalAdminSeeder extends Seeder
{
    public function run(): void
    {
        $phone = AuthService::normalizeUsername((string) env('LOFT_ADMIN_PHONE', ''));
        $password = (string) env('LOFT_ADMIN_PASSWORD', '');

        if ($phone === '' || $password === '') {
            $this->command?->warn('ข้าม LocalAdminSeeder: กรุณาตั้ง LOFT_ADMIN_PHONE และ LOFT_ADMIN_PASSWORD');
            return;
        }

        $user = User::where('username', $phone)->first();

        if ($user) {
            // ถ้าเป็นผู้ใช้จาก Firebase ให้คงชื่อ พื้นที่ คะแนน รูป และประวัติเดิมไว้
            $user->update([
                'phone' => $user->phone ?: $phone,
                'password' => AuthService::hashPassword($password),
                'role' => 'admin',
            ]);
        } else {
            $user = User::create([
                'username' => $phone,
                'phone' => $phone,
                'full_name' => (string) env('LOFT_ADMIN_NAME', 'ผู้ดูแลระบบ LOFT'),
                'password' => AuthService::hashPassword($password),
                'role' => 'admin',
                'tambon' => 'all',
                'score' => 0,
                'level' => 1,
                'image_status' => 'Approved',
            ]);
        }

        // รหัสผ่านเปลี่ยนแล้ว token เก่าของบัญชีนี้ต้องใช้ต่อไม่ได้
        $user->tokens()->delete();

        $this->command?->info("สร้าง/อัปเดตผู้ดูแลระบบ {$phone} แล้ว");
    }
}
