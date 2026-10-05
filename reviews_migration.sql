USE kirana_store;

ALTER TABLE ratings
    ADD COLUMN review TEXT NULL,
    ADD COLUMN review_image LONGTEXT NULL;

ALTER TABLE ratings
    ADD COLUMN product_id INT NULL;

ALTER TABLE ratings
    DROP INDEX ratings_user_unique;

ALTER TABLE ratings
    ADD CONSTRAINT ratings_product_fk FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    ADD UNIQUE KEY ratings_user_product_unique (user_id, product_id);

CREATE TABLE product_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    viewer_key VARCHAR(190) NOT NULL,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY product_viewer_unique (product_id, viewer_key)
);
