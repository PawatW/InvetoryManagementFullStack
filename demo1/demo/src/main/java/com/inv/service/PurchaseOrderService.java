package com.inv.service;

import com.inv.model.Product;
import com.inv.model.ProductBatch;
import com.inv.model.PurchaseItem;
import com.inv.model.PurchaseOrder;
import com.inv.model.StockTransaction;
import com.inv.repo.ProductBatchRepository;
import com.inv.repo.ProductRepository;
import com.inv.repo.PurchaseOrderRepository;
import com.inv.repo.StockTransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class PurchaseOrderService {

    @Autowired
    private PurchaseOrderRepository purchaseOrderRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductBatchRepository productBatchRepository;

    @Autowired
    private StockTransactionRepository stockTransactionRepository;

    public List<PurchaseOrder> getPurchaseOrders(String status) {
        List<PurchaseOrder> orders = (status == null || status.isBlank())
                ? purchaseOrderRepository.findAll()
                : purchaseOrderRepository.findByStatus(status);
        for (PurchaseOrder order : orders) {
            order.setItems(purchaseOrderRepository.findItems(order.getPoId()));
        }
        return orders;
    }

    public PurchaseOrder getPurchaseOrder(String poId) {
        PurchaseOrder order = purchaseOrderRepository.findById(poId);
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบใบสั่งซื้อ");
        }
        order.setItems(purchaseOrderRepository.findItems(poId));
        return order;
    }

    @Transactional
    public PurchaseOrder createPurchaseOrder(PurchaseOrder order) {
        if (order.getSupplierId() == null || order.getSupplierId().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ต้องระบุ Supplier สำหรับใบสั่งซื้อ");
        }
        if (order.getItems() == null || order.getItems().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ต้องมีรายการสินค้าอย่างน้อย 1 รายการ");
        }
        for (PurchaseItem item : order.getItems()) {
            if (item.getProductId() == null || item.getProductId().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ต้องระบุสินค้าในใบสั่งซื้อ");
            }
            if (item.getQuantity() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "จำนวนสินค้าต่อรายการต้องมากกว่า 0");
            }
        }

        String poId = "PO-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        order.setPoId(poId);
        if (order.getStaffId() != null && order.getStaffId().isBlank()) {
            order.setStaffId(null);
        }
        if (order.getPoDate() == null) {
            order.setPoDate(java.time.LocalDateTime.now());
        }
        order.setStatus(order.getStatus() != null ? order.getStatus() : "New order");
        order.setTotalAmount(order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO);

        List<PurchaseItem> itemsWithId = new ArrayList<>();
        for (PurchaseItem item : order.getItems()) {
            PurchaseItem copy = new PurchaseItem();
            copy.setPoItemId("POI-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
            copy.setPoId(poId);
            copy.setProductId(item.getProductId());
            copy.setQuantity(item.getQuantity());
            copy.setUnitPrice(item.getUnitPrice());
            itemsWithId.add(copy);
        }
        order.setItems(itemsWithId);

        purchaseOrderRepository.save(order);
        order.setItems(purchaseOrderRepository.findItems(poId));
        return order;
    }

    @Transactional
    public PurchaseOrder updatePricing(String poId, List<PurchaseItem> pricedItems, boolean reject) {
        PurchaseOrder existing = purchaseOrderRepository.findById(poId);
        if (existing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบใบสั่งซื้อ");
        }
        if (reject) {
            purchaseOrderRepository.updateStatus(poId, "Rejected");
            existing.setStatus("Rejected");
            return existing;
        }
        if (pricedItems == null || pricedItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ต้องส่งข้อมูลราคาสำหรับทุกรายการ");
        }
        BigDecimal total = BigDecimal.ZERO;
        for (PurchaseItem item : pricedItems) {
            if (item.getPoItemId() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ไม่พบรหัสรายการสินค้า");
            }
            if (item.getUnitPrice() == null || item.getUnitPrice().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ราคาต่อหน่วยต้องมากกว่า 0");
            }
            PurchaseItem existingItem = purchaseOrderRepository.findItemById(item.getPoItemId());
            if (existingItem == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบรายการสินค้าในใบสั่งซื้อ");
            }
            purchaseOrderRepository.updateItemCost(item.getPoItemId(), item.getUnitPrice());
            total = total.add(item.getUnitPrice().multiply(BigDecimal.valueOf(existingItem.getQuantity())));
        }
        purchaseOrderRepository.updateTotalAmount(poId, total);
        purchaseOrderRepository.updateStatus(poId, "Pending");
        existing.setStatus("Pending");
        existing.setTotalAmount(total);
        existing.setItems(purchaseOrderRepository.findItems(poId));
        return existing;
    }

    @Transactional
    public PurchaseOrder receivePurchaseOrder(String poId, List<PurchaseItem> receivedItems, String staffId) {
        PurchaseOrder order = purchaseOrderRepository.findById(poId);
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบใบสั่งซื้อ");
        }
        if (staffId == null || staffId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ต้องระบุรหัสพนักงานผู้รับสินค้า");
        }
        if (receivedItems == null || receivedItems.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ต้องระบุรายการสินค้าที่รับเข้า");
        }
        BigDecimal total = BigDecimal.ZERO;
        for (PurchaseItem item : receivedItems) {
            PurchaseItem existingItem = purchaseOrderRepository.findItemById(item.getPoItemId());
            if (existingItem == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบรายการสินค้าในใบสั่งซื้อ");
            }
            if (item.getUnitPrice() == null || item.getUnitPrice().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ราคาทุนต้องมากกว่า 0");
            }
            if (item.getQuantity() <= 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "จำนวนที่รับต้องมากกว่า 0");
            }
            Product product = productRepository.findById(existingItem.getProductId());
            if (product == null) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบสินค้าในระบบ");
            }

            int oldQty = product.getQuantity();
            BigDecimal oldCost = product.getCostPrice() != null ? product.getCostPrice() : BigDecimal.ZERO;
            BigDecimal newCost = item.getUnitPrice().setScale(2, java.math.RoundingMode.HALF_UP);
            int receivedQty = item.getQuantity();

            BigDecimal newAverageCost;
            if (oldQty <= 0 || oldCost.compareTo(BigDecimal.ZERO) <= 0) {
                newAverageCost = newCost;
            } else {
                BigDecimal oldValue = oldCost.multiply(BigDecimal.valueOf(oldQty));
                BigDecimal newValue = newCost.multiply(BigDecimal.valueOf(receivedQty));
                newAverageCost = oldValue.add(newValue).divide(BigDecimal.valueOf(oldQty + receivedQty), java.math.MathContext.DECIMAL64);
            }
            newAverageCost = newAverageCost.setScale(2, java.math.RoundingMode.HALF_UP);

            productRepository.updateQuantity(product.getProductId(), receivedQty);
            productRepository.updateCostPrice(product.getProductId(), newAverageCost);
            purchaseOrderRepository.updateItemQuantity(item.getPoItemId(), receivedQty);
            purchaseOrderRepository.updateItemCost(item.getPoItemId(), newCost);

            ProductBatch batch = new ProductBatch();
            batch.setBatchId("BATCH-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
            batch.setProductId(product.getProductId());
            batch.setPoId(poId);
            batch.setQuantityIn(receivedQty);
            batch.setQuantityRemaining(receivedQty);
            batch.setUnitCost(newCost);
            productBatchRepository.save(batch);

            StockTransaction transaction = new StockTransaction();
            transaction.setTransactionId("ST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
            transaction.setType("IN");
            transaction.setProductId(product.getProductId());
            transaction.setQuantity(receivedQty);
            transaction.setStaffId(staffId);
            transaction.setDescription("รับสินค้าเข้าจาก PO " + poId);
            transaction.setBatchId(batch.getBatchId());
            transaction.setReferenceId(poId);
            stockTransactionRepository.save(transaction);

            total = total.add(newCost.multiply(BigDecimal.valueOf(receivedQty)));
        }

        purchaseOrderRepository.updateStatus(poId, "Received");
        purchaseOrderRepository.updateTotalAmount(poId, total);

        order.setStatus("Received");
        order.setTotalAmount(total);
        order.setItems(purchaseOrderRepository.findItems(poId));
        return order;
    }
}
