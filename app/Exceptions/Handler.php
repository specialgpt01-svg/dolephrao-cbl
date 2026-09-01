<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    public function render($request, Throwable $e)
    {
        // API JSON responses
        if ($request->is('api/*') || $request->wantsJson() || true) {
            $status  = method_exists($e, 'getStatusCode') ? $e->getStatusCode() : 500;
            $message = $e->getMessage() ?: 'Server Error';
            $data = [
                'status' => 'error',
                'message' => $message,
            ];
            if (config('app.debug')) {
                $data['file'] = $e->getFile();
                $data['line'] = $e->getLine();
                $data['trace'] = array_slice($e->getTrace(), 0, 10);
            }
            return response()->json($data, $status);
        }

        return parent::render($request, $e);
    }
}
