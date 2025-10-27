'use client';

import { FormEvent, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../../../components/AuthContext';
import { apiFetch } from '../../../../lib/api';
import { useAuthedSWR } from '../../../../lib/swr';
import type { PurchaseItem, PurchaseOrder } from '../../../../lib/types';

const STATUSES: { id: string; label: string }[] = [
  { id: 'New order', label: 'New order' },
  { id: 'Pending', label: 'Pending pricing' },
  { id: 'Received', label: 'Received' },
  { id: 'Rejected', label: 'Rejected' }
];

interface EditableItem extends PurchaseItem {
  unitPriceInput?: string;
  quantityInput?: string;
}

export default function PurchaseOrdersPage() {
  const { role, token, staffId } = useAuth();
  const { data: orders, mutate, isLoading } = useAuthedSWR<PurchaseOrder[]>(role ? '/purchase-orders' : null, token, {
    refreshInterval: 30000
  });
  const [activeStatus, setActiveStatus] = useState('New order');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pricingOrder, setPricingOrder] = useState<PurchaseOrder | null>(null);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [pricingItems, setPricingItems] = useState<EditableItem[]>([]);
  const [receivingItems, setReceivingItems] = useState<EditableItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  if (role !== 'PROCUREMENT' && role !== 'ADMIN') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        เฉพาะผู้ใช้ฝ่ายจัดซื้อ (Procurement) หรือผู้ดูแลระบบเท่านั้นที่สามารถจัดการใบสั่งซื้อได้
      </div>
    );
  }

  const filteredOrders = useMemo(() => {
    return (orders ?? []).filter((order) => order.status === activeStatus);
  }, [orders, activeStatus]);

  const handleOpenPricing = async (orderId: string) => {
    if (!token) return;
    setIsLoadingDetail(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const detail = await apiFetch<PurchaseOrder>(`/purchase-orders/${orderId}`, { token });
      setPricingOrder(detail);
      setPricingItems(
        (detail.items ?? []).map((item) => ({
          ...item,
          unitPriceInput: item.unitPrice !== undefined && item.unitPrice !== null ? String(item.unitPrice) : ''
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลใบสั่งซื้อได้');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleOpenReceiving = async (orderId: string) => {
    if (!token) return;
    setIsLoadingDetail(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const detail = await apiFetch<PurchaseOrder>(`/purchase-orders/${orderId}`, { token });
      setReceivingOrder(detail);
      setReceivingItems(
        (detail.items ?? []).map((item) => ({
          ...item,
          unitPriceInput: item.unitPrice !== undefined && item.unitPrice !== null ? String(item.unitPrice) : '',
          quantityInput: String(item.quantity)
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลใบสั่งซื้อได้');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleClosePricing = () => {
    setPricingOrder(null);
    setPricingItems([]);
  };

  const handleCloseReceiving = () => {
    setReceivingOrder(null);
    setReceivingItems([]);
  };

  const handleSubmitPricing = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !pricingOrder) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payloadItems: PurchaseItem[] = pricingItems.map((item) => {
        const priceValue = Number(item.unitPriceInput ?? '');
        if (!Number.isFinite(priceValue) || priceValue <= 0) {
          throw new Error('กรุณาระบุราคาทุนต่อหน่วยให้ถูกต้อง');
        }
        return {
          poItemId: item.poItemId,
          poId: item.poId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: priceValue
        };
      });

      await apiFetch<PurchaseOrder>(`/purchase-orders/${pricingOrder.poId}/pricing`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ items: payloadItems, reject: false })
      });

      setSuccessMessage('บันทึกราคาทุนสำหรับใบสั่งซื้อแล้ว');
      handleClosePricing();
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกราคาทุนได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectPricing = async () => {
    if (!token || !pricingOrder) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await apiFetch(`/purchase-orders/${pricingOrder.poId}/pricing`, {
        method: 'PUT',
        token,
        body: JSON.stringify({ items: [], reject: true })
      });
      setSuccessMessage('ปฏิเสธใบสั่งซื้อเรียบร้อย');
      handleClosePricing();
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถปฏิเสธใบสั่งซื้อได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReceiving = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !receivingOrder) return;
    if (!staffId) {
      setError('ไม่พบรหัสพนักงานผู้รับสินค้า');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const payloadItems: PurchaseItem[] = receivingItems.map((item) => {
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
      setSuccessMessage('บันทึกรับสินค้าเข้าคลังเรียบร้อย');
      handleCloseReceiving();
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถบันทึกรับสินค้าได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Purchase Orders</h1>
        <p className="text-sm text-slate-500">จัดการใบสั่งซื้อจาก Supplier และอัปเดตสถานะการรับสินค้า</p>
      </header>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {successMessage && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{successMessage}</div>
      )}

      <section className="card space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((status) => (
            <button
              key={status.id}
              type="button"
              onClick={() => setActiveStatus(status.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeStatus === status.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">PO ID</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">วันที่</th>
                <th className="px-4 py-3">ยอดรวม</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-400">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              )}
              {!isLoading && filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    ไม่มีใบสั่งซื้อในสถานะนี้
                  </td>
                </tr>
              )}
              {filteredOrders.map((order) => (
                <tr key={order.poId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{order.poId}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{order.supplierId}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {order.poDate ? format(new Date(order.poDate), 'dd MMM yyyy HH:mm') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    ฿{(order.totalAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-700">{order.status}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenPricing(order.poId)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                        disabled={isLoadingDetail || order.status !== 'New order'}
                      >
                        กรอกราคา
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenReceiving(order.poId)}
                        className="rounded-lg border border-primary-200 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isLoadingDetail || order.status !== 'Pending'}
                      >
                        รับสินค้า
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {pricingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
            <div className="max-h-[85vh] overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">กำหนดราคาทุน</h2>
                  <p className="text-sm text-slate-500">{pricingOrder.poId} • Supplier: {pricingOrder.supplierId}</p>
                </div>
                <button
                  type="button"
                  onClick={handleClosePricing}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  ปิด
                </button>
              </div>
              <form onSubmit={handleSubmitPricing} className="mt-6 space-y-6">
                <div className="space-y-4">
                  {pricingItems.map((item, index) => (
                    <div key={item.poItemId} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{item.productId}</p>
                          <p className="text-xs text-slate-500">จำนวน {item.quantity} หน่วย</p>
                        </div>
                        <div className="space-y-1">
                          <label className="block text-xs font-medium text-slate-500">ราคาทุนต่อหน่วย</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPriceInput ?? ''}
                            onChange={(event) => {
                              const value = event.target.value;
                              setPricingItems((prev) => {
                                const next = [...prev];
                                next[index] = { ...next[index], unitPriceInput: value };
                                return next;
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:justify-between">
                  <button
                    type="button"
                    onClick={handleRejectPricing}
                    disabled={isSubmitting}
                    className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ปฏิเสธใบสั่งซื้อ
                  </button>
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleClosePricing}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {receivingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
            <div className="max-h-[85vh] overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">บันทึกรับสินค้าเข้าคลัง</h2>
                  <p className="text-sm text-slate-500">{receivingOrder.poId} • Supplier: {receivingOrder.supplierId}</p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseReceiving}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  ปิด
                </button>
              </div>
              <form onSubmit={handleSubmitReceiving} className="mt-6 space-y-6">
                <div className="space-y-4">
                  {receivingItems.map((item, index) => (
                    <div key={item.poItemId} className="rounded-2xl border border-slate-200 p-4">
                      <p className="text-sm font-semibold text-slate-800">{item.productId}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <label className="text-xs font-medium text-slate-500">จำนวนที่รับเข้า</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.quantityInput ?? ''}
                            onChange={(event) => {
                              const value = event.target.value;
                              setReceivingItems((prev) => {
                                const next = [...prev];
                                next[index] = { ...next[index], quantityInput: value };
                                return next;
                              });
                            }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-500">ราคาทุนต่อหน่วย</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPriceInput ?? ''}
                            onChange={(event) => {
                              const value = event.target.value;
                              setReceivingItems((prev) => {
                                const next = [...prev];
                                next[index] = { ...next[index], unitPriceInput: value };
                                return next;
                              });
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCloseReceiving}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันรับเข้า'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
