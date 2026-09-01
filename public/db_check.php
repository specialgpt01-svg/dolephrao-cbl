<?php
header('Content-Type: application/json');

$results = [];

$user = env('DB_USERNAME', 'doleph_db_loft_learn');
$pass = env('DB_PASSWORD', 'XBh^fn6#qHu5dZ1v');
$db = env('DB_DATABASE', 'doleph_db_loft_learn');

// Test 1: standard localhost
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

// Test 3: check available databases / current user if connected
echo json_encode([
    'db_user' => $user,
    'db_name' => $db,
    'pass_length' => strlen($pass),
    'pass_prefix' => substr($pass, 0, 4) . '***' . substr($pass, -3),
    'results' => $results
], JSON_PRETTY_PRINT);
