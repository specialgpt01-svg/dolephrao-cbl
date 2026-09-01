<?php

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/../vendor/autoload.php';

// Normalize subfolder SCRIPT_NAME and PHP_SELF for Plesk & Shared Hosting
foreach (['SCRIPT_NAME', 'PHP_SELF'] as $serverKey) {
    if (isset($_SERVER[$serverKey]) && strpos($_SERVER[$serverKey], '/public/index.php') !== false) {
        $_SERVER[$serverKey] = str_replace('/public/index.php', '/index.php', $_SERVER[$serverKey]);
    }
}

/** @var Application $app */
$app = require_once __DIR__.'/../bootstrap/app.php';

$app->handleRequest(Request::capture());
