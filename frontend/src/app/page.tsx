'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api, { getImageUrl } from '@/lib/api';
import EventCard from '@/components/events/EventCard';
import { Event, EventStatus } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineTicket } from 'react-icons/hi';
import { AnimatePresence, motion } from 'framer-motion';

// Demo events — se muestran cuando no hay eventos reales del API
const DEMO_EVENTS: Event[] = [];

export default function HomePage() {
  const { t, lang } = useLang();
  const { categories } = useCategories();
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [usingDemo, setUsingDemo] = useState(false);
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const categoriesRef = useRef<HTMLDivElement>(null);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesRef.current) {
      const scrollAmount = 200;
      categoriesRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    // Safety timeout: if API doesn't respond in 3 seconds, show demo events
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        setAllEvents(DEMO_EVENTS);
        setUsingDemo(true);
        setLoading(false);
      }
    }, 3000);

    try {
      const response = await api.get('/events?limit=16').catch(() => null);
      if (response && response.data && response.data.events && response.data.events.length > 0) {
        setAllEvents(response.data.events);
        setUsingDemo(false);
      } else {
        setAllEvents(DEMO_EVENTS);
        setUsingDemo(true);
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
    if (searchQuery.trim()) {
      window.location.href = `/events?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const displayCategories = categories;
  
  const filteredEvents = useMemo(() => {
    let result = activeCategory
      ? allEvents.filter((e) => e.category === activeCategory)
      : allEvents;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.title.toLowerCase().includes(q) || 
        (e.venueName && e.venueName.toLowerCase().includes(q))
      );
    }

    return result;
  }, [allEvents, activeCategory, searchQuery]);

  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState('fecha');
  const [categoryOpen, setCategoryOpen] = useState(false);

  // bannerEvents: 15 random published events
  const bannerEvents = useMemo(() => {
    return allEvents
      .filter((e) => e.status === EventStatus.PUBLISHED && e.isFeatured)
      .sort(() => Math.random() - 0.5)
      .slice(0, 15);
  }, [allEvents]);
  const bannerEvent = bannerEvents.length > 0 ? bannerEvents[currentBannerIdx % bannerEvents.length] : null;

  const nextBanner = () => {
    setCurrentBannerIdx((prev) => (prev + 1) % bannerEvents.length);
  };

  const prevBanner = () => {
    setCurrentBannerIdx((prev) => (prev - 1 + bannerEvents.length) % bannerEvents.length);
  };

  useEffect(() => {
    if (bannerEvents.length <= 1) return;
    const interval = setInterval(nextBanner, 6000);
    return () => clearInterval(interval);
  }, [bannerEvents.length]);

  return (
    <div>
      {/* Banner */}
      {loading ? (
        <section className="bg-white">
          <div className="w-full">
            <div className="relative aspect-[16/9] sm:aspect-[21/8] min-h-[220px] sm:min-h-[450px] overflow-hidden animate-shimmer">
              {/* Main Banner Loading Skeleton */}
            </div>
          </div>
        </section>
      ) : bannerEvent ? (
        <section className="bg-white">
          <div className="w-full relative group">
            <Link href={usingDemo ? '#' : `/events/${bannerEvent.slug}`} className="block relative aspect-[16/9] sm:aspect-[21/8] min-h-[220px] sm:min-h-[450px] overflow-hidden bg-black">
              <AnimatePresence initial={false}>
                <motion.img
                  key={bannerEvent.id}
                  src={getImageUrl(bannerEvent.bannerImageUrl || bannerEvent.imageUrl) || '/demo/concert.png'}
                  alt={bannerEvent.title}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, ease: "easeInOut" }}
                  className="absolute inset-0 w-full h-full object-cover block"
                  style={{ objectPosition: bannerEvent.bannerPosition || 'center' }}
                  loading="eager"
                  fetchPriority="high"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/demo/concert.png'; }}
                />
              </AnimatePresence>
            </Link>

            {/* Navigation Arrows (Passline Style: No circle, always visible) */}
            {bannerEvents.length > 1 && (
              <>
                <button 
                  onClick={(e) => { e.preventDefault(); prevBanner(); }}
                  className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-12 h-20 flex items-center justify-center text-white/70 hover:text-white active:scale-90 active:opacity-50 transition-all z-10"
                  aria-label="Previous event"
                >
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button 
                  onClick={(e) => { e.preventDefault(); nextBanner(); }}
                  className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-12 h-20 flex items-center justify-center text-white/70 hover:text-white active:scale-90 active:opacity-50 transition-all z-10"
                  aria-label="Next event"
                >
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </section>
      ) : null}

      {/* Main Bar: Search + Categories + Sort */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
          
          {/* Search (Pill style) */}
          <form onSubmit={handleSearch} className="relative flex items-center bg-white rounded-xl border border-gray-300 w-full lg:w-[450px] shrink-0 transition-all focus-within:border-primary-400 focus-within:shadow-md">
            <div className="pl-4 text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input 
              type="text"
              placeholder={lang === 'es' ? 'Buscar eventos...' : 'Search events...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 py-3 px-3 text-gray-700 focus:outline-none text-sm bg-transparent"
            />
          </form>

          {/* Categories (Scrollable Slider with chevrons) */}
          <div className="flex-1 flex items-center gap-1.5 relative overflow-hidden group/cats px-1">
            {/* Left Button */}
            <button
              type="button"
              onClick={() => scrollCategories('left')}
              className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-primary-500 hover:border-primary-300 shadow-sm transition-all hover:scale-110 active:scale-95 shrink-0"
              aria-label="Scroll Left"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Scrollable Container */}
            <div 
              ref={categoriesRef}
              className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-1 scroll-smooth"
            >
              <button
                onClick={() => setActiveCategory('')}
                className={`category-pill whitespace-nowrap !py-2.5 ${activeCategory === '' ? 'active' : ''}`}
              >
                {t('catAll')}
              </button>
              {displayCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(activeCategory === cat.slug ? '' : cat.slug)}
                  className={`category-pill whitespace-nowrap !py-2.5 ${activeCategory === cat.slug ? 'active' : ''}`}
                >
                  {lang === 'en' ? cat.labelEn : cat.labelEs}
                </button>
              ))}
            </div>

            {/* Right Button */}
            <button
              type="button"
              onClick={() => scrollCategories('right')}
              className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-primary-500 hover:border-primary-300 shadow-sm transition-all hover:scale-110 active:scale-95 shrink-0"
              aria-label="Scroll Right"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Sort (Desktop/Mobile) */}
          <div className="relative shrink-0 w-full lg:w-auto">
            <button 
              onClick={() => setSortOpen(!sortOpen)}
              className="w-full lg:w-auto bg-primary-500 hover:bg-primary-600 text-white font-black text-[10px] py-3 px-5 flex items-center justify-center lg:justify-between gap-2 rounded-xl transition-all shadow-sm tracking-widest uppercase"
            >
              {t('sortBy')}
              <span className="text-[8px] opacity-70">▼</span>
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-2 w-full lg:w-44 bg-white border border-gray-100 rounded-2xl shadow-elevated overflow-hidden z-[60] animate-fade-in-up">
                <div className="px-4 py-2 border-b border-gray-50 bg-gray-50/50">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{lang === 'es' ? 'Ordenar por' : 'Sort by'}</span>
                </div>
                <button
                  onClick={() => { setSortBy('fecha'); setSortOpen(false); }}
                  className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors ${sortBy === 'fecha' ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  📅 {t('date')}
                </button>
                <button
                  onClick={() => { setSortBy('precio'); setSortOpen(false); }}
                  className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors ${sortBy === 'precio' ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  💰 {t('price')}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>



      {/* Events Grid — 4 columns (1 on mobile for larger cards) */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-12 mt-12">
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
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-5">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-gray-200 rounded-lg">
            <HiOutlineTicket className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-bold text-xl text-gray-600 mb-2">{t('noEventsCategory')}</h3>
          </div>
        )}
      </section>
    </div>
  );
}
