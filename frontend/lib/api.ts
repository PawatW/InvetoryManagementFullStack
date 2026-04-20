import { API_BASE_URL } from './config';
import { clearToken } from './auth/storage';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function buildApiError(response: Response): Promise<ApiError> {
  const rawMessage = await response.text().catch(() => '');
  let message = rawMessage || 'Request failed';
  if (rawMessage) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (typeof parsed === 'string') {
        message = parsed;
      } else if (parsed?.message && typeof parsed.message === 'string') {
        message = parsed.message;
      }
    } catch {
      message = rawMessage;
    }
  }
  return new ApiError(message, response.status);
}

function handleUnauthorized(): void {
  clearToken();
  if (typeof window !== 'undefined') {
    window.location.href = '/';
  }
}

export async function apiFetch<T>(
  path: string,
  { token, ...init }: RequestInit & { token?: string } = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (response.status === 401) {
    handleUnauthorized();
    throw await buildApiError(response);
  }

  if (!response.ok) {
    throw await buildApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export async function uploadProductImage(file: File, token: string): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/products/upload-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });

  if (response.status === 401) {
    handleUnauthorized();
  }

  if (!response.ok) throw await buildApiError(response);
  return response.json() as Promise<{ url: string }>;
}

export async function uploadPurchaseOrderSlip(file: File, token: string): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/purchase-orders/upload-slip`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData
  });

  if (response.status === 401) {
    handleUnauthorized();
  }

  if (!response.ok) throw await buildApiError(response);
  return response.json() as Promise<{ url: string }>;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}
