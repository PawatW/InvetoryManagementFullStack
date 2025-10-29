'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../../components/AuthContext';
import { apiFetch, uploadPurchaseOrderSlip } from '../../../lib/api';
import { useAuthedSWR } from '../../../lib/swr';
import type { Product, PurchaseItem, PurchaseOrder, Supplier, ProductBatch } from '../../../lib/types';
import { SearchableSelect, type SearchableOption } from '../../../components/SearchableSelect';

const STATUSES: { id: string; label: string }[] = [
  { id: 'New order', label: 'New order' },
  { id: 'Pending', label: 'Pending receiving' },
  { id: 'Received', label: 'Received' },
  { id: 'Rejected', label: 'Rejected' }
];

interface EditableItem extends PurchaseItem {
  unitPriceInput?: string;
  quantityInput?: string;
}

interface DraftPurchaseItem {
  key: string;
  productId: string;
  quantity: string;
}

function createDraftItem(): DraftPurchaseItem {
  return {
    key: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    productId: '',
    quantity: ''
  };
}

export default function PurchaseOrdersPage() {
  const { role, token, staffId } = useAuth();
  const { data: orders, mutate, isLoading } = useAuthedSWR<PurchaseOrder[]>(role ? '/purchase-orders' : null, token, {
    refreshInterval: 30000
  });
  const { data: suppliers } = useAuthedSWR<Supplier[]>(role ? '/suppliers' : null, token);
  const { data: products } = useAuthedSWR<Product[]>(role ? '/products' : null, token);

  const [activeStatus, setActiveStatus] = useState('New order');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pricingOrder, setPricingOrder] = useState<PurchaseOrder | null>(null);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [pricingItems, setPricingItems] = useState<EditableItem[]>([]);
  const [pricingSlipUrl, setPricingSlipUrl] = useState('');
  const [pricingSlipUploading, setPricingSlipUploading] = useState(false);
  const [pricingSlipPreviewError, setPricingSlipPreviewError] = useState(false);
  const [receivingItems, setReceivingItems] = useState<EditableItem[]>([]);
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [detailSlipError, setDetailSlipError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [createFormKey, setCreateFormKey] = useState(0);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [draftItems, setDraftItems] = useState<DraftPurchaseItem[]>([createDraftItem()]);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);

  const canCreate = role === 'WAREHOUSE' || role === 'ADMIN';
  const canPrice = role === 'PROCUREMENT' || role === 'ADMIN';
  const canReceive = role === 'WAREHOUSE' || role === 'ADMIN';
  const canView = canCreate || canPrice || canReceive;

  if (!canView) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        เฉพาะผู้ใช้ฝ่ายคลังสินค้า ฝ่ายจัดซื้อ หรือผู้ดูแลระบบเท่านั้นที่สามารถจัดการใบสั่งซื้อได้
      </div>
    );
  }

  const supplierOptions = useMemo<SearchableOption[]>(() => {
    return (suppliers ?? []).map((supplier) => ({
      value: supplier.supplierId,
      label: `${supplier.supplierName} (${supplier.supplierId})`,
      description: supplier.phone ? `โทร: ${supplier.phone}` : supplier.email ? `อีเมล: ${supplier.email}` : undefined,
      keywords: [
        supplier.supplierName,
        supplier.supplierId,
        supplier.phone ?? '',
        supplier.email ?? '',
        supplier.address ?? ''
      ]
    }));
  }, [suppliers]);

  const supplierNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (suppliers ?? []).forEach((supplier) => {
      map.set(supplier.supplierId, supplier.supplierName);
    });
    return map;
  }, [suppliers]);

  const productOptions = useMemo<SearchableOption[]>(() => {
    return (products ?? []).map((product) => ({
      value: product.productId,
      label: `${product.productName} (${product.productId})`,
      description: product.unit ? `หน่วย: ${product.unit}` : undefined,
      keywords: [product.productName, product.productId, product.unit ?? '', product.description ?? '']
    }));
  }, [products]);

  const productNameMap = useMemo(() => {
    const map = new Map<string, string>();
    (products ?? []).forEach((product) => {
      map.set(product.productId, product.productName);
    });
    return map;
  }, [products]);

  const filteredOrders = useMemo(() => {
    return (orders ?? []).filter((order) => order.status === activeStatus);
  }, [orders, activeStatus]);

  const resetCreateForm = () => {
    setDraftItems([createDraftItem()]);
    setSelectedSupplierId('');
    setCreateFormKey((prev) => prev + 1);
  };

  const handleOpenCreate = () => {
    setError(null);
    setSuccessMessage(null);
    resetCreateForm();
    setCreateModalOpen(true);
  };

  const handleCloseCreate = () => {
    setCreateModalOpen(false);
  };

  const handleAddDraftItem = () => {
    setDraftItems((prev) => [...prev, createDraftItem()]);
  };

  const handleRemoveDraftItem = (key: string) => {
    setDraftItems((prev) => {
      if (prev.length === 1) {
        return [createDraftItem()];
      }
      return prev.filter((item) => item.key !== key);
    });
  };

  const handleUpdateDraftItem = (key: string, patch: Partial<DraftPurchaseItem>) => {
    setDraftItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  };

  const handleSubmitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      return;
    }
    if (!staffId) {
      setError('ไม่พบรหัสพนักงานผู้สร้างใบสั่งซื้อ');
      return;
    }

    const trimmedSupplier = selectedSupplierId.trim();
    if (!trimmedSupplier) {
      setError('กรุณาเลือก Supplier สำหรับใบสั่งซื้อ');
      return;
    }

    const sanitizedItems = draftItems
      .map((item) => ({
        productId: item.productId.trim(),
        quantityValue: Number(item.quantity)
      }))
      .filter((item) => item.productId);

    if (sanitizedItems.length === 0) {
      setError('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    for (const item of sanitizedItems) {
      if (!Number.isFinite(item.quantityValue) || item.quantityValue <= 0) {
        setError('จำนวนสินค้าทุกบรรทัดต้องมากกว่า 0');
        return;
      }
    }

    setIsCreateSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload: {
        supplierId: string;
        staffId: string;
        items: { productId: string; quantity: number }[];
      } = {
        supplierId: trimmedSupplier,
        staffId,
        items: sanitizedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantityValue
        }))
      };

      await apiFetch<PurchaseOrder>('/purchase-orders', {
        method: 'POST',
        token,
        body: JSON.stringify(payload)
      });

      setSuccessMessage('สร้างใบสั่งซื้อใหม่เรียบร้อย');
      setCreateModalOpen(false);
      resetCreateForm();
      setActiveStatus('New order');
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถสร้างใบสั่งซื้อได้');
    } finally {
      setIsCreateSubmitting(false);
    }
  };

  const handleOpenDetail = async (orderId: string) => {
    if (!token) return;
    setIsLoadingDetail(true);
    setError(null);
    setSuccessMessage(null);
    setDetailSlipError(false);
    try {
      const detail = await apiFetch<PurchaseOrder>(`/purchase-orders/${orderId}`, { token });
      setDetailOrder(detail);
      setDetailModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลใบสั่งซื้อได้');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setDetailModalOpen(false);
    setDetailOrder(null);
    setDetailSlipError(false);
  };

  const handleOpenPricing = async (orderId: string) => {
    if (!token || !canPrice) return;
    setIsLoadingDetail(true);
    setError(null);
    setSuccessMessage(null);
    setPricingSlipUploading(false);
    setPricingSlipPreviewError(false);
    try {
      const detail = await apiFetch<PurchaseOrder>(`/purchase-orders/${orderId}`, { token });
      setPricingOrder(detail);
      setPricingItems(
        (detail.items ?? []).map((item) => ({
          ...item,
          unitPriceInput:
            item.unitPrice !== undefined && item.unitPrice !== null ? String(item.unitPrice) : ''
        }))
      );
      setPricingSlipUrl(detail.slipUrl ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลใบสั่งซื้อได้');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleOpenReceiving = async (orderId: string) => {
    if (!token || !canReceive) return;
    setIsLoadingDetail(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const detail = await apiFetch<PurchaseOrder>(`/purchase-orders/${orderId}`, { token });
      setReceivingOrder(detail);
      setReceivingItems(
        (detail.items ?? []).map((item) => ({
          ...item,
          unitPriceInput:
            item.unitPrice !== undefined && item.unitPrice !== null ? String(item.unitPrice) : '',
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
    setPricingSlipUrl('');
    setPricingSlipUploading(false);
    setPricingSlipPreviewError(false);
  };

  const handlePricingSlipChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!token) return;
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setPricingSlipUploading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const uploadResult = await uploadPurchaseOrderSlip(file, token);
      setPricingSlipUrl(uploadResult.url);
      setPricingSlipPreviewError(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถอัปโหลดสลิปได้');
      setPricingSlipUrl('');
    } finally {
      setPricingSlipUploading(false);
      event.target.value = '';
    }
  };

  const handleCloseReceiving = () => {
    setReceivingOrder(null);
    setReceivingItems([]);
  };

  const handleSubmitPricing = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !pricingOrder) return;
    if (pricingSlipUploading) {
      setError('กรุณารอให้อัปโหลดสลิปเสร็จสิ้นก่อนบันทึก');
      return;
    }
    if (!pricingSlipUrl) {
      setError('กรุณาอัปโหลดสลิปยืนยันราคาก่อนบันทึก');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payloadItems: PurchaseItem[] = pricingItems.map((item) => {
        if (!item.poItemId) {
          throw new Error('ไม่พบรหัสรายการสินค้า');
        }
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
        body: JSON.stringify({ items: payloadItems, reject: false, slipUrl: pricingSlipUrl })
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Purchase Orders</h1>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-500"
            >
              สร้างใบสั่งซื้อ
            </button>
          )}
        </div>
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
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {supplierNameMap.get(order.supplierId) ?? order.supplierId}
                  </td>
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
                        onClick={() => handleOpenDetail(order.poId)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={isLoadingDetail}
                      >
                        ดูรายละเอียด
                      </button>
                      {canPrice && (
                        <button
                          type="button"
                          onClick={() => handleOpenPricing(order.poId)}
                          className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isLoadingDetail || order.status !== 'New order'}
                        >
                          กรอกราคา
                        </button>
                      )}
                      {canReceive && (
                        <button
                          type="button"
                          onClick={() => handleOpenReceiving(order.poId)}
                          className="rounded-lg border border-primary-200 px-3 py-1 text-xs font-semibold text-primary-600 transition hover:border-primary-300 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isLoadingDetail || order.status !== 'Pending'}
                        >
                          รับสินค้า
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {detailOrder && isDetailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
            <div className="max-h-[85vh] overflow-y-auto p-6 space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">รายละเอียดใบสั่งซื้อ</h2>
                  <p className="text-sm text-slate-500">
                    {detailOrder.poId} • {detailOrder.status}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCloseDetail}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  ปิด
                </button>
              </div>
              <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Supplier</p>
                  <p className="font-medium text-slate-800">
                    {supplierNameMap.get(detailOrder.supplierId) ?? detailOrder.supplierId}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">วันที่สร้าง</p>
                  <p>{detailOrder.poDate ? format(new Date(detailOrder.poDate), 'dd MMM yyyy HH:mm') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">ยอดรวม</p>
                  <p>
                    ฿
                    {(detailOrder.totalAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">ผู้บันทึก</p>
                  <p>{detailOrder.staffId || '-'}</p>
                </div>
              </div>
              {detailOrder.slipUrl && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">หลักฐานการเสนอราคา</h3>
                    <a
                      href={detailOrder.slipUrl ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary-600 hover:underline"
                    >
                      เปิดในแท็บใหม่
                    </a>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    {detailSlipError ? (
                      <div className="p-4 text-xs text-slate-500">
                        ไม่สามารถแสดงรูปหลักฐานได้ กรุณาเปิดลิงก์ด้านบนเพื่อดูไฟล์
                      </div>
                    ) : (
                      <img
                        src={detailOrder.slipUrl ?? undefined}
                        alt="หลักฐานการเสนอราคา"
                        className="max-h-72 w-full object-contain"
                        onError={() => setDetailSlipError(true)}
                      />
                    )}
                  </div>
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">รายการสินค้า</h3>
                </div>
                {(detailOrder.items ?? []).length === 0 ? (
                  <p className="text-sm text-slate-500">ไม่มีรายการสินค้าในใบสั่งซื้อนี้</p>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-2">สินค้า</th>
                          <th className="px-4 py-2">จำนวน</th>
                          <th className="px-4 py-2">ราคาทุน/หน่วย</th>
                          <th className="px-4 py-2">ยอดรวม</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-[13px]">
                        {(detailOrder.items ?? []).map((item) => {
                          const unitPrice = item.unitPrice ?? 0;
                          const lineTotal = unitPrice * item.quantity;
                          return (
                            <tr key={item.poItemId ?? `${item.productId}-${item.quantity}`} className="hover:bg-slate-50/60">
                              <td className="px-4 py-2">
                                <p className="font-medium text-slate-800">
                                  {productNameMap.get(item.productId) ?? item.productId}
                                </p>
                                <p className="text-xs text-slate-500">รหัส: {item.productId}</p>
                              </td>
                              <td className="px-4 py-2 text-slate-700">{item.quantity}</td>
                              <td className="px-4 py-2 text-slate-700">
                                {item.unitPrice !== undefined && item.unitPrice !== null
                                  ? Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })
                                  : '-'}
                              </td>
                              <td className="px-4 py-2 text-slate-700">
                                {item.unitPrice !== undefined && item.unitPrice !== null
                                  ? lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })
                                  : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
            <div className="max-h-[85vh] overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">สร้างใบสั่งซื้อใหม่</h2>
                  <p className="text-sm text-slate-500">เลือก Supplier และสินค้าที่ต้องการสั่งซื้อ</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleCloseCreate();
                  }}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                >
                  ปิด
                </button>
              </div>
              <form key={createFormKey} onSubmit={handleSubmitCreate} className="mt-6 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">Supplier</label>
                  <SearchableSelect
                    key={`supplier-${createFormKey}`}
                    name="supplierId"
                    value={selectedSupplierId}
                    onChange={setSelectedSupplierId}
                    options={[{ value: '', label: 'เลือก Supplier' }, ...supplierOptions]}
                    placeholder="เลือก Supplier"
                    searchPlaceholder="ค้นหา Supplier..."
                    emptyMessage="ไม่พบ Supplier"
                    disabled={supplierOptions.length === 0}
                    required
                  />
                  {supplierOptions.length === 0 && (
                    <p className="text-xs text-rose-500">ยังไม่มีข้อมูล Supplier ที่ใช้งานอยู่</p>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">รายการสินค้า</h3>
                    <button
                      type="button"
                      onClick={handleAddDraftItem}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                    >
                      เพิ่มรายการสินค้า
                    </button>
                  </div>
                  {draftItems.map((item) => (
                    <div key={item.key} className="rounded-2xl border border-slate-200 p-4">
                      <div className="grid gap-4 md:grid-cols-12">
                        <div className="md:col-span-7 space-y-2">
                          <label className="text-xs font-medium text-slate-500">สินค้า</label>
                          <SearchableSelect
                            key={`${item.key}-product`}
                            value={item.productId}
                            onChange={(value) => handleUpdateDraftItem(item.key, { productId: value })}
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
                        <div className="md:col-span-3 space-y-2">
                          <label className="text-xs font-medium text-slate-500">จำนวน</label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) =>
                              handleUpdateDraftItem(item.key, { quantity: event.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="md:col-span-2 flex items-end justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveDraftItem(item.key)}
                            className="rounded-lg border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      handleCloseCreate();
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isCreateSubmitting}
                    className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreateSubmitting ? 'กำลังบันทึก...' : 'บันทึกใบสั่งซื้อ'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {pricingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
            <div className="max-h-[85vh] overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">ยืนยันการจัดซื้อ</h2>
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
                    <div key={item.poItemId ?? `pricing-${index}`} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">สินค้า {item.productId}</p>
                          <p className="text-xs text-slate-500">จำนวน: {item.quantity}</p>
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
                              setPricingItems((prev) =>
                                prev.map((candidate) =>
                                  candidate.poItemId === item.poItemId
                                    ? { ...candidate, unitPriceInput: event.target.value }
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
                <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">หลักฐานการเสนอราคา (สลิป)</p>
                      <p className="text-xs text-slate-400">อัปโหลดสลิปหรือรูปใบเสนอราคาก่อนยืนยัน</p>
                    </div>
                    {pricingSlipUrl && (
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        onClick={() => {
                          setPricingSlipUrl('');
                          setPricingSlipPreviewError(false);
                        }}
                        disabled={pricingSlipUploading || isSubmitting}
                      >
                        ล้างไฟล์
                      </button>
                    )}
                  </div>
                  {pricingSlipUrl && (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                      {pricingSlipPreviewError ? (
                        <div className="p-3 text-xs text-slate-500">
                          ไม่สามารถแสดงตัวอย่างภาพได้{' '}
                          <a
                            href={pricingSlipUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-primary-600 hover:underline"
                          >
                            เปิดลิงก์
                          </a>
                        </div>
                      ) : (
                        <img
                          src={pricingSlipUrl}
                          alt="หลักฐานการเสนอราคา"
                          className="max-h-64 w-full bg-white object-contain"
                          onError={() => setPricingSlipPreviewError(true)}
                        />
                      )}
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePricingSlipChange}
                    disabled={pricingSlipUploading || isSubmitting}
                  />
                  <p className="text-xs text-slate-400">
                    {pricingSlipUploading ? 'กำลังอัปโหลดไฟล์...' : 'ไฟล์จะถูกบันทึกและแสดงในรายละเอียดใบสั่งซื้อ'}
                  </p>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                  <button
                    type="button"
                    onClick={handleRejectPricing}
                    disabled={isSubmitting}
                    className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ปฏิเสธใบสั่งซื้อ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || pricingSlipUploading}
                    className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการจัดซื้อ'}
                  </button>
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
                  <h2 className="text-lg font-semibold text-slate-900">ยืนยันการรับสินค้าเข้าคลัง</h2>
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
                    {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการรับสินค้า'}
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
