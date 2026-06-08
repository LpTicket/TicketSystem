import { MobileEvent } from '../types/event';
import { apiGet, getImageUrl } from './api';

type ApiEvent = {
  id: string;
  title: string;
  slug?: string;
  eventDate?: string;
  eventTimezone?: string;
  venueName?: string;
  venueAddress?: string;
  price?: number;
  minPrice?: number;
  currency?: string;
  category?: string;
  categoryName?: string;
  imageUrl?: string;
  bannerImageUrl?: string;
  mobileImageData?: string;
  imageData?: string;
  tag?: string;
  ageRestriction?: string;
  description?: string;
  isFeatured?: boolean;
};

function formatEventDate(value?: string) {
  if (!value) return 'Date coming soon';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
  })} at ${date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function pickImage(...values: Array<string | undefined>) {
  return values.find(Boolean) || '';
}

export type MobileSection = {
  id: string;
  name: string;
  type: string;
  price: number;
  available: number;
  capacity: number;
};

/** Raw seat map (sections + seats + layout) for the interactive venue map. */
export async function getEventSeatMap(eventId: string): Promise<any[]> {
  const data = await apiGet<any>(`/events/${eventId}/seatmap`);
  return Array.isArray(data) ? data : data?.sections || [];
}

/** Sections of an event with live availability, used by the purchase screen. */
export async function getEventSections(eventId: string): Promise<MobileSection[]> {
  const data = await apiGet<any>(`/events/${eventId}/seatmap`);
  const sections: any[] = Array.isArray(data) ? data : data?.sections || [];
  return sections
    .filter((s) => s && s.sectionType !== 'stage' && s.sectionType !== 'decor')
    .map((s) => {
      const seats: any[] = s.seats || [];
      const sold = seats.filter(
        (x) => x.status === 'sold' || (x.status === 'locked' && !x.lockExpiresAt),
      ).length;
      const capacity =
        s.sectionType === 'standing'
          ? Number(s.capacity) || seats.length
          : seats.length;
      return {
        id: s.id,
        name: s.name || 'Section',
        type: s.sectionType || 'standing',
        price: Number(s.price || 0),
        available: Math.max(0, capacity - sold),
        capacity,
      };
    });
}

export async function getPublicEvents(): Promise<MobileEvent[]> {
  const data = await apiGet<ApiEvent[] | { data?: ApiEvent[]; events?: ApiEvent[] }>('/events');

  const events = Array.isArray(data)
    ? data
    : data.data || data.events || [];

  return events.map((event) => {
    const currency = event.currency || 'USD';
    const price = Number(event.minPrice ?? event.price ?? 0);

    return {
      id: event.id,
      slug: event.slug,
      title: event.title,
      date: formatEventDate(event.eventDate),
      venue: event.venueName || 'Venue coming soon',
      address: event.venueAddress || '',
      price: `${price.toFixed(2)} ${currency}`,
      tag: event.tag || event.categoryName || event.category || 'EVENT',
      featured: event.isFeatured ?? true,
      age: event.ageRestriction || '+21',
      description: event.description || '',
      currency,
      minPrice: price,
      eventDate: event.eventDate,
      eventTimezone: event.eventTimezone,
      venueName: event.venueName,
      venueAddress: event.venueAddress,
      imageUrl: getImageUrl(pickImage(event.imageUrl, event.imageData)),
      bannerImageUrl: getImageUrl(pickImage(event.bannerImageUrl, event.mobileImageData, event.imageUrl, event.imageData)),
    };
  });
}
