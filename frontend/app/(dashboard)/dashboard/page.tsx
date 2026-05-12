'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '../../../components/AuthContext';
import { useAuthedSWR } from '../../../lib/swr';
import type { Product, Order, Request, StockTransaction } from '../../../lib/types';

const IconBox = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const IconClipboard = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const IconRequest = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconArrows = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);

const IconChevronRight = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

const IconActivity = () => (
  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'purple';
}

const colorMap = {
  blue: { bg: 'bg-primary-50', text: 'text-primary-600', border: 'border-primary-100' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
};

function StatCard({ label, value, icon, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${c.bg} ${c.text} border ${c.border}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { role, token } = useAuth();
  const isRole = (...roles: string[]) => !!role && (roles.includes(role) || role === 'ADMIN');

  const { data: products } = useAuthedSWR<Product[]>('/products', token, { revalidateOnFocus: false });
  const { data: confirmedOrders } = useAuthedSWR<Order[]>(isRole('TECHNICIAN', 'ADMIN', 'SALES') ? '/orders/confirmed' : null, token, {
    revalidateOnFocus: false
  });
  const { data: pendingRequests } = useAuthedSWR<Request[]>(isRole('FOREMAN', 'ADMIN') ? '/requests/pending' : null, token, {
    refreshInterval: 20000
  });
  const { data: approvedRequests } = useAuthedSWR<Request[]>(isRole('WAREHOUSE', 'ADMIN') ? '/stock/approved-requests' : null, token, {
    refreshInterval: 20000
  });
  const { data: stockTransactions } = useAuthedSWR<StockTransaction[]>(isRole('ADMIN') ? '/stock/transactions' : null, token, {
    revalidateOnFocus: false
  });

  const tasks = [
    {
      title: 'บันทึกสินค้าเข้า',
      description: 'บันทึก Stock-In พร้อม Supplier reference และโน้ตประกอบ',
      href: '/stock',
      roles: ['WAREHOUSE']
    },
    {
      title: 'ดำเนินการเบิกสินค้า',
      description: 'Warehouse ค้นหา Request ที่อนุมัติแล้วและตัดสต็อกจากคลัง',
      href: '/requests',
      roles: ['WAREHOUSE']
    },
    {
      title: 'สร้างคำขอเบิก',
      description: 'Technician สร้าง Request พร้อมรายการสินค้าตาม Order ที่ได้รับการยืนยัน',
      href: '/requests',
      roles: ['TECHNICIAN']
    },
    {
      title: 'อนุมัติคำขอเบิก',
      description: 'Foreman ตรวจสอบและอนุมัติหรือปฏิเสธคำขอที่รออยู่',
      href: '/requests',
      roles: ['FOREMAN']
    },
    {
      title: 'ปิดคำสั่งซื้อ',
      description: 'Sales ตรวจสอบ Order ที่พร้อมปิดและอัปเดตสถานะ',
      href: '/orders',
      roles: ['SALES']
    },
    {
      title: 'จัดการพนักงาน',
      description: 'Admin เพิ่มพนักงานใหม่และกำหนดบทบาทในระบบ',
      href: '/admin/staff',
      roles: ['ADMIN']
    }
  ].filter((task) => isRole(...task.roles));

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">ภาพรวมระบบจัดการสินค้า</p>
        </div>
      </div>

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="สินค้าทั้งหมด"
          value={products?.length ?? 0}
          icon={<IconBox />}
          color="blue"
        />
        {isRole('TECHNICIAN', 'ADMIN', 'SALES') && (
          <StatCard
            label="Order ที่ยืนยันแล้ว"
            value={confirmedOrders?.length ?? 0}
            icon={<IconClipboard />}
            color="green"
          />
        )}
        {isRole('FOREMAN', 'ADMIN') && (
          <StatCard
            label="คำขอรออนุมัติ"
            value={pendingRequests?.length ?? 0}
            icon={<IconRequest />}
            color="amber"
          />
        )}
        {isRole('WAREHOUSE', 'ADMIN') && (
          <StatCard
            label="คำขอรอจัดสินค้า"
            value={approvedRequests?.length ?? 0}
            icon={<IconRequest />}
            color="amber"
          />
        )}
        {isRole('ADMIN') && (
          <StatCard
            label="ธุรกรรมสต็อก"
            value={stockTransactions?.length ?? 0}
            icon={<IconArrows />}
            color="purple"
          />
        )}
      </section>

      {/* Quick actions */}
      {tasks.length > 0 && (
        <section className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">งานที่ต้องดำเนินการ</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {tasks.map((task) => (
              <Link
                key={task.href}
                href={task.href}
                className="group flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-3.5 transition hover:border-primary-200 hover:bg-primary-50/40"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-700 group-hover:text-primary-700">{task.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{task.description}</p>
                </div>
                <span className="ml-4 flex-shrink-0 text-slate-400 transition group-hover:text-primary-500 group-hover:translate-x-0.5">
                  <IconChevronRight />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent stock activity */}
      {isRole('ADMIN') && stockTransactions && stockTransactions.length > 0 && (
        <section className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <IconActivity />
            <h2 className="section-title">ความเคลื่อนไหวสต็อกล่าสุด</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {stockTransactions.slice(0, 5).map((transaction) => (
              <div key={transaction.transactionId} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold
                    ${transaction.type === 'IN'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-red-50 text-red-500'
                    }`}
                  >
                    {transaction.type === 'IN' ? '+' : '−'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {transaction.type === 'IN' ? 'สินค้าเข้า' : 'สินค้าออก'}
                    </p>
                    <p className="text-xs text-slate-500">{transaction.description}</p>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <p className="font-medium text-slate-600">Product: {transaction.productId}</p>
                  <p>{format(new Date(transaction.transactionDate), 'dd MMM yyyy HH:mm')}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
