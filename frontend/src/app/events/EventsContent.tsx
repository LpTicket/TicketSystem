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
  const [loading, setLoading] = useState(Boolean(searchParams.get('search') || searchParams.get('category') || searchParams.get('page')));
  const [total, setTotal] = useState(initialTotal);
  const rawPage = Number(searchParams.get('page') || 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const category = searchParams.get('category') || '';
  const appliedSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(appliedSearch);
  const [totalPages, setTotalPages] = useState(initialTotalPages);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const firstLoad = useRef(true);

  useEffect(() => { setSearch(appliedSearch); }, [appliedSearch]);

  useEffect(() => {
    // The server supplies only the unfiltered first page.
    if (firstLoad.current) {
      firstLoad.current = false;
      if (page === 1 && !category && !appliedSearch) { setLoading(false); return; }
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    api.get<EventsResponse>('/events', {
      params: { page, limit: 12, category: category || undefined, search: appliedSearch || undefined },
      signal: controller.signal,
    }).then(({ data }) => {
      if (controller.signal.aborted) return;
      setEvents(data.events);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    }).catch(() => {
      if (!controller.signal.aborted) setError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [page, category, appliedSearch, retry]);

  const updateFilters = (changes: { page?: number; category?: string; search?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (!value || (key === 'page' && value === 1)) params.delete(key);
      else params.set(key, String(value));
    });
    const nextUrl = `/events${params.size ? `?${params}` : ''}`;
    if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.pushState(null, '', nextUrl);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({ search: search.trim(), page: 1 });
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-14">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">{lang === 'es' ? 'Eventos' : 'Events'}</h1>
        <p className="mt-2 text-sm text-slate-400">{lang === 'es' ? 'Encuentra tu próxima experiencia.' : 'Find your next experience.'}</p>
      </div>
      {/* Main Bar: Search + Categories */}
      <div className="events-filter-bar relative flex flex-col lg:flex-row items-stretch lg:items-center gap-3 p-3 mb-8">

        {/* Search */}
        <form onSubmit={handleSearch} className="events-search-form relative flex items-center rounded-xl border border-[rgba(246,198,95,0.18)] bg-[rgba(5,17,31,0.7)] w-full lg:w-[450px] shrink-0 transition-all focus-within:border-primary-500">
          <div className="events-search-icon text-gray-400">
            <HiOutlineSearch className="w-4 h-4 text-primary-400" />
          </div>
          <input
            type="search"
            aria-label={lang === 'es' ? 'Buscar eventos' : 'Search events'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'es' ? 'Buscar eventos...' : 'Search events...'}
            className="min-w-0 flex-1 py-3 px-3 text-white placeholder-gray-500 focus:outline-none text-sm bg-transparent"
          />
          <button type="submit" className="px-4 py-3 text-sm font-medium text-primary-400">{lang === 'es' ? 'Buscar' : 'Search'}</button>
        </form>

        {/* Categories (Scrollable) */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => updateFilters({ category: '', page: 1 })}
            aria-pressed={!category}
            className={`category-pill whitespace-nowrap !py-2.5 !text-[0.76rem] !font-normal ${!category ? 'active' : ''}`}
          >
            {lang === 'es' ? 'Todos' : 'All'}
          </button>
          {categories.filter((cat) => cat.slug !== 'todos' && cat.slug !== 'todas').map((cat) => (
            <button
              key={cat.slug}
              onClick={() => updateFilters({ category: cat.slug, page: 1 })}
              aria-pressed={category === cat.slug}
              className={`category-pill whitespace-nowrap !py-2.5 !text-[0.76rem] !font-normal ${category === cat.slug ? 'active' : ''}`}
            >
              {lang === 'en' ? cat.labelEn : cat.labelEs}
            </button>
          ))}
        </div>
      </div>

      <p role="status" className="text-sm text-gray-400 mb-4">{loading ? (lang === 'es' ? 'Buscando… ' : 'Searching… ') : error ? '' : <>{total} {lang === 'es' ? (total === 1 ? 'evento encontrado' : 'eventos encontrados') : (total === 1 ? 'event found' : 'events found')}</>}</p>

      {/* Grid */}
      <div className="mt-6" aria-busy={loading}>
        {loading ? (
          <div role="status" className="py-20 text-center text-slate-400">{lang === 'es' ? 'Cargando eventos…' : 'Loading events…'}</div>
        ) : error ? (
          <div role="alert" className="py-16 text-center space-y-4">
            <p className="text-slate-300">{lang === 'es' ? 'No pudimos cargar los eventos. Inténtalo de nuevo.' : 'We could not load events. Please try again.'}</p>
            <button onClick={() => setRetry(value => value + 1)} className="btn-secondary">{lang === 'es' ? 'Reintentar' : 'Retry'}</button>
          </div>
        ) : events.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {events.map((event, idx) => <EventCard key={event.id} event={event} priority={idx < 8} returnTo={`/events${searchParams.size ? `?${searchParams}` : ''}`} />)}
          </div>
        ) : (
          <div className="text-center py-20 border border-gray-200 rounded-lg"><p className="text-gray-500">{lang === 'es' ? 'No se encontraron eventos' : 'No events found'}</p></div>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-10">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => updateFilters({ page: p })} aria-current={p === page ? 'page' : undefined} aria-label={`${lang === 'es' ? 'Página' : 'Page'} ${p}`} className={`w-9 h-9 rounded text-sm font-medium transition-all ${p === page ? 'bg-primary-500 text-white' : 'bg-[rgba(8,31,51,0.8)] text-gray-300 border border-[rgba(246,198,95,0.14)] hover:border-primary-500 hover:text-white'}`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
