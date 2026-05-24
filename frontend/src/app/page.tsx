'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import api, { getImageUrl } from '@/lib/api';
import EventCard from '@/components/events/EventCard';
import TrustBadges from '@/components/layout/TrustBadges';
import { parseSafeDate, formatDateInTimezone } from '@/lib/dateUtils';
import { Event, EventStatus } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineCalendar, HiOutlineLocationMarker, HiOutlineSearch, HiOutlineTicket } from 'react-icons/hi';
import { AnimatePresence, motion } from 'framer-motion';

const DEMO_EVENTS: Event[] = [];

type MarketingHomeBanner = {
  id: string;
  imageData: string;
  fileName?: string;
  bannerPosition?: string;
  isMarketingBanner: true;
};

type HomeBannerItem = Event | MarketingHomeBanner;

const isMarketingBanner = (banner: HomeBannerItem): banner is MarketingHomeBanner =>
  'isMarketingBanner' in banner && banner.isMarketingBanner === true;

export default function HomePage() {
  const { t, lang } = useLang();
  const { categories } = useCategories();
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [marketingBanner, setMarketingBanner] = useState<MarketingHomeBanner | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [usingDemo, setUsingDemo] = useState(false);
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState('fecha');
  const categoriesRef = useRef<HTMLDivElement>(null);

  const scrollCategories = (direction: 'left' | 'right') => {
    categoriesRef.current?.scrollBy({
      left: direction === 'left' ? -220 : 220,
      behavior: 'smooth',
    });
  };

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    const safetyTimeout = setTimeout(() => {
      setAllEvents(DEMO_EVENTS);
      setUsingDemo(true);
      setLoading(false);
    }, 3000);

    try {
      const response = await api.get('/events?limit=16').catch(() => null);
      const events = response?.data?.events;

      if (Array.isArray(events) && events.length > 0) {
        setAllEvents(events);
        setUsingDemo(false);
      } else {
        setAllEvents(DEMO_EVENTS);
        setUsingDemo(true);
      }

      const bannerResponse = await api.get('/marketing/banner/home').catch(() => null);
      if (bannerResponse?.data?.imageData) {
        setMarketingBanner({
          id: bannerResponse.data.id || 'marketing-home-banner',
          imageData: bannerResponse.data.imageData,
          fileName: bannerResponse.data.fileName || 'Banner publicitario LPTicket',
          bannerPosition: 'center',
          isMarketingBanner: true,
        });
      } else {
        setMarketingBanner(null);
      }
    } catch (err) {
      console.error('API Error:', err);
      setAllEvents(DEMO_EVENTS);
      setUsingDemo(true);
    } finally {
      clearTimeout(safetyTimeout);
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (activeCategory) params.set('category', activeCategory);
    if (params.toString()) window.location.href = `/events?${params.toString()}`;
  };

  const filteredEvents = useMemo(() => {
    let result = activeCategory ? allEvents.filter((e) => e.category === activeCategory) : allEvents;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.venueName?.toLowerCase().includes(q)
      );
    }

    if (locationQuery.trim()) {
      const q = locationQuery.toLowerCase();
      result = result.filter(e =>
        e.venueName?.toLowerCase().includes(q) ||
        e.venueAddress?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allEvents, activeCategory, searchQuery, locationQuery]);

  const sortedEvents = useMemo(() => {
    const result = [...filteredEvents];
    if (sortBy === 'precio') {
      return result.sort((a, b) => Number(a.minPrice || 0) - Number(b.minPrice || 0));
    }
    return result.sort((a, b) => parseSafeDate(a.eventDate).getTime() - parseSafeDate(b.eventDate).getTime());
  }, [filteredEvents, sortBy]);

  const bannerEvents = useMemo<HomeBannerItem[]>(() => {
    const eventBanners = allEvents
      .filter((e) => e.status === EventStatus.PUBLISHED && e.isFeatured)
      .sort(() => Math.random() - 0.5)
      .slice(0, 15);

    return marketingBanner ? [marketingBanner, ...eventBanners] : eventBanners;
  }, [allEvents, marketingBanner]);

  const bannerEvent = bannerEvents.length > 0 ? bannerEvents[currentBannerIdx % bannerEvents.length] : null;

  const nextBanner = () => setCurrentBannerIdx((prev) => (prev + 1) % bannerEvents.length);
  const prevBanner = () => setCurrentBannerIdx((prev) => (prev - 1 + bannerEvents.length) % bannerEvents.length);

  useEffect(() => {
    if (bannerEvents.length <= 1) return;
    const interval = setInterval(nextBanner, 6000);
    return () => clearInterval(interval);
  }, [bannerEvents.length]);

  return (
    <div className="home-signature min-h-screen">
      {loading ? (
        <section className="home-hero-shell">
          <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
            <div className="home-hero-frame animate-shimmer" />
          </div>
        </section>
      ) : bannerEvent ? (
        <section className="home-hero-shell">
          <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
            <div className="home-hero-frame group">
              <Link href={isMarketingBanner(bannerEvent) || usingDemo ? '#' : `/events/${bannerEvent.slug}`} className="absolute inset-0 z-[5] block overflow-hidden bg-[#0A375A]" aria-label={isMarketingBanner(bannerEvent) ? (bannerEvent.fileName || 'Banner publicitario LPTicket') : bannerEvent.title}>
                <AnimatePresence initial={false}>
                  <motion.img
                    key={`${bannerEvent.id}-mobile`}
                    src={isMarketingBanner(bannerEvent) ? bannerEvent.imageData : (getImageUrl(bannerEvent.imageUrl) || '/demo/concert.png')}
                    alt={isMarketingBanner(bannerEvent) ? (bannerEvent.fileName || 'Banner publicitario LPTicket') : bannerEvent.title}
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="absolute inset-0 block h-full w-full object-cover transition-transform duration-[1600ms] group-hover:scale-[1.025] sm:hidden"
                    style={{ objectPosition: bannerEvent.bannerPosition || 'center' }}
                    loading="eager"
                    fetchPriority="high"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/demo/concert.png'; }}
                  />
                  <motion.img
                    key={`${bannerEvent.id}-desktop`}
                    src={isMarketingBanner(bannerEvent) ? bannerEvent.imageData : (getImageUrl(bannerEvent.bannerImageUrl || bannerEvent.imageUrl) || '/demo/concert.png')}
                    alt={isMarketingBanner(bannerEvent) ? (bannerEvent.fileName || 'Banner publicitario LPTicket') : bannerEvent.title}
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="absolute inset-0 hidden h-full w-full object-cover transition-transform duration-[1600ms] group-hover:scale-[1.025] sm:block"
                    style={{ objectPosition: bannerEvent.bannerPosition || 'center' }}
                    loading="eager"
                    fetchPriority="high"
                    onError={(e) => { (e.target as HTMLImageElement).src = '/demo/concert.png'; }}
                  />
                </AnimatePresence>
                {!isMarketingBanner(bannerEvent) && <span className="home-hero-overlay" />}
              </Link>

              {!isMarketingBanner(bannerEvent) && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-end">
                <div className="home-hero-content">
                  <div className="mb-4 hidden items-center gap-2 rounded-lg border border-white/20 bg-white/12 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/90 backdrop-blur-md sm:inline-flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-400 shadow-[0_0_14px_rgba(249,115,22,0.9)]" />
                    {lang === 'es' ? 'Evento destacado' : 'Featured event'}
                  </div>
                  <h1 className="hidden max-w-4xl text-4xl font-black leading-[0.98] tracking-normal text-white sm:block sm:text-6xl lg:text-7xl">
                    {bannerEvent.title}
                  </h1>
                  <div className="mt-5 hidden flex-wrap items-center gap-3 text-sm font-semibold text-white/90 sm:flex">
                    <span className="inline-flex items-center gap-2 rounded-lg bg-white/12 px-3 py-2 backdrop-blur-md">
                      <HiOutlineCalendar className="h-4 w-4" />
                      {formatDateInTimezone(bannerEvent.eventDate, bannerEvent.eventTimezone || 'UTC', lang === 'es' ? 'es' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-lg bg-white/12 px-3 py-2 backdrop-blur-md">
                      <HiOutlineLocationMarker className="h-4 w-4" />
                      {bannerEvent.venueName}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-lg bg-white/12 px-3 py-2 backdrop-blur-md">
                      {lang === 'es' ? 'Desde' : 'From'} {Number(bannerEvent.minPrice || 0).toFixed(2)} {bannerEvent.currency || 'USD'}
                    </span>
                  </div>
                  <div className="home-hero-actions mt-6 flex flex-wrap items-center gap-3">
                    <Link href={usingDemo ? '#' : `/events/${bannerEvent.slug}`} className="inline-flex h-11 items-center justify-center rounded-lg bg-primary-500 px-6 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_16px_35px_rgba(249,115,22,0.28)] transition-all hover:bg-primary-600 hover:-translate-y-0.5">
                      {lang === 'es' ? 'Ver tickets' : 'View tickets'}
                    </Link>
                    <Link href="/events" className="inline-flex h-11 items-center justify-center rounded-lg border border-white/24 bg-white/10 px-5 text-xs font-black uppercase tracking-[0.12em] text-white backdrop-blur-md transition-all hover:bg-white/16">
                      {lang === 'es' ? 'Explorar eventos' : 'Explore events'}
                    </Link>
                  </div>
                </div>
              </div>
              )}

              {bannerEvents.length > 1 && (
                <>
                  <button onClick={(e) => { e.preventDefault(); prevBanner(); }} className="home-hero-arrow left-3 sm:left-5" aria-label="Previous event">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button onClick={(e) => { e.preventDefault(); nextBanner(); }} className="home-hero-arrow right-3 sm:right-5" aria-label="Next event">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="home-hero-shell">
          <div className="mx-auto max-w-[1500px] px-4 sm:px-6 lg:px-8">
            <div className="home-empty-hero">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-primary-600">LPTicket</p>
              <h1 className="max-w-3xl text-4xl font-black leading-tight text-[#0A375A] sm:text-6xl">
                {lang === 'es' ? 'Descubre tu próximo evento.' : 'Discover your next event.'}
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium text-gray-500">
                {lang === 'es' ? 'Una experiencia elegante para encontrar, reservar y vivir eventos memorables.' : 'An elegant experience to find, reserve, and enjoy memorable events.'}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="relative z-20 -mt-8 mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
        <div className="home-discovery-panel">
          <form onSubmit={handleSearch} className="grid gap-3 lg:grid-cols-[1.35fr_0.85fr_auto]">
            <label className="home-search-field">
              <span>{lang === 'es' ? 'Buscar evento' : 'Search event'}</span>
              <div>
                <HiOutlineSearch className="h-5 w-5 text-[#0A375A]/70" />
                <input type="text" placeholder={lang === 'es' ? 'Conciertos, teatro, talleres...' : 'Concerts, theater, workshops...'} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
            </label>

            <label className="home-search-field">
              <span>{lang === 'es' ? 'Lugar' : 'Place'}</span>
              <div>
                <HiOutlineLocationMarker className="h-5 w-5 text-[#0A375A]/70" />
                <input type="text" placeholder={lang === 'es' ? 'Ciudad o venue' : 'City or venue'} value={locationQuery} onChange={(e) => setLocationQuery(e.target.value)} />
              </div>
            </label>

            <button type="submit" className="inline-flex h-full min-h-[58px] items-center justify-center rounded-lg bg-[#0A375A] px-7 text-[0.64rem] font-black uppercase tracking-[0.14em] text-white shadow-[0_16px_28px_rgba(10,55,90,0.18)] transition-all hover:bg-[#0A375A] hover:-translate-y-0.5 lg:w-[10.5rem]">
              {lang === 'es' ? 'Buscar' : 'Search'}
            </button>
          </form>

          <div className="mt-4 flex flex-col gap-3 border-t border-[#0A375A]/10 pt-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-1.5 relative overflow-hidden group/cats lg:flex-1">
              <button type="button" onClick={() => scrollCategories('left')} className="home-scroll-button" aria-label="Scroll Left">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>

              <div ref={categoriesRef} className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth">
                <button onClick={() => setActiveCategory('')} className={`category-pill whitespace-nowrap ${activeCategory === '' ? 'active' : ''}`}>
                  {t('catAll')}
                </button>
                {categories.map((cat) => (
                  <button key={cat.id} onClick={() => setActiveCategory(activeCategory === cat.slug ? '' : cat.slug)} className={`category-pill whitespace-nowrap ${activeCategory === cat.slug ? 'active' : ''}`}>
                    {lang === 'en' ? cat.labelEn : cat.labelEs}
                  </button>
                ))}
              </div>

              <button type="button" onClick={() => scrollCategories('right')} className="home-scroll-button" aria-label="Scroll Right">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            <div className="relative shrink-0 w-full lg:w-[10.5rem]">
              <button onClick={() => setSortOpen(!sortOpen)} className="home-sort-button">
                {t('sortBy')}
                <span className="text-[10px] opacity-70">▼</span>
              </button>
              {sortOpen && (
                <div className="absolute right-0 top-full mt-2 w-full lg:w-44 bg-white border border-gray-100 rounded-2xl shadow-elevated overflow-hidden z-[60] animate-fade-in-up">
                  <div className="px-4 py-2 border-b border-gray-50 bg-gray-50/50">
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-tighter">{lang === 'es' ? 'Ordenar por' : 'Sort by'}</span>
                  </div>
                  <button onClick={() => { setSortBy('fecha'); setSortOpen(false); }} className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors ${sortBy === 'fecha' ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'}`}>
                    📅 {t('date')}
                  </button>
                  <button onClick={() => { setSortBy('precio'); setSortOpen(false); }} className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors ${sortBy === 'precio' ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'}`}>
                    💰 {t('price')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-8 max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <TrustBadges />
      </section>

      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-14 mt-14">
        <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-600">{lang === 'es' ? 'Destacados' : 'Highlights'}</p>
            <h2 className="mt-2 text-3xl font-black text-[#0A375A] sm:text-4xl">{lang === 'es' ? 'Eventos cerca de ti' : 'Events near you'}</h2>
          </div>
          <p className="text-sm font-semibold text-gray-500">{sortedEvents.length} {lang === 'es' ? 'eventos disponibles' : 'available events'}</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                <div className="aspect-[3/4] animate-shimmer" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 rounded-full animate-shimmer" />
                  <div className="h-3 w-1/2 rounded-full animate-shimmer" />
                  <div className="flex justify-between items-center pt-2">
                    <div className="h-6 w-16 rounded-full animate-shimmer" />
                    <div className="h-6 w-16 rounded-full animate-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : sortedEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-5">
            {sortedEvents.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        ) : (
          <div className="text-center py-20 border border-gray-200 rounded-lg bg-white/80">
            <HiOutlineTicket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-bold text-xl text-gray-600 mb-2">{t('noEventsCategory')}</h3>
          </div>
        )}
      </section>
    </div>
  );
}
