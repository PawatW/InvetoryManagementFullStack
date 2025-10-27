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
        p.setCostPrice(rs.getBigDecimal("cost_price"));
        p.setSellPrice(rs.getBigDecimal("sell_price"));
        p.setSupplierId(rs.getString("supplier_id")); // rs.getString
        p.setQuantity(rs.getInt("quantity"));
        p.setImageUrl(rs.getString("image_url"));
        p.setActive(rs.getBoolean("active"));
        return p;
    }

    public List<Product> findAll() {
        String sql = "SELECT product_id, product_name, description, unit, cost_price, sell_price, supplier_id, quantity, image_url, active " +
                "FROM product WHERE active = TRUE ORDER BY product_name";
        return jdbcTemplate.query(sql, this::mapRow);
    }

    public Product findById(String id) { // รับ String id
        List<Product> list = jdbcTemplate.query(
                "SELECT product_id, product_name, description, unit, cost_price, sell_price, supplier_id, quantity, image_url, active FROM product WHERE product_id = ?",
                this::mapRow,
                id
        );
        return list.isEmpty() ? null : list.get(0);
    }

    public void save(Product p) {
        String sql = "INSERT INTO product (product_id, product_name, description, unit, cost_price, sell_price, supplier_id, quantity, image_url, active) " +
                "VALUES (?,?,?,?,?,?,?,?,?,?)";
        jdbcTemplate.update(
                sql,
                p.getProductId(),
                p.getProductName(),
                p.getDescription(),
                p.getUnit(),
                p.getCostPrice(),
                p.getSellPrice(),
                p.getSupplierId(),
                p.getQuantity(),
                p.getImageUrl(),
                p.isActive()
        );
    }

    public void updateQuantity(String productId, int diff) { // รับ String productId
        jdbcTemplate.update("UPDATE product SET quantity = quantity + ? WHERE product_id = ?", diff, productId);
    }

    public void updateDetails(String productId, String productName, String description, String imageUrl, Number sellPrice) {
        jdbcTemplate.update(
                "UPDATE product SET product_name = ?, description = ?, image_url = ?, sell_price = ? WHERE product_id = ?",
                productName,
                description,
                imageUrl,
                sellPrice,
                productId
        );
    }

    public void updateCostPrice(String productId, Number newCostPrice) {
        jdbcTemplate.update(
                "UPDATE product SET cost_price = ? WHERE product_id = ?",
                newCostPrice,
                productId
        );
    }

    public void deactivate(String productId) {
        jdbcTemplate.update("UPDATE product SET active = FALSE WHERE product_id = ?", productId);
    }
}
