package com.inv.controller;

import com.inv.model.PurchaseItem;
import com.inv.model.PurchaseOrder;
import com.inv.service.PurchaseOrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/purchase-orders")
public class PurchaseOrderController {

    @Autowired
    private PurchaseOrderService purchaseOrderService;

    @GetMapping
    public List<PurchaseOrder> getPurchaseOrders(@RequestParam(required = false) String status) {
        return purchaseOrderService.getPurchaseOrders(status);
    }

    @GetMapping("/{id}")
    public PurchaseOrder getPurchaseOrder(@PathVariable("id") String poId) {
        return purchaseOrderService.getPurchaseOrder(poId);
    }

    @PostMapping
    public ResponseEntity<PurchaseOrder> createPurchaseOrder(@RequestBody PurchaseOrder request) {
        PurchaseOrder order = purchaseOrderService.createPurchaseOrder(request);
        return ResponseEntity.ok(order);
    }

    public record PricingRequest(List<PurchaseItem> items, boolean reject) {}

    @PutMapping("/{id}/pricing")
    public ResponseEntity<PurchaseOrder> updatePricing(@PathVariable("id") String poId, @RequestBody PricingRequest request) {
        PurchaseOrder order = purchaseOrderService.updatePricing(poId, request.items(), request.reject());
        return ResponseEntity.ok(order);
    }

    public record ReceiveRequest(List<PurchaseItem> items, String staffId) {}

    @PostMapping("/{id}/receive")
    public ResponseEntity<PurchaseOrder> receiveOrder(@PathVariable("id") String poId, @RequestBody ReceiveRequest request) {
        PurchaseOrder order = purchaseOrderService.receivePurchaseOrder(poId, request.items(), request.staffId());
        return ResponseEntity.ok(order);
    }
}
