const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

export async function apiGet<T>(path: string): Promise<T> {
  if (!API_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_URL');
  }

  const response = await fetch(`${API_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
