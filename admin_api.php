<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (!$data) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON data']);
        exit;
    }

    $action = $data['action'] ?? '';

    if ($action === 'add_product') {
        // Admin add product
        $name = $conn->real_escape_string($data['name'] ?? '');
        $price = floatval($data['price'] ?? 0);
        $category = $conn->real_escape_string($data['category'] ?? 'General');
        $image = $conn->real_escape_string($data['image'] ?? '🛒');

        if (empty($name) || $price <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Name and valid price are required']);
            exit;
        }

        $stmt = $conn->prepare('INSERT INTO products (name, price, category, image) VALUES (?, ?, ?, ?)');
        $stmt->bind_param('sdss', $name, $price, $category, $image);

        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(['error' => 'Product add failed: ' . $stmt->error]);
            exit;
        }

        $productId = $conn->insert_id;
        $result = $conn->query("SELECT id, name, price, category, image FROM products WHERE id = $productId");
        $product = $result ? $result->fetch_assoc() : null;

        echo json_encode(['success' => true, 'product' => $product]);
        exit;

    } elseif ($action === 'update_product') {
        // Admin update product
        $id = intval($data['id'] ?? 0);
        $name = $conn->real_escape_string($data['name'] ?? '');
        $price = floatval($data['price'] ?? 0);
        $category = $conn->real_escape_string($data['category'] ?? 'General');
        $image = $conn->real_escape_string($data['image'] ?? '🛒');

        if ($id <= 0 || empty($name) || $price <= 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid ID, name, and price are required']);
            exit;
        }

        $stmt = $conn->prepare('UPDATE products SET name = ?, price = ?, category = ?, image = ? WHERE id = ?');
        $stmt->bind_param('sdssi', $name, $price, $category, $image, $id);

        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(['error' => 'Product update failed: ' . $stmt->error]);
            exit;
        }

        $result = $conn->query("SELECT id, name, price, category, image FROM products WHERE id = $id");
        $product = $result ? $result->fetch_assoc() : null;

        echo json_encode(['success' => true, 'product' => $product]);
        exit;

    } elseif ($action === 'delete_product') {
        // Admin delete product (but since user said not to delete, maybe disable this)
        http_response_code(403);
        echo json_encode(['error' => 'Product deletion is not allowed']);
        exit;

    } elseif ($action === 'get_products') {
        // Get all products
        $result = $conn->query('SELECT id, name, price, category, image FROM products ORDER BY id DESC');

        if (!$result) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to fetch products']);
            exit;
        }

        $products = [];
        while ($row = $result->fetch_assoc()) {
            $products[] = $row;
        }

        echo json_encode(['success' => true, 'products' => $products]);
        exit;
    }
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>