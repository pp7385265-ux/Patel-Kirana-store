-- Create Database
CREATE DATABASE IF NOT EXISTS kirana_store;
USE kirana_store;

-- =========================
-- USERS TABLE
-- =========================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    mobile VARCHAR(10) UNIQUE NOT NULL,
    address TEXT,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- ADMIN TABLE
-- =========================
CREATE TABLE admin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    password VARCHAR(255) NOT NULL
);

INSERT INTO admin (username, password) VALUES ('admin', '1234');

-- =========================
-- PRODUCTS TABLE
-- =========================
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category VARCHAR(50),
    image LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Products
INSERT INTO products (name, price, category, image) VALUES
('Aashirvaad Atta 5kg', 250, 'Kirana', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80'),
('India Gate Basmati Rice 5kg', 520, 'Kirana', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80'),
('Tata Salt 1kg', 28, 'Kirana', 'https://images.unsplash.com/photo-1518110925495-5fe2aabf2a7b?w=600&q=80'),
('Tata Sugar 1kg', 48, 'Kirana', 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?w=600&q=80'),
('Toor Dal 1kg', 165, 'Pulses', 'https://images.unsplash.com/photo-1585996740317-6f9e8a86c7c4?w=600&q=80'),
('Moong Dal 1kg', 140, 'Pulses', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80'),
('Chana Dal 1kg', 105, 'Pulses', 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=600&q=80'),
('Fortune Sunflower Oil 1L', 180, 'Oil', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=80'),
('Amul Butter 500g', 285, 'Dairy', 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=600&q=80'),
('Amul Milk 1L', 60, 'Dairy', 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600&q=80'),
('Amul Paneer 200g', 90, 'Dairy', 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=600&q=80'),
('Coca Cola 1L', 45, 'Cold Drink', 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=600&q=80'),
('Pepsi 500ml', 25, 'Cold Drink', 'https://images.unsplash.com/photo-1629203849820-fdd70d49c38e?w=600&q=80'),
('Real Mixed Fruit Juice 1L', 120, 'Cold Drink', 'https://images.unsplash.com/photo-1600271886742-f049e7c08c8b?w=600&q=80'),
('Lays Classic Chips', 20, 'Snacks', 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&q=80'),
('Parle-G Biscuits 800g', 75, 'Snacks', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80'),
('Patel Special Namkeen Mix 200g', 70, 'Snacks', 'https://images.unsplash.com/photo-1514996937319-344454492b37?w=600&q=80'),
('Kurkure Masala Munch', 20, 'Snacks', 'https://images.unsplash.com/photo-1621939514649-280e2aa58f7f?w=600&q=80'),
('Haldirams Bhujia 200g', 65, 'Snacks', 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=600&q=80'),
('Maggi Noodles Pack of 4', 60, 'Instant Food', 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&q=80'),
('Kissan Tomato Ketchup 500g', 115, 'Sauces', 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=600&q=80'),
('Everest Garam Masala 100g', 65, 'Spices', 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80'),
('MDH Chaat Masala 100g', 70, 'Spices', 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=600&q=80'),
('Tata Tea Gold 500g', 285, 'Beverages', 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=600&q=80'),
('Nescafe Classic 100g', 320, 'Beverages', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&q=80'),
('Surf Excel Matic 2kg', 390, 'Cleaning', 'https://images.unsplash.com/photo-1585832770485-e68a5dbfad52?w=600&q=80'),
('Vim Dishwash Bar 200g', 35, 'Cleaning', 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&q=80'),
('Dettol Liquid 250ml', 95, 'Personal Care', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&q=80'),
('Dove Bath Soap 100g', 65, 'Personal Care', 'https://images.unsplash.com/photo-1607006344380-b6775a0824a7?w=600&q=80'),
('Colgate Toothpaste 200g', 110, 'Personal Care', 'https://images.unsplash.com/photo-1559591937-e3b7e0f8f3ed?w=600&q=80'),
('Clinic Plus Shampoo 340ml', 210, 'Personal Care', 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600&q=80'),
('Whole Wheat Flour 10kg', 490, 'Kirana', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80'),
('Sona Masoori Rice 5kg', 320, 'Kirana', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&q=80'),
('Rajma 1kg', 145, 'Pulses', 'https://images.unsplash.com/photo-1515543904379-3d757afe72e4?w=600&q=80'),
('Kabuli Chana 1kg', 135, 'Pulses', 'https://images.unsplash.com/photo-1585996740317-6f9e8a86c7c4?w=600&q=80'),
('Mustard Oil 1L', 190, 'Oil', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=80'),
('Groundnut Oil 1L', 205, 'Oil', 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&q=80'),
('Curd 400g', 40, 'Dairy', 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=600&q=80'),
('Cheese Slices 200g', 145, 'Dairy', 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600&q=80'),
('Thums Up 750ml', 40, 'Cold Drink', 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=600&q=80'),
('Maaza Mango Drink 1L', 95, 'Cold Drink', 'https://images.unsplash.com/photo-1600271886742-f049e7c08c8b?w=600&q=80'),
('Oreo Biscuits 120g', 35, 'Snacks', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80'),
('Namkeen Mixture 500g', 120, 'Snacks', 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?w=600&q=80'),
('Vermicelli Seviyan 200g', 45, 'Instant Food', 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=600&q=80'),
('Poha 1kg', 75, 'Breakfast', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&q=80'),
('Turmeric Powder 200g', 55, 'Spices', 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=600&q=80'),
('Red Chilli Powder 200g', 70, 'Spices', 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=600&q=80'),
('Black Pepper 100g', 95, 'Spices', 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?w=600&q=80'),
('Bru Instant Coffee 100g', 180, 'Beverages', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&q=80'),
('Bournvita 500g', 245, 'Beverages', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=600&q=80'),
('Harpic Toilet Cleaner 500ml', 105, 'Cleaning', 'https://images.unsplash.com/photo-1585832770485-e68a5dbfad52?w=600&q=80'),
('Lizol Floor Cleaner 1L', 175, 'Cleaning', 'https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=600&q=80'),
('Lux Bath Soap 100g', 42, 'Personal Care', 'https://images.unsplash.com/photo-1607006344380-b6775a0824a7?w=600&q=80'),
('Head & Shoulders Shampoo 180ml', 190, 'Personal Care', 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=600&q=80'),
('Parle Monaco Salted Biscuits 200g', 40, 'Snacks', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=600&q=80'),
('Cadbury Dairy Milk Chocolate 110g', 120, 'Chocolates', 'https://images.unsplash.com/photo-1575377427642-087cf684f04d?w=600&q=80'),
('Fresh Onions 2kg', 80, 'Fresh Produce', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600&q=80'),
('Nestle KitKat 4 Finger', 50, 'Chocolates', 'https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=600&q=80');

-- =========================
-- CART TABLE
-- =========================
CREATE TABLE cart (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    product_id INT,
    quantity INT DEFAULT 1,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- =========================
-- ORDERS TABLE
-- =========================
CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    total_amount DECIMAL(10,2),
    discount DECIMAL(10,2),
    final_amount DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'Pending',
    location TEXT,
    payment_method VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =========================
-- ORDER ITEMS TABLE
-- =========================
CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT,
    price DECIMAL(10,2),

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- =========================
-- OFFERS TABLE
-- =========================
CREATE TABLE offers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(100),
    discount INT,
    expiry DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- RATINGS TABLE
-- =========================
CREATE TABLE ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NULL,
    rating INT CHECK (rating >=1 AND rating <=5),
    review TEXT,
    review_image LONGTEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY ratings_user_product_unique (user_id, product_id)
);

-- =========================
-- PRODUCT VIEWS TABLE
-- =========================
CREATE TABLE product_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    viewer_key VARCHAR(190) NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY product_viewer_unique (product_id, viewer_key)
);

-- =========================
-- NOTIFICATIONS TABLE
-- =========================
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Notification
INSERT INTO notifications (message) VALUES
('New order received!'),
('Stock running low on some products');
