import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lpticket.com').replace(/\/$/, '');
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ticketsystembackend.up.railway.app/api';

function resolveImage(url?: string | null) {
  if (!url) return `${siteUrl}/logo.png`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('data:')) return `${siteUrl}/logo.png`;

  const backendBase = apiUrl.replace(/\/api\/?$/, '');
  return `${backendBase}${url.startsWith('/') ? url : `/${url}`}`;
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
  const eventUrl = `${siteUrl}/events/${slug}`;

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/events/${slug}`, {
      cache: 'no-store',
    });

    if (!response.ok) throw new Error('Event not found');

    const event = await response.json();

    const eventName = cleanText(event.title, 'Event');
    const venueText = cleanText(event.venueName || event.venueAddress);
    const dateText = formatEventDate(event.eventDate, event.eventTimezone || 'America/Chicago');
    const title = `${eventName} | LP Ticket`;
    const description = buildDescription(event);
    const image = resolveImage(event.bannerImageUrl || event.imageUrl);

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
            width: 1200,
            height: 630,
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
        canonical: eventUrl,
      },
      openGraph: {
        title: 'Event | LP Ticket',
        description: 'Buy verified tickets securely on LP Ticket.',
        url: eventUrl,
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
