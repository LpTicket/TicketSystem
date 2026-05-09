'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { Event } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import {
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineSearch,
  HiOutlineCalendar,
  HiOutlineTrash,
  HiOutlinePencilAlt,
  HiOutlineStar,
  HiStar,
} from 'react-icons/hi';
import Link from 'next/link';

export default function AdminEventsPage() {
  const { t, lang } = useLang();
  const [events, setEvents] = useState<Event[]>([]);
  const { getCategoryInfo } = useCategories();
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { loadEvents(); }, [page, filter]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15 };
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/admin/events', { params });
      setEvents(data.events);
      setTotal(data.total);
    } catch {} finally { setLoading(false); }
  };

  const handleApprove = async (id: string) => {
    try { await api.patch(`/admin/events/${id}/approve`); await loadEvents(); }
    catch (err: any) { alert(err.response?.data?.message || 'Error'); }
  };

  const handleReject = async (id: string) => {
    if (!confirm(lang === 'es' ? '¿Rechazar este evento?' : 'Reject this event?')) return;
    try { await api.patch(`/admin/events/${id}/reject`); await loadEvents(); }
    catch (err: any) { alert(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(lang === 'es' ? `¿Estás seguro de eliminar el evento "${title}"?` : `Are you sure you want to delete "${title}"?`)) return;
    try { await api.delete(`/admin/events/${id}`); await loadEvents(); }
    catch (err: any) { alert(err.response?.data?.message || 'Error'); }
  };

  const handleToggleFeatured = async (id: string) => {
    try {
      await api.patch(`/admin/events/${id}/toggle-featured`);
      await loadEvents();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error');
    }
  };

  const dateFnsLocale = lang === 'es' ? es : enUS;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published': return { label: t('adminPublished'), classes: 'bg-green-100 text-green-700' };
      case 'draft': return { label: lang === 'es' ? 'Borrador' : 'Draft', classes: 'bg-yellow-100 text-yellow-700' };
      case 'cancelled': return { label: lang === 'es' ? 'Rechazado' : 'Rejected', classes: 'bg-red-100 text-red-700' };
      default: return { label: status, classes: 'bg-gray-100 text-gray-700' };
    }
  };

  const statusFilters = [
    { key: 'all', label: lang === 'es' ? 'Todos' : 'All' },
    { key: 'draft', label: t('adminDrafts') },
    { key: 'published', label: t('adminPublished') },
    { key: 'cancelled', label: lang === 'es' ? 'Rechazados' : 'Rejected' },
  ];

  const filteredEvents = events.filter((e) => !search || e.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="font-bold text-2xl text-gray-900">{t('adminEventManagement')}</h1>
        <p className="text-sm text-gray-500 mt-1">{lang === 'es' ? 'Aprueba, rechaza y gestiona los eventos de la plataforma' : 'Approve, reject and manage platform events'}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
                filter === f.key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
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
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
      </div>

      {/* Events Table */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 skeleton rounded-lg" />)}</div>
      ) : filteredEvents.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{lang === 'es' ? 'Evento' : 'Event'}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('adminOrganizer')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{lang === 'es' ? 'Fecha' : 'Date'}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{lang === 'es' ? 'Estado' : 'Status'}</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">{t('adminActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEvents.map((ev) => {
                  const badge = getStatusBadge(ev.status);
                  const catInfo = getCategoryInfo(ev.category);
                  const catLabel = catInfo ? (lang === 'en' ? catInfo.labelEn : catInfo.labelEs) : ev.category;
                  return (
                    <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg shrink-0">
                            {catInfo?.icon || '🎫'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate max-w-[200px]">{ev.title}</p>
                            <p className="text-xs text-gray-500">{catLabel} · {ev.venueName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {ev.organizer ? `${ev.organizer.firstName} ${ev.organizer.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {format(new Date(ev.eventDate), "dd MMM yyyy", { locale: dateFnsLocale })}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.classes}`}>{badge.label}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {ev.status === 'draft' && (
                            <>
                              <button
                                onClick={() => handleApprove(ev.id)}
                                className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors flex items-center gap-1"
                              >
                                <HiOutlineCheckCircle className="w-4 h-4" />
                                {t('adminApprove')}
                              </button>
                              <button
                                onClick={() => handleReject(ev.id)}
                                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors flex items-center gap-1"
                              >
                                <HiOutlineXCircle className="w-4 h-4" />
                                {t('adminReject')}
                              </button>
                            </>
                          )}
                          {ev.status === 'published' && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-green-600 font-semibold flex items-center gap-1 mr-1">
                                <HiOutlineCheckCircle className="w-4 h-4" /> {t('adminPublished')}
                              </span>
                              <button
                                onClick={() => handleToggleFeatured(ev.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 active:scale-95 ${
                                  ev.isFeatured
                                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200 shadow-sm'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'
                                }`}
                                title={lang === 'es' ? 'Mostrar en banner de inicio' : 'Show in homepage banner'}
                              >
                                {ev.isFeatured ? <HiStar className="w-4.5 h-4.5 text-amber-500 fill-amber-500 shrink-0" /> : <HiOutlineStar className="w-4.5 h-4.5 text-gray-500 shrink-0" />}
                                <span>{ev.isFeatured ? (lang === 'es' ? 'Banner Activo' : 'Banner Active') : (lang === 'es' ? 'Poner Banner' : 'Set Banner')}</span>
                              </button>
                            </div>
                          )}
                          <Link
                            href={`/organizer/events/${ev.id}`}
                            className="p-1.5 rounded-lg transition-colors text-blue-500 hover:bg-blue-50"
                            title={lang === 'es' ? 'Editar evento' : 'Edit event'}
                          >
                            <HiOutlinePencilAlt className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(ev.id, ev.title)}
                            className="p-1.5 rounded-lg transition-colors text-red-500 hover:bg-red-50"
                            title={lang === 'es' ? 'Eliminar evento' : 'Delete event'}
                          >
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

          {/* Pagination */}
          {total > 15 && (
            <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500">{total} {lang === 'es' ? 'eventos' : 'events'}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-50">{lang === 'es' ? 'Anterior' : 'Previous'}</button>
                <button onClick={() => setPage(page + 1)} disabled={events.length < 15} className="px-3 py-1 text-xs border rounded hover:bg-white disabled:opacity-50">{lang === 'es' ? 'Siguiente' : 'Next'}</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-16 text-center">
          <HiOutlineCalendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">{t('adminNoEvents')}</p>
        </div>
      )}
    </div>
  );
}
