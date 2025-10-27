package com.inv.service;

import com.inv.model.Product;
import com.inv.repo.ProductRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
public class ProductService {

    @Autowired
    private ProductRepository productRepository;

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

        product.setProductId("PROD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        product.setProductName(name);
        product.setDescription(trimToNull(product.getDescription()));
        product.setUnit(trimToNull(product.getUnit()));
        product.setSupplierId(trimToNull(product.getSupplierId()));
        product.setImageUrl(trimToNull(product.getImageUrl()));
        product.setQuantity(0);
        product.setCostPrice(product.getCostPrice() != null ? product.getCostPrice() : java.math.BigDecimal.ZERO);
        product.setSellPrice(product.getSellPrice() != null ? product.getSellPrice() : java.math.BigDecimal.ZERO);
        product.setActive(true);

        productRepository.save(product);
        return product;
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
}
