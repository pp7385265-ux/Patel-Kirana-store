<?php
$host = 'localhost';
$user = 'root';
$password = '';
$dbname = 'kirana_store';

$conn = new mysqli($host, $user, $password, $dbname);
if ($conn->connect_error) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]);
    exit;
}
$conn->set_charset('utf8mb4');

// Keep older installations compatible with the review and product-view features.
$schemaQueries = [
    "CREATE TABLE IF NOT EXISTS auth_tokens (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        role VARCHAR(30) NOT NULL DEFAULT 'customer',
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX auth_tokens_user_idx (user_id),
        INDEX auth_tokens_expiry_idx (expires_at)
    )",
    "CREATE TABLE IF NOT EXISTS delivery_partners (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        phone VARCHAR(20) NOT NULL UNIQUE,
        email VARCHAR(190) NULL,
        password_hash VARCHAR(255) NOT NULL,
        kyc_status VARCHAR(30) NOT NULL DEFAULT 'Pending',
        kyc_document TEXT NULL,
        is_online TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )",
    "ALTER TABLE auth_tokens ADD COLUMN partner_id INT NULL",
    "CREATE TABLE IF NOT EXISTS otp_codes (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        destination VARCHAR(190) NOT NULL,
        code_hash CHAR(64) NOT NULL,
        purpose VARCHAR(30) NOT NULL DEFAULT 'login',
        attempts TINYINT NOT NULL DEFAULT 0,
        expires_at DATETIME NOT NULL,
        consumed_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX otp_destination_idx (destination, purpose, expires_at)
    )",
    "CREATE TABLE IF NOT EXISTS user_addresses (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        label VARCHAR(50) NOT NULL,
        address TEXT NOT NULL,
        latitude DECIMAL(10,7) NULL,
        longitude DECIMAL(10,7) NULL,
        is_default TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )",
    "CREATE TABLE IF NOT EXISTS inventory (
        product_id INT PRIMARY KEY,
        stock DECIMAL(10,2) NOT NULL DEFAULT 0,
        reorder_level DECIMAL(10,2) NOT NULL DEFAULT 5,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )",
    "CREATE TABLE IF NOT EXISTS coupons (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(40) NOT NULL UNIQUE,
        discount_percent DECIMAL(5,2) NOT NULL,
        max_uses INT NULL,
        used_count INT NOT NULL DEFAULT 0,
        expires_at DATETIME NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )",
    "CREATE TABLE IF NOT EXISTS carts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        variant VARCHAR(50) NOT NULL DEFAULT 'Standard',
        quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY cart_item_unique (user_id, product_id, variant),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )",
    "ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(40) NULL",
    "ALTER TABLE orders ADD COLUMN gst_amount DECIMAL(10,2) NOT NULL DEFAULT 0",
    "ALTER TABLE orders ADD COLUMN tracking_code VARCHAR(80) NULL",
    "ALTER TABLE orders ADD COLUMN delivery_address_id BIGINT NULL",
    "CREATE TABLE IF NOT EXISTS order_status_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        status VARCHAR(50) NOT NULL,
        note VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX order_status_order_idx (order_id),
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )",
    "CREATE TABLE IF NOT EXISTS delivery_assignments (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL UNIQUE,
        partner_id INT NULL,
        driver_name VARCHAR(100) NULL,
        driver_phone VARCHAR(20) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'Unassigned',
        latitude DECIMAL(10,7) NULL,
        longitude DECIMAL(10,7) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )",
    "ALTER TABLE delivery_assignments ADD COLUMN partner_id INT NULL",
    "CREATE TABLE IF NOT EXISTS partner_earnings (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        partner_id INT NOT NULL,
        order_id INT NULL,
        amount DECIMAL(10,2) NOT NULL,
        kind VARCHAR(30) NOT NULL DEFAULT 'Delivery',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (partner_id) REFERENCES delivery_partners(id) ON DELETE CASCADE
    )",
    "CREATE TABLE IF NOT EXISTS partner_incentives (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        partner_id INT NOT NULL,
        title VARCHAR(150) NOT NULL,
        amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'Active',
        expires_at DATETIME NULL,
        FOREIGN KEY (partner_id) REFERENCES delivery_partners(id) ON DELETE CASCADE
    )",
    "CREATE TABLE IF NOT EXISTS partner_payouts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        partner_id INT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'Pending',
        week_start DATE NOT NULL,
        week_end DATE NOT NULL,
        paid_at DATETIME NULL,
        FOREIGN KEY (partner_id) REFERENCES delivery_partners(id) ON DELETE CASCADE
    )",
    "CREATE TABLE IF NOT EXISTS stores (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        area VARCHAR(150) NOT NULL,
        capacity INT NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )",
    "CREATE TABLE IF NOT EXISTS notifications (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        read_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )",
    "ALTER TABLE notifications ADD COLUMN user_id INT NULL",
    "ALTER TABLE notifications ADD COLUMN title VARCHAR(150) NULL",
    "ALTER TABLE notifications ADD COLUMN read_at DATETIME NULL",
    "CREATE TABLE IF NOT EXISTS refunds (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        user_id INT NOT NULL,
        reason TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Requested',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )",
    "CREATE TABLE IF NOT EXISTS support_tickets (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        subject VARCHAR(180) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'Open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )",
    "CREATE TABLE IF NOT EXISTS admin_roles (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        permissions JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )",
    "CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(100) NOT NULL,
        entity VARCHAR(100) NULL,
        entity_id VARCHAR(80) NULL,
        metadata JSON NULL,
        ip_address VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX audit_logs_created_idx (created_at)
    )",
    "CREATE TABLE IF NOT EXISTS app_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value VARCHAR(255) NOT NULL
    )",
    "CREATE TABLE IF NOT EXISTS ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NULL,
        rating INT NOT NULL,
        review TEXT NULL,
        review_image LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY ratings_user_product_unique (user_id, product_id)
    )",
    "ALTER TABLE ratings ADD COLUMN IF NOT EXISTS review TEXT NULL",
    "ALTER TABLE ratings ADD COLUMN IF NOT EXISTS review_image LONGTEXT NULL",
    "ALTER TABLE ratings ADD COLUMN IF NOT EXISTS product_id INT NULL",
    "ALTER TABLE ratings DROP INDEX IF EXISTS ratings_user_unique",
    "ALTER TABLE ratings DROP INDEX IF EXISTS ratings_user_product_unique",
    "ALTER TABLE ratings ADD UNIQUE INDEX ratings_user_product_unique (user_id, product_id)",
    "ALTER TABLE products MODIFY COLUMN image LONGTEXT NULL",
    "CREATE TABLE IF NOT EXISTS product_views (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        viewer_key VARCHAR(190) NOT NULL,
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        UNIQUE KEY product_viewer_unique (product_id, viewer_key)
    )"
];

foreach ($schemaQueries as $schemaQuery) {
    $conn->query($schemaQuery);
}

$offerResetKey = 'legacy_offers_cleared_v1';
$offerResetResult = $conn->query("SELECT setting_key FROM app_settings WHERE setting_key = '$offerResetKey' LIMIT 1");
if ($offerResetResult && $offerResetResult->num_rows === 0) {
    $conn->query('DELETE FROM offers');
    $conn->query("INSERT INTO app_settings (setting_key, setting_value) VALUES ('$offerResetKey', '1')");
}
