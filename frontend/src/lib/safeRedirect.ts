/** Login destinations must remain local, including after URL normalization. */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value?.startsWith('/') || /[\\\u0000-\u0020\u007f]/.test(value)) return '/';
  try {
    const base = 'https://lpticket.invalid';
    const url = new URL(value, base);
    const decodedPath = decodeURIComponent(url.pathname);
    if (url.origin !== base || decodedPath.startsWith('//') || decodedPath.includes('\\')) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
