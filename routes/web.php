<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function () {
    return response()->file(public_path('index.html'));
});

Route::get('/api/downloadCertificate', [\App\Http\Controllers\Api\CertificateController::class, 'downloadCertificate']);
Route::get('/api/downloadCert', [\App\Http\Controllers\Api\CertificateController::class, 'downloadCertificate']);


