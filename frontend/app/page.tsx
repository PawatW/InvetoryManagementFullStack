'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthContext';

export default function LoginPage() {
  const { login, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect after React commits the auth state — avoids race condition where
  // router.push inside login() navigates before setToken is committed.
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [loading, isAuthenticated, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-stretch bg-gradient-to-br from-primary-900 via-slate-900 to-slate-800">
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden lg:flex">
        <div className="absolute inset-0 bg-[url('/images/images.jpg')] bg-cover bg-center opacity-25" />
        <div className="relative z-10 max-w-lg space-y-6 rounded-3xl bg-black/40 p-12 text-white backdrop-blur">
          <div className="inline-flex rounded-2xl bg-primary-500/20 px-4 py-2 text-xs uppercase tracking-[0.3em]">AstarService</div>
          <h1 className="text-4xl font-semibold leading-tight">Inventory management system</h1>
        </div>
      </div>
      <div className="flex w-full items-center justify-center bg-white px-6 py-12 sm:px-12 lg:w-[480px]">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h2 className="text-3xl font-semibold text-slate-900">เข้าสู่ระบบ</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-slate-600">
                อีเมล
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                placeholder="name@company.com"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-slate-600">
                รหัสผ่าน
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
              />
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-primary-600 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/30 transition hover:bg-primary-500 disabled:opacity-60"
            >
              {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
