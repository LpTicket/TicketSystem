import { MobileEvent } from '../types/event';
import { apiGet } from './api';

type ApiEvent = {
  id: string;
  title: string;
  slug?: string;
  eventDate?: string;
  venueName?: string;
  venueAddress?: string;
  price?: number;
  minPrice?: number;
  category?: string;
  imageUrl?: string;
  bannerImageUrl?: string;
};

function formatEventDate(value?: string) {
  if (!value) return 'Date coming soon';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
  }) + ' at ' + date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function getPublicEvents(): Promise<MobileEvent[]> {
  const data = await apiGet<ApiEvent[] | { data?: ApiEvent[]; events?: ApiEvent[] }>('/events');

  const events = Array.isArray(data)
    ? data
    : data.data || data.events || [];

  return events.map((event) => ({
    id: event.id,
    title: event.title,
    date: formatEventDate(event.eventDate),
    venue: event.venueName || 'Venue coming soon',
    address: event.venueAddress || '',
    price: `${Number(event.minPrice ?? event.price ?? 0).toFixed(2)} USD`,
    tag: event.category || 'EVENT',
    featured: true,
    age: '+21',
    imageUrl: event.imageUrl,
    bannerImageUrl: event.bannerImageUrl,
  }));
}
