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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PurchaseOrderServiceTest {

    @Mock
    private PurchaseOrderRepository purchaseOrderRepository;
    @Mock
    private ProductRepository productRepository;
    @Mock
    private ProductBatchRepository productBatchRepository;
    @Mock
    private StockTransactionRepository stockTransactionRepository;

    @InjectMocks
    private PurchaseOrderService purchaseOrderService;

    @Test
    void receivePurchaseOrder_updatesWeightedAverageAndCreatesBatch() {
        PurchaseOrder order = new PurchaseOrder();
        order.setPoId("PO-123");
        order.setStatus("Pending");
        when(purchaseOrderRepository.findById("PO-123")).thenReturn(order);

        PurchaseItem storedItem = new PurchaseItem();
        storedItem.setPoItemId("POI-1");
        storedItem.setPoId("PO-123");
        storedItem.setProductId("PROD-1");
        storedItem.setQuantity(5);
        when(purchaseOrderRepository.findItemById("POI-1")).thenReturn(storedItem);
        when(purchaseOrderRepository.findItems("PO-123")).thenReturn(List.of(storedItem));

        Product product = new Product();
        product.setProductId("PROD-1");
        product.setQuantity(10);
        product.setCostPrice(new BigDecimal("5.00"));
        when(productRepository.findById("PROD-1")).thenReturn(product);

        PurchaseItem received = new PurchaseItem();
        received.setPoItemId("POI-1");
        received.setQuantity(5);
        received.setUnitPrice(new BigDecimal("8.00"));

        PurchaseOrder result = purchaseOrderService.receivePurchaseOrder("PO-123", List.of(received), "STF-1");

        verify(productRepository).updateQuantity("PROD-1", 5);

        ArgumentCaptor<Number> costCaptor = ArgumentCaptor.forClass(Number.class);
        verify(productRepository).updateCostPrice(eq("PROD-1"), costCaptor.capture());
        assertEquals(new BigDecimal("6.00"), new BigDecimal(costCaptor.getValue().toString()));

        ArgumentCaptor<ProductBatch> batchCaptor = ArgumentCaptor.forClass(ProductBatch.class);
        verify(productBatchRepository).save(batchCaptor.capture());
        ProductBatch savedBatch = batchCaptor.getValue();
        assertEquals("PROD-1", savedBatch.getProductId());
        assertEquals(5, savedBatch.getQuantityIn());
        assertEquals(5, savedBatch.getQuantityRemaining());
        assertEquals(new BigDecimal("8.00"), savedBatch.getUnitCost());
        assertNotNull(savedBatch.getBatchId());

        ArgumentCaptor<StockTransaction> transactionCaptor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository).save(transactionCaptor.capture());
        StockTransaction transaction = transactionCaptor.getValue();
        assertEquals("IN", transaction.getType());
        assertEquals("PROD-1", transaction.getProductId());
        assertEquals(5, transaction.getQuantity());
        assertEquals("STF-1", transaction.getStaffId());
        assertEquals("PO-123", transaction.getReferenceId());
        assertEquals("รับสินค้าเข้าจาก PO PO-123", transaction.getDescription());
        assertEquals(savedBatch.getBatchId(), transaction.getBatchId());

        verify(purchaseOrderRepository).updateItemQuantity("POI-1", 5);
        verify(purchaseOrderRepository).updateItemCost("POI-1", new BigDecimal("8.00"));
        verify(purchaseOrderRepository).updateTotalAmount("PO-123", new BigDecimal("40.00"));
        verify(purchaseOrderRepository).updateStatus("PO-123", "Received");

        assertEquals("Received", result.getStatus());
        assertEquals(new BigDecimal("40.00"), result.getTotalAmount());
        assertEquals(1, result.getItems().size());
    }

    @Test
    void receivePurchaseOrder_usesNewCostWhenExistingInventoryIsZero() {
        PurchaseOrder order = new PurchaseOrder();
        order.setPoId("PO-456");
        when(purchaseOrderRepository.findById("PO-456")).thenReturn(order);

        PurchaseItem storedItem = new PurchaseItem();
        storedItem.setPoItemId("POI-2");
        storedItem.setPoId("PO-456");
        storedItem.setProductId("PROD-2");
        storedItem.setQuantity(10);
        when(purchaseOrderRepository.findItemById("POI-2")).thenReturn(storedItem);
        when(purchaseOrderRepository.findItems("PO-456")).thenReturn(List.of(storedItem));

        Product product = new Product();
        product.setProductId("PROD-2");
        product.setQuantity(0);
        product.setCostPrice(null);
        when(productRepository.findById("PROD-2")).thenReturn(product);

        PurchaseItem received = new PurchaseItem();
        received.setPoItemId("POI-2");
        received.setQuantity(10);
        received.setUnitPrice(new BigDecimal("4.50"));

        PurchaseOrder result = purchaseOrderService.receivePurchaseOrder("PO-456", List.of(received), "STF-2");

        verify(productRepository).updateQuantity("PROD-2", 10);

        ArgumentCaptor<Number> costCaptor = ArgumentCaptor.forClass(Number.class);
        verify(productRepository).updateCostPrice(eq("PROD-2"), costCaptor.capture());
        assertEquals(new BigDecimal("4.50"), new BigDecimal(costCaptor.getValue().toString()));

        verify(purchaseOrderRepository).updateTotalAmount("PO-456", new BigDecimal("45.00"));
        verify(purchaseOrderRepository).updateStatus("PO-456", "Received");
        assertEquals(new BigDecimal("45.00"), result.getTotalAmount());
    }

    @Test
    void receivePurchaseOrder_throwsWhenItemMissing() {
        when(purchaseOrderRepository.findById("PO-404")).thenReturn(new PurchaseOrder());
        when(purchaseOrderRepository.findItemById("MISSING")).thenReturn(null);

        PurchaseItem received = new PurchaseItem();
        received.setPoItemId("MISSING");
        received.setQuantity(1);
        received.setUnitPrice(new BigDecimal("1.00"));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                purchaseOrderService.receivePurchaseOrder("PO-404", List.of(received), "STF-3")
        );

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        verify(productRepository, never()).updateQuantity(org.mockito.Mockito.anyString(), org.mockito.Mockito.anyInt());
    }
}
