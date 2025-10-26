package com.inv.repo;

import com.inv.model.Product;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

@Repository
public class ProductRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Product mapRow(ResultSet rs, int rowNum) throws SQLException {
        Product p = new Product();
        p.setProductId(rs.getString("product_id")); // rs.getString
        p.setProductName(rs.getString("product_name"));
        p.setDescription(rs.getString("description"));
        p.setUnit(rs.getString("unit"));
        p.setPricePerUnit(rs.getBigDecimal("price_per_unit"));
        p.setSupplierId(rs.getString("supplier_id")); // rs.getString
        p.setQuantity(rs.getInt("quantity"));
        p.setImageUrl(rs.getString("image_url"));
        return p;
    }

    public List<Product> findAll() {
        String sql = "SELECT product_id, product_name, description, unit, price_per_unit, supplier_id, quantity, image_url " +
                "FROM product ORDER BY product_name";
        return jdbcTemplate.query(sql, this::mapRow);
    }

    public Product findById(String id) { // รับ String id
        List<Product> list = jdbcTemplate.query(
                "SELECT product_id, product_name, description, unit, price_per_unit, supplier_id, quantity, image_url FROM product WHERE product_id = ?",
                this::mapRow,
                id
        );
        return list.isEmpty() ? null : list.get(0);
    }

    public void save(Product p) {
        // แก้ไข SQL ให้มี placeholder 8 ตัวให้ตรงกับจำนวนคอลัมน์
        String sql = "INSERT INTO product (product_id, product_name, description, unit, price_per_unit, supplier_id, quantity, image_url) " +
                "VALUES (?,?,?,?,?,?,?,?)";
        jdbcTemplate.update(
                sql,
                p.getProductId(),
                p.getProductName(),
                p.getDescription(),
                p.getUnit(),
                p.getPricePerUnit(),
                p.getSupplierId(),
                p.getQuantity(),
                p.getImageUrl()
        );
    }

    public void updateQuantity(String productId, int diff) { // รับ String productId
        jdbcTemplate.update("UPDATE product SET quantity = quantity + ? WHERE product_id = ?", diff, productId);
    }

    public void updateDetails(String productId, String productName, String description, String imageUrl) {
        jdbcTemplate.update(
                "UPDATE product SET product_name = ?, description = ?, image_url = ? WHERE product_id = ?",
                productName,
                description,
                imageUrl,
                productId
        );
    }
}
