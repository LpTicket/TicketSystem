'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import EventCard from '@/components/events/EventCard';
import { Event, EventsResponse } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { useLang } from '@/context/LanguageContext';
import { HiOutlineSearch } from 'react-icons/hi';

interface EventsContentProps {
  initialEvents: Event[];
  initialTotal: number;
  initialTotalPages: number;
}

export default function EventsContent({ initialEvents, initialTotal, initialTotalPages }: EventsContentProps) {
  const searchParams = useSearchParams();
  const { lang } = useLang();
  const { categories } = useCategories();
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');

  // Skip the initial mount fetch — the server component already supplied
  // initialEvents via ISR. Only refetch on actual user interaction.
  const skipNextLoad = useRef(true);

  useEffect(() => {
    if (skipNextLoad.current) {
      skipNextLoad.current = false;
      return;
    }
    loadEvents();
  }, [page, category]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 12 };
      if (category) params.category = category;
      if (search) params.search = search;
      const { data } = await api.get<EventsResponse>('/events', { params });
      setEvents(data.events);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); loadEvents(); };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-14">
      {/* Main Bar: Search + Categories */}
      <div className="events-filter-bar relative flex flex-col lg:flex-row items-stretch lg:items-center gap-3 p-3 mb-8">

        {/* Search */}
        <form onSubmit={handleSearch} className="events-search-form relative flex items-center rounded-xl border border-[rgba(246,198,95,0.18)] bg-[rgba(5,17,31,0.7)] w-full lg:w-[450px] shrink-0 transition-all focus-within:border-primary-500">
          <div className="events-search-icon text-gray-400">
            <HiOutlineSearch className="w-4 h-4 text-primary-400" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'es' ? 'Buscar eventos...' : 'Search events...'}
            className="flex-1 py-3 px-3 text-white placeholder-gray-500 focus:outline-none text-sm bg-transparent"
          />
        </form>

        {/* Categories (Scrollable) */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => { setCategory(''); setPage(1); }}
            className={`category-pill whitespace-nowrap !py-2 text-[0.76rem] font-bold ${!category ? 'active' : ''}`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => { setCategory(cat.slug); setPage(1); }}
              className={`category-pill whitespace-nowrap !py-2 text-[0.76rem] font-bold ${category === cat.slug ? 'active' : ''}`}
            >
              {lang === 'en' ? cat.labelEn : cat.labelEs}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-4">{total} {lang === 'es' ? (total === 1 ? 'evento encontrado' : 'eventos encontrados') : (total === 1 ? 'event found' : 'events found')}</p>

      {/* Grid */}
      <div className="mt-12">
        {events.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {events.map((event, idx) => <EventCard key={event.id} event={event} priority={idx < 8} />)}
          </div>
        ) : (
          <div className="text-center py-20 border border-gray-200 rounded-lg"><p className="text-gray-500">{lang === 'es' ? 'No se encontraron eventos' : 'No events found'}</p></div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={`w-9 h-9 rounded text-sm font-medium transition-all ${p === page ? 'bg-primary-500 text-white' : 'bg-[rgba(8,31,51,0.8)] text-gray-300 border border-[rgba(246,198,95,0.14)] hover:border-primary-500 hover:text-white'}`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
