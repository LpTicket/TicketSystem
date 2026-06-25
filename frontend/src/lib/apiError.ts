// Centralized helper to turn an axios/API error into a user-friendly message.
// Special-cases HTTP 429 (rate limited) so users see how long to wait instead
// of a generic failure.

type Lang = 'es' | 'en';

function formatWait(seconds: number, lang: Lang): string {
  if (!seconds || seconds < 1) seconds = 1;
  if (seconds < 60) {
    return lang === 'es'
      ? `${seconds} segundo${seconds === 1 ? '' : 's'}`
      : `${seconds} second${seconds === 1 ? '' : 's'}`;
  }
  const mins = Math.ceil(seconds / 60);
  return lang === 'es'
    ? `${mins} minuto${mins === 1 ? '' : 's'}`
    : `${mins} minute${mins === 1 ? '' : 's'}`;
}

/**
 * Reads the Retry-After header (seconds) when present, otherwise falls back to
 * a sensible default for throttled auth endpoints.
 */
function retryAfterSeconds(error: any): number {
  const header =
    error?.response?.headers?.['retry-after'] ??
    error?.response?.headers?.['Retry-After'];
  const parsed = Number(header);
  if (Number.isFinite(parsed) && parsed > 0) return Math.ceil(parsed);
  return 60; // throttler windows in this app are 1 minute
}

/**
 * Returns a friendly, localized error message for any API error.
 * @param fallback message to show when the error has no usable message
 */
export function getApiErrorMessage(error: any, lang: Lang = 'es', fallback?: string): string {
  const status = error?.response?.status;

  if (status === 429) {
    const wait = formatWait(retryAfterSeconds(error), lang);
    return lang === 'es'
      ? `Demasiados intentos. Vuelve a intentarlo en ${wait}.`
      : `Too many attempts. Please try again in ${wait}.`;
  }

  // Server-provided message (NestJS exception payload).
  const serverMsg = error?.response?.data?.message;
  if (serverMsg) {
    return Array.isArray(serverMsg) ? serverMsg.join(' ') : String(serverMsg);
  }

  if (status >= 500) {
    return lang === 'es'
      ? 'Ocurrió un error en el servidor. Inténtalo de nuevo más tarde.'
      : 'A server error occurred. Please try again later.';
  }

  if (error?.code === 'ERR_NETWORK' || error?.message === 'Network Error') {
    return lang === 'es'
      ? 'Sin conexión. Revisa tu internet e inténtalo de nuevo.'
      : 'No connection. Check your internet and try again.';
  }

  return fallback || (lang === 'es' ? 'Algo salió mal. Inténtalo de nuevo.' : 'Something went wrong. Please try again.');
}
