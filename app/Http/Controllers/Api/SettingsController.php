<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\AuthService;
use App\Services\CacheService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
}
