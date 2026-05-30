'use client';

import { useState, useEffect, useRef } from 'react';
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
  priority?: boolean;
}

export default function EventCard({ event, priority = false }: EventCardProps) {
  const { getCategoryInfo } = useCategories();
  const { lang } = useLang();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const resolvedSrc = !imageError && event.imageUrl
    ? getImageUrl(event.imageUrl, event.updatedAt) || '/demo/concert.png'
    : '/demo/concert.png';

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setImageLoaded(true);
    }
  }, []);

  const defaultCategory = { labelEs: 'Otro', labelEn: 'Other', icon: '🎫', color: '#6366f1' };
  const categoryInfo = getCategoryInfo(event.category) || defaultCategory;
  const catLabel = lang === 'en' ? categoryInfo?.labelEn : categoryInfo?.labelEs;
  const eventLocale = lang === 'es' ? 'es' : 'en-US';
  const eventTz = event.eventTimezone || 'UTC';
  const eventDay = formatDateInTimezone(event.eventDate, eventTz, eventLocale, { day: '2-digit', month: '2-digit' });
  const eventTime = formatDateInTimezone(event.eventDate, eventTz, eventLocale, { hour: '2-digit', minute: '2-digit', hour12: true });
  const eventTzAbbr = event.eventTimezone ? getTimezoneAbbr(eventTz, event.eventDate) : '';
  const eventHref = `/events/${event.slug}`;

  return (
    <article className="event-signature-card group">
      <Link href={eventHref} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-[#0A375A]">
          {!imageLoaded && (
            <div className="absolute inset-0 z-10 h-full w-full animate-shimmer" />
          )}
          <img
            ref={imgRef}
            src={resolvedSrc}
            alt={event.title}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={() => setImageLoaded(true)}
            className="h-full w-full object-cover transition-all duration-700 group-hover:scale-[1.035]"
            onError={() => { setImageError(true); setImageLoaded(true); }}
          />
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-[#0A375A] shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
            {catLabel}
          </div>
          {event.isFeatured && (
            <div className="absolute right-3 top-3 rounded-lg bg-primary-500 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-sm">
              {lang === 'es' ? 'Destacado' : 'Featured'}
            </div>
          )}
        </div>

        <div className="event-card-body space-y-3 p-4 pb-3">
          <h3 className="line-clamp-2 min-h-[3.6rem] text-[1.3rem] font-black leading-tight text-white">
            {event.title}
          </h3>
          <div className="event-card-date flex items-center gap-1.5 text-sm font-semibold">
            <HiOutlineCalendar className="h-4 w-4 shrink-0" />
            <span>{eventDay} {lang === 'es' ? 'a las' : 'at'} {eventTime}{eventTzAbbr && <span className="ml-1 font-medium text-gray-500">({eventTzAbbr})</span>}</span>
          </div>
          <div className="event-card-location flex min-w-0 items-start gap-1.5 text-sm font-semibold text-gray-500">
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

      <div className="event-card-footer mx-4 flex flex-col gap-3 border-t border-gray-100 pb-4 pt-3">
        <div className="flex min-w-0 items-center gap-1.5 text-white">
          <HiOutlineTag className="h-4 w-4 shrink-0 text-primary-500" />
          <span className="event-card-price text-sm font-black leading-tight">
            {lang === 'es' ? 'Desde' : 'From'} {Number(event.minPrice || 0).toFixed(2)} {event.currency || 'USD'}
          </span>
        </div>
        <div className="flex w-full items-center gap-3">
          <ShareEventButton
            eventTitle={event.title}
            eventPath={eventHref}
            label={lang === 'es' ? 'Comparte con tus amigos' : 'Share with friends'}
            compact
            className="!h-12 !w-12 !rounded-lg !border-[#ff7a00]/70 !bg-transparent !text-white !shadow-[0_0_18px_rgba(255,122,0,0.18)] hover:!border-[#ff7a00] hover:!bg-[rgba(255,122,0,0.08)]"
          />
          <Link
            href={eventHref}
            className="event-card-buy-button inline-flex flex-1 items-center justify-center rounded-lg bg-primary-500 px-4 text-[11px] font-black uppercase tracking-[0.12em] text-white transition-all hover:bg-primary-600"
          >
            {lang === 'es' ? 'Comprar tickets' : 'Buy tickets'}
          </Link>
        </div>
      </div>
    </article>
  );
}
