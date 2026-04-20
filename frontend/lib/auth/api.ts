import { API_BASE_URL } from '../config';
import { ApiError } from '../api';
import type { AuthResponse, LoginCredentials } from './types';

async function parseError(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => '');
  let message = text || 'Request failed';
  try {
    const parsed = JSON.parse(text);
    if (parsed?.message) message = parsed.message;
  } catch {}
  return new ApiError(message, response.status);
}

export async function loginApi(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<AuthResponse>;
}

export async function getMeApi(token: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw await parseError(response);
  return response.json() as Promise<AuthResponse>;
}
