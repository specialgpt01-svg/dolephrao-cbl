<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuthService;
use App\Services\CacheService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FileController extends Controller
{
    /**
     * uploadImage — upload base64 image
     */
    public function uploadImage(Request $request): JsonResponse
    {
        $actor = AuthService::buildActorFromRequest($request);
        if (!$actor) {
            return response()->json(['status' => 'error', 'message' => 'กรุณาเข้าสู่ระบบ'], 401);
        }

        $dataUrlInput = $request->input('imageData') ?? $request->input('base64') ?? $request->input('data') ?? '';
        
        if (is_array($dataUrlInput)) {
            $dataUrl = $dataUrlInput['imageData'] ?? $dataUrlInput['base64'] ?? $dataUrlInput['data'] ?? (is_string(reset($dataUrlInput)) ? reset($dataUrlInput) : '');
        } else {
            $dataUrl = (string) $dataUrlInput;
        }

        $filename = trim($request->input('filename') ?? $request->input('fileName') ?? '') ?: (Str::uuid() . '.jpg');

        if (!$dataUrl) return response()->json(['status' => 'error', 'message' => 'ไม่พบข้อมูลรูปภาพ']);

        // Parse base64 data URL safely
        if (preg_match('/^data:image\/(\w+);base64,/', $dataUrl, $matches)) {
            $ext      = $matches[1];
            $data     = base64_decode(substr($dataUrl, strpos($dataUrl, ',') + 1));
            $filename = pathinfo($filename, PATHINFO_FILENAME) . '.' . $ext;
        } else {
            $data = base64_decode($dataUrl);
        }

        if (!$data || strlen($data) > 10 * 1024 * 1024) { // 10MB limit
            return response()->json(['status' => 'error', 'message' => 'รูปภาพใหญ่เกิน 10MB']);
        }

        $path    = 'uploads/images/' . date('Y/m') . '/' . $filename;
        Storage::disk('public')->put($path, $data);

        $url = '/storage/' . $path;

        // หากเป็นการอัปโหลดรูปโปรไฟล์ ให้อัปเดตรูปใน User Model อัตโนมัติ
        $context = $request->input('context') ?? '';
        if ($context === 'profile' || str_contains($filename, 'profile_')) {
            $user = \App\Models\User::where('username', $actor['username'])->first();
            if ($user) {
                $isAutoApprove = in_array(strtolower(trim($user->role)), ['teacher', 'admin'], true);
                $user->update([
                    'profile_image' => $url,
                    'image_status'  => $isAutoApprove ? 'Approved' : 'Pending'
                ]);
                CacheService::forgetUserProfile($user->username);
                CacheService::invalidateLeaderboard();
            }
        }

        return response()->json(['status' => 'success', 'url' => $url, 'path' => $path]);
    }

    /**
     * uploadGeneralImage — same as uploadImage but in general directory
     */
    public function uploadGeneralImage(Request $request): JsonResponse
    {
        return $this->uploadImage($request);
    }

    /**
     * getFile — serve a file by path (replaces getFirebaseFile)
     */
    public function getFile(Request $request)
    {
        $path  = $request->query('path') ?? '';
        $token = $request->query('token') ?? '';

        if (!$path) return response('File not found', 404);

        // Basic path traversal protection
        $path = ltrim(str_replace('..', '', $path), '/');

        if (!Storage::disk('public')->exists($path)) {
            return response('File not found', 404);
        }

        $content     = Storage::disk('public')->get($path);
        $mimeType    = Storage::disk('public')->mimeType($path);
        $lastModified = Storage::disk('public')->lastModified($path);

        return response($content, 200)
            ->header('Content-Type', $mimeType)
            ->header('Cache-Control', 'public, max-age=86400')
            ->header('Last-Modified', gmdate('D, d M Y H:i:s', $lastModified) . ' GMT');
    }
}
