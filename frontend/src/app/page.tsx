'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';
import EventCard from '@/components/events/EventCard';
import { Event, EventStatus } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineTicket } from 'react-icons/hi';

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

  const displayCategories = categories.slice(0, 5);
  const filteredEvents = activeCategory
    ? allEvents.filter((e) => e.category === activeCategory)
    : allEvents;

  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState('fecha');
  const [categoryOpen, setCategoryOpen] = useState(false);

  // Featured event for banner
  const featuredEvents = allEvents.filter((e) => e.isFeatured);
  const bannerEvents = featuredEvents.length > 0 ? featuredEvents : (allEvents.length > 0 ? [allEvents[0]] : []);
  const bannerEvent = bannerEvents.length > 0 ? bannerEvents[currentBannerIdx % bannerEvents.length] : null;

  useEffect(() => {
    if (bannerEvents.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBannerIdx((prev) => (prev + 1) % bannerEvents.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [bannerEvents.length]);

  return (
    <div>
      {/* Banner */}
      {loading ? (
        <section className="bg-white">
          <div className="max-w-[1400px] mx-auto">
            <div className="relative aspect-[21/8] overflow-hidden bg-gray-100 animate-pulse flex items-center">
              <div className="pl-6 sm:pl-16 max-w-lg space-y-3 w-full">
                <div className="h-8 sm:h-12 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-9 sm:h-11 bg-gray-200 rounded w-1/3" />
              </div>
            </div>
          </div>
          <div className="hidden sm:flex justify-center gap-1.5 py-4 bg-white max-w-[1400px] mx-auto flex-wrap px-4">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="h-1 w-6 sm:w-8 bg-gray-100 animate-pulse" />
            ))}
          </div>
        </section>
      ) : bannerEvent ? (
        <section className="bg-white">
          <div className="max-w-[1400px] mx-auto">
            <Link href={usingDemo ? '#' : `/events/${bannerEvent.slug}`} className="block">
              <div className="relative aspect-[21/8] overflow-hidden">
                <img
                  src={bannerEvent.bannerImageUrl || bannerEvent.imageUrl || '/demo/concert.png'}
                  alt={bannerEvent.title}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = '/demo/concert.png'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent flex items-center">
                  <div className="pl-6 sm:pl-16 max-w-lg">
                    <h2 className="text-white text-xl sm:text-4xl font-bold leading-tight drop-shadow-lg">{bannerEvent.title}</h2>
                    <p className="hidden sm:block text-white/80 mt-2 text-sm sm:text-base">{bannerEvent.venueName}</p>
                    <span className="inline-block mt-3 sm:mt-4 btn-primary text-xs sm:text-sm px-4 py-1.5 sm:px-5 sm:py-2.5">{t('buyTickets')}</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
          {/* Dashes indicator (mdticket style) — hidden on mobile */}
          <div className="hidden sm:flex justify-center gap-1.5 py-4 bg-white max-w-[1400px] mx-auto flex-wrap px-4">
            {bannerEvents.length > 1 ? (
              bannerEvents.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentBannerIdx(i)}
                  className={`h-1 w-6 sm:w-8 transition-colors ${i === currentBannerIdx % bannerEvents.length ? 'bg-primary-500' : 'bg-[#e5d4c8] hover:bg-primary-300'}`}
                />
              ))
            ) : (
              [...Array(20)].map((_, i) => (
                <div key={i} className={`h-1 w-6 sm:w-8 ${i === 0 ? 'bg-primary-500' : 'bg-[#e5d4c8]'}`} />
              ))
            )}
          </div>
        </section>
      ) : null}


      {/* Category pills & Sort */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center gap-4">
          
          {/* Desktop Categories */}
          <div className="hidden sm:flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory('')}
              className={`category-pill ${activeCategory === '' ? 'active' : ''}`}
            >
              {t('catAll')}
            </button>
            {displayCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(activeCategory === cat.slug ? '' : cat.slug)}
                className={`category-pill ${activeCategory === cat.slug ? 'active' : ''}`}
              >
                {lang === 'en' ? cat.labelEn : cat.labelEs}
              </button>
            ))}
          </div>

          {/* Mobile Categories Dropdown */}
          <div className="sm:hidden relative">
            <button 
              onClick={() => setCategoryOpen(!categoryOpen)}
              className="bg-white border border-primary-500 text-primary-500 text-sm py-2 px-4 flex items-center gap-2 font-bold"
            >
              {t('categories')}
              <span className="text-xs">▼</span>
            </button>
            {categoryOpen && (
              <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-20 animate-fade-in">
                <button
                  onClick={() => { setActiveCategory(''); setCategoryOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm ${activeCategory === '' ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {t('catAll')}
                </button>
                {displayCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveCategory(activeCategory === cat.slug ? '' : cat.slug); setCategoryOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm ${activeCategory === cat.slug ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'}`}
                  >
                    {lang === 'en' ? cat.labelEn : cat.labelEs}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button 
              onClick={() => setSortOpen(!sortOpen)}
              className="btn-primary text-sm py-2 px-4 flex items-center gap-2"
            >
              {t('sortBy')}
              <span className="text-xs">▼</span>
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-20 animate-fade-in">
                <button
                  onClick={() => { setSortBy('fecha'); setSortOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm ${sortBy === 'fecha' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {t('date')}
                </button>
                <button
                  onClick={() => { setSortBy('precio'); setSortOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm ${sortBy === 'precio' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  {t('price')}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Events Grid — 4 columns */}
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card"><div className="aspect-[3/4] skeleton" /><div className="p-4 space-y-2"><div className="h-4 skeleton rounded w-3/4" /><div className="h-3 skeleton rounded w-1/2" /><div className="h-9 skeleton rounded mt-2" /></div></div>
            ))}
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
