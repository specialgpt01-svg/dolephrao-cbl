<?php
header('Content-Type: application/json');
ini_set('display_errors', 1);
error_reporting(E_ALL);

$envPath = __DIR__ . '/../.env';
$env = [];
if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if (str_starts_with($line, '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k);
        $v = trim($v);
        $v = trim($v, "\"'");
        $env[$k] = $v;
    }
}

$user = $env['DB_USERNAME'] ?? 'doleph_db_loft_learn';
$pass = $env['DB_PASSWORD'] ?? 'XBh^fn6#qHu5dZ1v';
$db   = $env['DB_DATABASE'] ?? 'doleph_db_loft_learn';

$results = [];

// Test 1: localhost
try {
    $pdo = new PDO("mysql:host=localhost;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    $stmt = $pdo->query("SELECT count(*) as cnt FROM users");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $results['test_localhost'] = ['status' => 'OK', 'users_count' => $row['cnt']];
} catch (Exception $e) {
    $results['test_localhost'] = ['status' => 'ERROR', 'message' => $e->getMessage()];
}

// Test 2: 127.0.0.1
try {
    $pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    $stmt = $pdo->query("SELECT count(*) as cnt FROM users");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $results['test_127_0_0_1'] = ['status' => 'OK', 'users_count' => $row['cnt']];
} catch (Exception $e) {
    $results['test_127_0_0_1'] = ['status' => 'ERROR', 'message' => $e->getMessage()];
}

echo json_encode([
    'env_exists' => file_exists($envPath),
    'db_user' => $user,
    'db_name' => $db,
    'pass_length' => strlen($pass),
    'pass_preview' => substr($pass, 0, 4) . '***' . substr($pass, -3),
    'results' => $results
], JSON_PRETTY_PRINT);
