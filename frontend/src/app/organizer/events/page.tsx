'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { parseSafeDate, formatDateInTimezone } from '@/lib/dateUtils';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { Event } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import {
  HiOutlinePlusCircle,
  HiOutlineChartBar,
  HiOutlineDownload,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineGlobe,
  HiOutlineCalendar,
  HiOutlineSearch,
} from 'react-icons/hi';

export default function OrganizerEventsPage() {
  const { user } = useAuthStore();
  const { t, lang } = useLang();
  const { getCategoryInfo } = useCategories();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    try {
      const { data } = await api.get('/events', { params: { limit: 100, includePast: 'true' } });
      setEvents((data.events || []).filter((e: Event) => e.organizerId === user?.id));
    } catch {} finally { setLoading(false); }
  };

  const handlePublish = async (id: string) => {
    try {
      await api.post(`/events/${id}/publish`);
      await loadEvents();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(lang === 'es' ? '¿Estás seguro de eliminar este evento?' : 'Are you sure you want to delete this event?')) return;
    try {
      await api.delete(`/events/${id}`);
      await loadEvents();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error');
    }
  };

  const exportCSV = async (id: string) => {
    try {
      const { data } = await api.get(`/orders/event/${id}/attendees`);
      const csv = [
        'Name,Email,Section,Row,Seat,Code',
        ...data.map((t: any) => `${t.user?.firstName} ${t.user?.lastName},${t.user?.email},${t.sectionName},${t.rowLabel},${t.seatNumber},${t.ticketCode}`)
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `attendees-${id}.csv`;
      a.click();
    } catch {}
  };

  const dateFnsLocale = lang === 'es' ? es : enUS;

  const filteredEvents = events
    .filter((e) => filter === 'all' || e.status === filter)
    .filter((e) => !search || e.title.toLowerCase().includes(search.toLowerCase()));

  const getStatusBadge = (status: string, isPast: boolean) => {
    if (isPast) {
      return { label: lang === 'es' ? 'Finalizado' : 'Ended', classes: 'bg-gray-100 text-gray-500 border border-gray-200' };
    }
    switch (status) {
      case 'published': return { label: t('orgPublished'), classes: 'bg-green-100 text-green-700' };
      case 'draft': return { label: t('orgDraft'), classes: 'bg-yellow-100 text-yellow-700' };
      case 'pending_approval': return { label: t('orgPending'), classes: 'bg-blue-100 text-blue-700' };
      case 'cancelled': return { label: t('orgCancelled'), classes: 'bg-red-100 text-red-700' };
      default: return { label: status, classes: 'bg-gray-100 text-gray-700' };
    }
  };

  const statusFilters = [
    { key: 'all', label: lang === 'es' ? 'Todos' : 'All' },
    { key: 'draft', label: t('orgDraft') },
    { key: 'published', label: t('orgPublished') },
    { key: 'cancelled', label: t('orgCancelled') },
  ];

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        <div className="h-8 skeleton rounded w-1/4 mb-6" />
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 skeleton rounded" />)}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Alert Banner / Cartel */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 lg:p-5 flex items-start gap-3.5 shadow-sm select-none">
        <div className="bg-amber-100 rounded-xl p-2 shrink-0 text-amber-800 text-lg">
          🔔
        </div>
        <div>
          <h4 className="font-bold text-sm text-amber-900">
            {lang === 'es' ? 'Recordatorio Importante sobre la Publicación de Eventos' : 'Important Event Publication Reminder'}
          </h4>
          <p className="text-xs text-amber-800/90 mt-1 leading-relaxed">
            {lang === 'es' 
              ? 'Cuando creas o editas un evento, este se guardará en estado de borrador (Draft). Debes esperar a que el administrador de la plataforma apruebe y autorice tu evento para que aparezca publicado al público general.' 
              : 'When you create or edit an event, it will be saved as a draft (Draft). You must wait for the platform administrator to approve and authorize your event before it is published to the general public.'}
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="font-bold text-2xl text-gray-900">{t('orgMyEvents')}</h1>
        <Link href="/organizer/events/create" className="btn-primary text-sm inline-flex items-center gap-2 self-start">
          <HiOutlinePlusCircle className="w-5 h-5" />
          {t('orgCreateEvent')}
        </Link>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                filter === f.key
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={lang === 'es' ? 'Buscar eventos...' : 'Search events...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Events Table */}
      {filteredEvents.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('orgEventTitle')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('orgCategory')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('date')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('orgVenue')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{lang === 'es' ? 'Estado' : 'Status'}</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{lang === 'es' ? 'Acciones' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEvents.map((ev) => {
                  const isPast = parseSafeDate(ev.eventDate).getTime() < Date.now();
                  const badge = getStatusBadge(ev.status, isPast);
                  const catInfo = getCategoryInfo(ev.category);
                  const catLabel = catInfo ? (lang === 'en' ? catInfo.labelEn : catInfo.labelEs) : ev.category;
                  return (
                    <tr key={ev.id} className={`hover:bg-gray-50 transition-colors ${isPast ? 'opacity-60 bg-gray-50/20' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center ${isPast ? 'grayscale' : ''}`}>
                            {ev.imageUrl ? (
                              <img src={ev.imageUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-lg">{catInfo?.icon || '🎫'}</span>
                            )}
                          </div>
                          <span className={`font-medium text-gray-900 text-sm truncate max-w-[200px] ${isPast ? 'line-through text-gray-400' : ''}`}>{ev.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          {catInfo?.icon || '🎫'} {catLabel}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {formatDateInTimezone(ev.eventDate, ev.eventTimezone || 'UTC', lang === 'es' ? 'es' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 truncate max-w-[150px]">{ev.venueName}</td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.classes}`}>{badge.label}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {ev.status === 'draft' && !isPast && (
                            <button
                              onClick={() => handlePublish(ev.id)}
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
                              title={t('orgSendApproval')}
                            >
                              <HiOutlineGlobe className="w-4 h-4" />
                            </button>
                          )}
                          <Link href={`/organizer/events/${ev.id}`} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors" title={t('orgEditEvent')}>
                            <HiOutlinePencil className="w-4 h-4" />
                          </Link>
                          <button onClick={() => exportCSV(ev.id)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors" title={t('orgExportCSV')}>
                            <HiOutlineDownload className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(ev.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors" title={t('orgDeleteEvent')}>
                            <HiOutlineTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filteredEvents.map((ev) => {
              const isPast = parseSafeDate(ev.eventDate).getTime() < Date.now();
              const badge = getStatusBadge(ev.status, isPast);
              const catInfo = getCategoryInfo(ev.category);
              return (
                <div key={ev.id} className={`p-4 space-y-3 ${isPast ? 'opacity-60 bg-gray-50/20' : ''}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center ${isPast ? 'grayscale' : ''}`}>
                      {ev.imageUrl ? (
                        <img src={ev.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">{catInfo?.icon || '🎫'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold text-gray-900 text-sm truncate ${isPast ? 'line-through text-gray-400' : ''}`}>{ev.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        📅 {formatDateInTimezone(ev.eventDate, ev.eventTimezone || 'UTC', lang === 'es' ? 'es' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })} · 📍 {ev.venueName}
                      </p>
                      <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${badge.classes}`}>{badge.label}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {ev.status === 'draft' && !isPast && (
                      <button onClick={() => handlePublish(ev.id)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                        <HiOutlineGlobe className="w-3.5 h-3.5" /> {t('orgSendApproval')}
                      </button>
                    )}
                    <Link href={`/organizer/events/${ev.id}`} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1">
                      <HiOutlinePencil className="w-3.5 h-3.5" /> {t('orgEditEvent')}
                    </Link>
                    <button onClick={() => exportCSV(ev.id)} className="btn-secondary text-xs py-1.5 px-3">
                      <HiOutlineDownload className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-16 text-center">
          <HiOutlineCalendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-4">{t('orgNoEvents')}</p>
          <Link href="/organizer/events/create" className="btn-primary text-sm inline-flex items-center gap-2">
            <HiOutlinePlusCircle className="w-5 h-5" />
            {t('orgCreateFirst')}
          </Link>
        </div>
      )}
    </div>
  );
}
