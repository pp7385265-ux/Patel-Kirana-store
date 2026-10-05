<?php
header('Content-Type: application/json; charset=utf-8');
require_once 'db.php';

$products = [];
$offers = [];
$reviews = [];
$productViews = [];

$productQuery = "SELECT id, name, price, category, image FROM products ORDER BY id ASC";
if ($result = $conn->query($productQuery)) {
    while ($row = $result->fetch_assoc()) {
        $row['price'] = (float) $row['price'];
        $row['category'] = $row['category'] ?? 'General';
        $row['image'] = $row['image'] ?? '🛒';
        $products[] = $row;
    }
    $result->free();
}

$conn->query("DELETE FROM offers WHERE expiry <= NOW()");
$offerQuery = "SELECT id, title, discount, expiry, 'All' AS category FROM offers WHERE expiry > NOW() ORDER BY id DESC";
if ($result = $conn->query($offerQuery)) {
    while ($row = $result->fetch_assoc()) {
        $row['discount'] = (int) $row['discount'];
        $row['expiry'] = strtotime($row['expiry']) * 1000;
        $offers[] = $row;
    }
    $result->free();
}

$reviewQuery = "SELECT r.id, r.rating, r.review, r.review_image, r.product_id, p.name AS product_name, r.created_at, u.name
                FROM ratings r
                INNER JOIN users u ON u.id = r.user_id
                LEFT JOIN products p ON p.id = r.product_id
                WHERE r.rating BETWEEN 1 AND 5
                ORDER BY r.created_at DESC
                LIMIT 24";
if ($result = $conn->query($reviewQuery)) {
    while ($row = $result->fetch_assoc()) {
        $row['rating'] = (int) $row['rating'];
        $row['review_image'] = $row['review_image'] ?? '';
        $reviews[] = $row;
    }
    $result->free();
}

$viewQuery = "SELECT product_id, COUNT(*) AS view_count FROM product_views GROUP BY product_id";
if ($result = $conn->query($viewQuery)) {
    while ($row = $result->fetch_assoc()) {
        $productViews[(string) $row['product_id']] = (int) $row['view_count'];
    }
    $result->free();
}

echo json_encode(['products' => $products, 'offers' => $offers, 'reviews' => $reviews, 'product_views' => $productViews], JSON_UNESCAPED_UNICODE);
$conn->close();
