'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { ROLE_LABELS } from '../lib/config';
import { useAuth } from './AuthContext';

interface NavItem {
  href: string;
  label: string;
  roles?: string[];
  labelByRole?: Partial<Record<string, string>>;
  icon: React.ReactNode;
}

const IconDashboard = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const IconBox = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const IconClipboard = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const IconRequest = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const IconArrows = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
  </svg>
);

const IconUsers = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const IconTruck = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l1 1h1m8-1h4l1-1 1-4H8m5 5H9m4 0h1" />
  </svg>
);

const IconCart = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const IconChart = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const IconUserGroup = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: <IconDashboard /> },
  {
    href: '/inventory',
    label: 'Inventory',
    roles: ['WAREHOUSE', 'ADMIN', 'SALES', 'PROCUREMENT'],
    labelByRole: { SALES: 'Products' },
    icon: <IconBox />
  },
  { href: '/orders', label: 'Orders', roles: ['SALES', 'TECHNICIAN', 'ADMIN'], icon: <IconClipboard /> },
  { href: '/requests', label: 'Requests', roles: ['TECHNICIAN', 'FOREMAN', 'WAREHOUSE', 'ADMIN'], icon: <IconRequest /> },
  { href: '/stock', label: 'Stock Ops', roles: ['WAREHOUSE', 'ADMIN'], icon: <IconArrows /> },
  { href: '/customers', label: 'Customers', roles: ['SALES', 'TECHNICIAN', 'ADMIN'], icon: <IconUsers /> },
  { href: '/suppliers', label: 'Suppliers', roles: ['WAREHOUSE', 'SALES', 'PROCUREMENT', 'ADMIN'], icon: <IconTruck /> },
  { href: '/purchase-orders', label: 'Purchase Orders', roles: ['WAREHOUSE', 'PROCUREMENT', 'ADMIN'], icon: <IconCart /> },
  { href: '/admin/report-export', label: 'Report Export', roles: ['ADMIN'], icon: <IconChart /> },
  { href: '/admin/staff', label: 'Staff', roles: ['ADMIN'], icon: <IconUserGroup /> }
];

const ROLE_BADGE_MAP: Record<string, string> = {
  ADMIN: 'badge badge-purple',
  WAREHOUSE: 'badge badge-blue',
  SALES: 'badge badge-green',
  TECHNICIAN: 'badge badge-amber',
  FOREMAN: 'badge badge-slate',
  PROCUREMENT: 'badge badge-slate',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, staffId, logout } = useAuth();

  const items = NAV_ITEMS.filter((item) => !item.roles || (role ? item.roles.includes(role) || role === 'ADMIN' : false));

  const roleInitials = role ? role.slice(0, 2).toUpperCase() : 'US';

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col bg-slate-900 lg:flex" style={{ minHeight: '100vh' }}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-800/80 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-xs font-bold text-white tracking-wide shadow-lg shadow-primary-500/30">
            AS
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-tight">Smart Inventory</p>
            <p className="text-[11px] text-slate-500 leading-tight">AstarService</p>
          </div>
        </div>

        {/* Nav label */}
        <div className="px-5 pt-6 pb-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Navigation</p>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-0.5 px-3 pb-4">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const displayLabel = (role && item.labelByRole?.[role]) || item.label;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all',
                  active
                    ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                )}
              >
                <span className={clsx('flex-shrink-0', active ? 'text-white' : 'text-slate-500')}>
                  {item.icon}
                </span>
                <span className="font-medium">{displayLabel}</span>
              </Link>
            );
          })}
        </nav>

        {/* User section at bottom */}
        <div className="border-t border-slate-800/80 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-slate-300">
              {roleInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-slate-300">{role ? ROLE_LABELS[role] || role : 'User'}</p>
              <p className="truncate text-[11px] text-slate-500">ID: {staffId ?? '-'}</p>
            </div>
            <button
              onClick={logout}
              className="flex-shrink-0 rounded-md bg-transparent px-2 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition shadow-none"
              title="Logout"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top header */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-6 backdrop-blur-sm shadow-sm">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-tight">
                {role ? ROLE_LABELS[role] || role : 'Smart Inventory'}
              </p>
              <p className="text-[11px] text-slate-500 leading-tight">Staff ID: {staffId ?? '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {role && (
              <span className={ROLE_BADGE_MAP[role] ?? 'badge badge-slate'}>
                {ROLE_LABELS[role] || role}
              </span>
            )}
            <div className="h-4 w-px bg-slate-200" />
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-none transition hover:bg-slate-50 hover:text-slate-800"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              ออกจากระบบ
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
