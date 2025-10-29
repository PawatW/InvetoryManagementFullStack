package com.inv.service;

import com.inv.model.Product;
import com.inv.model.ProductBatch;
import com.inv.model.StockTransaction;
import com.inv.repo.ProductRepository;
import com.inv.repo.ProductBatchRepository;
import com.inv.repo.StockTransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;

@Service
public class ProductService {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ProductBatchRepository productBatchRepository;

    @Autowired
    private StockTransactionRepository stockTransactionRepository;

    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    public Product getProductById(String id) { // รับ String id
        return productRepository.findById(id);
    }

    public Product createProduct(Product product) {
        String name = trimToNull(product.getProductName());
        if (name == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาระบุชื่อสินค้า (Product name is required)");
        }

        int initialQuantity = Math.max(product.getQuantity(), 0);
        BigDecimal initialCost = product.getCostPrice() != null ? product.getCostPrice() : BigDecimal.ZERO;
        if (initialQuantity > 1 && initialCost.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาระบุราคาทุนเริ่มต้นเมื่อมีการเพิ่มสต็อกมากกว่า 1 หน่วย");
        }

        product.setProductId("PROD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        product.setProductName(name);
        product.setDescription(trimToNull(product.getDescription()));
        product.setUnit(trimToNull(product.getUnit()));
        product.setSupplierId(trimToNull(product.getSupplierId()));
        product.setImageUrl(trimToNull(product.getImageUrl()));
        product.setSellPrice(product.getSellPrice() != null ? product.getSellPrice() : BigDecimal.ZERO);
        product.setActive(true);

        if (initialQuantity > 1) {
            product.setQuantity(initialQuantity);
            product.setCostPrice(initialCost.setScale(2, RoundingMode.HALF_UP));
        } else if (initialQuantity == 1) {
            product.setQuantity(1);
            product.setCostPrice(BigDecimal.ZERO);
        } else {
            product.setQuantity(0);
            product.setCostPrice(BigDecimal.ZERO);
        }

        productRepository.save(product);

        if (initialQuantity > 1) {
            String staffId = trimToNull(product.getCreatedByStaffId());
            if (staffId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ต้องระบุผู้บันทึกเมื่อมีการเพิ่มสต็อกเริ่มต้น");
            }
            createInitialStockRecords(product, initialQuantity, product.getCostPrice(), staffId);
        }

        return productRepository.findById(product.getProductId());
    }

    private void createInitialStockRecords(Product product, int quantity, BigDecimal unitCost, String staffId) {
        BigDecimal normalizedCost = unitCost.setScale(2, RoundingMode.HALF_UP);

        ProductBatch batch = new ProductBatch();
        batch.setBatchId("BATCH-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        batch.setProductId(product.getProductId());
        batch.setQuantityIn(quantity);
        batch.setQuantityRemaining(quantity);
        batch.setUnitCost(normalizedCost);
        batch.setPoId(null);
        productBatchRepository.save(batch);

        StockTransaction transaction = new StockTransaction();
        transaction.setTransactionId("ST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        transaction.setType("IN");
        transaction.setProductId(product.getProductId());
        transaction.setQuantity(quantity);
        transaction.setStaffId(staffId);
        transaction.setBatchId(batch.getBatchId());
        transaction.setReferenceId(null);
        transaction.setDescription("Initial stock recorded on product creation");
        stockTransactionRepository.save(transaction);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public void adjustQuantity(String productId, int diff) { // รับ String productId
        productRepository.updateQuantity(productId, diff);
    }

    public Product updateProductDetails(String productId, Product payload) {
        Product existing = productRepository.findById(productId);
        if (existing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบสินค้า (Product not found)");
        }

        String name = trimToNull(payload.getProductName());
        if (name == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาระบุชื่อสินค้า (Product name is required)");
        }

        String description = payload.getDescription() != null ? trimToNull(payload.getDescription()) : existing.getDescription();
        String imageUrl = payload.getImageUrl() != null ? trimToNull(payload.getImageUrl()) : existing.getImageUrl();

        java.math.BigDecimal sellPrice = payload.getSellPrice() != null ? payload.getSellPrice() : existing.getSellPrice();
        if (sellPrice != null && sellPrice.signum() < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ราคาขายต้องไม่เป็นค่าติดลบ (Sell price must be >= 0)");
        }

        productRepository.updateDetails(productId, name, description, imageUrl, sellPrice);

        Product updated = productRepository.findById(productId);
        if (updated == null) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "ไม่สามารถอัปเดตสินค้าได้ (Unable to update product)");
        }
        return updated;
    }

    public void deactivateProduct(String productId) {
        Product existing = productRepository.findById(productId);
        if (existing == null || !existing.isActive()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบสินค้า (Product not found)");
        }
        productRepository.deactivate(productId);
    }

    public List<ProductBatch> getProductBatches(String productId) {
        String normalizedId = trimToNull(productId);
        if (normalizedId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาระบุรหัสสินค้า (Product ID is required)");
        }

        Product existing = productRepository.findById(normalizedId);
        if (existing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบสินค้า (Product not found)");
        }
        return productBatchRepository.findByProduct(normalizedId);
    }

    public List<ProductBatch> getAvailableProductBatches(String productId) {
        String normalizedId = trimToNull(productId);
        if (normalizedId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาระบุรหัสสินค้า (Product ID is required)");
        }

        Product existing = productRepository.findById(normalizedId);
        if (existing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบสินค้า (Product not found)");
        }
        return productBatchRepository.findAvailableBatches(normalizedId);
    }

    public ProductBatch getProductBatch(String productId, String batchId) {
        String normalizedProductId = trimToNull(productId);
        String normalizedBatchId = trimToNull(batchId);

        if (normalizedProductId == null || normalizedBatchId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "กรุณาระบุรหัสสินค้าและล็อตสินค้า (Product and batch ID are required)");
        }

        Product existing = productRepository.findById(normalizedProductId);
        if (existing == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบสินค้า (Product not found)");
        }
        ProductBatch batch = productBatchRepository.findById(normalizedBatchId);
        if (batch == null || batch.getProductId() == null || !batch.getProductId().equals(normalizedProductId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "ไม่พบล็อตสินค้าที่ระบุ (Product batch not found)");
        }
        return batch;
    }
}
