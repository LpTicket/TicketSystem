'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Event } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { useLang } from '@/context/LanguageContext';
import { format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { HiOutlineCalendar, HiOutlineLocationMarker, HiOutlineTag } from 'react-icons/hi';
import { getImageUrl } from '@/lib/api';

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
  const eventDate = new Date(event.eventDate);
  const dateLocale = lang === 'es' ? es : enUS;
  const dateLocale = lang === 'es' ? es : enUS;

  return (
    <Link href={`/events/${event.slug}`} className="event-signature-card group block">
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

        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-blue-950/82 via-blue-950/18 to-transparent" />

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

      <div className="space-y-3 p-4">
        <h3 className="line-clamp-2 min-h-[3rem] text-base font-black leading-tight text-blue-950">
          {event.title}
        </h3>

        <div className="flex items-center gap-1.5 text-sm font-semibold text-blue-700">
          <HiOutlineCalendar className="h-4 w-4 shrink-0" />
          <span>
            {format(eventDate, 'dd/MM', { locale: es })} a las {format(eventDate, 'hh:mm a')}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-500">
          <HiOutlineLocationMarker className="h-4 w-4 shrink-0" />
          <span className="truncate">{event.venueName}</span>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-3">
          <div className="flex items-center gap-1.5 text-blue-900">
            <HiOutlineTag className="h-4 w-4 shrink-0 text-primary-500" />
            <span className="text-sm font-black">
              {lang === 'es' ? 'Desde' : 'From'} {Number(event.minPrice || 0).toFixed(2)} {event.currency || 'USD'}
            </span>
          </div>
          <span className="rounded-lg bg-primary-500 px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] text-white transition-all group-hover:bg-primary-600">
            Tickets
          </span>
        </div>
      </div>
    </Link>
  );
}
