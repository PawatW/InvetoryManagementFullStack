'use client';

import { FormEvent, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../../components/AuthContext';
import { apiFetch } from '../../../lib/api';
import { useAuthedSWR } from '../../../lib/swr';
import type { Product, PurchaseItem, PurchaseOrder, StockTransaction, Supplier } from '../../../lib/types';
import { SearchableSelect, type SearchableOption } from '../../../components/SearchableSelect';

interface ReceivableItem extends PurchaseItem {
  quantityInput?: string;
  unitPriceInput?: string;
}

export default function StockPage() {
  const { role, token, staffId } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStockInModalOpen, setStockInModalOpen] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [isAdjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustFormResetKey, setAdjustFormResetKey] = useState(0);
  const [selectedAdjustProductId, setSelectedAdjustProductId] = useState('');
  const [isAdjustSubmitting, setIsAdjustSubmitting] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [inspectedTransactionId, setInspectedTransactionId] = useState<string | null>(null);
  const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [receivingItems, setReceivingItems] = useState<ReceivableItem[]>([]);
  const [isReceiveModalOpen, setReceiveModalOpen] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [isLoadingPoDetail, setIsLoadingPoDetail] = useState(false);
  const [isPendingPoModalOpen, setPendingPoModalOpen] = useState(false);

  const canStockIn = role === 'WAREHOUSE';
  const canReceiveFromPurchaseOrder = role === 'WAREHOUSE' || role === 'ADMIN';
  const canViewTransactions = role === 'WAREHOUSE' || role === 'ADMIN';

  const { data: suppliers } = useAuthedSWR<Supplier[]>(role ? '/suppliers' : null, token);
  const { data: products, mutate: mutateProducts } = useAuthedSWR<Product[]>(role ? '/products' : null, token);
  const { data: pendingPurchaseOrders, mutate: mutatePendingPurchaseOrders } = useAuthedSWR<PurchaseOrder[]>(
    canReceiveFromPurchaseOrder ? '/purchase-orders?status=Pending' : null,
    token,
    {
      refreshInterval: 30000
    }
  );
  const { data: transactions, mutate } = useAuthedSWR<StockTransaction[]>(
    canViewTransactions ? '/stock/transactions' : null,
    token,
    {
      refreshInterval: 30000
    }
  );

  const productOptions = useMemo<SearchableOption[]>(() => {
    return (products ?? []).map((product) => ({
      value: product.productId,
      label: `${product.productName} (${product.productId})`,
      description: [product.unit, product.supplierId ? `Supplier: ${product.supplierId}` : null]
        .filter(Boolean)
        .join(' • ') || undefined,
      keywords: [product.productName, product.productId, product.unit ?? '', product.supplierId ?? '', product.description ?? '']
    }));
  }, [products]);

  const supplierNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (suppliers ?? []).forEach((supplier) => {
      map.set(supplier.supplierId, supplier.supplierName);
    });
    return map;
  }, [suppliers]);

  const sortedPendingOrders = useMemo(() => {
    const list = pendingPurchaseOrders ?? [];
    return [...list].sort((a, b) => {
      const aTime = a.poDate ? new Date(a.poDate).getTime() : 0;
      const bTime = b.poDate ? new Date(b.poDate).getTime() : 0;
      return bTime - aTime;
    });
  }, [pendingPurchaseOrders]);

  const sortedTransactions = useMemo(() => {
    const data = transactions ?? [];
    return [...data].sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const query = transactionSearch.trim().toLowerCase();
    if (!query) {
      return sortedTransactions;
    }
    return sortedTransactions.filter((transaction) => {
      const haystack = [
        transaction.transactionId,
        transaction.productId,
        transaction.staffId,
        transaction.type,
        transaction.description ?? '',
        transaction.batchId ?? '',
        transaction.referenceId ?? ''
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [sortedTransactions, transactionSearch]);

  const inspectedTransaction = useMemo(() => {
    if (!inspectedTransactionId) {
      return null;
    }
    return sortedTransactions.find((transaction) => transaction.transactionId === inspectedTransactionId) ?? null;
  }, [sortedTransactions, inspectedTransactionId]);

  const handleStockIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const form = event.currentTarget;
    setError(null);
    setMessage(null);

    const formData = new FormData(form);
    const productId = String(formData.get('productId') ?? '').trim();
    const quantityRaw = formData.get('quantity');
    const quantity = quantityRaw === null || quantityRaw === '' ? 0 : Number(quantityRaw);
    const note = String(formData.get('note') ?? '');

    if (!productId) {
      setError('กรุณาเลือกสินค้า');
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('จำนวนต้องมากกว่า 0');
      return;
    }

    const payload = {
      productId,
      quantity,
      note: note || undefined
    };

    try {
      await apiFetch<void>('/stock/in', {
        method: 'POST',
        body: JSON.stringify(payload),
        token
      });
      setMessage('บันทึกสินค้าเข้าเรียบร้อย');
      form.reset();
      setStockInModalOpen(false);
      setFormResetKey((prev) => prev + 1);
      setSelectedProductId('');
      mutate();
      mutateProducts?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกสินค้าเข้าได้');
    }
  };

  const handleAdjustStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const form = event.currentTarget;
    setError(null);
    setMessage(null);

    const formData = new FormData(form);
    const productId = String(formData.get('productId') ?? '').trim();
    const diffRaw = formData.get('diff');
    const diff = diffRaw === null || diffRaw === '' ? Number.NaN : Number(diffRaw);

    if (!productId) {
      setError('กรุณาเลือกสินค้า');
      return;
    }

    if (!Number.isFinite(diff) || diff === 0) {
      setError('จำนวนที่ปรับต้องไม่เป็นศูนย์');
      return;
    }

    setIsAdjustSubmitting(true);

    try {
      await apiFetch<void>(`/products/${productId}/adjust?diff=${diff}`, {
        method: 'PUT',
        token
      });
      setMessage('ปรับจำนวนสินค้าเรียบร้อย');
      form.reset();
      setAdjustModalOpen(false);
      setAdjustFormResetKey((prev) => prev + 1);
      setSelectedAdjustProductId('');
      mutate();
      mutateProducts?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถปรับจำนวนสินค้าได้');
    } finally {
      setIsAdjustSubmitting(false);
    }
  };

  const handleOpenReceiveFromPo = async (poId: string) => {
    if (!token || !canReceiveFromPurchaseOrder) {
      return;
    }
    setIsLoadingPoDetail(true);
    setError(null);
    setMessage(null);
    try {
      const detail = await apiFetch<PurchaseOrder>(`/purchase-orders/${poId}`, { token });
      setReceivingOrder(detail);
      setReceivingItems(
        (detail.items ?? []).map((item) => ({
          ...item,
          quantityInput: String(item.quantity),
          unitPriceInput:
            item.unitPrice !== undefined && item.unitPrice !== null ? String(item.unitPrice) : ''
        }))
      );
      setReceiveModalOpen(true);
      setPendingPoModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลใบสั่งซื้อได้');
    } finally {
      setIsLoadingPoDetail(false);
    }
  };

  const handleCloseReceiveFromPo = () => {
    setReceiveModalOpen(false);
    setReceivingOrder(null);
    setReceivingItems([]);
  };

  const handleSubmitReceiveFromPo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !receivingOrder) {
      return;
    }
    if (!staffId) {
      setError('ไม่พบรหัสพนักงานผู้รับสินค้า');
      return;
    }
    setIsReceiving(true);
    setError(null);
    setMessage(null);
    try {
      const payloadItems: PurchaseItem[] = receivingItems.map((item) => {
        if (!item.poItemId) {
          throw new Error('ไม่พบรหัสรายการสินค้าในใบสั่งซื้อ');
        }
        const priceValue = Number(item.unitPriceInput ?? '');
        const qtyValue = Number(item.quantityInput ?? '');
        if (!Number.isFinite(priceValue) || priceValue <= 0) {
          throw new Error('กรุณาระบุราคาทุนที่ถูกต้อง');
        }
        if (!Number.isFinite(qtyValue) || qtyValue <= 0) {
          throw new Error('กรุณาระบุจำนวนที่รับเข้าให้ถูกต้อง');
        }
        return {
          poItemId: item.poItemId,
          poId: item.poId,
          productId: item.productId,
          quantity: qtyValue,
          unitPrice: priceValue
        };
      });

      await apiFetch(`/purchase-orders/${receivingOrder.poId}/receive`, {
        method: 'POST',
        token,
        body: JSON.stringify({ items: payloadItems, staffId })
      });
      setMessage('รับสินค้าเข้าจากใบสั่งซื้อเรียบร้อย');
      handleCloseReceiveFromPo();
      mutatePendingPurchaseOrders?.();
      mutate();
      mutateProducts?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกรับสินค้าได้');
    } finally {
      setIsReceiving(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Stock Operations</h1>
      </header>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {message && <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{message}</div>}

      {canStockIn && (
        <>
          <section className="card space-y-4 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">บันทึกสินค้าเข้า (Stock-In)</h2>
              </div>
              <div className="flex w-full flex-wrap gap-2 md:w-auto md:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMessage(null);
                    setStockInModalOpen(true);
                    setFormResetKey((prev) => prev + 1);
                    setSelectedProductId('');
                  }}
                  className="w-full rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white md:w-auto"
                >
                  Stock-In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMessage(null);
                    setAdjustModalOpen(true);
                    setAdjustFormResetKey((prev) => prev + 1);
                    setSelectedAdjustProductId('');
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 md:w-auto"
                >
                  ปรับสต็อก
                </button>
                {canReceiveFromPurchaseOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMessage(null);
                      setPendingPoModalOpen(true);
                    }}
                    className="w-full rounded-xl border border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-600 transition hover:border-primary-300 hover:bg-primary-50 md:w-auto"
                  >
                    เพิ่มตาม PO
                  </button>
                )}
              </div>
            </div>
            {canReceiveFromPurchaseOrder && (
              <p className="text-xs text-slate-500">
                สามารถเลือกใบสั่งซื้อสถานะ Pending เพื่อยืนยันการรับสินค้าเข้าคลังได้จากปุ่ม "เพิ่มตาม PO"
              </p>
            )}
          </section>

          {isStockInModalOpen && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60">
              <div className="flex min-h-full items-center justify-center p-4">
                <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
                  <div className="max-h-[85vh] overflow-y-auto p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">บันทึกสินค้าเข้า (Stock-In)</h2>
                        <p className="text-sm text-slate-500">เลือกสินค้าและระบุจำนวนก่อนยืนยัน</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStockInModalOpen(false);
                          setFormResetKey((prev) => prev + 1);
                          setSelectedProductId('');
                        }}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                      >
                        ปิด
                      </button>
                    </div>
                    <form key={formResetKey} onSubmit={handleStockIn} className="mt-6 space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-medium text-slate-500">สินค้า</label>
                          <SearchableSelect
                            key={`stock-product-${formResetKey}`}
                            name="productId"
                            value={selectedProductId}
                            onChange={setSelectedProductId}
                            options={[{ value: '', label: 'เลือกสินค้า' }, ...productOptions]}
                            placeholder="เลือกสินค้า"
                            searchPlaceholder="ค้นหาสินค้า..."
                            emptyMessage="ไม่พบสินค้า"
                            disabled={productOptions.length === 0}
                          />
                          {productOptions.length === 0 && (
                            <p className="text-xs text-rose-500">ยังไม่มีข้อมูลสินค้า</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-slate-500">จำนวน</label>
                          <input name="quantity" type="number" min={1} required />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-medium text-slate-500">หมายเหตุ</label>
                          <textarea name="note" rows={3} placeholder="อ้างอิงใบส่งของหรือข้อมูลขนส่ง" />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setStockInModalOpen(false);
                            setFormResetKey((prev) => prev + 1);
                            setSelectedProductId('');
                          }}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                        >
                          ยกเลิก
                        </button>
                        <button type="submit" className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white">
                          บันทึก
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {canReceiveFromPurchaseOrder && isPendingPoModalOpen && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60">
              <div className="flex min-h-full items-center justify-center p-4">
                <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
                  <div className="max-h-[85vh] overflow-y-auto p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">เลือกใบสั่งซื้อที่รอรับสินค้า</h2>
                        <p className="text-sm text-slate-500">ตรวจสอบรายการ Pending Purchase Order และกดรับสินค้าเข้าคลัง</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPendingPoModalOpen(false)}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                      >
                        ปิด
                      </button>
                    </div>
                    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                        <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3">PO ID</th>
                            <th className="px-4 py-3">Supplier</th>
                            <th className="px-4 py-3">วันที่</th>
                            <th className="px-4 py-3">ยอดรวม</th>
                            <th className="px-4 py-3">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {pendingPurchaseOrders === undefined ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                                กำลังโหลดข้อมูล...
                              </td>
                            </tr>
                          ) : sortedPendingOrders.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                                ไม่มีใบสั่งซื้อรอรับสินค้า
                              </td>
                            </tr>
                          ) : (
                            sortedPendingOrders.map((order) => (
                              <tr key={order.poId} className="hover:bg-slate-50">
                                <td className="px-4 py-3 font-mono text-xs text-slate-500">{order.poId}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {supplierNameMap.get(order.supplierId) ?? order.supplierId}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-500">
                                  {order.poDate ? format(new Date(order.poDate), 'dd MMM yyyy HH:mm') : '-'}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  ฿{(order.totalAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReceiveFromPo(order.poId)}
                                    className="rounded-lg border border-primary-200 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    disabled={isLoadingPoDetail}
                                  >
                                    {isLoadingPoDetail ? 'กำลังโหลด...' : 'รับสินค้า'}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isAdjustModalOpen && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60">
              <div className="flex min-h-full items-center justify-center p-4">
                <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
                  <div className="max-h-[85vh] overflow-y-auto p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">ปรับจำนวนสินค้า</h2>
                        <p className="text-sm text-slate-500">เพิ่มหรือลดจำนวนสินค้าในคลังให้ตรงกับสต็อกจริง</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setAdjustModalOpen(false);
                          setAdjustFormResetKey((prev) => prev + 1);
                          setSelectedAdjustProductId('');
                        }}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                      >
                        ปิด
                      </button>
                    </div>
                    <form key={adjustFormResetKey} onSubmit={handleAdjustStock} className="mt-6 space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">สินค้า</label>
                        <SearchableSelect
                          key={`adjust-product-${adjustFormResetKey}`}
                          name="productId"
                          value={selectedAdjustProductId}
                          onChange={setSelectedAdjustProductId}
                          options={[{ value: '', label: 'เลือกสินค้า' }, ...productOptions]}
                          placeholder="เลือกสินค้า"
                          searchPlaceholder="ค้นหาสินค้า..."
                          emptyMessage="ไม่พบสินค้า"
                          disabled={productOptions.length === 0}
                        />
                        {productOptions.length === 0 && (
                          <p className="text-xs text-rose-500">ยังไม่มีข้อมูลสินค้า</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-500">จำนวนที่ต้องการปรับ</label>
                        <input name="diff" type="number" required />
                        <p className="text-xs text-slate-400">ใส่ค่าบวกเพื่อเพิ่ม และค่าติดลบเพื่อลดจำนวนสินค้า</p>
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setAdjustModalOpen(false);
                            setAdjustFormResetKey((prev) => prev + 1);
                            setSelectedAdjustProductId('');
                          }}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="submit"
                          disabled={isAdjustSubmitting}
                          className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isAdjustSubmitting ? 'กำลังบันทึก...' : 'บันทึกการปรับสต็อก'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isReceiveModalOpen && receivingOrder && (
            <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60">
              <div className="flex min-h-full items-center justify-center p-4">
                <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
                  <div className="max-h-[85vh] overflow-y-auto p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">ยืนยันการรับสินค้าเข้าคลัง</h2>
                        <p className="text-sm text-slate-500">
                          {receivingOrder.poId} • Supplier: {receivingOrder.supplierId}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCloseReceiveFromPo}
                        className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                      >
                        ปิด
                      </button>
                    </div>
                    <form onSubmit={handleSubmitReceiveFromPo} className="mt-6 space-y-6">
                      <div className="space-y-4">
                        {receivingItems.map((item, index) => (
                          <div key={item.poItemId ?? `receiving-${index}`} className="rounded-2xl border border-slate-200 p-4">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-700">สินค้า {item.productId}</p>
                                <p className="text-xs text-slate-500">จำนวนในใบสั่งซื้อ: {item.quantity}</p>
                              </div>
                            </div>
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-500">ราคาทุนต่อหน่วย</label>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  required
                                  value={item.unitPriceInput ?? ''}
                                  onChange={(event) =>
                                    setReceivingItems((prev) =>
                                      prev.map((candidate) =>
                                        candidate.poItemId === item.poItemId
                                          ? { ...candidate, unitPriceInput: event.target.value }
                                          : candidate
                                      )
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-500">จำนวนที่รับเข้า</label>
                                <input
                                  type="number"
                                  min={1}
                                  required
                                  value={item.quantityInput ?? ''}
                                  onChange={(event) =>
                                    setReceivingItems((prev) =>
                                      prev.map((candidate) =>
                                        candidate.poItemId === item.poItemId
                                          ? { ...candidate, quantityInput: event.target.value }
                                          : candidate
                                      )
                                    )
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={handleCloseReceiveFromPo}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                        >
                          ยกเลิก
                        </button>
                        <button
                          type="submit"
                          disabled={isReceiving}
                          className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isReceiving ? 'กำลังบันทึก...' : 'ยืนยันการรับสินค้า'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {canViewTransactions && (
        <section className="card space-y-4 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">ประวัติธุรกรรมสต็อก</h2>
            </div>
            <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
              <input
                type="search"
                value={transactionSearch}
                onChange={(event) => setTransactionSearch(event.target.value)}
                placeholder="ค้นหาด้วยรหัสสินค้า ประเภท หรือผู้ทำรายการ"
                className="w-full md:w-80"
              />
              <p className="text-xs text-slate-400">
                แสดง {filteredTransactions.length} จาก {sortedTransactions.length} รายการ
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Transaction ID</th>
                  <th className="px-4 py-3">วันที่</th>
                  <th className="px-4 py-3">สินค้า</th>
                  <th className="px-4 py-3">ประเภท</th>
                  <th className="px-4 py-3">จำนวน</th>
                  <th className="px-4 py-3">ผู้ทำรายการ</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">รายละเอียด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {transactions === undefined ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-400">
                      กำลังโหลดประวัติธุรกรรม...
                    </td>
                  </tr>
                ) : filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                      {sortedTransactions.length === 0 ? 'ยังไม่มีธุรกรรมสต็อก' : 'ไม่พบรายการที่ตรงกับการค้นหา'}
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((transaction) => (
                    <tr key={transaction.transactionId} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{transaction.transactionId}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {format(new Date(transaction.transactionDate), 'dd MMM yyyy HH:mm')}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{transaction.productId}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">
                        {transaction.type === 'IN' ? 'สินค้าเข้า' : 'สินค้าออก'}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{transaction.quantity}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{transaction.staffId}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{transaction.batchId || '-'}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectedTransactionId(transaction.transactionId);
                            setTransactionModalOpen(true);
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:border-primary-200 hover:bg-primary-50"
                        >
                          ดูรายละเอียด
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canViewTransactions && isTransactionModalOpen && inspectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="max-h-[80vh] overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">รายละเอียดธุรกรรม</h2>
                  <p className="text-sm text-slate-500">
                    {inspectedTransaction.transactionId} • {format(new Date(inspectedTransaction.transactionDate), 'dd MMM yyyy HH:mm')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTransactionModalOpen(false);
                    setInspectedTransactionId(null);
                  }}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  ปิด
                </button>
              </div>
              <div className="mt-6 space-y-4 text-sm text-slate-700">
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">ประเภท</span>
                    <span className="font-semibold text-slate-800">{inspectedTransaction.type}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">สินค้า</span>
                    <span className="font-semibold text-slate-800">{inspectedTransaction.productId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">จำนวน</span>
                    <span className="font-semibold text-slate-800">{inspectedTransaction.quantity}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">ผู้ทำรายการ</span>
                    <span className="font-semibold text-slate-800">{inspectedTransaction.staffId}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Batch</span>
                    <span className="font-semibold text-slate-800">{inspectedTransaction.batchId || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">อ้างอิง</span>
                    <span className="font-semibold text-slate-800">{inspectedTransaction.referenceId || '-'}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-500">รายละเอียดเพิ่มเติม</p>
                  <p className="mt-2 text-sm text-slate-700">{inspectedTransaction.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
