'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../../components/AuthContext';
import { useAuthedSWR } from '../../../lib/swr';
import { apiFetch, uploadProductImage } from '../../../lib/api';
import type { Product, Supplier, ProductBatch } from '../../../lib/types';
import { SearchableSelect, type SearchableOption } from '../../../components/SearchableSelect';
export default function InventoryPage() {
  const { token, role, staffId } = useAuth();
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [formResetKey, setFormResetKey] = useState(0);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [isDetailImageError, setDetailImageError] = useState(false);
  const [productBatches, setProductBatches] = useState<ProductBatch[]>([]);
  const [isBatchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isUpdateSubmitting, setIsUpdateSubmitting] = useState(false);
  const [editFormResetKey, setEditFormResetKey] = useState(0);
  const [isEditImageError, setEditImageError] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [priceEditProduct, setPriceEditProduct] = useState<Product | null>(null);
  const [isPriceModalOpen, setPriceModalOpen] = useState(false);
  const [isPriceSubmitting, setIsPriceSubmitting] = useState(false);
  const [initialQuantity, setInitialQuantity] = useState<number>(0);
  const [initialCostInput, setInitialCostInput] = useState('');

  useEffect(() => {
    setDetailImageError(false);
  }, [selectedProduct]);

  useEffect(() => {
    setEditImageError(false);
  }, [productToEdit]);

  useEffect(() => {
    if (initialQuantity <= 1) {
      setInitialCostInput('');
    }
  }, [initialQuantity]);

  const canManage = role === 'WAREHOUSE' || role === 'PROCUREMENT' || role === 'ADMIN';
  const canEditSellPrice = role === 'SALES' || role === 'ADMIN';
  const canCreateCustomers = role === 'SALES' || role === 'TECHNICIAN' || role === 'ADMIN';
  const canCreateOrders = role === 'SALES' || role === 'TECHNICIAN' || role === 'ADMIN';
  const isInitialCostEnabled = initialQuantity >= 1;
  const { data: suppliers } = useAuthedSWR<Supplier[]>(canManage ? '/suppliers' : null, token);
  const { data: products, mutate, isLoading } = useAuthedSWR<Product[]>('/products', token, { refreshInterval: 30000 });

  const batchSummary = useMemo(() => {
    const totalRemaining = productBatches.reduce((acc, batch) => acc + (batch.quantityRemaining ?? 0), 0);
    const totalReceived = productBatches.reduce((acc, batch) => acc + (batch.quantityIn ?? 0), 0);
    return {
      totalBatches: productBatches.length,
      totalRemaining,
      totalReceived
    };
  }, [productBatches]);

  const supplierOptions = useMemo<SearchableOption[]>(() => {
    return (suppliers ?? []).map((supplier) => ({
      value: supplier.supplierId,
      label: `${supplier.supplierName} (${supplier.supplierId})`,
      description: supplier.phone ? `โทร: ${supplier.phone}` : supplier.email ? `อีเมล: ${supplier.email}` : undefined,
      keywords: [supplier.supplierName, supplier.supplierId, supplier.phone ?? '', supplier.email ?? '', supplier.address ?? '']
    }));
  }, [suppliers]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (!filter) return products;
    return products.filter(
      (product) =>
        product.productName.toLowerCase().includes(filter.toLowerCase()) ||
        product.productId.toLowerCase().includes(filter.toLowerCase())
    );
  }, [products, filter]);

  useEffect(() => {
    if (!selectedProduct || !products) {
      return;
    }
    const updated = products.find((candidate) => candidate.productId === selectedProduct.productId);
    if (updated && updated !== selectedProduct) {
      setSelectedProduct(updated);
    }
  }, [products, selectedProduct]);

  const loadProductBatches = async (productId: string) => {
    if (!token) {
      return;
    }
    setBatchesError(null);
    setBatchesLoading(true);
    try {
      const batches = await apiFetch<ProductBatch[]>(`/products/${productId}/batches`, { token });
      setProductBatches(batches ?? []);
    } catch (err) {
      setProductBatches([]);
      setBatchesError(err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลล็อตสินค้าได้');
    } finally {
      setBatchesLoading(false);
    }
  };

  const handleOpenDetails = (product: Product) => {
    setSelectedProduct(product);
    setDetailImageError(false);
    setDetailModalOpen(true);
    setProductBatches([]);
    void loadProductBatches(product.productId);
  };

  const handleCloseDetails = () => {
    setDetailModalOpen(false);
    setSelectedProduct(null);
    setDetailImageError(false);
    setProductBatches([]);
    setBatchesError(null);
    setBatchesLoading(false);
  };

  const handleOpenEdit = (product: Product) => {
    setProductToEdit(product);
    setEditImageError(false);
    setEditModalOpen(true);
    setError(null);
    setSuccessMessage(null);
    setEditFormResetKey((prev) => prev + 1);
  };

  const handleCloseEdit = () => {
    setEditModalOpen(false);
    setProductToEdit(null);
    setEditImageError(false);
    setEditFormResetKey((prev) => prev + 1);
  };

  const handleOpenPriceEdit = (product: Product) => {
    setPriceEditProduct(product);
    setError(null);
    setSuccessMessage(null);
    setPriceModalOpen(true);
  };

  const handleClosePriceEdit = () => {
    setPriceModalOpen(false);
    setPriceEditProduct(null);
    setIsPriceSubmitting(false);
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!token) return;
    const confirmed = window.confirm(`ต้องการปิดใช้งานสินค้า ${product.productName} หรือไม่?`);
    if (!confirmed) {
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setDeletingProductId(product.productId);

    try {
      await apiFetch(`/products/${product.productId}`, {
        method: 'DELETE',
        token
      });
      await mutate();
      setSuccessMessage('ปิดการใช้งานสินค้าเรียบร้อย');
      if (isDetailModalOpen && selectedProduct?.productId === product.productId) {
        handleCloseDetails();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'ไม่สามารถปิดการใช้งานสินค้าได้');
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleUpdateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !productToEdit) return;

    const formData = new FormData(event.currentTarget);
    const productName = String(formData.get('productName') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const imageFile = formData.get('imageFile');

    if (!productName) {
      setError('กรุณากรอกชื่อสินค้า');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsUpdateSubmitting(true);

    let imageUrl: string | null = productToEdit.imageUrl ?? null;

    if (imageFile instanceof File && imageFile.size > 0) {
      try {
        const uploadResult = await uploadProductImage(imageFile, token);
        imageUrl = uploadResult.url;
      } catch (uploadError) {
        setIsUpdateSubmitting(false);
        setError(uploadError instanceof Error ? uploadError.message : 'ไม่สามารถอัปโหลดรูปภาพได้');
        return;
      }
    }

    const payload: Record<string, unknown> = {
      productName,
      description: description || null,
      imageUrl
    };

    try {
      const updatedProduct = await apiFetch<Product>(`/products/${productToEdit.productId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        token
      });
      setSuccessMessage('อัปเดตข้อมูลสินค้าเรียบร้อย');
      setEditModalOpen(false);
      setProductToEdit(null);
      setEditFormResetKey((prev) => prev + 1);
      setSelectedProduct((prev) => (prev && prev.productId === updatedProduct.productId ? updatedProduct : prev));
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถอัปเดตสินค้าได้');
    } finally {
      setIsUpdateSubmitting(false);
    }
  };

  const handleUpdateSellPrice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !priceEditProduct) return;

    const formData = new FormData(event.currentTarget);
    const sellPriceRaw = formData.get('sellPrice');
    const parsed = sellPriceRaw === null || sellPriceRaw === '' ? Number.NaN : Number(sellPriceRaw);

    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('ราคาขายต้องเป็นตัวเลขที่ไม่ติดลบ');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsPriceSubmitting(true);

    try {
      const payload = {
        productName: priceEditProduct.productName,
        description: priceEditProduct.description ?? null,
        imageUrl: priceEditProduct.imageUrl ?? null,
        sellPrice: parsed
      };

      const updatedProduct = await apiFetch<Product>(`/products/${priceEditProduct.productId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
        token
      });

      setSuccessMessage('อัปเดตราคาขายมาตรฐานเรียบร้อย');
      setPriceModalOpen(false);
      setPriceEditProduct(null);
      setSelectedProduct((prev) => (prev && prev.productId === updatedProduct.productId ? updatedProduct : prev));
      mutate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถอัปเดตราคาขายได้');
    } finally {
      setIsPriceSubmitting(false);
    }
  };

  const handleCreateProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;
    const form = event.currentTarget;
    setError(null);
    setSuccessMessage(null);
    const formData = new FormData(event.currentTarget);
    const productName = String(formData.get('productName') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const unit = String(formData.get('unit') ?? '').trim();
    const quantityRaw = String(formData.get('quantity') ?? '').trim();
    const quantityValue = quantityRaw ? Math.floor(Number(quantityRaw)) : 0;
    const costRaw = String(formData.get('initialCost') ?? '').trim();

    if (!Number.isFinite(quantityValue) || quantityValue < 0) {
      setError('จำนวนเริ่มต้นต้องไม่ติดลบ');
      return;
    }

    if (quantityValue > 1) {
      if (!costRaw) {
        setError('กรุณาระบุราคาทุนเริ่มต้นเมื่อมีจำนวนมากกว่า 1 หน่วย');
        return;
      }
      const costValue = Number(costRaw);
      if (!Number.isFinite(costValue) || costValue <= 0) {
        setError('ราคาทุนเริ่มต้นต้องมากกว่า 0');
        return;
      }
    }

    if (!staffId) {
      setError('ไม่พบรหัสพนักงานผู้บันทึกสินค้าใหม่');
      return;
    }

    if (!productName) {
      setError('กรุณากรอกชื่อสินค้า');
      return;
    }

    if (!selectedSupplierId) {
      setError('กรุณาเลือก Supplier');
      return;
    }

    const imageFile = formData.get('imageFile');
    setIsSubmitting(true);

    let uploadedImageUrl: string | undefined;
    if (imageFile instanceof File && imageFile.size > 0) {
      try {
        const uploadResult = await uploadProductImage(imageFile, token);
        uploadedImageUrl = uploadResult.url;
      } catch (uploadError) {
        setIsSubmitting(false);
        setError(uploadError instanceof Error ? uploadError.message : 'ไม่สามารถอัปโหลดรูปภาพได้');
        return;
      }
    }

    const initialCostValue = quantityValue > 1 ? Number(costRaw) : 0;

    const payload = {
      productName,
      description: description || undefined,
      unit: unit || undefined,
      supplierId: selectedSupplierId,
      costPrice: initialCostValue || 0,
      sellPrice: 0,
      quantity: quantityValue,
      imageUrl: uploadedImageUrl,
      createdByStaffId: staffId
    };

    try {
      await apiFetch<Product>('/products', {
        method: 'POST',
        body: JSON.stringify(payload),
        token
      });
      form.reset();
      setCreateModalOpen(false);
      setFormResetKey((prev) => prev + 1);
      setSelectedSupplierId('');
      setInitialQuantity(0);
      setInitialCostInput('');
      mutate();
      setSuccessMessage('เพิ่มสินค้าเรียบร้อย');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถสร้างสินค้าได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
      </header>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {successMessage && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{successMessage}</div>
      )}

      <div className="card space-y-6 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <input
            type="search"
            placeholder="ค้นหาด้วยชื่อหรือรหัสสินค้า"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="w-full md:w-72"
          />
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex w-full flex-wrap gap-2 md:justify-end">
              {canManage && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setSuccessMessage(null);
                    setSelectedSupplierId('');
                    setInitialQuantity(0);
                    setInitialCostInput('');
                    setCreateModalOpen(true);
                    setFormResetKey((prev) => prev + 1);
                  }}
                  className="w-full rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-500 md:w-auto"
                >
                  เพิ่มสินค้าใหม่
                </button>
              )}

            </div>
            <p className="text-xs text-slate-400">แสดง {filteredProducts.length} จาก {products?.length ?? 0} รายการ</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">รหัสสินค้า</th>
                <th className="px-4 py-3">ชื่อสินค้า</th>
                <th className="px-4 py-3">คงเหลือ</th>
                <th className="px-4 py-3">หน่วย</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">ราคาขายมาตรฐาน</th>
                <th className="px-4 py-3 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              )}
              {!isLoading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
                    ไม่พบสินค้า
                  </td>
                </tr>
              )}
              {filteredProducts.map((product) => (
                <tr key={product.productId} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{product.productId}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{product.productName}</p>
                    {product.description && <p className="text-xs text-slate-500">{product.description}</p>}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800">{product.quantity}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{product.unit || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{product.supplierId || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {product.sellPrice !== undefined && product.sellPrice !== null
                      ? Number(product.sellPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(product)}
                        className="rounded-lg border border-slate-200 px-3 py-1 font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        ดูรายละเอียด
                      </button>
                      {canEditSellPrice && (
                        <button
                          type="button"
                          onClick={() => handleOpenPriceEdit(product)}
                          className="rounded-lg border border-emerald-200 px-3 py-1 font-semibold text-emerald-600 transition hover:bg-emerald-50"
                        >
                          ปรับราคาขาย
                        </button>
                      )}
                      {canManage && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(product)}
                            className="rounded-lg border border-primary-200 px-3 py-1 font-semibold text-primary-600 transition hover:bg-primary-50"
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product)}
                            disabled={deletingProductId === product.productId}
                            className="rounded-lg border border-red-200 px-3 py-1 font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingProductId === product.productId ? 'กำลังปิดใช้งาน...' : 'ปิดใช้งาน'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {canManage && isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl">
              <div className="max-h-[85vh] overflow-y-auto p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">เพิ่มสินค้าใหม่</h2>
                  </div>
                  <button
                    type="button"
                  onClick={() => {
                    setCreateModalOpen(false);
                    setSelectedSupplierId('');
                    setInitialQuantity(0);
                    setInitialCostInput('');
                    setFormResetKey((prev) => prev + 1);
                  }}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    ปิด
                  </button>
                </div>
                <form key={formResetKey} onSubmit={handleCreateProduct} className="mt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-500">ชื่อสินค้า</label>
                      <input name="productName" required placeholder="เช่น สายไฟ 2x2.5" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-500">หน่วย</label>
                      <input name="unit" placeholder="ม้วน / ชิ้น / กล่อง" />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-500">จำนวนเริ่มต้น</label>
                      <input
                        name="quantity"
                        type="number"
                        min={0}
                        step={1}
                        value={initialQuantity}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          if (Number.isNaN(nextValue)) {
                            setInitialQuantity(0);
                            return;
                          }
                          setInitialQuantity(Math.max(0, Math.floor(nextValue)));
                        }}
                      />
                      <p className="text-xs text-slate-400">สามารถปล่อยเป็น 0 เพื่อเพิ่มสต็อกภายหลังได้</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-500">ราคาทุนเริ่มต้น (ต่อหน่วย)</label>
                      <input
                        name="initialCost"
                        type="number"
                        min={0}
                        step="0.01"
                        value={initialCostInput}
                        onChange={(event) => setInitialCostInput(event.target.value)}
                        disabled={!isInitialCostEnabled}
                        className="disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                      <p className="text-xs text-slate-400">จำเป็นเมื่อจำนวนมากกว่า 1 หน่วย</p>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-xs font-medium text-slate-500">คำอธิบาย</label>
                      <textarea name="description" rows={3} placeholder="ระบุรายละเอียดสินค้าเพิ่มเติม" />
                    </div>
                    <p className="md:col-span-2 text-xs text-slate-400">
                      หากจำนวนมากกว่า 1 หน่วย ระบบจะเปิดให้กรอกราคาทุนและบันทึกธุรกรรม Stock-in ให้โดยอัตโนมัติ
                    </p>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-500">Supplier</label>
                      <SearchableSelect
                        key={`supplier-${formResetKey}`} // ใช้ formKey เพื่อ reset ค่าตอนเปิด modal ใหม่
                        name="supplierId" // อาจไม่จำเป็นถ้าใช้ State แต่ใส่ไว้เผื่อ
                        value={selectedSupplierId}
                        onChange={setSelectedSupplierId} // อัปเดต State โดยตรง
                        // เพิ่ม option เริ่มต้น และรวมกับ supplierOptions
                        options={[{ value: '', label: 'เลือก Supplier' }, ...supplierOptions]}
                        placeholder="เลือก Supplier"
                        searchPlaceholder="ค้นหา Supplier..."
                        emptyMessage="ไม่พบ Supplier"
                        // ทำให้ disabled ถ้าไม่มีตัวเลือก (ไม่นับ option เริ่มต้น)
                        disabled={supplierOptions.length === 0}
                      />
                      {/* (Optional) แสดงข้อความถ้าไม่มี supplier */}
                      {supplierOptions.length === 0 && (
                        <p className="text-xs text-slate-500">ยังไม่มีข้อมูล Supplier โปรดเพิ่มในเมนู Suppliers</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-500">รูปสินค้า (อัปโหลด)</label>
                      <input name="imageFile" type="file" accept="image/*" className="block w-full" />
                      <p className="text-xs text-slate-400">ไม่เลือกก็ได้ ระบบจะอัปโหลดไปยัง Cloudinary ให้อัตโนมัติเมื่อบันทึกสินค้า</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateModalOpen(false);
                        setSelectedSupplierId('');
                        setInitialQuantity(0);
                        setInitialCostInput('');
                        setFormResetKey((prev) => prev + 1);
                      }}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกสินค้า'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {canManage && productToEdit && isEditModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
              <div className="max-h-[85vh] overflow-y-auto p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">แก้ไขสินค้า</h2>
                    <p className="text-sm text-slate-500">ปรับปรุงชื่อสินค้า คำอธิบาย หรือเพิ่มรูปสินค้าใหม่</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseEdit}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    ปิด
                  </button>
                </div>
                <form key={editFormResetKey} onSubmit={handleUpdateProduct} className="mt-6 space-y-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-500">ชื่อสินค้า</label>
                    <input name="productName" required defaultValue={productToEdit.productName} />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-500">คำอธิบาย</label>
                    <textarea name="description" rows={3} defaultValue={productToEdit.description ?? ''} placeholder="ระบุคำอธิบายสินค้า" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-500">รูปสินค้า (อัปโหลดใหม่)</label>
                    <input name="imageFile" type="file" accept="image/*" className="block w-full" />
                    <p className="text-xs text-slate-400">หากไม่เลือกรูปใหม่ ระบบจะใช้รูปเดิมโดยอัตโนมัติ</p>
                  </div>
                  {productToEdit.imageUrl && !isEditImageError && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-500">รูปปัจจุบัน</label>
                      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <img
                          src={productToEdit.imageUrl}
                          alt={productToEdit.productName}
                          className="h-48 w-full bg-white object-contain"
                          onError={() => setEditImageError(true)}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleCloseEdit}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdateSubmitting}
                      className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdateSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {canEditSellPrice && priceEditProduct && isPriceModalOpen && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/60">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
              <div className="max-h-[85vh] overflow-y-auto p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">ปรับราคาขายมาตรฐาน</h2>
                    <p className="text-sm text-slate-500">{priceEditProduct.productName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClosePriceEdit}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    ปิด
                  </button>
                </div>
                <form onSubmit={handleUpdateSellPrice} className="mt-6 space-y-6">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-500">ราคาขายมาตรฐานใหม่ (บาท)</label>
                    <input
                      name="sellPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={
                        priceEditProduct.sellPrice !== undefined && priceEditProduct.sellPrice !== null
                          ? Number(priceEditProduct.sellPrice)
                          : ''
                      }
                      required
                    />
                    <p className="text-xs text-slate-400">กรอกเฉพาะค่าที่ต้องการบันทึกใหม่</p>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleClosePriceEdit}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      disabled={isPriceSubmitting}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPriceSubmitting ? 'กำลังบันทึก...' : 'บันทึกการปรับราคา'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && isDetailModalOpen && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-900/60">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
              <div className="max-h-[85vh] overflow-y-auto p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">รายละเอียดสินค้า</h2>
                    <p className="text-sm text-slate-500">{selectedProduct.productName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCloseDetails}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    ปิด
                  </button>
                </div>

                <div className="mt-6 space-y-6">
                  {selectedProduct.imageUrl && !isDetailImageError && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.productName}
                        className="h-64 w-full bg-white object-contain"
                        onError={() => setDetailImageError(true)}
                      />
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">รหัสสินค้า</p>
                      <p className="font-mono text-sm text-slate-700">{selectedProduct.productId}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">Supplier</p>
                      <p className="text-sm text-slate-700">{selectedProduct.supplierId || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">คงเหลือ</p>
                      <p className="text-sm font-semibold text-slate-800">{selectedProduct.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">หน่วย</p>
                      <p className="text-sm text-slate-700">{selectedProduct.unit || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">ราคาทุนเฉลี่ย</p>
                      <p className="text-sm text-slate-700">
                        {selectedProduct.costPrice !== undefined && selectedProduct.costPrice !== null
                          ? Number(selectedProduct.costPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-400">ราคาขายมาตรฐาน</p>
                      <p className="text-sm text-slate-700">
                        {selectedProduct.sellPrice !== undefined && selectedProduct.sellPrice !== null
                          ? Number(selectedProduct.sellPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })
                          : '-'}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs font-semibold uppercase text-slate-400">คำอธิบาย</p>
                      <p className="whitespace-pre-line text-sm text-slate-700">
                        {selectedProduct.description || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm font-semibold text-slate-800">ข้อมูลล็อตสินค้า</p>
                      <div className="flex flex-col gap-1 text-xs text-slate-400 sm:text-right">
                        {isBatchesLoading && <span>กำลังโหลด...</span>}
                        {!isBatchesLoading && productBatches.length > 0 && (
                          <span>
                            ทั้งหมด {batchSummary.totalBatches.toLocaleString('th-TH')} ล็อต • รับเข้ารวม{' '}
                            {batchSummary.totalReceived.toLocaleString('th-TH')} • คงเหลือรวม{' '}
                            {batchSummary.totalRemaining.toLocaleString('th-TH')}
                          </span>
                        )}
                      </div>
                    </div>
                    {batchesError && (
                      <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{batchesError}</div>
                    )}
                    {!isBatchesLoading && !batchesError && productBatches.length === 0 && (
                      <p className="text-sm text-slate-500">ยังไม่มีข้อมูลล็อตสินค้า</p>
                    )}
                    {!isBatchesLoading && productBatches.length > 0 && (
                      <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-2">Batch ID</th>
                              <th className="px-4 py-2">รับเข้าเมื่อ</th>
                              <th className="px-4 py-2">จำนวนรับ</th>
                              <th className="px-4 py-2">คงเหลือ</th>
                              <th className="px-4 py-2">ราคาทุน/หน่วย</th>
                              <th className="px-4 py-2">PO อ้างอิง</th>
                              <th className="px-4 py-2">วันหมดอายุ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white text-[13px]">
                            {productBatches.map((batch) => (
                              <tr key={batch.batchId} className="hover:bg-slate-50/60">
                                <td className="px-4 py-2 font-mono text-[11px] text-slate-500">{batch.batchId}</td>
                                <td className="px-4 py-2 text-slate-600">
                                  {batch.receivedDate ? format(new Date(batch.receivedDate), 'dd MMM yyyy HH:mm') : '-'}
                                </td>
                                <td className="px-4 py-2 font-semibold text-slate-800">{batch.quantityIn}</td>
                                <td className="px-4 py-2 text-slate-700">{batch.quantityRemaining}</td>
                                <td className="px-4 py-2 text-slate-700">
                                  {batch.unitCost !== undefined && batch.unitCost !== null
                                    ? Number(batch.unitCost).toLocaleString(undefined, { minimumFractionDigits: 2 })
                                    : '-'}
                                </td>
                                <td className="px-4 py-2 text-slate-600">{batch.poId || '-'}</td>
                                <td className="px-4 py-2 text-slate-600">
                                  {batch.expiryDate ? format(new Date(batch.expiryDate), 'dd MMM yyyy') : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
