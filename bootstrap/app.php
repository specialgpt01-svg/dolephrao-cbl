<?php

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Frontend ใช้ Sanctum Personal Access Token ผ่าน Authorization: Bearer
        // จึงไม่เปิด statefulApi() ซึ่งเป็นโหมด cookie SPA และบังคับ CSRF กับ
        // same-origin POST จน action API ตอบ 419

        // ไม่มี named route `login` เพราะหน้าเข้าสู่ระบบเป็น SPA ใน `/`;
        // API ที่ไม่ผ่าน auth จึงต้องโยน AuthenticationException โดยไม่ redirect
        $middleware->redirectGuestsTo(function (Request $request) {
            return ($request->is('api') || $request->is('api/*')) ? null : '/';
        });

        // Shared hosting อาจทำงานอยู่หลัง reverse proxy
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'role' => \App\Http\Middleware\RoleMiddleware::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // API ต้องตอบ JSON 401 เสมอ แม้ client ไม่ได้ส่ง Accept: application/json
        $exceptions->render(function (AuthenticationException $exception, Request $request) {
            if ($request->is('api/*') || $request->is('api') || $request->has('action')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'กรุณาเข้าสู่ระบบ',
                ], 401);
            }
        });

        // API 500 error ตอบเป็น JSON เสมอเพื่อให้อ่านข้อความ error ได้ตรงจุด
        $exceptions->render(function (\Throwable $exception, Request $request) {
            if ($request->is('api/*') || $request->is('api') || $request->has('action') || $request->expectsJson()) {
                return response()->json([
                    'status' => 'error',
                    'message' => $exception->getMessage(),
                    'file' => config('app.debug') ? $exception->getFile().':'.$exception->getLine() : null,
                ], 500);
            }
        });
    })->create();
