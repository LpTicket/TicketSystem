/**
 * api (mobile HTTP layer)
 * EN: Thin fetch wrapper for the mobile app. Injects the bearer token, refreshes
 *     it on a 401 and retries, applies timeouts and GET retries, and throws
 *     `ApiError` (carrying HTTP status + Retry-After) so callers can show
 *     friendly messages (see `getApiErrorMessage`). Tokens live in AsyncStorage.
 * ES: Envoltura ligera de fetch para la app móvil. Inyecta el token bearer, lo
 *     refresca ante un 401 y reintenta, aplica timeouts y reintentos en GET, y
 *     lanza `ApiError` (con el status HTTP + Retry-After) para que quien llama
 *     muestre mensajes amigables (ver `getApiErrorMessage`). Los tokens viven en
 *     AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// Defaults to the production Railway backend so the app works out of the box.
// Override with EXPO_PUBLIC_API_URL (e.g. http://192.168.x.x:3001/api for local dev).
const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://ticketsystembackend.up.railway.app/api').replace(/\/$/, '');
const TOKENS_KEY = 'lp_auth_tokens';
const REQUEST_TIMEOUT_MS = 15000;
const GET_RETRY_DELAYS_MS = [600, 1400];

let accessToken = '';
let refreshToken = '';

export { API_URL };

// Error carrying the HTTP status so callers can react to 429 (rate limited),
// 401, etc. instead of only seeing a generic message string.
export class ApiError extends Error {
  status: number;
  retryAfter?: number; // seconds, when the server sends Retry-After
  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function buildApiError(response: Response, serverMessage?: string): ApiError {
  const retryHeader = response.headers.get('retry-after') || response.headers.get('Retry-After');
  const retryAfter = retryHeader && Number(retryHeader) > 0 ? Math.ceil(Number(retryHeader)) : undefined;
  return new ApiError(serverMessage || `API request failed: ${response.status}`, response.status, retryAfter);
}

function formatWait(seconds: number, es: boolean): string {
  if (!seconds || seconds < 1) seconds = 1;
  if (seconds < 60) return es ? `${seconds} segundo${seconds === 1 ? '' : 's'}` : `${seconds} second${seconds === 1 ? '' : 's'}`;
  const mins = Math.ceil(seconds / 60);
  return es ? `${mins} minuto${mins === 1 ? '' : 's'}` : `${mins} minute${mins === 1 ? '' : 's'}`;
}

/**
 * Turns any thrown error into a friendly, localized message.
 * Special-cases 429 so the user is told how long to wait.
 */
export function getApiErrorMessage(error: any, lang: 'es' | 'en' = 'es', fallback?: string): string {
  const es = lang === 'es';
  if (error instanceof ApiError) {
    if (error.status === 429) {
      const wait = formatWait(error.retryAfter ?? 60, es);
      return es ? `Demasiados intentos. Vuelve a intentarlo en ${wait}.` : `Too many attempts. Please try again in ${wait}.`;
    }
    if (error.status >= 500) {
      return es ? 'Ocurrió un error en el servidor. Inténtalo más tarde.' : 'A server error occurred. Please try again later.';
    }
    if (error.message && !error.message.startsWith('API request failed')) return error.message;
  }
  if (error?.message === 'Network request failed' || error?.name === 'AbortError') {
    return es ? 'Sin conexión. Revisa tu internet e inténtalo de nuevo.' : 'No connection. Check your internet and try again.';
  }
  return fallback || (es ? 'Algo salió mal. Inténtalo de nuevo.' : 'Something went wrong. Please try again.');
}

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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function persistTokens(tokens: { accessToken: string; refreshToken: string }) {
  accessToken = tokens.accessToken || '';
  refreshToken = tokens.refreshToken || '';
  try {
    await AsyncStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    /* ignore */
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function refreshAuthTokens() {
  await ensureAuthTokens();
  if (!refreshToken) return false;
  try {
    const response = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    if (!data?.accessToken || !data?.refreshToken) return false;
    await persistTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return true;
  } catch {
    return false;
  }
}

async function requestWithAuth(url: string, options: RequestInit = {}, retryAuth = true) {
  await ensureAuthTokens();
  // Rebuild headers after ensureAuthTokens so the token is always injected.
  const headersWithAuth = authHeaders(
    Object.fromEntries(
      Object.entries((options.headers as Record<string, string>) || {}).filter(
        ([k]) => k.toLowerCase() !== 'authorization',
      ),
    ),
  );
  let response = await fetchWithTimeout(url, { ...options, headers: headersWithAuth });
  if (response.status === 401 && retryAuth) {
    const refreshed = await refreshAuthTokens();
    if (refreshed) {
      response = await fetchWithTimeout(url, {
        ...options,
        headers: authHeaders(
          Object.fromEntries(
            Object.entries((options.headers as Record<string, string>) || {}).filter(
              ([k]) => k.toLowerCase() !== 'authorization',
            ),
          ),
        ),
      });
    }
  }
  return response;
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
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

export async function apiGet<T>(path: string, params?: Record<string, any>): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  let url = `${API_URL}${cleanPath}`;
  if (params) {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) url += `?${qs}`;
  }
  let response: Response | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt <= GET_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      response = await requestWithAuth(url, { headers: authHeaders() });
      if (response.ok || (response.status >= 400 && response.status < 500)) break;
    } catch (err) {
      lastError = err;
    }
    const delay = GET_RETRY_DELAYS_MS[attempt];
    if (delay) await wait(delay);
  }

  if (!response) {
    throw lastError instanceof Error ? lastError : new Error('API request failed');
  }

  if (!response.ok) {
    throw buildApiError(response);
  }

  return readJsonResponse<T>(response);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const response = await requestWithAuth(`${API_URL}${cleanPath}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body === undefined ? {} : body),
  });

  if (!response.ok) {
    let message: string | undefined;
    try {
      const data = await response.json();
      message = data?.message;
    } catch {}
    throw buildApiError(response, Array.isArray(message) ? message.join(' ') : message);
  }

  return readJsonResponse<T>(response);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const response = await requestWithAuth(`${API_URL}${cleanPath}`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw buildApiError(response);
  }

  return readJsonResponse<T>(response);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const response = await requestWithAuth(`${API_URL}${cleanPath}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw buildApiError(response);
  }

  return readJsonResponse<T>(response);
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
    const blob = await (await fetchWithTimeout(image.uri)).blob();
    form.append(field, blob, name);
  } else {
    // Native: React Native FormData accepts the file descriptor object.
    form.append(field, { uri: image.uri, name, type } as any);
  }

  const response = await requestWithAuth(`${API_URL}${cleanPath}`, {
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

  return readJsonResponse<T>(response);
}

export async function apiDelete<T = void>(path: string): Promise<T> {
  if (!API_URL) throw new Error('Missing EXPO_PUBLIC_API_URL');

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const response = await requestWithAuth(`${API_URL}${cleanPath}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw buildApiError(response);
  }

  return readJsonResponse<T>(response);
}
