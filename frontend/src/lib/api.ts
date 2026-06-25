/**
 * api (axios instance)
 * EN: Single configured axios client for the web app. Attaches the bearer token
 *     from localStorage on every request and, on a 401, clears the session and
 *     redirects to /login (unless already on an auth page). `getImageUrl`
 *     resolves relative image paths against the API host.
 * ES: Cliente axios único y configurado para la web. Adjunta el token bearer
 *     desde localStorage en cada petición y, ante un 401, limpia la sesión y
 *     redirige a /login (salvo que ya estés en una página de auth). `getImageUrl`
 *     resuelve rutas de imagen relativas contra el host de la API.
 */
import axios from 'axios';

// API_URL is always a string — never undefined
export const API_URL: string =
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      // Don't redirect if already on auth pages
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export function getImageUrl(url: string | null | undefined, cacheKey?: string | number | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    if (!cacheKey || url.startsWith('data:')) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${encodeURIComponent(String(cacheKey))}`;
  }
  
  // Extract base server url (strip /api if present)
  let base = API_URL.replace(/\/api\/?$/, '');
  
  // Ensure we don't double slash
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  const imageUrl = `${base}${cleanUrl}`;
  if (!cacheKey) return imageUrl;
  const separator = imageUrl.includes('?') ? '&' : '?';
  return `${imageUrl}${separator}v=${encodeURIComponent(String(cacheKey))}`;
}

export default api;
