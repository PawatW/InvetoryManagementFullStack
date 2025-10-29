package com.inv.model;

import java.math.BigDecimal;

public class Product {
    private String productId; // แก้เป็น String
    private String productName;
    private String description;
    private String unit;
    private BigDecimal costPrice;
    private BigDecimal sellPrice;
    private String supplierId; // แก้เป็น String
    private int quantity;
    private String imageUrl;
    private boolean active;
    private String createdByStaffId;

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public BigDecimal getCostPrice() { return costPrice; }
    public void setCostPrice(BigDecimal costPrice) { this.costPrice = costPrice; }

    public BigDecimal getSellPrice() { return sellPrice; }
    public void setSellPrice(BigDecimal sellPrice) { this.sellPrice = sellPrice; }

    public String getProductId() { return productId; }
    public void setProductId(String productId) { this.productId = productId; }

    public String getSupplierId() { return supplierId; }
    public void setSupplierId(String supplierId) { this.supplierId = supplierId; }

    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public String getCreatedByStaffId() { return createdByStaffId; }
    public void setCreatedByStaffId(String createdByStaffId) { this.createdByStaffId = createdByStaffId; }

}
