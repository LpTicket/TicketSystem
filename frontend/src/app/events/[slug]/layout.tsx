import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lpticket.com').replace(/\/$/, '');
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ticketsystembackend.up.railway.app/api';

function resolveImage(url?: string | null, slug?: string | null, version?: string | null) {
  if (!url) return `${siteUrl}/logo.png`;
  // Always proxy social previews through Next.js so WhatsApp/Facebook get a
  // normalized 1200x630 image and a fresh URL after event image updates.
  if (slug) {
    const imageUrl = new URL(`${siteUrl}/events/${encodeURIComponent(slug)}/og-image`);
    if (version) imageUrl.searchParams.set('v', version);
    return imageUrl.toString();
  }
  return `${siteUrl}/logo.png`;
}

function cleanText(value?: string | null, fallback = '') {
  return String(value || fallback).replace(/\s+/g, ' ').trim();
}

function limitText(value: string, max = 220) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

function formatEventDate(value?: string | null, timezone = 'America/Chicago') {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'America/Chicago',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function normalizeSlug(value: string) {
  return decodeURIComponent(value || '').trim().toLowerCase();
}

async function fetchJson(url: string) {
  // ISR: cache for 60s so the whole /events/[slug] route stays static-ISR
  // (no-store here would force the entire route into dynamic rendering).
  // OG image freshness is handled separately via the ?v=updatedAt version param.
  const response = await fetch(url, { next: { revalidate: 60 } });
  if (!response.ok) return null;
  return response.json();
}

async function findEventBySlug(slug: string) {
  const cleanSlug = decodeURIComponent(slug || '').trim();
  const candidates = Array.from(new Set([
    cleanSlug,
    cleanSlug.toLowerCase(),
    cleanSlug.toUpperCase(),
  ].filter(Boolean)));

  for (const candidate of candidates) {
    const event = await fetchJson(`${apiUrl.replace(/\/$/, '')}/events/${encodeURIComponent(candidate)}`);
    if (event?.id) return event;
  }

  const listData = await fetchJson(`${apiUrl.replace(/\/$/, '')}/events?limit=200&includePast=true`);
  const events = Array.isArray(listData?.events) ? listData.events : Array.isArray(listData) ? listData : [];
  const target = normalizeSlug(cleanSlug);

  return events.find((event: any) => normalizeSlug(event.slug || '') === target) || null;
}

function buildDescription(event: any) {
  const dateText = formatEventDate(event.eventDate, event.eventTimezone || 'America/Chicago');
  const venueText = cleanText(event.venueName || event.venueAddress);
  const cityText = cleanText(event.venueAddress);

  const parts = [
    dateText,
    venueText && `at ${venueText}`,
    cityText && cityText !== venueText ? cityText : '',
    'Buy verified tickets securely on LP Ticket.',
  ].filter(Boolean);

  const fallback = parts.join(' ');
  return limitText(cleanText(event.description, fallback), 220);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const requestedUrl = `${siteUrl}/events/${slug}`;

  try {
    const event = await findEventBySlug(slug);

    if (!event?.id) throw new Error('Event not found');

    const eventName = cleanText(event.title, 'Event');
    const venueText = cleanText(event.venueName || event.venueAddress);
    const dateText = formatEventDate(event.eventDate, event.eventTimezone || 'America/Chicago');
    const canonicalSlug = event.slug || slug;
    const eventUrl = `${siteUrl}/events/${canonicalSlug}`;
    const title = `${eventName} | LP Ticket`;
    const description = buildDescription(event);
    const imageVersion = event.updatedAt || event.createdAt || event.eventDate || '';
    const image = resolveImage(event.imageUrl || event.bannerImageUrl, canonicalSlug, imageVersion);

    return {
      title,
      description,
      applicationName: 'LP Ticket',
      category: 'events',
      keywords: [
        eventName,
        venueText,
        event.venueAddress,
        event.category,
        dateText,
        'LP Ticket',
        'LPTicket',
        'tickets',
        'boletos',
        'event tickets',
        'verified tickets',
      ].filter(Boolean),
      alternates: {
        canonical: eventUrl,
      },
      openGraph: {
        title,
        description,
        url: eventUrl,
        siteName: 'LP Ticket',
        images: [
          {
            url: image,
            width: 1080,
            height: 1350,
            alt: `${eventName} - LP Ticket`,
          },
        ],
        type: 'website',
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
      other: {
        'og:brand': 'LP Ticket',
        'event:start_time': event.eventDate || '',
        'event:location': venueText || '',
        'event:timezone': event.eventTimezone || 'America/Chicago',
      },
    };
  } catch {
    return {
      title: 'Event | LP Ticket',
      description: 'Buy verified tickets securely on LP Ticket.',
      alternates: {
        canonical: requestedUrl,
      },
      openGraph: {
        title: 'Event | LP Ticket',
        description: 'Buy verified tickets securely on LP Ticket.',
        url: requestedUrl,
        siteName: 'LP Ticket',
        images: [{ url: `${siteUrl}/logo.png`, width: 1200, height: 630, alt: 'LP Ticket' }],
        type: 'website',
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Event | LP Ticket',
        description: 'Buy verified tickets securely on LP Ticket.',
        images: [`${siteUrl}/logo.png`],
      },
    };
  }
}

export default function EventSlugLayout({ children }: { children: ReactNode }) {
  return children;
}
