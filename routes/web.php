<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return response()->file(public_path('index.html'));
});

Route::get('/api/downloadCertificate', [\App\Http\Controllers\Api\CertificateController::class, 'downloadCertificate']);
Route::get('/api/downloadCert', [\App\Http\Controllers\Api\CertificateController::class, 'downloadCertificate']);

// Multi-folder / Subfolder hosting bridge for API routes
Route::match(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], '{subfolder}/api', function (Request $request, $subfolder) {
    $targetUri = '/api' . ($request->getQueryString() ? '?' . $request->getQueryString() : '');
    $subRequest = Request::create(
        $targetUri,
        $request->getMethod(),
        $request->all(),
        $request->cookies->all(),
        $request->files->all(),
        $request->server->all(),
        $request->getContent()
    );
    return app()->handle($subRequest);
})->where('subfolder', '^(?!api$).*');

Route::match(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], '{subfolder}/api/{any}', function (Request $request, $subfolder, $any) {
    $targetUri = '/api/' . $any . ($request->getQueryString() ? '?' . $request->getQueryString() : '');
    $subRequest = Request::create(
        $targetUri,
        $request->getMethod(),
        $request->all(),
        $request->cookies->all(),
        $request->files->all(),
        $request->server->all(),
        $request->getContent()
    );
    return app()->handle($subRequest);
})->where('subfolder', '^(?!api$).*')->where('any', '.*');
