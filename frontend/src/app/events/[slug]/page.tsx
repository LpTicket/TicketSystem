import EventDetailContent from './EventDetailContent';
import type { Event, VenueSection, Seat } from '@/types';

export const revalidate = 60; // ISR: regenerate every 60s

// Prerender current events at build time (SSG + ISR). Slugs not generated here
// (e.g. events created later) still render on-demand thanks to dynamicParams.
export async function generateStaticParams() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  try {
    const res = await fetch(`${baseUrl}/events?limit=200`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    const events: { slug?: string }[] = data.events || data || [];
    return events
      .filter((e) => e.slug)
      .map((e) => ({ slug: String(e.slug) }));
  } catch {
    return [];
  }
}

async function loadEventData(slug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  try {
    const eventRes = await fetch(`${baseUrl}/events/${slug}`, { next: { revalidate: 60 } });
    if (!eventRes.ok) return { event: null, seatMap: [] as (VenueSection & { seats: Seat[] })[] };

    const event: Event = await eventRes.json();

    let seatMap: (VenueSection & { seats: Seat[] })[] = [];
    if (event?.id) {
      const mapRes = await fetch(`${baseUrl}/events/${event.id}/seatmap`, { next: { revalidate: 60 } });
      if (mapRes.ok) {
        seatMap = await mapRes.json();
      }
    }

    return { event, seatMap };
  } catch (err) {
    console.error('Error loading event:', err);
    return { event: null, seatMap: [] as (VenueSection & { seats: Seat[] })[] };
  }
}

export default async function EventDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { event, seatMap } = await loadEventData(slug);

  return <EventDetailContent initialEvent={event} initialSeatMap={seatMap} />;
}
