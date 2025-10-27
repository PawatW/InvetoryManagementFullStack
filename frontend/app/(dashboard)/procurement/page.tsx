'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAuth } from '../../../components/AuthContext';
import { useAuthedSWR } from '../../../lib/swr';
import type { PurchaseOrder } from '../../../lib/types';

const STATUS_LABELS: Record<string, string> = {
  'New order': 'New order',
  Pending: 'Pending pricing',
  Received: 'Received',
  Rejected: 'Rejected'
};

export default function ProcurementOverviewPage() {
  const { role, token } = useAuth();
  const { data: orders } = useAuthedSWR<PurchaseOrder[]>(role ? '/purchase-orders' : null, token, {
    refreshInterval: 30000
  });

  if (role !== 'PROCUREMENT' && role !== 'ADMIN') {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-700">
        เฉพาะผู้ใช้ฝ่ายจัดซื้อ (Procurement) หรือผู้ดูแลระบบเท่านั้นที่สามารถเข้าถึงหน้านี้ได้
      </div>
    );
  }

  const summaries = useMemo(() => {
    const counts: Record<string, number> = {};
    (orders ?? []).forEach((order) => {
      const key = order.status || 'Unknown';
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts).map(([status, total]) => ({
      status,
      total,
      label: STATUS_LABELS[status] ?? status
    }));
  }, [orders]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Procurement Overview</h1>
        <p className="text-sm text-slate-500">สรุปสถานะใบสั่งซื้อและการรับสินค้าเข้าคลัง</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaries.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            ยังไม่มีข้อมูลใบสั่งซื้อในระบบ
          </div>
        )}
        {summaries.map((summary) => (
          <div key={summary.status} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-400">{summary.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{summary.total}</p>
            <p className="mt-1 text-xs text-slate-500">รายการ</p>
          </div>
        ))}
      </section>

      <section className="card space-y-4 p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">จัดการใบสั่งซื้อ</h2>
            <p className="text-sm text-slate-500">ตรวจสอบใบสั่งซื้อใหม่ กรอกราคาทุน และยืนยันการรับสินค้า</p>
          </div>
          <Link
            href="/procurement/purchase-orders"
            className="w-full rounded-xl bg-primary-600 px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-primary-500 md:w-auto"
          >
            ไปที่ Purchase Orders
          </Link>
        </div>
      </section>
    </div>
  );
}
