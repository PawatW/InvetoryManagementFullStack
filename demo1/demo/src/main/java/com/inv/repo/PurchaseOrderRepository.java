package com.inv.repo;

import com.inv.model.PurchaseItem;
import com.inv.model.PurchaseOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;

@Repository
public class PurchaseOrderRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private PurchaseOrder mapRow(ResultSet rs, int rowNum) throws SQLException {
        PurchaseOrder order = new PurchaseOrder();
        order.setPoId(rs.getString("po_id"));
        if (rs.getTimestamp("po_date") != null) {
            order.setPoDate(rs.getTimestamp("po_date").toLocalDateTime());
        }
        order.setSupplierId(rs.getString("supplier_id"));
        order.setStaffId(rs.getString("staff_id"));
        order.setTotalAmount(rs.getBigDecimal("total_amount"));
        order.setStatus(rs.getString("status"));
        return order;
    }

    private PurchaseItem mapItem(ResultSet rs, int rowNum) throws SQLException {
        PurchaseItem item = new PurchaseItem();
        item.setPoItemId(rs.getString("po_item_id"));
        item.setPoId(rs.getString("po_id"));
        item.setProductId(rs.getString("product_id"));
        item.setQuantity(rs.getInt("quantity"));
        item.setUnitPrice(rs.getBigDecimal("unit_price"));
        return item;
    }

    public List<PurchaseOrder> findAll() {
        String sql = "SELECT po_id, po_date, supplier_id, staff_id, total_amount, status FROM PurchaseOrder ORDER BY po_date DESC";
        return jdbcTemplate.query(sql, this::mapRow);
    }

    public List<PurchaseOrder> findByStatus(String status) {
        String sql = "SELECT po_id, po_date, supplier_id, staff_id, total_amount, status FROM PurchaseOrder WHERE status = ? ORDER BY po_date DESC";
        return jdbcTemplate.query(sql, this::mapRow, status);
    }

    public PurchaseOrder findById(String poId) {
        List<PurchaseOrder> list = jdbcTemplate.query(
                "SELECT po_id, po_date, supplier_id, staff_id, total_amount, status FROM PurchaseOrder WHERE po_id = ?",
                this::mapRow,
                poId
        );
        return list.isEmpty() ? null : list.get(0);
    }

    public List<PurchaseItem> findItems(String poId) {
        String sql = "SELECT po_item_id, po_id, product_id, quantity, unit_price FROM PurchaseItem WHERE po_id = ?";
        return jdbcTemplate.query(sql, this::mapItem, poId);
    }

    public PurchaseItem findItemById(String poItemId) {
        List<PurchaseItem> list = jdbcTemplate.query(
                "SELECT po_item_id, po_id, product_id, quantity, unit_price FROM PurchaseItem WHERE po_item_id = ?",
                this::mapItem,
                poItemId
        );
        return list.isEmpty() ? null : list.get(0);
    }

    public void save(PurchaseOrder order) {
        jdbcTemplate.update(
                "INSERT INTO PurchaseOrder(po_id, po_date, supplier_id, staff_id, total_amount, status) VALUES (?,?,?,?,?,?)",
                order.getPoId(),
                order.getPoDate() != null ? Timestamp.valueOf(order.getPoDate()) : null,
                order.getSupplierId(),
                order.getStaffId(),
                order.getTotalAmount(),
                order.getStatus()
        );
        if (order.getItems() != null) {
            addItems(order.getPoId(), order.getItems());
        }
    }

    public void addItems(String poId, List<PurchaseItem> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        for (PurchaseItem item : items) {
            jdbcTemplate.update(
                    "INSERT INTO PurchaseItem(po_item_id, po_id, product_id, quantity, unit_price) VALUES (?,?,?,?,?)",
                    item.getPoItemId(),
                    poId,
                    item.getProductId(),
                    item.getQuantity(),
                    item.getUnitPrice()
            );
        }
    }

    public void updateStatus(String poId, String status) {
        jdbcTemplate.update("UPDATE PurchaseOrder SET status = ? WHERE po_id = ?", status, poId);
    }

    public void updateTotalAmount(String poId, java.math.BigDecimal totalAmount) {
        jdbcTemplate.update("UPDATE PurchaseOrder SET total_amount = ? WHERE po_id = ?", totalAmount, poId);
    }

    public void updateItemCost(String poItemId, java.math.BigDecimal unitPrice) {
        jdbcTemplate.update("UPDATE PurchaseItem SET unit_price = ? WHERE po_item_id = ?", unitPrice, poItemId);
    }

    public void updateItemQuantity(String poItemId, int quantity) {
        jdbcTemplate.update("UPDATE PurchaseItem SET quantity = ? WHERE po_item_id = ?", quantity, poItemId);
    }
}
