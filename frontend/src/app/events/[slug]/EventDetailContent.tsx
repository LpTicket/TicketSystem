'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatSeatLabel } from '@/lib/seatLabel';
import { formatDateInTimezone } from '@/lib/dateUtils';
import { useAuthStore } from '@/stores/auth';
import type { Event } from '@/types';
import { VenueSection, Seat, SeatStatus } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { HiOutlineCalendar, HiOutlineLocationMarker, HiOutlineClock } from 'react-icons/hi';
import SeatMapInteractive from '@/components/events/SeatMapInteractive';
import ShareEventButton from '@/components/events/ShareEventButton';
import { useLang } from '@/context/LanguageContext';

import { getImageUrl } from '@/lib/api';
import TrustBadges from '@/components/layout/TrustBadges';

const getTimezoneAbbr = (timezone: string): string => {
  if (!timezone) return '';
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(now);
    const tzPart = parts.find(p => p.type === 'timeZoneName');
    return tzPart?.value || '';
  } catch {
    return '';
  }
};

interface EventDetailContentProps {
  initialEvent: Event | null;
  initialSeatMap: (VenueSection & { seats: Seat[] })[];
}

export default function EventDetailContent({ initialEvent, initialSeatMap }: EventDetailContentProps) {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { lang, t } = useLang();
  const { isAuthenticated } = useAuthStore();
  const { getCategoryInfo } = useCategories();
  const [event, setEvent] = useState<Event | null>(initialEvent);
  const [seatMap, setSeatMap] = useState<(VenueSection & { seats: Seat[] })[]>(initialSeatMap);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  // If the server already supplied the event, there is no skeleton to show.
  const [loading, setLoading] = useState(!initialEvent);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  useEffect(() => {
    // Server already preloaded the event via ISR — skip the initial client fetch.
    if (initialEvent) return;
    loadEvent();
  }, [slug]);

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

  const [hasLoadedSaved, setHasLoadedSaved] = useState(false);
 
  // Cargar asientos iniciales desde localStorage si existen
  useEffect(() => {
    if (event?.id && seatMap.length > 0 && !hasLoadedSaved) {
      const saved = localStorage.getItem(`selectedSeats_${event.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const availableSeatIds = new Set(
              seatMap.flatMap((section: any) =>
                (section.seats || [])
                  .filter((seat: any) => seat.status === SeatStatus.AVAILABLE)
                  .map((seat: any) => seat.id)
              )
            );

            const valid = parsed.filter((s: any) =>
              (!s.addedAt || (Date.now() - s.addedAt < 10 * 60 * 1000)) &&
              (!s.id || String(s.id).startsWith('standing-') || availableSeatIds.has(s.id))
            );

            if (valid.length !== parsed.length) {
              localStorage.setItem(`selectedSeats_${event.id}`, JSON.stringify(valid));
              window.dispatchEvent(new Event('cart-updated'));
            }

            setSelectedSeats(valid);
          }
        } catch (e) {}
      }
      setHasLoadedSaved(true);
    }
  }, [event?.id, seatMap.length, hasLoadedSaved]);
 
  // Sincronizar selección a localStorage y escuchar cambios externos
  useEffect(() => {
    if (!event?.id || !hasLoadedSaved) return;
 
    const cartData = selectedSeats.map(s => ({
      ...s,
      addedAt: (s as any).addedAt || Date.now(),
      eventTitle: event.title,
      eventSlug: event.slug,
      eventDate: event.eventDate,
      venueName: event.venueName,
      currency: event.currency
    }));
    
    // Only write if different from what's there to prevent loops
    const currentSaved = localStorage.getItem(`selectedSeats_${event.id}`);
    const newSaved = JSON.stringify(cartData);
    if (currentSaved !== newSaved) {
      if (cartData.length === 0) {
        localStorage.removeItem(`selectedSeats_${event.id}`);
      } else {
        localStorage.setItem(`selectedSeats_${event.id}`, newSaved);
      }
      window.dispatchEvent(new Event('cart-updated'));
    }
  }, [selectedSeats, event, hasLoadedSaved]);

  useEffect(() => {
    const handleCartSync = () => {
      if (!event?.id) return;
      const saved = localStorage.getItem(`selectedSeats_${event.id}`);
      if (!saved) {
        if (selectedSeats.length > 0) setSelectedSeats([]);
      } else {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === 0) {
            if (selectedSeats.length > 0) setSelectedSeats([]);
          }
        } catch (e) {}
      }
    };

    window.addEventListener('cart-updated', handleCartSync);
    window.addEventListener('storage', handleCartSync);
    return () => {
      window.removeEventListener('cart-updated', handleCartSync);
      window.removeEventListener('storage', handleCartSync);
    };
  }, [event?.id, selectedSeats.length]); // Added selectedSeats.length to prevent empty loop

  const toggleSeats = (seats: Seat[]) => {
    setSelectedSeats((prev) => {
      let next = [...prev];
      for (const seat of seats) {
        if (seat.status !== SeatStatus.AVAILABLE) continue;
        const exists = next.find(s => s.id === seat.id);
        if (exists) {
          next = next.filter(s => s.id !== seat.id);
        } else {
          const limit = event?.maxTicketsPerTransaction || 10;
          if (next.length >= limit) {
            setAlertMessage(lang === 'es' 
              ? `No puedes seleccionar más de ${limit} asientos por transacción.` 
              : `You cannot select more than ${limit} seats per transaction.`);
            break;
          }
          const seatWithTime = { ...seat, addedAt: Date.now() };
          next.push(seatWithTime);
        }
      }
      return next;
    });
  };

  const getTotalPrice = useCallback(() => {
    return selectedSeats.reduce((total, seat) => {
      const section = seatMap.find((s) => s.id === seat.sectionId);
      return total + getSeatPrice(seat, section);
    }, 0);
  }, [selectedSeats, seatMap]);

  const getServiceFee = useCallback(() => {
    return selectedSeats.reduce((total, seat) => {
      const section = seatMap.find((s) => s.id === seat.sectionId);
      const price = getSeatPrice(seat, section);
      
      const sFeePercent = section?.serviceFeePercent !== null && section?.serviceFeePercent !== undefined 
        ? Number(section.serviceFeePercent) 
        : (event?.serviceFeePercent !== null && event?.serviceFeePercent !== undefined ? Number(event.serviceFeePercent) : 0.12);

      const sFeeFixed = section?.serviceFeeFixedPerTicket !== null && section?.serviceFeeFixedPerTicket !== undefined 
        ? Number(section.serviceFeeFixedPerTicket) 
        : (event?.serviceFeeFixedPerTicket !== null && event?.serviceFeeFixedPerTicket !== undefined ? Number(event.serviceFeeFixedPerTicket) : 0);
        
      return total + (price * sFeePercent + sFeeFixed);
    }, 0);
  }, [selectedSeats, seatMap, event]);

  const getProcessingFee = useCallback(() => {
    return selectedSeats.reduce((total, seat) => {
      const section = seatMap.find((s) => s.id === seat.sectionId);
      const price = getSeatPrice(seat, section);
      
      const pFeePercent = section?.processingFeePercent !== null && section?.processingFeePercent !== undefined 
        ? Number(section.processingFeePercent) 
        : (event?.processingFeePercent !== null && event?.processingFeePercent !== undefined ? Number(event.processingFeePercent) : 0.029);

      const pFeeFixed = section?.processingFeeFixedPerTicket !== null && section?.processingFeeFixedPerTicket !== undefined 
        ? Number(section.processingFeeFixedPerTicket) 
        : (event?.processingFeeFixedPerTicket !== null && event?.processingFeeFixedPerTicket !== undefined ? Number(event.processingFeeFixedPerTicket) : 0.30);
        
      return total + (price * pFeePercent + pFeeFixed);
    }, 0);
  }, [selectedSeats, seatMap, event]);

  const handleBuyTickets = () => {
    if (selectedSeats.length === 0) {
      setAlertMessage(lang === 'es' ? 'Por favor selecciona al menos un asiento.' : 'Please select at least one seat.');
      return;
    }

    if (event?.id) {
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
    
    if (!isAuthenticated) { 
      router.push(`/login?redirect=/events/${slug}/purchase`); 
      return; 
    }
    router.push(`/events/${slug}/purchase`);
  };

  if (loading) return <div className="event-premium-shell max-w-7xl mx-auto px-4 py-8"><div className="h-64 skeleton rounded-lg mb-6" /><div className="h-6 skeleton rounded w-1/2 mb-3" /></div>;
  if (!event) return null;

  const categoryInfo = getCategoryInfo(event.category) || {
    labelEs: 'Otro', labelEn: 'Other', icon: '🎫', color: '#6366f1'
  };

  const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lpticket.com';
  const eventPublicUrl = `${publicSiteUrl}/events/${event.slug}`;
  const eventImageUrl = getImageUrl(event.bannerImageUrl || event.imageUrl) || `${publicSiteUrl}/logo.png`;
  const lowestSectionPrice = event.sections?.length
    ? Math.min(...event.sections.map((section) => Number(section.price || 0)))
    : Number(event.minPrice || 0);

  const eventJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description || `${event.title} en ${event.venueName}. Compra tickets seguros en LPTicket.`,
    image: [eventImageUrl],
    startDate: event.eventDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: eventPublicUrl,
    location: {
      '@type': 'Place',
      name: event.venueName,
      address: event.venueAddress || event.venueName,
    },
    organizer: {
      '@type': 'Organization',
      name: 'LPTicket',
      url: publicSiteUrl,
    },
    offers: {
      '@type': 'Offer',
      url: eventPublicUrl,
      price: lowestSectionPrice,
      priceCurrency: event.currency || 'USD',
      availability: 'https://schema.org/InStock',
      validFrom: event.createdAt,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventJsonLd) }}
      />
      <div className="event-dark max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-8 lg:pt-24">
      {/* Hero Image */}
      <div className="event-premium-hero relative overflow-hidden mb-8 aspect-[16/9] sm:aspect-[21/8]">
        {(event.bannerImageUrl || event.imageUrl) ? (
          <img 
            src={getImageUrl(event.bannerImageUrl || event.imageUrl)} 
            alt={event.title} 
            className="w-full h-full object-cover" 
            style={{ objectPosition: event.bannerPosition || 'center' }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-[#0A375A] to-[#F97316] flex items-center justify-center">
            <span className="text-8xl">{categoryInfo.icon}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Event Info */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <span className="category-pill text-xs mb-3 inline-block">{categoryInfo.icon} {lang === 'en' ? categoryInfo.labelEn : categoryInfo.labelEs}</span>
            <h1 className="font-bold text-2xl sm:text-3xl text-gray-900">{event.title}</h1>
            <ShareEventButton
              eventTitle={event.title}
              eventPath={`/events/${event.slug}`}
              label={lang === 'es' ? 'Comparte con tus amigos' : 'Share with friends'}
              className="mt-4"
            />
          </div>

          {/* Quick info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="event-premium-info flex items-center gap-3 p-4">
              <HiOutlineCalendar className="w-5 h-5 text-[#0A375A] shrink-0" />
              <div>
                <div className="text-xs text-gray-500">{t('dateLabel')}</div>
                <div className="text-sm font-semibold text-gray-900">{formatDateInTimezone(event.eventDate, event.eventTimezone || 'UTC', lang === 'en' ? 'en-US' : 'es', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
              </div>
            </div>
            <div className="event-premium-info flex items-center gap-3 p-4">
              <HiOutlineClock className="w-5 h-5 text-[#0A375A] shrink-0" />
              <div>
                <div className="text-xs text-gray-500">{t('timeLabel')}</div>
                <div className="text-sm font-semibold text-gray-900">
                  {formatDateInTimezone(event.eventDate, event.eventTimezone || 'UTC', lang === 'en' ? 'en-US' : 'es', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  {event?.eventTimezone && <span className="text-gray-500 ml-1">({getTimezoneAbbr(event.eventTimezone)})</span>}
                </div>
              </div>
            </div>
            <div className="event-premium-info flex items-center gap-3 p-4">
              <HiOutlineLocationMarker className="w-5 h-5 text-[#0A375A] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500">{t('venueLabel')}</div>
                <div className="text-sm font-black text-[#0A375A] truncate">{event.venueName}</div>
                {event.venueAddress && (
                  <div className="text-xs text-gray-500 truncate mt-0.5">{event.venueAddress}</div>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="event-premium-panel p-6">
              <h2 className="event-premium-title font-black text-lg mb-3">{t('aboutEvent')}</h2>
              <div className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{event.description}</div>
            </div>
          )}

          {/* Seat Map */}
          {seatMap.length > 0 && (
            <div className="event-premium-panel overflow-hidden">
              <div className="font-black text-base sm:text-lg text-[#0A375A] py-3 px-6 border-b border-[rgba(10,55,90,0.10)] bg-[rgba(10,55,90,0.04)]">
                <span>{lang === 'es' ? 'Selecciona tus asientos' : 'Select your seats'}</span>
              </div>
              <div className="p-6">
                <SeatMapInteractive
                  seatMap={seatMap}
                  selectedSeats={selectedSeats}
                  onToggleSeats={toggleSeats}
                  defaultViewX={event.defaultViewX}
                  defaultViewY={event.defaultViewY}
                  defaultViewZoom={event.defaultViewZoom}
                  showStage={event.showStage}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — Purchase */}
        <div className="lg:col-span-1">
          <div className="sticky top-20">
            <div className="event-premium-panel p-6 space-y-4">
              <h3 className="font-black text-lg text-[#0A375A]">{t('purchaseSummary')}</h3>

              {seatMap.length > 0 && (
                <details className="group border border-[rgba(10,55,90,0.12)] rounded-lg bg-white overflow-hidden shadow-sm">
                  <summary className="px-4 py-3 text-sm font-bold text-[#0A375A] cursor-pointer list-none flex justify-between items-center hover:bg-orange-50 transition-colors">
                    <span>{lang === 'es' ? 'Ver Precios y Zonas' : 'View Prices & Zones'}</span>
                    <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">▼</span>
                  </summary>
                  <div className="px-4 pb-4 pt-2 space-y-2 border-t border-gray-100 bg-white">
                    {seatMap
                      .filter((s) => s.sectionType !== 'stage' && s.sectionType !== 'decor')
                      .map((section) => (
                      <div key={section.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: section.color }} />
                          {section.name}
                        </span>
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
                    <div className="text-xs text-gray-500 mb-1">{t('selectedSeats')}</div>
                    {(() => {
                      // Group standing tickets by section
                      const standingGroups: Record<string, any[]> = {};
                      const regularSeats: any[] = [];
                      
                      selectedSeats.forEach(seat => {
                        const section = seatMap.find(s => s.id === seat.sectionId);
                        if (section?.sectionType === 'standing') {
                          if (!standingGroups[section.id!]) standingGroups[section.id!] = [];
                          standingGroups[section.id!].push(seat);
                        } else {
                          regularSeats.push(seat);
                        }
                      });

                      return (
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {Object.entries(standingGroups).map(([secId, seats]) => {
                            const section = seatMap.find(s => s.id === secId);
                            return (
                              <div key={secId} className="flex items-center justify-between text-sm py-1 px-1.5 rounded hover:bg-slate-50 transition-colors">
                                <span className="text-gray-600 flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white shadow-sm" style={{ background: section?.color || '#cbd5e1' }} />
                                  <span className="font-extrabold text-slate-800">{seats.length}x</span>
                                  <span className="font-semibold text-slate-800">{section?.name}</span>
                                </span>
                                <span className="font-extrabold text-slate-900">${(Number(section?.price || 0) * seats.length).toFixed(2)}</span>
                              </div>
                            );
                          })}
                          {regularSeats.map((seat) => {
                            const section = seatMap.find((s) => s.id === seat.sectionId);
                            return (
                              <div key={seat.id} className="flex items-center justify-between text-sm py-1 px-1.5 rounded hover:bg-slate-50 transition-colors">
                                <span className="text-gray-600 flex items-center gap-2 min-w-0">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white shadow-sm" style={{ background: section?.color || '#cbd5e1' }} />
                                  <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                                    {formatSeatLabel(seat, section, lang)}
                                  </span>
                                </span>
                                <span className="font-extrabold text-slate-900 shrink-0">${getSeatPrice(seat, section).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  <hr className="border-gray-200" />
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('subtotal')}</span>
                      <span className="text-gray-800">${getTotalPrice().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('serviceFee')}</span>
                      <span className="text-gray-800">${getServiceFee().toFixed(2)}</span>
                    </div>
                    {getProcessingFee() > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{lang === 'es' ? 'Tarifa de procesamiento' : 'Processing fee'}</span>
                        <span className="text-gray-800">${getProcessingFee().toFixed(2)}</span>
                      </div>
                    )}
                    <hr className="border-gray-200" />
                    <div className="flex justify-between font-bold text-base">
                      <span className="text-gray-900">{t('total')}</span>
                      <span className="text-[#F97316]">${(getTotalPrice() + getServiceFee() + getProcessingFee()).toFixed(2)} {event.currency || 'USD'}</span>
                    </div>
                  </div>
                </>
              )}

              <button onClick={handleBuyTickets} className="btn-primary w-full py-3 rounded-lg font-black uppercase tracking-wide text-sm shadow-lg shadow-orange-500/20">
                {t('buyTickets')}
              </button>
              <p className="text-[10px] text-gray-400 text-center">{t('securePayments')}</p>
              <TrustBadges compact />
            </div>
          </div>
        </div>
      </div>
      {/* Custom Premium Glassmorphic Modal Alert */}
      {alertMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 transform scale-100 transition-all duration-300 animate-scaleUp">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Animated Warning Icon */}
              <div className="w-16 h-16 rounded-full bg-orange-50 flex items-center justify-center text-[#F97316] animate-bounce-slow shadow-inner">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              
              <h4 className="text-[17px] font-black text-slate-800 leading-tight">
                {lang === 'es' ? 'Atención' : 'Attention'}
              </h4>
              
              <p className="text-sm text-slate-500 font-semibold leading-relaxed">
                {alertMessage}
              </p>

              <button 
                onClick={() => setAlertMessage(null)}
                className="w-full py-3 bg-[#F97316] hover:bg-[#ea650c] active:scale-[0.98] text-white font-extrabold rounded-lg transition-all shadow-md shadow-orange-500/20 text-sm tracking-wide uppercase"
              >
                {lang === 'es' ? 'Entendido' : 'Got it'}
              </button>
            </div>
          </div>

          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleUp {
              from { transform: scale(0.95); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            .animate-fadeIn {
              animation: fadeIn 0.2s ease-out forwards;
            }
            .animate-scaleUp {
              animation: scaleUp 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            @keyframes bounceSlow {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-4px); }
            }
            .animate-bounce-slow {
              animation: bounceSlow 2s ease-in-out infinite;
            }
          `}} />
        </div>
      )}
      </div>
    </>
  );
}
