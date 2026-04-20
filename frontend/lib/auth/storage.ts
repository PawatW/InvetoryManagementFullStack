const STORAGE_KEY = 'inventory-auth-token';
const SESSION_COOKIE = 'inventory-auth-session';

export function saveToken(token: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, token);
  // Lightweight session cookie — used by Next.js middleware for edge routing.
  // The real security gate is the backend JWT filter.
  document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax`;
}

export function loadToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
  document.cookie = `${SESSION_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
