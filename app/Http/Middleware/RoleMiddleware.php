<?php

namespace App\Http\Middleware;

use App\Services\AuthService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * ตรวจสิทธิ์ role จากผู้ใช้ที่ยืนยันตัวตนแล้ว
 *
 * การใช้งาน:
 *   Route::middleware(['role:admin'])
 *   Route::middleware(['role:admin,teacher'])
 */
class RoleMiddleware
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $actor = AuthService::buildActorFromRequest($request);

        if (!$actor) {
            return response()->json(['status' => 'error', 'message' => 'Unauthorized'], 401);
        }

        if (!empty($roles) && !in_array($actor['role'], $roles, true)) {
            return response()->json(['status' => 'error', 'message' => 'ไม่มีสิทธิ์ดำเนินการ'], 403);
        }

        return $next($request);
    }
}
