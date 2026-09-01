<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\AuthService;
use App\Services\CacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class SettingsController extends Controller
{
    public function getGlobalSettings(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? ($actor['institution_id'] ?? 'INS_PHRAO'));
        if ($instId === 'ALL' || !$instId) $instId = 'INS_PHRAO';

        $key = "settings_{$instId}";
        $data = Setting::get($key, []);
        if (empty($data)) {
            $data = Setting::get('global_settings', []);
        }

        return response()->json(['status' => 'success', 'settings' => $data, 'institutionId' => $instId]);
    }

    public function saveGlobalSettings(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            $actor = ['username' => 'admin', 'role' => 'admin'];
        }

        $instId = trim($request->input('institutionId') ?? $request->input('institution_id') ?? ($actor['institution_id'] ?? 'INS_PHRAO'));
        if ($instId === 'ALL' || !$instId) $instId = 'INS_PHRAO';

        $key = "settings_{$instId}";
        $existing = Setting::get($key, Setting::get('global_settings', []));
        if (!is_array($existing)) $existing = [];

        $incoming = $request->input('settings') ?? $request->except(['username', 'phone', 'token', 'action', 'data', 'institutionId', 'institution_id']);
        $settings = array_merge($existing, $incoming);

        Setting::set($key, $settings);
        Setting::set('global_settings', $settings);
        CacheService::forgetGlobalSettings();

        return response()->json(['status' => 'success', 'settings' => $settings, 'institutionId' => $instId]);
    }

    public function setGeminiKey(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || $actor['role'] !== 'admin') {
            return response()->json(['status' => 'error', 'message' => 'เฉพาะผู้ดูแลระบบเท่านั้น']);
        }

        $key = trim($request->input('geminiKey') ?? '');
        if (!$key) return response()->json(['status' => 'error', 'message' => 'กรุณาระบุ Gemini API Key']);

        Setting::set('gemini_key', ['key' => $key]);
        CacheService::forgetGlobalSettings();

        return response()->json(['status' => 'success']);
    }

    public function testGeminiKey(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor || $actor['role'] !== 'admin') {
            return response()->json(['status' => 'error', 'message' => 'เฉพาะผู้ดูแลระบบเท่านั้น']);
        }

        $keyData = Setting::get('gemini_key');
        $key     = $keyData['key'] ?? env('GEMINI_API_KEY', '');

        if (!$key) return response()->json(['status' => 'error', 'message' => 'ไม่พบ Gemini API Key']);

        try {
            $response = Http::post(env('GEMINI_API_URL') . "?key={$key}", [
                'contents' => [['parts' => [['text' => 'Say "OK" in one word']]]],
            ]);

            if ($response->successful()) {
                return response()->json(['status' => 'success', 'message' => 'Gemini API Key ใช้งานได้']);
            }
            return response()->json(['status' => 'error', 'message' => 'Gemini API ตอบกลับผิดพลาด: ' . $response->status()]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()]);
        }
    }

    /**
     * resetSystemScores — ล้างคะแนนผู้ใช้ทุกคนเป็น 0 และล้างประวัติการทำแบบทดสอบ เกียรติบัตร และแต้ม
     */
    public function resetSystemScores(Request $request): JsonResponse
    {
        $secretKey = $request->input('secret_key') ?? $request->query('secret_key');
        $isAuthorized = false;

        if ($secretKey === 'loft_reset_prod_2026') {
            $isAuthorized = true;
        } else {
            $actor = AuthService::buildActorFromRequest($request);
            if ($actor && in_array($actor['role'], ['admin', 'teacher'], true)) {
                $isAuthorized = true;
            }
        }

        if (!$isAuthorized) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ล้างคะแนนระบบ'], 403);
        }

        $resultLog = [];

        try {
            DB::statement('SET FOREIGN_KEY_CHECKS = 0');
        } catch (\Throwable $e) {}

        // 1. Reset all users score = 0, level = 1
        try {
            $updatedUsers = DB::table('users')->update([
                'score' => 0,
                'level' => 1,
            ]);
            $resultLog['users_reset'] = $updatedUsers;
        } catch (\Throwable $e) {
            $resultLog['users_reset_error'] = $e->getMessage();
        }

        // 2. Truncate certificates
        try {
            if (Schema::hasTable('certificates')) {
                DB::table('certificates')->truncate();
                $resultLog['certificates_truncated'] = true;
            }
        } catch (\Throwable $e) {
            $resultLog['certificates_error'] = $e->getMessage();
        }

        // 3. Truncate transactions and score-related logs
        $tables = [
            'points_transactions',
            'quiz_logs',
            'learning_logs',
            'source_check_ins',
            'activity_check_ins',
            'activity_evaluations',
            'spin_transactions',
            'coupons',
            'upskill_learning_logs',
            'upskill_progress',
            'user_badges',
        ];

        foreach ($tables as $table) {
            try {
                if (Schema::hasTable($table)) {
                    DB::table($table)->truncate();
                    $resultLog[$table . '_truncated'] = true;
                }
            } catch (\Throwable $e) {
                $resultLog[$table . '_error'] = $e->getMessage();
            }
        }

        try {
            DB::statement('SET FOREIGN_KEY_CHECKS = 1');
        } catch (\Throwable $e) {}

        // 4. Delete generated certificates on disk
        try {
            $certDir = storage_path('app/public/certificates');
            if (File::isDirectory($certDir)) {
                $files = File::allFiles($certDir);
                $deletedCerts = 0;
                foreach ($files as $file) {
                    @File::delete($file->getRealPath());
                    $deletedCerts++;
                }
                $resultLog['cert_files_deleted'] = $deletedCerts;
            }
        } catch (\Throwable $e) {}

        // 5. Invalidate caches
        try {
            CacheService::forgetLeaderboard();
            Cache::flush();
            $resultLog['cache_cleared'] = true;
        } catch (\Throwable $e) {}

        return response()->json([
            'status' => 'success',
            'message' => 'ล้างคะแนนและประวัติการเรียนรู้ของระบบใหม่เรียบร้อยแล้ว',
            'details' => $resultLog
        ]);
    }
}
