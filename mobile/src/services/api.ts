import AsyncStorage from '@react-native-async-storage/async-storage';

// Defaults to the production Railway backend so the app works out of the box.
// Override with EXPO_PUBLIC_API_URL (e.g. http://192.168.x.x:3001/api for local dev).
const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://ticketsystembackend.up.railway.app/api').replace(/\/$/, '');
const TOKENS_KEY = 'lp_auth_tokens';

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
  avatarUrl?: string | null;
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

async function ensureAuthTokens() {
  if (accessToken) return;
  try {
    const tokensRaw = await AsyncStorage.getItem(TOKENS_KEY);
    if (!tokensRaw) return;
    const tokens = JSON.parse(tokensRaw);
    accessToken = tokens?.accessToken || '';
    refreshToken = tokens?.refreshToken || '';
  } catch {
    /* ignore */
  }
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
  await ensureAuthTokens();
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
  await ensureAuthTokens();
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

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  await ensureAuthTokens();
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

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  await ensureAuthTokens();
  const response = await fetch(`${API_URL}${cleanPath}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export type PickedImage = { uri: string; fileName?: string | null; mimeType?: string | null };

// Multipart upload of a locally-picked image. Works on web (blob fetch) and
// native (uri/name/type triplet). Does NOT set Content-Type so the runtime adds
// the correct multipart boundary.
export async function apiUploadImage<T>(path: string, image: PickedImage, field = 'image'): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const name = image.fileName || `upload-${Date.now()}.jpg`;
  const type = image.mimeType || 'image/jpeg';
  const form = new FormData();

  if (typeof window !== 'undefined' && image.uri.startsWith('blob:')) {
    // Web: the picker hands back a blob: URL — materialize it into a Blob.
    const blob = await (await fetch(image.uri)).blob();
    form.append(field, blob, name);
  } else {
    // Native: React Native FormData accepts the file descriptor object.
    form.append(field, { uri: image.uri, name, type } as any);
  }

  await ensureAuthTokens();
  const response = await fetch(`${API_URL}${cleanPath}`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;
    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {}
    throw new Error(message);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  await ensureAuthTokens();
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
