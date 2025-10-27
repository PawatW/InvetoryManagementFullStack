package com.inv.service;

import com.inv.model.Product;
import com.inv.model.ProductBatch;
import com.inv.model.Request;
import com.inv.model.RequestItem;
import com.inv.model.StockTransaction;
import com.inv.repo.OrderRepository;
import com.inv.repo.ProductBatchRepository;
import com.inv.repo.ProductRepository;
import com.inv.repo.RequestRepository;
import com.inv.repo.StockTransactionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.anyInt;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StockServiceTest {

    @Mock
    private ProductRepository productRepository;
    @Mock
    private StockTransactionRepository stockTransactionRepository;
    @Mock
    private ProductBatchRepository productBatchRepository;
    @Mock
    private RequestRepository requestRepository;
    @Mock
    private OrderRepository orderRepository;

    @InjectMocks
    private StockService stockService;

    @Test
    void fulfillItem_consumesBatchesInFifoOrder() {
        RequestItem requestItem = new RequestItem();
        requestItem.setRequestItemId("REQ-ITEM-1");
        requestItem.setRequestId("REQ-1");
        requestItem.setProductId("PROD-1");
        requestItem.setQuantity(10);
        requestItem.setRemainingQty(10);
        when(requestRepository.findItemById("REQ-ITEM-1")).thenReturn(requestItem);

        Product product = new Product();
        product.setProductId("PROD-1");
        product.setQuantity(10);
        when(productRepository.findById("PROD-1")).thenReturn(product);

        ProductBatch firstBatch = new ProductBatch();
        firstBatch.setBatchId("BATCH-1");
        firstBatch.setProductId("PROD-1");
        firstBatch.setQuantityRemaining(3);

        ProductBatch secondBatch = new ProductBatch();
        secondBatch.setBatchId("BATCH-2");
        secondBatch.setProductId("PROD-1");
        secondBatch.setQuantityRemaining(5);

        when(productBatchRepository.findAvailableBatches("PROD-1"))
                .thenReturn(List.of(firstBatch, secondBatch));

        Request request = new Request();
        request.setRequestId("REQ-1");
        request.setOrderId("ORDER-1");
        when(requestRepository.findById("REQ-1")).thenReturn(request);

        stockService.fulfillItem("REQ-ITEM-1", 6, "STF-1");

        verify(requestRepository).updateItemFulfillment("REQ-ITEM-1", 6);
        verify(productBatchRepository).updateRemaining("BATCH-1", 0);
        verify(productBatchRepository).updateRemaining("BATCH-2", 2);

        ArgumentCaptor<StockTransaction> transactionCaptor = ArgumentCaptor.forClass(StockTransaction.class);
        verify(stockTransactionRepository, times(2)).save(transactionCaptor.capture());
        List<StockTransaction> transactions = transactionCaptor.getAllValues();
        assertEquals(2, transactions.size());
        assertEquals("BATCH-1", transactions.get(0).getBatchId());
        assertEquals(3, transactions.get(0).getQuantity());
        assertEquals("BATCH-2", transactions.get(1).getBatchId());
        assertEquals(3, transactions.get(1).getQuantity());

        verify(productRepository).updateQuantity("PROD-1", -6);
        verify(requestRepository).updateRequestStatus("REQ-1", "Pending");
        verify(orderRepository).updateOrderItemFulfillment("ORDER-1", "PROD-1", 6);
    }

    @Test
    void fulfillItem_throwsWhenBatchesInsufficient() {
        RequestItem requestItem = new RequestItem();
        requestItem.setRequestItemId("REQ-ITEM-2");
        requestItem.setRequestId("REQ-2");
        requestItem.setProductId("PROD-2");
        requestItem.setQuantity(10);
        requestItem.setRemainingQty(10);
        when(requestRepository.findItemById("REQ-ITEM-2")).thenReturn(requestItem);

        Product product = new Product();
        product.setProductId("PROD-2");
        product.setQuantity(10);
        when(productRepository.findById("PROD-2")).thenReturn(product);

        ProductBatch batch = new ProductBatch();
        batch.setBatchId("BATCH-3");
        batch.setProductId("PROD-2");
        batch.setQuantityRemaining(4);
        when(productBatchRepository.findAvailableBatches("PROD-2"))
                .thenReturn(List.of(batch));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                stockService.fulfillItem("REQ-ITEM-2", 6, "STF-2")
        );

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        verify(productRepository, never()).updateQuantity(anyString(), anyInt());
        verify(requestRepository, never()).updateRequestStatus(anyString(), anyString());
        verify(orderRepository, never()).updateOrderItemFulfillment(anyString(), anyString(), anyInt());
    }
}
