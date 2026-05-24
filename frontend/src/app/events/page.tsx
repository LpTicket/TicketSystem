import { Suspense } from 'react';
import EventsContent from './EventsContent';
import { EventsResponse } from '@/types';

export const revalidate = 60; // ISR: revalidar cada 60 segundos

async function loadEventsData() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  try {
    const res = await fetch(`${baseUrl}/events?limit=12&page=1`, { next: { revalidate: 60 } });
    const data: EventsResponse = await res.json();
    return {
      events: data.events || [],
      total: data.total || 0,
      totalPages: data.totalPages || 1,
    };
  } catch (err) {
    console.error('Error loading events:', err);
    return { events: [], total: 0, totalPages: 1 };
  }
}

export default async function EventsPage() {
  const { events, total, totalPages } = await loadEventsData();

  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="h-10 skeleton rounded w-1/3 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card"><div className="aspect-[16/10] skeleton" /><div className="p-4 space-y-3"><div className="h-5 skeleton rounded w-3/4" /><div className="h-3 skeleton rounded w-1/2" /></div></div>
          ))}
        </div>
      </div>
    }>
      <EventsContent initialEvents={events} initialTotal={total} initialTotalPages={totalPages} />
    </Suspense>
  );
}
