<?php
ini_set('display_errors', 0);
error_reporting(0);
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
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

    if ($action === 'register') {
        // User registration
        $name = $conn->real_escape_string($data['name'] ?? '');
        $mobile = $conn->real_escape_string($data['mobile'] ?? '');
        $address = $conn->real_escape_string($data['address'] ?? '');
        $passwordInput = $data['password'] ?? '';

        if (empty($name) || empty($mobile) || empty($address) || empty($passwordInput)) {
            http_response_code(400);
            echo json_encode(['error' => 'All fields are required']);
            exit;
        }

        $password = password_hash($passwordInput, PASSWORD_DEFAULT);

        // Check if user already exists
        $checkStmt = $conn->prepare('SELECT id FROM users WHERE mobile = ?');
        $checkStmt->bind_param('s', $mobile);
        $checkStmt->execute();
        $result = $checkStmt->get_result();

        if ($result->num_rows > 0) {
            http_response_code(409);
            echo json_encode(['error' => 'Mobile number already registered']);
            exit;
        }

        // Insert new user
        $stmt = $conn->prepare('INSERT INTO users (name, mobile, address, password) VALUES (?, ?, ?, ?)');
        $stmt->bind_param('ssss', $name, $mobile, $address, $password);

        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(['error' => 'Registration failed: ' . $stmt->error]);
            exit;
        }

        $userId = $conn->insert_id;
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $userId,
                'name' => $name,
                'mobile' => $mobile,
                'address' => $address
            ]
        ]);
        exit;

    } elseif ($action === 'login') {
        // User login
        $mobile = $conn->real_escape_string($data['mobile'] ?? '');
        $password = $data['password'] ?? '';

        if (empty($mobile) || empty($password)) {
            http_response_code(400);
            echo json_encode(['error' => 'Mobile and password are required']);
            exit;
        }

        // Check if admin login
        if ($mobile === '8115910227' && $password === 'admin') {
            echo json_encode([
                'success' => true,
                'user' => [
                    'mobile' => '8115910227',
                    'name' => 'Admin',
                    'isAdmin' => true
                ]
            ]);
            exit;
        }

        // Regular user login
        $stmt = $conn->prepare('SELECT id, name, mobile, address, password FROM users WHERE mobile = ?');
        $stmt->bind_param('s', $mobile);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            http_response_code(401);
            echo json_encode(['error' => 'User not found']);
            exit;
        }

        $user = $result->fetch_assoc();

        if (!password_verify($password, $user['password'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid password']);
            exit;
        }

        // Remove password from response
        unset($user['password']);

        echo json_encode([
            'success' => true,
            'user' => $user
        ]);
        exit;

    } elseif ($action === 'get_users') {
        // Get all users (for admin)
        $result = $conn->query('SELECT id, name, mobile, address, created_at FROM users ORDER BY created_at DESC');

        if (!$result) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to fetch users']);
            exit;
        }

        $users = [];
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }

        echo json_encode(['success' => true, 'users' => $users]);
        exit;

    } elseif ($action === 'update_profile') {
        // Update user profile
        $mobile = $conn->real_escape_string($data['mobile'] ?? '');
        $name = $conn->real_escape_string($data['name'] ?? '');
        $address = $conn->real_escape_string($data['address'] ?? '');

        if (empty($mobile) || empty($name) || empty($address)) {
            http_response_code(400);
            echo json_encode(['error' => 'All fields are required']);
            exit;
        }

        $stmt = $conn->prepare('UPDATE users SET name = ?, address = ? WHERE mobile = ?');
        $stmt->bind_param('sss', $name, $address, $mobile);

        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(['error' => 'Profile update failed: ' . $stmt->error]);
            exit;
        }

        echo json_encode(['success' => true]);
        exit;
    } elseif ($action === 'submit_rating') {
        $mobile = trim((string) ($data['mobile'] ?? ''));
        $rating = (int) ($data['rating'] ?? 0);
        $review = trim((string) ($data['review'] ?? ''));
        $reviewImage = $data['review_image'] ?? '';
        $productId = isset($data['product_id']) && $data['product_id'] !== '' && $data['product_id'] !== null ? (int) $data['product_id'] : null;
        if ($productId !== null && $productId <= 0) {
            $productId = null;
        }

        if ($mobile === '' || $rating < 1 || $rating > 5) {
            http_response_code(400);
            echo json_encode(['error' => 'Valid mobile number and rating are required']);
            exit;
        }

        $userStmt = $conn->prepare('SELECT id FROM users WHERE mobile = ?');
        $userStmt->bind_param('s', $mobile);
        $userStmt->execute();
        $userResult = $userStmt->get_result();
        if ($userResult->num_rows === 0) {
            http_response_code(404);
            echo json_encode(['error' => 'User not found']);
            exit;
        }
        $userId = (int) $userResult->fetch_assoc()['id'];

        if ($productId !== null) {
            $productStmt = $conn->prepare('SELECT id FROM products WHERE id = ?');
            $productStmt->bind_param('i', $productId);
            $productStmt->execute();
            if ($productStmt->get_result()->num_rows === 0) {
                http_response_code(404);
                echo json_encode(['error' => 'Product not found. Please refresh the order and try again.']);
                exit;
            }
        }

        if ($productId === null) {
            $existingStmt = $conn->prepare('SELECT id FROM ratings WHERE user_id = ? AND product_id IS NULL');
            $existingStmt->bind_param('i', $userId);
            $existingStmt->execute();
            $existingRating = $existingStmt->get_result();

            if ($existingRating->num_rows > 0) {
                $ratingId = (int) $existingRating->fetch_assoc()['id'];
                $stmt = $conn->prepare('UPDATE ratings SET rating = ?, review = ?, review_image = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?');
                $stmt->bind_param('issi', $rating, $review, $reviewImage, $ratingId);
            } else {
                $stmt = $conn->prepare('INSERT INTO ratings (user_id, product_id, rating, review, review_image) VALUES (?, NULL, ?, ?, ?)');
                $stmt->bind_param('iiss', $userId, $rating, $review, $reviewImage);
            }
        } else {
            $existingStmt = $conn->prepare('SELECT id FROM ratings WHERE user_id = ? AND product_id = ? LIMIT 1');
            $existingStmt->bind_param('ii', $userId, $productId);
            $existingStmt->execute();
            $existingRating = $existingStmt->get_result();

            if ($existingRating->num_rows > 0) {
                $ratingId = (int) $existingRating->fetch_assoc()['id'];
                $stmt = $conn->prepare('UPDATE ratings SET rating = ?, review = ?, review_image = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?');
                $stmt->bind_param('issi', $rating, $review, $reviewImage, $ratingId);
            } else {
                $stmt = $conn->prepare('INSERT INTO ratings (user_id, product_id, rating, review, review_image) VALUES (?, ?, ?, ?, ?)');
                $stmt->bind_param('iiiss', $userId, $productId, $rating, $review, $reviewImage);
            }
        }
        if (!$stmt->execute()) {
            http_response_code(500);
            echo json_encode(['error' => 'Rating could not be saved: ' . $stmt->error]);
            exit;
        }

        echo json_encode(['success' => true]);
        exit;
    } elseif ($action === 'view_product') {
        $productId = (int) ($data['product_id'] ?? 0);
        $viewerKey = trim($data['viewer_key'] ?? '');
        if ($productId <= 0 || $viewerKey === '') {
            http_response_code(400);
            echo json_encode(['error' => 'Product and viewer are required']);
            exit;
        }

        $stmt = $conn->prepare('INSERT IGNORE INTO product_views (product_id, viewer_key) VALUES (?, ?)');
        $stmt->bind_param('is', $productId, $viewerKey);
        $stmt->execute();
        echo json_encode(['success' => true]);
        exit;
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        exit;
    }
} elseif ($method === 'GET') {
    // Get user by mobile (for profile loading)
    $mobile = $_GET['mobile'] ?? '';

    if (empty($mobile)) {
        http_response_code(400);
        echo json_encode(['error' => 'Mobile number required']);
        exit;
    }

    $stmt = $conn->prepare('SELECT id, name, mobile, address FROM users WHERE mobile = ?');
    $stmt->bind_param('s', $mobile);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        exit;
    }

    $user = $result->fetch_assoc();
    echo json_encode(['success' => true, 'user' => $user]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>