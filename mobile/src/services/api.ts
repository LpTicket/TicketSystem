const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

export { API_URL };

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
  if (!API_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_URL');
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${API_URL}${cleanPath}`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
