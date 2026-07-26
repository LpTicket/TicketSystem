import type { Metadata } from 'next';
import type { ReactNode } from 'react';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lpticket.com';
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://ticketsystembackend.up.railway.app/api';

function resolveImage(slug?: string | null, version?: string) {
  if (!slug) return `${siteUrl}/logo.png`;

  // Event flyers are often stored as Base64 in the backend. Social crawlers
  // cannot use a data URL, so always use the existing public image route.
  const imageUrl = new URL(`${siteUrl}/events/${encodeURIComponent(slug)}/og-image`);
  if (version) imageUrl.searchParams.set('v', version);
  return imageUrl.toString();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;

  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}/orders/ticket/${code}`, {
      cache: 'no-store',
    });

    if (!response.ok) throw new Error('Ticket not found');

    const ticket = await response.json();
    const event = ticket.event;
    const image = resolveImage(event?.slug, code);
    const title = event?.title ? `Entrada para ${event.title}` : 'Entrada LPTicket';

    return {
      title: `${title} — LPTicket`,
      description: event?.venueName
        ? `${event.venueName}${event.venueAddress ? ` — ${event.venueAddress}` : ''}`
        : 'Entrada digital de LPTicket.',
      openGraph: {
        title,
        description: event?.venueName || 'Entrada digital de LPTicket',
        url: `${siteUrl}/verify/${code}`,
        siteName: 'LPTicket',
        images: [{ url: image, width: 1200, height: 630, alt: title }],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: event?.venueName || 'Entrada digital de LPTicket',
        images: [image],
      },
    };
  } catch {
    return {
      title: 'Entrada LPTicket',
      description: 'Entrada digital de LPTicket.',
    };
  }
}

export default function VerifyCodeLayout({ children }: { children: ReactNode }) {
  return children;
}
