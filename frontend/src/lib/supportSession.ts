import type { User } from '@/types';

const KEY = 'lpticketSupportSession';

export interface SupportSession {
  accessToken: string;
  user: User;
}

export function getSupportSession(): SupportSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(KEY);
    if (!value) return null;
    const session = JSON.parse(value) as SupportSession;
    return typeof session.accessToken === 'string' && session.user?.id ? session : null;
  } catch {
    return null;
  }
}

export function saveSupportSession(session: SupportSession) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSupportSession() {
  if (typeof window !== 'undefined') sessionStorage.removeItem(KEY);
}
