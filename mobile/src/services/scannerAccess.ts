import { apiGet, apiPatch, apiPost, getImageUrl } from './api';
import { getPublicEvents } from './events';

export type ScannerAccessStatus = 'pending' | 'approved' | 'rejected' | 'revoked';

export type ScannerAccessEvent = {
  id: string;
  title: string;
  eventDate?: string | null;
  status?: string | null;
  imageUrl?: string | null;
  bannerImageUrl?: string | null;
  venueName?: string | null;
};

export type ScannerAccessGrant = {
  id: string;
  status: ScannerAccessStatus;
  event: ScannerAccessEvent;
  user?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatarUrl?: string | null;
  };
  requestedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
};

function listFrom(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data || payload?.events || payload?.items || payload?.requests || [];
}

function normalizeEvent(event: any): ScannerAccessEvent {
  return {
    id: String(event.id),
    title: event.title || 'Evento',
    eventDate: event.eventDate,
    status: event.status,
    venueName: event.venueName || event.venue,
    imageUrl: getImageUrl(event.imageUrl || event.bannerImageUrl),
    bannerImageUrl: getImageUrl(event.bannerImageUrl || event.imageUrl),
  };
}

function normalizeGrant(item: any): ScannerAccessGrant {
  const event = item.event || item;
  const user = item.user
    ? {
        ...item.user,
        avatarUrl: getImageUrl(item.user.avatarUrl),
      }
    : undefined;

  return {
    id: String(item.id || `${event.id}-${item.status || 'approved'}`),
    status: (item.status || 'approved') as ScannerAccessStatus,
    event: normalizeEvent(event),
    user,
    requestedAt: item.requestedAt || item.createdAt,
    approvedAt: item.approvedAt,
    rejectedAt: item.rejectedAt,
  };
}

export async function getMyScannerAccess(): Promise<ScannerAccessGrant[]> {
  const data = await apiGet<any>('/scanner-access/me');
  return listFrom(data).map(normalizeGrant);
}

export async function searchScannerAccessEvents(query: string): Promise<ScannerAccessEvent[]> {
  const clean = query.trim();
  if (!clean) return [];

  try {
    const data = await apiGet<any>('/scanner-access/events/search', { q: clean });
    return listFrom(data).map(normalizeEvent);
  } catch {
    const events = await getPublicEvents();
    const lower = clean.toLowerCase();
    return events
      .filter((event) =>
        [event.title, event.venueName, event.venue, event.categoryName, event.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(lower)),
      )
      .slice(0, 12)
      .map((event) => ({
        id: event.id,
        title: event.title,
        eventDate: event.eventDate,
        status: 'published',
        venueName: event.venueName || event.venue,
        imageUrl: event.imageUrl,
        bannerImageUrl: event.bannerImageUrl,
      }));
  }
}

export async function requestScannerAccess(eventId: string): Promise<ScannerAccessGrant> {
  const data = await apiPost<any>('/scanner-access/requests', { eventId });
  return normalizeGrant(data);
}

export async function getOrganizerScannerAccessRequests(eventId?: string): Promise<ScannerAccessGrant[]> {
  const data = await apiGet<any>('/scanner-access/organizer/requests', eventId ? { eventId } : undefined);
  return listFrom(data).map(normalizeGrant);
}

export async function approveScannerAccessRequest(id: string): Promise<ScannerAccessGrant> {
  const data = await apiPatch<any>(`/scanner-access/requests/${id}/approve`, {});
  return normalizeGrant(data);
}

export async function rejectScannerAccessRequest(id: string): Promise<ScannerAccessGrant> {
  const data = await apiPatch<any>(`/scanner-access/requests/${id}/reject`, {});
  return normalizeGrant(data);
}

export async function revokeScannerAccessRequest(id: string): Promise<ScannerAccessGrant> {
  const data = await apiPatch<any>(`/scanner-access/requests/${id}/revoke`, {});
  return normalizeGrant(data);
}
