'use client';

import Link from 'next/link';
import { Event } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { useLang } from '@/context/LanguageContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { HiOutlineCalendar, HiOutlineLocationMarker, HiOutlineTag } from 'react-icons/hi';

import { getImageUrl } from '@/lib/api';

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const { getCategoryInfo } = useCategories();
  const { lang } = useLang();
  
  const categoryInfo = getCategoryInfo(event.category) || {
    labelEs: 'Otro', labelEn: 'Other', icon: '🎫', color: '#6366f1'
  };
  const catLabel = lang === 'en' ? categoryInfo.labelEn : categoryInfo.labelEs;
  const eventDate = new Date(event.eventDate);

  return (
    <Link href={`/events/${event.slug}`} className="card group block">
      {/* Image — responsive aspect ratio */}
      <div className="relative aspect-[4/3] sm:aspect-[3/4] overflow-hidden">
        {event.imageUrl ? (
          <img
            src={getImageUrl(event.imageUrl)}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
        ) : null}
        
        {/* Fallback displayed if no imageUrl or if image fails to load */}
        <div 
          className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center absolute inset-0"
          style={{ display: event.imageUrl ? 'none' : 'flex' }}
        >
          <span className="text-6xl">{categoryInfo.icon}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <h3 className="font-bold text-gray-900 text-base leading-tight line-clamp-2 min-h-[3rem]">
          {event.title}
        </h3>

        <div className="flex items-center gap-1.5 text-blue-600 text-sm">
          <HiOutlineCalendar className="w-4 h-4 shrink-0" />
          <span>
            {format(eventDate, "dd/MM", { locale: es })} a las {format(eventDate, "hh:mm a")}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-blue-600 text-sm">
          <HiOutlineTag className="w-4 h-4 shrink-0" />
          <span>
            Desde {Number(event.minPrice || 0).toFixed(2)} {event.currency || 'USD'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-gray-500 text-sm">
          <HiOutlineLocationMarker className="w-4 h-4 shrink-0" />
          <span className="truncate">{event.venueName}</span>
        </div>

        {/* Orange CTA button — like mdticket */}
        <div className="pt-2">
          <span className="btn-primary w-full text-sm py-2.5 text-center block">
            COMPRAR TICKETS
          </span>
        </div>
      </div>
    </Link>
  );
}
