<?php
ini_set('display_errors', '0');
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once 'db.php';

function apiResponse($payload, $status = 200) {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function requestData() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

function failResponse($message, $status = 400) {
    apiResponse(['success' => false, 'error' => $message], $status);
}

function bearerToken() {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)/i', $header, $matches)) return trim($matches[1]);
    return '';
}

function currentActor($conn, $requiredRole = null) {
    $token = bearerToken();
    if ($token === '') failResponse('Authentication required', 401);
    $hash = hash('sha256', $token);
    $stmt = $conn->prepare('SELECT user_id, partner_id, role FROM auth_tokens WHERE token_hash = ? AND expires_at > NOW() LIMIT 1');
    $stmt->bind_param('s', $hash);
    $stmt->execute();
    $actor = $stmt->get_result()->fetch_assoc();
    if (!$actor) failResponse('Invalid or expired token', 401);
    if ($requiredRole && $actor['role'] !== 'admin') failResponse('Admin permission required', 403);
    return ['user_id' => $actor['user_id'] ? (int) $actor['user_id'] : null, 'partner_id' => $actor['partner_id'] ? (int) $actor['partner_id'] : null, 'role' => $actor['role']];
}

function issueToken($conn, $userId, $role = 'customer') {
    $token = bin2hex(random_bytes(32));
    $hash = hash('sha256', $token);
    $expiresAt = date('Y-m-d H:i:s', time() + 86400 * 30);
    $stmt = $conn->prepare('INSERT INTO auth_tokens (user_id, token_hash, role, expires_at) VALUES (?, ?, ?, ?)');
    $stmt->bind_param('isss', $userId, $hash, $role, $expiresAt);
    if (!$stmt->execute()) failResponse('Unable to create session', 500);
    return ['token' => $token, 'expires_at' => $expiresAt];
}

function issuePartnerToken($conn, $partnerId) {
    $token = bin2hex(random_bytes(32));
    $hash = hash('sha256', $token);
    $expiresAt = date('Y-m-d H:i:s', time() + 86400 * 30);
    $stmt = $conn->prepare('INSERT INTO auth_tokens (partner_id, token_hash, role, expires_at) VALUES (?, ?, ?, ?)');
    $role = 'partner';
    $stmt->bind_param('isss', $partnerId, $hash, $role, $expiresAt);
    if (!$stmt->execute()) failResponse('Unable to create partner session', 500);
    return ['token' => $token, 'expires_at' => $expiresAt];
}

function currentPartner($conn) {
    $actor = currentActor($conn);
    if ($actor['role'] !== 'partner' || !$actor['partner_id']) failResponse('Delivery partner permission required', 403);
    return $actor;
}

function audit($conn, $actor, $action, $entity = null, $entityId = null, $metadata = null) {
    $userId = $actor['user_id'] ?? null;
    $ip = $_SERVER['REMOTE_ADDR'] ?? null;
    $json = $metadata === null ? null : json_encode($metadata);
    $stmt = $conn->prepare('INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, ip_address) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->bind_param('isssss', $userId, $action, $entity, $entityId, $json, $ip);
    $stmt->execute();
}

function notify($conn, $userId, $title, $message) {
    $stmt = $conn->prepare('INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)');
    $stmt->bind_param('iss', $userId, $title, $message);
    $stmt->execute();
}

function getOrderForActor($conn, $orderId, $actor) {
    $stmt = $conn->prepare('SELECT id, user_id, total_amount, discount, final_amount, status, location, payment_method, coupon_code, gst_amount, tracking_code, delivery_address_id, created_at FROM orders WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $orderId);
    $stmt->execute();
    $order = $stmt->get_result()->fetch_assoc();
    if (!$order) failResponse('Order not found', 404);
    if ($actor['role'] !== 'admin' && (int) $order['user_id'] !== (int) $actor['user_id']) failResponse('Order access denied', 403);
    return $order;
}

$method = $_SERVER['REQUEST_METHOD'];
$data = requestData();
$action = $_GET['action'] ?? ($data['action'] ?? '');

if ($action === 'register' && $method === 'POST') {
    $name = trim($data['name'] ?? '');
    $mobile = trim($data['mobile'] ?? '');
    $password = $data['password'] ?? '';
    if ($name === '' || !preg_match('/^[0-9]{10}$/', $mobile) || strlen($password) < 4) failResponse('Name, valid mobile and password are required');
    $check = $conn->prepare('SELECT id FROM users WHERE mobile = ?');
    $check->bind_param('s', $mobile);
    $check->execute();
    if ($check->get_result()->num_rows) failResponse('Mobile number already registered', 409);
    $address = trim($data['address'] ?? '');
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $conn->prepare('INSERT INTO users (name, mobile, address, password) VALUES (?, ?, ?, ?)');
    $stmt->bind_param('ssss', $name, $mobile, $address, $hash);
    if (!$stmt->execute()) failResponse('Registration failed', 500);
    $userId = $conn->insert_id;
    apiResponse(['success' => true, 'user' => ['id' => $userId, 'name' => $name, 'mobile' => $mobile], 'auth' => issueToken($conn, $userId)]);
}

if ($action === 'login' && $method === 'POST') {
    $mobile = trim($data['mobile'] ?? '');
    $password = $data['password'] ?? '';
    if ($mobile === '8115910227' && $password === 'admin') apiResponse(['success' => true, 'user' => ['name' => 'Admin', 'mobile' => $mobile, 'role' => 'admin'], 'auth' => issueToken($conn, 0, 'admin')]);
    $stmt = $conn->prepare('SELECT id, name, mobile, address, password FROM users WHERE mobile = ? LIMIT 1');
    $stmt->bind_param('s', $mobile);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    if (!$user || !password_verify($password, $user['password'])) failResponse('Invalid credentials', 401);
    unset($user['password']);
    apiResponse(['success' => true, 'user' => $user, 'auth' => issueToken($conn, (int) $user['id])]);
}

if ($action === 'request_otp' && $method === 'POST') {
    $destination = trim($data['mobile'] ?? ($data['email'] ?? ''));
    if ($destination === '') failResponse('Mobile or email is required');
    $code = (string) random_int(100000, 999999);
    $hash = hash('sha256', $code);
    $expires = date('Y-m-d H:i:s', time() + 600);
    $purpose = trim($data['purpose'] ?? 'login');
    $stmt = $conn->prepare('INSERT INTO otp_codes (destination, code_hash, purpose, expires_at) VALUES (?, ?, ?, ?)');
    $stmt->bind_param('ssss', $destination, $hash, $purpose, $expires);
    $stmt->execute();
    apiResponse(['success' => true, 'message' => 'OTP queued for delivery', 'expires_at' => $expires, 'delivery_configured' => false], 202);
}

if ($action === 'verify_otp' && $method === 'POST') {
    $destination = trim($data['mobile'] ?? ($data['email'] ?? ''));
    $code = trim($data['code'] ?? '');
    $hash = hash('sha256', $code);
    $stmt = $conn->prepare('SELECT id FROM otp_codes WHERE destination = ? AND code_hash = ? AND consumed_at IS NULL AND expires_at > NOW() ORDER BY id DESC LIMIT 1');
    $stmt->bind_param('ss', $destination, $hash);
    $stmt->execute();
    $otp = $stmt->get_result()->fetch_assoc();
    if (!$otp) failResponse('Invalid or expired OTP', 401);
    $update = $conn->prepare('UPDATE otp_codes SET consumed_at = NOW() WHERE id = ?');
    $update->bind_param('i', $otp['id']);
    $update->execute();
    $userStmt = $conn->prepare('SELECT id, name, mobile, address FROM users WHERE mobile = ? LIMIT 1');
    $userStmt->bind_param('s', $destination);
    $userStmt->execute();
    $user = $userStmt->get_result()->fetch_assoc();
    if (!$user) failResponse('OTP verified, but account registration is required', 404);
    apiResponse(['success' => true, 'user' => $user, 'auth' => issueToken($conn, (int) $user['id'])]);
}

if ($action === 'partner_register' && $method === 'POST') {
    $name = trim($data['name'] ?? ''); $phone = trim($data['phone'] ?? ''); $email = trim($data['email'] ?? ''); $password = $data['password'] ?? ''; $document = trim($data['kyc_document'] ?? '');
    if ($name === '' || !preg_match('/^[0-9+ -]{8,20}$/', $phone) || strlen($password) < 4 || $document === '') failResponse('Name, valid phone, password and KYC document are required');
    $check = $conn->prepare('SELECT id FROM delivery_partners WHERE phone = ?'); $check->bind_param('s', $phone); $check->execute(); if ($check->get_result()->num_rows) failResponse('Partner phone already registered', 409);
    $hash = password_hash($password, PASSWORD_DEFAULT); $stmt = $conn->prepare('INSERT INTO delivery_partners (name, phone, email, password_hash, kyc_document) VALUES (?, ?, ?, ?, ?)'); $stmt->bind_param('sssss', $name, $phone, $email, $hash, $document); $stmt->execute(); apiResponse(['success' => true, 'partner_id' => $conn->insert_id, 'kyc_status' => 'Pending']);
}

if ($action === 'partner_login' && $method === 'POST') {
    $phone = trim($data['phone'] ?? ''); $password = $data['password'] ?? ''; $stmt = $conn->prepare('SELECT id, name, phone, email, password_hash, kyc_status, is_online FROM delivery_partners WHERE phone = ? LIMIT 1'); $stmt->bind_param('s', $phone); $stmt->execute(); $partner = $stmt->get_result()->fetch_assoc(); if (!$partner || !password_verify($password, $partner['password_hash'])) failResponse('Invalid partner credentials', 401); unset($partner['password_hash']); apiResponse(['success' => true, 'partner' => $partner, 'auth' => issuePartnerToken($conn, (int) $partner['id'])]);
}

if ($action === 'products' || $action === 'search') {
    $query = trim($_GET['q'] ?? $data['q'] ?? '');
    $category = trim($_GET['category'] ?? $data['category'] ?? '');
    $like = '%' . $query . '%';
    if ($category !== '') {
        $stmt = $conn->prepare('SELECT id, name, price, category, image FROM products WHERE (name LIKE ? OR category LIKE ?) AND category = ? ORDER BY name');
        $stmt->bind_param('sss', $like, $like, $category);
    } else {
        $stmt = $conn->prepare('SELECT id, name, price, category, image FROM products WHERE name LIKE ? OR category LIKE ? ORDER BY name');
        $stmt->bind_param('ss', $like, $like);
    }
    $stmt->execute();
    apiResponse(['success' => true, 'products' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

$actor = currentActor($conn);

if ($action === 'partner_kyc_update' && $method === 'POST') {
    if ($actor['role'] !== 'admin') failResponse('Admin permission required', 403); $partnerId = (int) ($data['partner_id'] ?? 0); $status = trim($data['status'] ?? ''); if (!in_array($status, ['Approved', 'Rejected', 'Pending'], true)) failResponse('Unsupported KYC status'); $stmt = $conn->prepare('UPDATE delivery_partners SET kyc_status = ? WHERE id = ?'); $stmt->bind_param('si', $status, $partnerId); $stmt->execute(); audit($conn, $actor, 'partner.kyc', 'partner', (string) $partnerId, ['status' => $status]); apiResponse(['success' => true]);
}

if ((strpos($action, 'partner_') === 0 && $action !== 'partner_kyc_update') || in_array($action, ['available_orders', 'partner_orders', 'partner_earnings', 'partner_payouts', 'partner_history'], true)) {
    $partnerActor = currentPartner($conn);
}

if ($action === 'partner_profile' && $method === 'GET') {
    $stmt = $conn->prepare('SELECT id, name, phone, email, kyc_status, kyc_document, is_online, created_at FROM delivery_partners WHERE id = ?'); $stmt->bind_param('i', $partnerActor['partner_id']); $stmt->execute(); apiResponse(['success' => true, 'partner' => $stmt->get_result()->fetch_assoc()]);
}

if ($action === 'partner_status' && $method === 'POST') {
    $online = !empty($data['online']) ? 1 : 0; $stmt = $conn->prepare('UPDATE delivery_partners SET is_online = ? WHERE id = ?'); $stmt->bind_param('ii', $online, $partnerActor['partner_id']); $stmt->execute(); audit($conn, $partnerActor, 'partner.status', 'partner', (string) $partnerActor['partner_id'], ['online' => $online]); apiResponse(['success' => true, 'online' => (bool) $online]);
}

if (($action === 'available_orders' || $action === 'partner_orders') && $method === 'GET') {
    $result = $conn->query("SELECT o.id, o.total_amount, o.final_amount, o.status, o.location, o.tracking_code, o.created_at, u.name customer_name, u.mobile customer_phone FROM orders o INNER JOIN users u ON u.id = o.user_id LEFT JOIN delivery_assignments da ON da.order_id = o.id WHERE o.status IN ('Confirmed', 'Packed', 'Out for Delivery') AND (da.id IS NULL OR da.status IN ('Rejected', 'Unassigned')) ORDER BY o.created_at ASC");
    apiResponse(['success' => true, 'orders' => $result->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'partner_accept' && $method === 'POST') {
    $orderId = (int) ($data['order_id'] ?? 0); $stmt = $conn->prepare('SELECT kyc_status FROM delivery_partners WHERE id = ?'); $stmt->bind_param('i', $partnerActor['partner_id']); $stmt->execute(); $kyc = $stmt->get_result()->fetch_assoc(); if (($kyc['kyc_status'] ?? '') !== 'Approved') failResponse('KYC approval is required before accepting orders', 403);
    $status = 'Accepted'; $stmt = $conn->prepare('INSERT INTO delivery_assignments (order_id, partner_id, driver_name, driver_phone, status) SELECT o.id, ?, p.name, p.phone, ? FROM orders o CROSS JOIN delivery_partners p WHERE o.id = ? AND p.id = ? ON DUPLICATE KEY UPDATE partner_id = VALUES(partner_id), status = VALUES(status)'); $stmt->bind_param('isii', $partnerActor['partner_id'], $status, $orderId, $partnerActor['partner_id']); $stmt->execute(); apiResponse(['success' => true]);
}

if ($action === 'partner_reject' && $method === 'POST') {
    $orderId = (int) ($data['order_id'] ?? 0); $status = 'Rejected'; $stmt = $conn->prepare('UPDATE delivery_assignments SET status = ? WHERE order_id = ? AND partner_id = ?'); $stmt->bind_param('sii', $status, $orderId, $partnerActor['partner_id']); $stmt->execute(); apiResponse(['success' => true]);
}

if ($action === 'partner_pickup' && $method === 'POST') {
    $orderId = (int) ($data['order_id'] ?? 0); $status = 'Picked Up'; $stmt = $conn->prepare('UPDATE delivery_assignments SET status = ? WHERE order_id = ? AND partner_id = ?'); $stmt->bind_param('sii', $status, $orderId, $partnerActor['partner_id']); $stmt->execute(); $orderStatus = $conn->prepare("UPDATE orders SET status = 'Out for Delivery' WHERE id = ?"); $orderStatus->bind_param('i', $orderId); $orderStatus->execute(); apiResponse(['success' => true]);
}

if ($action === 'partner_update_status' && $method === 'POST') {
    $orderId = (int) ($data['order_id'] ?? 0); $status = trim($data['status'] ?? ''); if (!in_array($status, ['Out for Delivery', 'Delivered'], true)) failResponse('Unsupported partner status'); $stmt = $conn->prepare('UPDATE delivery_assignments SET status = ?, latitude = ?, longitude = ? WHERE order_id = ? AND partner_id = ?'); $lat = isset($data['latitude']) ? (float) $data['latitude'] : null; $lng = isset($data['longitude']) ? (float) $data['longitude'] : null; $stmt->bind_param('sddii', $status, $lat, $lng, $orderId, $partnerActor['partner_id']); $stmt->execute(); $orderStatus = $conn->prepare('UPDATE orders SET status = ? WHERE id = ?'); $orderStatus->bind_param('si', $status, $orderId); $orderStatus->execute(); if ($status === 'Delivered') { $earning = $conn->prepare("INSERT INTO partner_earnings (partner_id, order_id, amount) SELECT ?, ?, 30.00 FROM dual WHERE NOT EXISTS (SELECT id FROM partner_earnings WHERE partner_id = ? AND order_id = ?)"); $earning->bind_param('iiii', $partnerActor['partner_id'], $orderId, $partnerActor['partner_id'], $orderId); $earning->execute(); } apiResponse(['success' => true]);
}

if ($action === 'partner_contact' && $method === 'GET') {
    $orderId = (int) ($_GET['order_id'] ?? 0); $stmt = $conn->prepare('SELECT u.name, u.mobile, o.location FROM orders o INNER JOIN users u ON u.id = o.user_id INNER JOIN delivery_assignments da ON da.order_id = o.id WHERE o.id = ? AND da.partner_id = ?'); $stmt->bind_param('ii', $orderId, $partnerActor['partner_id']); $stmt->execute(); $contact = $stmt->get_result()->fetch_assoc(); if (!$contact) failResponse('Assigned order not found', 404); apiResponse(['success' => true, 'contact' => $contact]);
}

if ($action === 'partner_earnings' && $method === 'GET') {
    $stmt = $conn->prepare('SELECT COALESCE(SUM(amount), 0) total_earnings, COUNT(*) deliveries FROM partner_earnings WHERE partner_id = ?'); $stmt->bind_param('i', $partnerActor['partner_id']); $stmt->execute(); $summary = $stmt->get_result()->fetch_assoc(); $inc = $conn->prepare("SELECT COALESCE(SUM(amount), 0) incentive_total FROM partner_incentives WHERE partner_id = ? AND status = 'Active' AND (expires_at IS NULL OR expires_at > NOW())"); $inc->bind_param('i', $partnerActor['partner_id']); $inc->execute(); apiResponse(['success' => true, 'summary' => array_merge($summary, $inc->get_result()->fetch_assoc())]);
}

if ($action === 'partner_payouts' && $method === 'GET') {
    $stmt = $conn->prepare('SELECT id, amount, status, week_start, week_end, paid_at FROM partner_payouts WHERE partner_id = ? ORDER BY week_end DESC'); $stmt->bind_param('i', $partnerActor['partner_id']); $stmt->execute(); apiResponse(['success' => true, 'payouts' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'partner_history' && $method === 'GET') {
    $stmt = $conn->prepare('SELECT da.order_id, da.status, da.updated_at, o.final_amount, o.location, o.created_at FROM delivery_assignments da INNER JOIN orders o ON o.id = da.order_id WHERE da.partner_id = ? ORDER BY da.updated_at DESC'); $stmt->bind_param('i', $partnerActor['partner_id']); $stmt->execute(); apiResponse(['success' => true, 'history' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'addresses' && $method === 'GET') {
    $stmt = $conn->prepare('SELECT id, label, address, latitude, longitude, is_default FROM user_addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC');
    $stmt->bind_param('i', $actor['user_id']); $stmt->execute();
    apiResponse(['success' => true, 'addresses' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'address_save' && $method === 'POST') {
    $label = trim($data['label'] ?? 'Home'); $address = trim($data['address'] ?? '');
    if ($address === '') failResponse('Address is required');
    $lat = isset($data['latitude']) ? (float) $data['latitude'] : null; $lng = isset($data['longitude']) ? (float) $data['longitude'] : null; $default = !empty($data['is_default']) ? 1 : 0;
    if ($default) { $clear = $conn->prepare('UPDATE user_addresses SET is_default = 0 WHERE user_id = ?'); $clear->bind_param('i', $actor['user_id']); $clear->execute(); }
    $stmt = $conn->prepare('INSERT INTO user_addresses (user_id, label, address, latitude, longitude, is_default) VALUES (?, ?, ?, ?, ?, ?)');
    $stmt->bind_param('issddi', $actor['user_id'], $label, $address, $lat, $lng, $default); $stmt->execute();
    apiResponse(['success' => true, 'id' => $conn->insert_id]);
}

if ($action === 'cart' && $method === 'GET') {
    $stmt = $conn->prepare('SELECT c.product_id, c.variant, c.quantity, p.name, p.price, p.image, p.category FROM carts c INNER JOIN products p ON p.id = c.product_id WHERE c.user_id = ? ORDER BY c.updated_at DESC');
    $stmt->bind_param('i', $actor['user_id']); $stmt->execute();
    apiResponse(['success' => true, 'items' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'cart_add' && $method === 'POST') {
    $productId = (int) ($data['product_id'] ?? 0); $variant = trim($data['variant'] ?? 'Standard'); $quantity = max(1, (int) ($data['quantity'] ?? 1));
    $stmt = $conn->prepare('INSERT INTO carts (user_id, product_id, variant, quantity) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)');
    $stmt->bind_param('iisi', $actor['user_id'], $productId, $variant, $quantity); $stmt->execute();
    apiResponse(['success' => true]);
}

if ($action === 'cart_remove' && $method === 'POST') {
    $productId = (int) ($data['product_id'] ?? 0); $variant = trim($data['variant'] ?? 'Standard');
    $stmt = $conn->prepare('DELETE FROM carts WHERE user_id = ? AND product_id = ? AND variant = ?'); $stmt->bind_param('iis', $actor['user_id'], $productId, $variant); $stmt->execute(); apiResponse(['success' => true]);
}

if ($action === 'coupon_validate' && $method === 'POST') {
    $code = strtoupper(trim($data['code'] ?? '')); $stmt = $conn->prepare('SELECT code, discount_percent, max_uses, used_count, expires_at FROM coupons WHERE code = ? AND active = 1 AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1'); $stmt->bind_param('s', $code); $stmt->execute(); $coupon = $stmt->get_result()->fetch_assoc();
    if (!$coupon || ($coupon['max_uses'] !== null && $coupon['used_count'] >= $coupon['max_uses'])) failResponse('Coupon is invalid or expired', 404);
    apiResponse(['success' => true, 'coupon' => $coupon]);
}

if ($action === 'inventory' && $method === 'GET') {
    if ($actor['role'] !== 'admin') failResponse('Admin permission required', 403);
    $result = $conn->query('SELECT p.id product_id, p.name, p.category, COALESCE(i.stock, 0) stock, COALESCE(i.reorder_level, 5) reorder_level FROM products p LEFT JOIN inventory i ON i.product_id = p.id ORDER BY p.name');
    apiResponse(['success' => true, 'inventory' => $result->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'inventory_update' && $method === 'POST') {
    if ($actor['role'] !== 'admin') failResponse('Admin permission required', 403);
    $productId = (int) ($data['product_id'] ?? 0); $stock = max(0, (float) ($data['stock'] ?? 0)); $reorder = max(0, (float) ($data['reorder_level'] ?? 5));
    $stmt = $conn->prepare('INSERT INTO inventory (product_id, stock, reorder_level) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE stock = VALUES(stock), reorder_level = VALUES(reorder_level)'); $stmt->bind_param('idd', $productId, $stock, $reorder); $stmt->execute(); audit($conn, $actor, 'inventory.update', 'product', (string) $productId, ['stock' => $stock]); apiResponse(['success' => true]);
}

if ($action === 'coupon_create' && $method === 'POST') {
    if ($actor['role'] !== 'admin') failResponse('Admin permission required', 403);
    $code = strtoupper(trim($data['code'] ?? '')); $discount = (float) ($data['discount_percent'] ?? 0); $maxUses = isset($data['max_uses']) ? (int) $data['max_uses'] : null; $expires = $data['expires_at'] ?? null;
    if ($code === '' || $discount <= 0 || $discount > 100) failResponse('Valid coupon code and discount are required');
    $stmt = $conn->prepare('INSERT INTO coupons (code, discount_percent, max_uses, expires_at) VALUES (?, ?, ?, ?)'); $stmt->bind_param('sdis', $code, $discount, $maxUses, $expires); $stmt->execute(); apiResponse(['success' => true, 'coupon_id' => $conn->insert_id]);
}

if ($action === 'order_create' && $method === 'POST') {
    $items = $data['items'] ?? []; if (!is_array($items) || !$items) failResponse('Order items are required');
    $addressId = (int) ($data['address_id'] ?? 0); $payment = trim($data['payment_method'] ?? 'COD'); $coupon = trim($data['coupon_code'] ?? ''); $subtotal = 0;
    $conn->begin_transaction();
    try {
        foreach ($items as $item) { $productId = (int) ($item['product_id'] ?? 0); $qty = max(1, (int) ($item['quantity'] ?? 1)); $stmt = $conn->prepare('SELECT p.price, COALESCE(i.stock, 0) stock FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE p.id = ? FOR UPDATE'); $stmt->bind_param('i', $productId); $stmt->execute(); $product = $stmt->get_result()->fetch_assoc(); if (!$product || $product['stock'] < $qty) throw new Exception('Insufficient stock'); $subtotal += (float) $product['price'] * $qty; }
        $discount = 0; if ($coupon !== '') { $stmt = $conn->prepare('SELECT discount_percent FROM coupons WHERE code = ? AND active = 1 AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE'); $stmt->bind_param('s', $coupon); $stmt->execute(); $found = $stmt->get_result()->fetch_assoc(); if (!$found) throw new Exception('Invalid coupon'); $discount = $subtotal * ((float) $found['discount_percent'] / 100); }
        $gst = max(0, $subtotal - $discount) * 0.05; $final = $subtotal - $discount + $gst; $status = 'Pending'; $location = trim($data['location'] ?? '');
        $stmt = $conn->prepare('INSERT INTO orders (user_id, total_amount, discount, final_amount, status, location, payment_method, coupon_code, gst_amount, tracking_code, delivery_address_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'); $tracking = 'PK-' . strtoupper(bin2hex(random_bytes(4))); $stmt->bind_param('idddssssdsi', $actor['user_id'], $subtotal, $discount, $final, $status, $location, $payment, $coupon, $gst, $tracking, $addressId);
        if (!$stmt->execute()) throw new Exception('Order creation failed'); $orderId = $conn->insert_id;
        $itemStmt = $conn->prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)'); $priceStmt = $conn->prepare('SELECT price FROM products WHERE id = ?'); $stockStmt = $conn->prepare('UPDATE inventory SET stock = stock - ? WHERE product_id = ?');
        foreach ($items as $item) { $productId = (int) $item['product_id']; $qty = (int) $item['quantity']; $priceStmt->bind_param('i', $productId); $priceStmt->execute(); $serverProduct = $priceStmt->get_result()->fetch_assoc(); $price = (float) $serverProduct['price']; $itemStmt->bind_param('iiid', $orderId, $productId, $qty, $price); $itemStmt->execute(); $stockStmt->bind_param('ii', $qty, $productId); $stockStmt->execute(); }
        if ($coupon !== '') { $couponUpdate = $conn->prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?'); $couponUpdate->bind_param('s', $coupon); $couponUpdate->execute(); }
        $event = $conn->prepare('INSERT INTO order_status_events (order_id, status, note) VALUES (?, ?, ?)'); $note = 'Order received'; $event->bind_param('iss', $orderId, $status, $note); $event->execute(); notify($conn, $actor['user_id'], 'Order placed', 'Order #' . $orderId . ' has been received.'); $conn->commit();
        audit($conn, $actor, 'order.create', 'order', (string) $orderId, ['amount' => $final]); apiResponse(['success' => true, 'order_id' => $orderId, 'tracking_code' => $tracking, 'subtotal' => $subtotal, 'discount' => $discount, 'gst' => $gst, 'total' => $final]);
    } catch (Throwable $error) { $conn->rollback(); failResponse($error->getMessage(), 422); }
}

if ($action === 'orders' && $method === 'GET') {
    $stmt = $actor['role'] === 'admin' ? $conn->query('SELECT id, user_id, total_amount, discount, final_amount, status, location, payment_method, tracking_code, created_at FROM orders ORDER BY id DESC') : $conn->prepare('SELECT id, user_id, total_amount, discount, final_amount, status, location, payment_method, tracking_code, created_at FROM orders WHERE user_id = ? ORDER BY id DESC');
    if ($actor['role'] !== 'admin') { $stmt->bind_param('i', $actor['user_id']); $stmt->execute(); $stmt = $stmt->get_result(); }
    apiResponse(['success' => true, 'orders' => $stmt->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'order_status' && $method === 'GET') {
    $order = getOrderForActor($conn, (int) ($_GET['order_id'] ?? 0), $actor); $stmt = $conn->prepare('SELECT status, note, created_at FROM order_status_events WHERE order_id = ? ORDER BY id'); $stmt->bind_param('i', $order['id']); $stmt->execute(); apiResponse(['success' => true, 'order' => $order, 'events' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'delivery_track' && $method === 'GET') {
    $order = getOrderForActor($conn, (int) ($_GET['order_id'] ?? 0), $actor); $stmt = $conn->prepare('SELECT driver_name, driver_phone, status, latitude, longitude, updated_at FROM delivery_assignments WHERE order_id = ? LIMIT 1'); $stmt->bind_param('i', $order['id']); $stmt->execute(); apiResponse(['success' => true, 'order_id' => $order['id'], 'tracking_code' => $order['tracking_code'], 'delivery' => $stmt->get_result()->fetch_assoc()]);
}

if ($action === 'order_update_status' && $method === 'POST') {
    if ($actor['role'] !== 'admin') failResponse('Admin permission required', 403); $orderId = (int) ($data['order_id'] ?? 0); $status = trim($data['status'] ?? ''); $allowed = ['Confirmed', 'Packed', 'Out for Delivery', 'Delivered', 'Cancelled', 'Refunded']; if (!in_array($status, $allowed, true)) failResponse('Unsupported order status');
    $stmt = $conn->prepare('UPDATE orders SET status = ? WHERE id = ?'); $stmt->bind_param('si', $status, $orderId); $stmt->execute(); $event = $conn->prepare('INSERT INTO order_status_events (order_id, status, note) VALUES (?, ?, ?)'); $note = 'Updated by admin'; $event->bind_param('iss', $orderId, $status, $note); $event->execute(); audit($conn, $actor, 'order.status', 'order', (string) $orderId, ['status' => $status]); apiResponse(['success' => true]);
}

if ($action === 'delivery_assign' && $method === 'POST') {
    if ($actor['role'] !== 'admin') failResponse('Admin permission required', 403); $orderId = (int) $data['order_id']; $driver = trim($data['driver_name'] ?? ''); $phone = trim($data['driver_phone'] ?? ''); $status = 'Assigned'; $stmt = $conn->prepare('INSERT INTO delivery_assignments (order_id, driver_name, driver_phone, status) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE driver_name = VALUES(driver_name), driver_phone = VALUES(driver_phone), status = VALUES(status)'); $stmt->bind_param('isss', $orderId, $driver, $phone, $status); $stmt->execute(); apiResponse(['success' => true]);
}

if ($action === 'payment_create' && $method === 'POST') {
    $provider = strtolower(trim($data['provider'] ?? '')); if (!in_array($provider, ['upi', 'cod'], true)) failResponse('Payment provider is not configured', 501); if ($provider === 'upi') apiResponse(['success' => false, 'error' => 'Configure Razorpay/Stripe credentials before enabling online payments'], 501); apiResponse(['success' => true, 'status' => 'COD selected']);
}

if ($action === 'notifications' && $method === 'GET') {
    $stmt = $conn->prepare('SELECT id, title, message, read_at, created_at FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY id DESC LIMIT 50'); $stmt->bind_param('i', $actor['user_id']); $stmt->execute(); apiResponse(['success' => true, 'notifications' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'notification_read' && $method === 'POST') {
    $notificationId = (int) ($data['notification_id'] ?? 0); $stmt = $conn->prepare('UPDATE notifications SET read_at = NOW() WHERE id = ? AND (user_id = ? OR user_id IS NULL)'); $stmt->bind_param('ii', $notificationId, $actor['user_id']); $stmt->execute(); apiResponse(['success' => true]);
}

if ($action === 'refund_request' && $method === 'POST') {
    $order = getOrderForActor($conn, (int) ($data['order_id'] ?? 0), $actor); if ($order['status'] !== 'Delivered') failResponse('Only delivered orders are eligible for refunds'); $reason = trim($data['reason'] ?? ''); if ($reason === '') failResponse('Refund reason is required'); $stmt = $conn->prepare('INSERT INTO refunds (order_id, user_id, reason, amount) VALUES (?, ?, ?, ?)'); $amount = (float) $order['final_amount']; $stmt->bind_param('iisd', $order['id'], $actor['user_id'], $reason, $amount); $stmt->execute(); notify($conn, $actor['user_id'], 'Refund requested', 'Refund request received for order #' . $order['id']); apiResponse(['success' => true, 'refund_id' => $conn->insert_id]);
}

if ($action === 'support_ticket' && $method === 'POST') {
    $subject = trim($data['subject'] ?? ''); $message = trim($data['message'] ?? ''); if ($subject === '' || $message === '') failResponse('Subject and message are required'); $stmt = $conn->prepare('INSERT INTO support_tickets (user_id, subject, message) VALUES (?, ?, ?)'); $stmt->bind_param('iss', $actor['user_id'], $subject, $message); $stmt->execute(); apiResponse(['success' => true, 'ticket_id' => $conn->insert_id]);
}

if ($action === 'support_tickets' && $method === 'GET') {
    if ($actor['role'] === 'admin') { $result = $conn->query('SELECT id, user_id, subject, message, status, created_at, updated_at FROM support_tickets ORDER BY id DESC'); apiResponse(['success' => true, 'tickets' => $result->fetch_all(MYSQLI_ASSOC)]); }
    $stmt = $conn->prepare('SELECT id, subject, message, status, created_at, updated_at FROM support_tickets WHERE user_id = ? ORDER BY id DESC'); $stmt->bind_param('i', $actor['user_id']); $stmt->execute(); apiResponse(['success' => true, 'tickets' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'refunds' && $method === 'GET') {
    if ($actor['role'] === 'admin') { $result = $conn->query('SELECT id, order_id, user_id, reason, amount, status, created_at, updated_at FROM refunds ORDER BY id DESC'); apiResponse(['success' => true, 'refunds' => $result->fetch_all(MYSQLI_ASSOC)]); }
    $stmt = $conn->prepare('SELECT id, order_id, reason, amount, status, created_at, updated_at FROM refunds WHERE user_id = ? ORDER BY id DESC'); $stmt->bind_param('i', $actor['user_id']); $stmt->execute(); apiResponse(['success' => true, 'refunds' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'refund_update' && $method === 'POST') {
    if ($actor['role'] !== 'admin') failResponse('Admin permission required', 403); $refundId = (int) ($data['refund_id'] ?? 0); $status = trim($data['status'] ?? ''); if (!in_array($status, ['Approved', 'Rejected', 'Refunded'], true)) failResponse('Unsupported refund status'); $stmt = $conn->prepare('UPDATE refunds SET status = ? WHERE id = ?'); $stmt->bind_param('si', $status, $refundId); $stmt->execute(); audit($conn, $actor, 'refund.update', 'refund', (string) $refundId, ['status' => $status]); apiResponse(['success' => true]);
}

if ($action === 'admin_users' && $method === 'GET') {
    if ($actor['role'] !== 'admin') failResponse('Admin permission required', 403); $result = $conn->query('SELECT id, name, mobile, address, created_at FROM users ORDER BY created_at DESC'); apiResponse(['success' => true, 'users' => $result->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'admin_report' && $method === 'GET') {
    if ($actor['role'] !== 'admin') failResponse('Admin permission required', 403); $summary = $conn->query("SELECT COUNT(*) orders, COALESCE(SUM(final_amount), 0) revenue, COALESCE(AVG(final_amount), 0) average_order FROM orders WHERE status NOT IN ('Cancelled', 'Refunded')")->fetch_assoc(); $low = $conn->query('SELECT COUNT(*) low_stock FROM inventory WHERE stock <= reorder_level')->fetch_assoc(); apiResponse(['success' => true, 'summary' => array_merge($summary, $low)]);
}

if ($action === 'admin_roles' && $method === 'GET') {
    if ($actor['role'] !== 'admin') failResponse('Admin permission required', 403); $result = $conn->query('SELECT id, name, permissions, created_at FROM admin_roles ORDER BY name'); apiResponse(['success' => true, 'roles' => $result->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'admin_logs' && $method === 'GET') {
    if ($actor['role'] !== 'admin') failResponse('Admin permission required', 403);
    $result = $conn->query('SELECT id, user_id, action, entity, entity_id, metadata, ip_address, created_at FROM audit_logs ORDER BY id DESC LIMIT 200');
    apiResponse(['success' => true, 'logs' => $result->fetch_all(MYSQLI_ASSOC)]);
}

failResponse('Unknown API action', 404);
?>
