'use client';

import { FormEvent, useState } from 'react';
import { useAuth } from '../components/AuthContext';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-slate-900 lg:flex">
        <div className="absolute inset-0 bg-[url('/images/images.jpg')] bg-cover bg-center opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary-900/80 via-slate-900/70 to-slate-900/90" />

        {/* Decorative grid */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }}
        />

        <div className="relative z-10 flex flex-1 flex-col justify-center p-16">
          <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-primary-300">AstarService</span>
          </div>
          <h1 className="max-w-sm text-4xl font-bold leading-tight tracking-tight text-white">
            Inventory Management System
          </h1>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
            ระบบบริหารจัดการคลังสินค้าและการจัดซื้อจัดจ้าง สำหรับองค์กร
          </p>

          <div className="mt-12 grid grid-cols-3 gap-6 border-t border-slate-800/60 pt-8">
            {[
              { label: 'จัดการสินค้า', desc: 'ติดตามสต็อกแบบ real-time' },
              { label: 'คำสั่งซื้อ', desc: 'สร้างและจัดการ orders' },
              { label: 'รายงาน', desc: 'Export ข้อมูลได้ทันที' },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-xs font-semibold text-slate-300">{item.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 py-12 sm:px-10 lg:w-[460px] lg:flex-none">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-xs font-bold text-white">AS</div>
            <span className="text-sm font-semibold text-slate-800">Smart Inventory</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">เข้าสู่ระบบ</h2>
            <p className="mt-1 text-sm text-slate-500">กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งาน</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                อีเมล
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="name@company.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                รหัสผ่าน
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="alert-error">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition hover:bg-primary-700 disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  กำลังเข้าสู่ระบบ...
                </span>
              ) : 'เข้าสู่ระบบ'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} AstarService — Inventory Management System
          </p>
        </div>
      </div>
    </div>
  );
}
