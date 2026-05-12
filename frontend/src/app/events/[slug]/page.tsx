'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type { Event } from '@/types';
import { VenueSection, Seat, SeatStatus } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { HiOutlineCalendar, HiOutlineLocationMarker, HiOutlineClock, HiOutlineTicket } from 'react-icons/hi';
import SeatMapInteractive from '@/components/events/SeatMapInteractive';
import { useLang } from '@/context/LanguageContext';

import { getImageUrl } from '@/lib/api';

export default function EventDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { lang } = useLang();
  const { user, isAuthenticated } = useAuthStore();
  const { getCategoryInfo } = useCategories();
  const [event, setEvent] = useState<Event | null>(null);
  const [seatMap, setSeatMap] = useState<(VenueSection & { seats: Seat[] })[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);

  useEffect(() => { loadEvent(); }, [slug]);

  const loadEvent = async () => {
    try {
      const { data } = await api.get(`/events/${slug}`);
      setEvent(data);
      if (data.id) {
        const { data: map } = await api.get(`/events/${data.id}/seatmap`);
        setSeatMap(map);
      }
    } catch { router.push('/events'); }
    finally { setLoading(false); }
  };

  const getSeatPrice = (seat: Seat, section?: VenueSection) => {
    if (!section) return 0;
    try {
      if (section.seatsConfig) {
        const config = JSON.parse(section.seatsConfig);
        let seatKey = '';
        if (seat.rowLabel && seat.rowLabel !== 'GA') {
          seatKey = `${seat.rowLabel}-${seat.seatNumber}`;
        } else {
          seatKey = `seat-${seat.seatNumber}`;
        }
        const override = config[seatKey];
        if (override && override.price !== undefined && override.price !== null) {
          return Number(override.price);
        }
      }
    } catch (e) {}
    return Number(section.price || 0);
  };

  const isFirstRender = useRef(true);

  // Load initial seats on mount / preparation
  useEffect(() => {
    if (event?.id && seatMap.length > 0) {
      const saved = localStorage.getItem(`selectedSeats_${event.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const valid = parsed.filter((s: any) => !s.addedAt || (Date.now() - s.addedAt < 10 * 60 * 1000));
            setSelectedSeats(valid);
          }
        } catch (e) {}
      }
    }
  }, [event?.id, seatMap.length]);

  // Synchronize state changes to localStorage and dispatch cart-updated
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!event?.id) return;

    const cartData = selectedSeats.map(s => ({
      ...s,
      addedAt: (s as any).addedAt || Date.now(),
      eventTitle: event.title,
      eventSlug: event.slug,
      eventDate: event.eventDate,
      venueName: event.venueName,
      currency: event.currency
    }));
    localStorage.setItem(`selectedSeats_${event.id}`, JSON.stringify(cartData));
    window.dispatchEvent(new Event('cart-updated'));
  }, [selectedSeats, event]);

  const toggleSeats = (seats: Seat[]) => {
    setSelectedSeats((prev) => {
      let next = [...prev];
      for (const seat of seats) {
        if (seat.status !== SeatStatus.AVAILABLE) continue;
        const exists = next.find(s => s.id === seat.id);
        if (exists) {
          next = next.filter(s => s.id !== seat.id);
        } else {
          if (next.length >= 10) {
            alert(lang === 'es' ? 'No puedes seleccionar más de 10 asientos por transacción.' : 'You cannot select more than 10 seats per transaction.');
            break;
          }
          next.push(seat);
        }
      }
      return next;
    });
  };

  const isSeatSelected = (seatId: string) => selectedSeats.some((s) => s.id === seatId);

  const getTotalPrice = () => selectedSeats.reduce((total, seat) => {
    const section = seatMap.find((s) => s.id === seat.sectionId);
    return total + getSeatPrice(seat, section);
  }, 0);

  const handleBuyTickets = () => {
    if (selectedSeats.length > 0 && event?.id) {
      const cartData = selectedSeats.map(s => ({
        ...s,
        addedAt: (s as any).addedAt || Date.now(),
        eventTitle: event.title,
        eventSlug: event.slug,
        eventDate: event.eventDate,
        venueName: event.venueName,
        currency: event.currency
      }));
      localStorage.setItem(`selectedSeats_${event.id}`, JSON.stringify(cartData));
      window.dispatchEvent(new Event('cart-updated'));
    }
    if (!isAuthenticated) { router.push(`/login?redirect=/events/${slug}/purchase`); return; }
    router.push(`/events/${slug}/purchase`);
  };

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-8"><div className="h-64 skeleton rounded-lg mb-6" /><div className="h-6 skeleton rounded w-1/2 mb-3" /></div>;
  if (!event) return null;

  const categoryInfo = getCategoryInfo(event.category) || {
    labelEs: 'Otro', labelEn: 'Other', icon: '🎫', color: '#6366f1'
  };
  const eventDate = new Date(event.eventDate);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Image */}
      <div className="relative rounded-lg overflow-hidden mb-8 aspect-[21/9]">
        {(event.bannerImageUrl || event.imageUrl) ? (
          <img 
            src={getImageUrl(event.bannerImageUrl || event.imageUrl)} 
            alt={event.title} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-blue-600 to-primary-500 flex items-center justify-center">
            <span className="text-8xl">{categoryInfo.icon}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Event Info */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <span className="category-pill text-xs mb-3 inline-block">{categoryInfo.icon} {categoryInfo.labelEs}</span>
            <h1 className="font-bold text-2xl sm:text-3xl text-gray-900">{event.title}</h1>
          </div>

          {/* Quick info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <HiOutlineCalendar className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Fecha</div>
                <div className="text-sm font-semibold text-gray-900">{format(eventDate, "dd 'de' MMMM, yyyy", { locale: es })}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <HiOutlineClock className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Hora</div>
                <div className="text-sm font-semibold text-gray-900">{format(eventDate, 'hh:mm a')}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <HiOutlineLocationMarker className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <div className="text-xs text-gray-500">Lugar</div>
                <div className="text-sm font-semibold text-gray-900 truncate">{event.venueName}</div>
              </div>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="font-bold text-lg text-gray-900 mb-3">Acerca del evento</h2>
              <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{event.description}</div>
            </div>
          )}

          {/* Seat Map */}
          {seatMap.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm space-y-4">
              <h2 className="font-bold text-lg text-gray-900">
                {lang === 'es' ? 'Selecciona tus asientos' : 'Select your seats'}
              </h2>
              
              <SeatMapInteractive
                seatMap={seatMap}
                selectedSeats={selectedSeats}
                onToggleSeats={toggleSeats}
                defaultViewX={event.defaultViewX}
                defaultViewY={event.defaultViewY}
                defaultViewZoom={event.defaultViewZoom}
              />
            </div>
          )}
        </div>

        {/* Sidebar — Purchase */}
        <div className="lg:col-span-1">
          <div className="sticky top-20">
            <div className="border border-gray-200 rounded-lg p-6 space-y-4 bg-white shadow-sm">
              <h3 className="font-bold text-lg text-gray-900">Resumen de compra</h3>

              {seatMap.length > 0 && (
                <details className="group border border-gray-200 rounded-lg bg-gray-50 overflow-hidden">
                  <summary className="px-4 py-3 text-sm font-semibold text-gray-700 cursor-pointer list-none flex justify-between items-center hover:bg-gray-100 transition-colors">
                    <span>{lang === 'es' ? 'Ver Precios y Zonas' : 'View Prices & Zones'}</span>
                    <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">▼</span>
                  </summary>
                  <div className="px-4 pb-4 pt-2 space-y-2 border-t border-gray-100 bg-white">
                    {seatMap.map((section) => (
                      <div key={section.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: section.color }} />{section.name}</span>
                        <span className="font-semibold text-gray-900">${Number(section.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {selectedSeats.length > 0 && (
                <>
                  <hr className="border-gray-200" />
                  <div className="space-y-1">
                    <div className="text-xs text-gray-500 mb-1">Asientos seleccionados:</div>
                    {selectedSeats.map((seat) => {
                      const section = seatMap.find((s) => s.id === seat.sectionId);
                      return (
                        <div key={seat.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{section?.name} — {seat.rowLabel}{seat.seatNumber}</span>
                        <span className="font-medium text-gray-800">${getSeatPrice(seat, section).toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <hr className="border-gray-200" />
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="text-gray-800">${getTotalPrice().toFixed(2)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Cargo por servicio (10%)</span><span className="text-gray-800">${(getTotalPrice() * 0.10).toFixed(2)}</span></div>
                    <hr className="border-gray-200" />
                    <div className="flex justify-between font-bold text-base"><span className="text-gray-900">Total</span><span className="text-primary-600">${(getTotalPrice() * 1.10).toFixed(2)} {event.currency || 'USD'}</span></div>
                  </div>
                </>
              )}

              <button onClick={handleBuyTickets} className="btn-primary w-full py-3">
                COMPRAR TICKETS
              </button>
              <p className="text-[10px] text-gray-400 text-center">Pagos seguros procesados por Stripe</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
