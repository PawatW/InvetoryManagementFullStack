package com.inv.repo;

import com.inv.model.ProductBatch;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public class ProductBatchRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private ProductBatch mapRow(ResultSet rs, int rowNum) throws SQLException {
        ProductBatch batch = new ProductBatch();
        batch.setBatchId(rs.getString("batch_id"));
        batch.setProductId(rs.getString("product_id"));
        batch.setPoId(rs.getString("po_id"));
        batch.setReceivedDate(rs.getTimestamp("received_date").toLocalDateTime());
        batch.setQuantityIn(rs.getInt("quantity_in"));
        batch.setQuantityRemaining(rs.getInt("quantity_remaining"));
        batch.setUnitCost(rs.getBigDecimal("unit_cost"));
        if (rs.getDate("expiry_date") != null) {
            batch.setExpiryDate(rs.getDate("expiry_date").toLocalDate());
        }
        return batch;
    }

    public void save(ProductBatch batch) {
        LocalDateTime received = batch.getReceivedDate();
        if (received == null) {
            received = LocalDateTime.now();
            batch.setReceivedDate(received);
        }
        jdbcTemplate.update(
                "INSERT INTO ProductBatch(batch_id, product_id, po_id, received_date, quantity_in, quantity_remaining, unit_cost, expiry_date) VALUES (?,?,?,?,?,?,?,?)",
                batch.getBatchId(),
                batch.getProductId(),
                batch.getPoId(),
                java.sql.Timestamp.valueOf(received),
                batch.getQuantityIn(),
                batch.getQuantityRemaining(),
                batch.getUnitCost(),
                batch.getExpiryDate()
        );
    }

    public List<ProductBatch> findAvailableBatches(String productId) {
        String sql = "SELECT batch_id, product_id, po_id, received_date, quantity_in, quantity_remaining, unit_cost, expiry_date " +
                "FROM ProductBatch WHERE product_id = ? AND quantity_remaining > 0 ORDER BY received_date ASC, batch_id ASC";
        return jdbcTemplate.query(sql, this::mapRow, productId);
    }

    public void updateRemaining(String batchId, int remaining) {
        jdbcTemplate.update("UPDATE ProductBatch SET quantity_remaining = ? WHERE batch_id = ?", remaining, batchId);
    }
    public void List<ProductBatch> findByProductId(@Param("productId") String productId){
    String sql ="SELECT * FROM product_batches WHERE product_id = :productId ORDER BY received_date ASC";
    
    

    // Ensure findById exists (CrudRepository provides this, but check if overridden)
    // If CrudRepository<ProductBatch, String> is used, this method is inherited.
    // Optional<ProductBatch> findById(String batchId); // Example if needed explicitly

    // Add this query to find available batches for a product
    @Query("SELECT * FROM product_batches WHERE product_id = :productId AND quantity_remaining > 0 ORDER BY expiry_date ASC NULLS LAST, received_date ASC")
    List<ProductBatch> findAvailableBatchesByProductId(@Param("productId") String productId);
}
