<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || empty($data['name']) || empty($data['price'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid product data']);
        exit;
    }

    $name = $conn->real_escape_string($data['name']);
    $price = floatval($data['price']);
    $category = $conn->real_escape_string($data['category'] ?? 'General');
    $image = $conn->real_escape_string($data['image'] ?? '🛒');

    if (!isset($data['id']) || empty($data['id'])) {
        $stmt = $conn->prepare('INSERT INTO products (name, price, category, image) VALUES (?, ?, ?, ?)');
        $stmt->bind_param('sdss', $name, $price, $category, $image);
    } else {
        $id = intval($data['id']);
        $stmt = $conn->prepare('UPDATE products SET name = ?, price = ?, category = ?, image = ? WHERE id = ?');
        $stmt->bind_param('sdssi', $name, $price, $category, $image, $id);
    }

    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['error' => 'Database insert/update failed: ' . $stmt->error]);
        exit;
    }

    $insertedId = isset($id) && $id ? $id : $conn->insert_id;
    $result = $conn->query("SELECT id, name, price, category, image FROM products WHERE id = $insertedId");
    $product = $result ? $result->fetch_assoc() : null;
    echo json_encode(['success' => true, 'product' => $product]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
