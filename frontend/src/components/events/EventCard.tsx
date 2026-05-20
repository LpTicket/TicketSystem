'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Event } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineCalendar, HiOutlineLocationMarker, HiOutlineTag } from 'react-icons/hi';
import ShareEventButton from '@/components/events/ShareEventButton';
import { getImageUrl } from '@/lib/api';

import { formatDateInTimezone, getTimezoneAbbr } from '@/lib/dateUtils';

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const { getCategoryInfo } = useCategories();
  const { lang } = useLang();
  const [imageLoaded, setImageLoaded] = useState(false);

  const categoryInfo = getCategoryInfo(event.category) || {
    labelEs: 'Otro',
    labelEn: 'Other',
    icon: '🎫',
    color: '#6366f1',
  };

  const catLabel = lang === 'en' ? categoryInfo.labelEn : categoryInfo.labelEs;
  const eventLocale = lang === 'es' ? 'es' : 'en-US';
  const eventTz = event.eventTimezone || 'UTC';
  const eventDay = formatDateInTimezone(event.eventDate, eventTz, eventLocale, { day: '2-digit', month: '2-digit' });
  const eventTime = formatDateInTimezone(event.eventDate, eventTz, eventLocale, { hour: '2-digit', minute: '2-digit', hour12: true });
  const eventTzAbbr = event.eventTimezone ? getTimezoneAbbr(eventTz, event.eventDate) : '';
  const eventHref = `/events/${event.slug}`;

  return (
    <article className="event-signature-card group">
      <Link href={eventHref} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-blue-950">
          {event.imageUrl && !imageLoaded && (
            <div className="absolute inset-0 z-10 h-full w-full animate-shimmer" />
          )}

          {event.imageUrl ? (
            <img
              src={getImageUrl(event.imageUrl)}
              alt={event.title}
              onLoad={() => setImageLoaded(true)}
              className={`h-full w-full object-cover transition-all duration-700 group-hover:scale-[1.035] ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onError={(e) => {
                setImageLoaded(true);
                (e.target as HTMLImageElement).style.display = 'none';
                const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}

          <div
            className="absolute inset-0 flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-800 via-blue-700 to-primary-500"
            style={{ display: event.imageUrl ? 'none' : 'flex' }}
          >
            <span className="text-6xl">{categoryInfo.icon}</span>
          </div>

          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-white/92 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-blue-900 shadow-sm backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
            {catLabel}
          </div>

          {event.isFeatured && (
            <div className="absolute right-3 top-3 rounded-lg bg-primary-500 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-sm">
              {lang === 'es' ? 'Destacado' : 'Featured'}
            </div>
          )}
        </div>

        <div className="space-y-3 p-4 pb-3">
          <h3 className="line-clamp-2 min-h-[3rem] text-base font-black leading-tight text-blue-950">
            {event.title}
          </h3>

          <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-700">
            <HiOutlineCalendar className="h-4 w-4 shrink-0" />
            <span>{eventDay} {lang === 'es' ? 'a las' : 'at'} {eventTime}{eventTzAbbr && <span className="ml-1 font-medium text-gray-500">({eventTzAbbr})</span>}</span>
          </div>

          <div className="flex min-w-0 items-start gap-1.5 text-sm font-semibold text-gray-500">
            <HiOutlineLocationMarker className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate">{event.venueName}</span>
              {event.venueAddress && (
                <span className="block truncate text-xs font-semibold text-gray-400">{event.venueAddress}</span>
              )}
            </span>
          </div>
        </div>
      </Link>

      <div className="mx-4 flex flex-col gap-3 border-t border-gray-100 pb-4 pt-3">
        <div className="flex min-w-0 items-center gap-1.5 text-blue-900">
          <HiOutlineTag className="h-4 w-4 shrink-0 text-primary-500" />
          <span className="text-sm font-black leading-tight">
            {lang === 'es' ? 'Desde' : 'From'} {Number(event.minPrice || 0).toFixed(2)} {event.currency || 'USD'}
          </span>
        </div>

        <div className="flex w-full items-center gap-3">
          <ShareEventButton
            eventTitle={event.title}
            eventPath={eventHref}
            label={lang === 'es' ? 'Comparte con tus amigos' : 'Share with friends'}
            compact
            className="!h-12 !w-12 !rounded-lg !border-blue-800 !bg-blue-800 !text-white !shadow-none hover:!bg-blue-700"
          />

          <Link
            href={eventHref}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-lg bg-primary-500 px-4 text-[11px] font-black uppercase tracking-[0.12em] text-white transition-all hover:bg-primary-600"
          >
            {lang === 'es' ? 'Comprar tickets' : 'Buy tickets'}
          </Link>
        </div>
      </div>
    </article>
  );
}
