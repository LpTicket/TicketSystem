// Defaults to the production Railway backend so the app works out of the box.
// Override with EXPO_PUBLIC_API_URL (e.g. http://192.168.x.x:3001/api for local dev).
const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://ticketsystembackend.up.railway.app/api').replace(/\/$/, '');

let accessToken = '';
let refreshToken = '';

export { API_URL };

export type AuthUser = {
  id: string;
  email: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  role?: 'client' | 'admin' | string;
  isActive?: boolean;
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export function setAuthTokens(nextAccessToken?: string, nextRefreshToken?: string) {
  accessToken = nextAccessToken || '';
  refreshToken = nextRefreshToken || '';
}

export function clearAuthTokens() {
  accessToken = '';
  refreshToken = '';
}

export function getAccessToken() {
  return accessToken;
}

function authHeaders(extra?: Record<string, string>) {
  return {
    Accept: 'application/json',
    ...(extra || {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

export function getImageUrl(url: string | null | undefined): string {
  if (!url) return '';

  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }

  const base = API_URL.replace(/\/api\/?$/, '');
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${base}${cleanUrl}`;
}

export async function apiGet<T>(path: string): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${API_URL}${cleanPath}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${API_URL}${cleanPath}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {}
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${API_URL}${cleanPath}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${API_URL}${cleanPath}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
