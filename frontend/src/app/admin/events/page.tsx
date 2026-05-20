'use client';

import { useState, useEffect } from 'react';
import api, { getImageUrl } from '@/lib/api';
import { formatDateInTimezone } from '@/lib/dateUtils';
import toast from 'react-hot-toast';
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
  HiOutlineCog,
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
  const [selectedEventForChanges, setSelectedEventForChanges] = useState<Event | null>(null);
  const [processingField, setProcessingField] = useState<string | null>(null);

  // Fee configuration state
  const [selectedEventForFees, setSelectedEventForFees] = useState<Event | null>(null);
  const [eventFeeConfig, setEventFeeConfig] = useState<any>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeSaving, setFeeSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'sections'>('global');

  const handleOpenFeesModal = async (ev: Event) => {
    setSelectedEventForFees(ev);
    setFeeLoading(true);
    setActiveTab('global');
    try {
      const { data } = await api.get(`/admin/events/${ev.id}/fees`);
      // Ensure numeric fields are strings or empty for clean controlled inputs
      const eventData = {
        ...data.event,
        serviceFeePercent: data.event.serviceFeePercent ?? '',
        serviceFeeFixedPerTicket: data.event.serviceFeeFixedPerTicket ?? '',
        processingFeePercent: data.event.processingFeePercent ?? '',
        processingFeeFixedPerTicket: data.event.processingFeeFixedPerTicket ?? '',
      };
      const sectionsData = data.sections.map((sec: any) => ({
        ...sec,
        serviceFeePercent: sec.serviceFeePercent ?? '',
        serviceFeeFixedPerTicket: sec.serviceFeeFixedPerTicket ?? '',
        processingFeePercent: sec.processingFeePercent ?? '',
        processingFeeFixedPerTicket: sec.processingFeeFixedPerTicket ?? '',
      }));
      setEventFeeConfig({ event: eventData, sections: sectionsData });
    } catch (err: any) {
      toast.error(lang === 'es' ? 'Error al cargar configuración de fees' : 'Error loading fees configuration');
    } finally {
      setFeeLoading(false);
    }
  };

  const handleSaveEventFees = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventForFees || !eventFeeConfig) return;
    setFeeSaving(true);
    try {
      const { event } = eventFeeConfig;
      await api.patch(`/admin/events/${event.id}/fees`, {
        serviceFeePercent: event.serviceFeePercent !== '' ? Number(event.serviceFeePercent) : null,
        serviceFeeFixedPerTicket: event.serviceFeeFixedPerTicket !== '' ? Number(event.serviceFeeFixedPerTicket) : null,
        processingFeePercent: event.processingFeePercent !== '' ? Number(event.processingFeePercent) : null,
        processingFeeFixedPerTicket: event.processingFeeFixedPerTicket !== '' ? Number(event.processingFeeFixedPerTicket) : null,
      });
      toast.success(lang === 'es' ? 'Fees del evento guardados con éxito' : 'Event fees saved successfully');
      await loadEvents();
    } catch (err: any) {
      toast.error(lang === 'es' ? 'Error al guardar fees' : 'Error saving fees');
    } finally {
      setFeeSaving(false);
    }
  };

  const handleSaveSectionFees = async (sectionId: string, sectionData: any) => {
    setFeeSaving(true);
    try {
      await api.patch(`/admin/sections/${sectionId}/fees`, {
        serviceFeePercent: sectionData.serviceFeePercent !== '' && sectionData.serviceFeePercent !== null ? Number(sectionData.serviceFeePercent) : null,
        serviceFeeFixedPerTicket: sectionData.serviceFeeFixedPerTicket !== '' && sectionData.serviceFeeFixedPerTicket !== null ? Number(sectionData.serviceFeeFixedPerTicket) : null,
        processingFeePercent: sectionData.processingFeePercent !== '' && sectionData.processingFeePercent !== null ? Number(sectionData.processingFeePercent) : null,
        processingFeeFixedPerTicket: sectionData.processingFeeFixedPerTicket !== '' && sectionData.processingFeeFixedPerTicket !== null ? Number(sectionData.processingFeeFixedPerTicket) : null,
      });
      toast.success(lang === 'es' ? 'Fees de sección guardados con éxito' : 'Section fees saved successfully');
    } catch (err: any) {
      toast.error(lang === 'es' ? 'Error al guardar fees de sección' : 'Error saving section fees');
    } finally {
      setFeeSaving(false);
    }
  };

  const hasPendingChanges = (ev: Event) => {
    return !!(
      ev.pendingTitle ||
      ev.pendingDescription ||
      ev.pendingImageUrl ||
      ev.pendingBannerImageUrl ||
      ev.pendingVenueName ||
      ev.pendingCategory ||
      ev.pendingEventDate
    );
  };

  const handleApproveField = async (eventId: string, field: string) => {
    setProcessingField(field);
    try {
      await api.patch(`/admin/events/${eventId}/approve-change`, { field });
      toast.success(lang === 'es' ? '¡Cambio aprobado con éxito!' : 'Change approved successfully!');
      
      const params: any = { page, limit: 15 };
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/admin/events', { params });
      setEvents(data.events);
      
      const updated = data.events.find((e: any) => e.id === eventId);
      setSelectedEventForChanges(updated || null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setProcessingField(null);
    }
  };

  const handleRejectField = async (eventId: string, field: string) => {
    setProcessingField(field);
    try {
      await api.patch(`/admin/events/${eventId}/reject-change`, { field });
      toast.success(lang === 'es' ? '¡Cambio rechazado con éxito!' : 'Change rejected successfully!');
      
      const params: any = { page, limit: 15 };
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/admin/events', { params });
      setEvents(data.events);
      
      const updated = data.events.find((e: any) => e.id === eventId);
      setSelectedEventForChanges(updated || null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setProcessingField(null);
    }
  };

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

  const handleApproveAll = async (eventId: string) => {
    if (!selectedEventForChanges) return;
    const fields = [];
    if (selectedEventForChanges.pendingTitle) fields.push('title');
    if (selectedEventForChanges.pendingDescription) fields.push('description');
    if (selectedEventForChanges.pendingImageUrl) fields.push('imageUrl');
    if (selectedEventForChanges.pendingBannerImageUrl) fields.push('bannerImageUrl');
    if (selectedEventForChanges.pendingVenueName) fields.push('venueName');
    if (selectedEventForChanges.pendingCategory) fields.push('category');
    if (selectedEventForChanges.pendingEventDate) fields.push('eventDate');

    if (fields.length === 0) return;

    setProcessingField('all');
    try {
      await Promise.all(fields.map(field => api.patch(`/admin/events/${eventId}/approve-change`, { field })));
      toast.success(lang === 'es' ? 'Todos los cambios han sido aprobados' : 'All changes approved');
      setSelectedEventForChanges(null);
      await loadEvents();
    } catch (err) {
      toast.error(lang === 'es' ? 'Error al aprobar todos los cambios' : 'Error approving all changes');
    } finally {
      setProcessingField(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published': return { label: t('adminPublished'), classes: 'bg-green-100 text-green-700' };
      case 'draft': return { label: lang === 'es' ? 'Borrador' : 'Draft', classes: 'bg-yellow-100 text-yellow-700' };
      case 'pending_approval': return { label: lang === 'es' ? 'Por Aprobar' : 'Pending Approval', classes: 'bg-blue-100 text-blue-700' };
      case 'cancelled': return { label: lang === 'es' ? 'Rechazado' : 'Rejected', classes: 'bg-red-100 text-red-700' };
      default: return { label: status, classes: 'bg-gray-100 text-gray-700' };
    }
  };

  const statusFilters = [
    { key: 'all', label: lang === 'es' ? 'Todos' : 'All' },
    { key: 'pending_approval', label: lang === 'es' ? 'Pendientes de Aprobación' : 'Pending Approval' },
    { key: 'draft', label: t('adminDrafts') },
    { key: 'published', label: t('adminPublished') },
    { key: 'cancelled', label: lang === 'es' ? 'Rechazados' : 'Rejected' },
  ];

  const filteredEvents = events.filter((e) => !search || e.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="font-bold text-2xl text-gray-900">{t('adminEventManagement')}</h1>
        <p className="text-sm text-gray-500 mt-1">{lang === 'es' ? 'Aprueba, rechaza y gestiona los eventos de la plataforma' : 'Approve, reject and manage platform events'}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`flex-1 sm:flex-none justify-center px-3.5 py-2.5 sm:py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap active:scale-95 ${
                filter === f.key ? 'bg-gray-900 text-white font-bold shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
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

      {/* Events Table/Cards Container */}
      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 skeleton rounded-lg" />)}</div>
      ) : filteredEvents.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('adminEventTitle' as any)}</th>
                  <th className="text-left px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('adminCategory' as any)}</th>
                  <th className="text-left px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('adminDate' as any)}</th>
                  <th className="text-center px-4 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{lang === 'es' ? 'Estado' : 'Status'}</th>
                  <th className="text-right px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">{lang === 'es' ? 'Acciones' : 'Actions'}</th>
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
                          <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                            {ev.imageUrl ? (
                              <img src={getImageUrl(ev.imageUrl)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-lg">{catInfo?.icon || '🎫'}</span>
                            )}
                          </div>
                          <span className="font-medium text-gray-900 text-sm truncate max-w-[200px]">{ev.title}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {catLabel}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {formatDateInTimezone(ev.eventDate, ev.eventTimezone || 'UTC', lang === 'es' ? 'es' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${badge.classes}`}>{badge.label}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(ev.status === 'draft' || ev.status === 'pending_approval') && (
                            <>
                              <button
                                onClick={() => handleApprove(ev.id)}
                                className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium hover:bg-green-100 transition-colors flex items-center gap-1"
                              >
                                <HiOutlineCheckCircle className="w-4 h-4" />
                                {t('adminApprove' as any)}
                              </button>
                              <button
                                onClick={() => handleReject(ev.id)}
                                className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100 transition-colors flex items-center gap-1"
                              >
                                <HiOutlineXCircle className="w-4 h-4" />
                                {t('adminReject' as any)}
                              </button>
                            </>
                          )}
                          {ev.status === 'published' && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleToggleFeatured(ev.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 active:scale-95 ${
                                  ev.isFeatured
                                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200 shadow-sm'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'
                                }`}
                              >
                                {ev.isFeatured ? <HiStar className="w-4.5 h-4.5 text-amber-500 fill-amber-500 shrink-0" /> : <HiOutlineStar className="w-4.5 h-4.5 text-gray-500 shrink-0" />}
                                <span>{ev.isFeatured ? (lang === 'es' ? 'Banner Activo' : 'Banner Active') : (lang === 'es' ? 'Poner Banner' : 'Set Banner')}</span>
                              </button>
                            </div>
                          )}
                          {hasPendingChanges(ev) && (
                            <button
                              onClick={() => setSelectedEventForChanges(ev)}
                              className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors flex items-center gap-1 shrink-0 shadow-sm border border-amber-200"
                              title={lang === 'es' ? 'Aprobar o Rechazar Cambios' : 'Approve or Reject Changes'}
                            >
                              <HiOutlineCheckCircle className="w-4 h-4 text-amber-600 animate-pulse" />
                              {lang === 'es' ? 'Ver cambios' : 'Review changes'}
                            </button>
                          )}
                          <button
                            onClick={() => handleOpenFeesModal(ev)}
                            className="px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 text-xs font-bold hover:bg-purple-100 transition-colors flex items-center gap-1 shrink-0 shadow-sm border border-purple-200"
                            title={lang === 'es' ? 'Configurar Fees' : 'Configure Fees'}
                          >
                            <HiOutlineCog className="w-4 h-4 text-purple-600" />
                            {lang === 'es' ? 'Fees' : 'Fees'}
                          </button>
                          <Link
                            href={`/organizer/events/${ev.id}`}
                            className="p-1.5 rounded-lg transition-colors text-blue-500 hover:bg-blue-50"
                          >
                            <HiOutlinePencilAlt className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(ev.id, ev.title)}
                            className="p-1.5 rounded-lg transition-colors text-red-500 hover:bg-red-50"
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

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-gray-100">
            {filteredEvents.map((ev) => {
              const badge = getStatusBadge(ev.status);
              const catInfo = getCategoryInfo(ev.category);
              return (
                <div key={ev.id} className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center border border-gray-200">
                      {ev.imageUrl ? (
                        <img src={getImageUrl(ev.imageUrl)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">{catInfo?.icon || '🎫'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold text-gray-900 text-sm leading-tight mb-1">{ev.title}</h3>
                      <p className="text-[10px] text-gray-500 flex items-center gap-1 font-medium">
                        <HiOutlineCalendar className="w-3 h-3" />
                        {formatDateInTimezone(ev.eventDate, ev.eventTimezone || 'UTC', lang === 'es' ? 'es' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <div className="mt-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.classes}`}>
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    {(ev.status === 'draft' || ev.status === 'pending_approval') && (
                      <>
                        <button
                          onClick={() => handleApprove(ev.id)}
                          className="flex-1 bg-green-600 text-white text-[10px] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                          <HiOutlineCheckCircle className="w-4 h-4" />
                          {t('adminApprove')}
                        </button>
                        <button
                          onClick={() => handleReject(ev.id)}
                          className="flex-1 bg-red-50 text-red-600 border border-red-100 text-[10px] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                        >
                          <HiOutlineXCircle className="w-4 h-4" />
                          {t('adminReject')}
                        </button>
                      </>
                    )}
                    
                    {ev.status === 'published' && (
                      <button
                        onClick={() => handleToggleFeatured(ev.id)}
                        className={`flex-1 text-[10px] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-sm border ${
                          ev.isFeatured
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {ev.isFeatured ? <HiStar className="w-4 h-4 text-amber-500 fill-amber-500" /> : <HiOutlineStar className="w-4 h-4 text-gray-400" />}
                        {ev.isFeatured ? (lang === 'es' ? 'BANNER ACTIVO' : 'BANNER ACTIVE') : (lang === 'es' ? 'PONER BANNER' : 'SET BANNER')}
                      </button>
                    )}

                    {hasPendingChanges(ev) && (
                      <button
                        onClick={() => setSelectedEventForChanges(ev)}
                        className="w-full bg-amber-500 text-white text-[10px] font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"
                      >
                        <HiOutlineCheckCircle className="w-4 h-4 text-amber-600 animate-pulse" />
                        {lang === 'es' ? 'REVISAR CAMBIOS SOLICITADOS' : 'REVIEW REQUESTED CHANGES'}
                      </button>
                    )}

                    <div className="flex gap-2 w-full mt-1">
                      <button
                        onClick={() => handleOpenFeesModal(ev)}
                        className="flex-1 bg-purple-50 text-purple-600 border border-purple-100 text-[10px] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      >
                        <HiOutlineCog className="w-4 h-4" />
                        {lang === 'es' ? 'CONFIGURAR FEES' : 'CONFIG FEES'}
                      </button>
                      <Link
                        href={`/organizer/events/${ev.id}`}
                        className="p-2 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg flex items-center justify-center active:scale-95 transition-all"
                      >
                        <HiOutlinePencilAlt className="w-4.5 h-4.5" />
                      </Link>
                      <button
                        onClick={() => handleDelete(ev.id, ev.title)}
                        className="p-2 bg-red-50 text-red-600 border border-red-100 rounded-lg active:scale-95 transition-all"
                      >
                        <HiOutlineTrash className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > 15 && (
            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{total} {lang === 'es' ? 'eventos' : 'events'}</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => setPage(Math.max(1, page - 1))} 
                  disabled={page <= 1} 
                  className="px-4 py-2 text-[10px] font-bold border border-gray-200 rounded-xl hover:bg-white disabled:opacity-50 transition-colors uppercase tracking-widest shadow-sm"
                >
                  {lang === 'es' ? 'Anterior' : 'Previous'}
                </button>
                <button 
                  onClick={() => setPage(page + 1)} 
                  disabled={filteredEvents.length < 15} 
                  className="px-4 py-2 text-[10px] font-bold border border-gray-200 rounded-xl hover:bg-white disabled:opacity-50 transition-colors uppercase tracking-widest shadow-sm"
                >
                  {lang === 'es' ? 'Siguiente' : 'Next'}
                </button>
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

      {/* Pending Changes Modal */}
      {selectedEventForChanges && (
        <div className="fixed inset-0 h-screen w-screen z-[9999] overflow-hidden flex justify-end">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedEventForChanges(null)}
          />
          
          {/* Drawer Panel */}
          <div className="relative w-full max-w-2xl bg-white h-screen shadow-2xl flex flex-col z-10 animate-[slideOver_0.3s_ease-out] border-l border-gray-150">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0 bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
                  <HiOutlineCalendar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-extrabold text-lg text-gray-900 leading-tight">{lang === 'es' ? 'Revisar Cambios' : 'Review Changes'}</h2>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">{selectedEventForChanges.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  disabled={!!processingField}
                  onClick={() => handleApproveAll(selectedEventForChanges.id)}
                  className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all shadow-lg shadow-green-200 active:scale-95 disabled:opacity-50"
                >
                  {lang === 'es' ? 'Aprobar Todo' : 'Approve All'}
                </button>
                <button 
                  onClick={() => setSelectedEventForChanges(null)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                >
                  <HiOutlineXCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <p className="text-xs text-gray-500 leading-relaxed">
                {lang === 'es' 
                  ? 'El organizador ha propuesto los siguientes cambios para este evento ya publicado. Puedes aprobar o rechazar cada cambio de manera independiente.'
                  : 'The organizer has proposed the following changes for this published event. You can approve or reject each change independently.'}
              </p>

              <div className="space-y-5">
                {/* Title Change */}
                {selectedEventForChanges.pendingTitle && (
                  <div className="p-4 border border-gray-200 rounded-2xl bg-white space-y-3 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">{lang === 'es' ? 'Título del Evento' : 'Event Title'}</span>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="font-bold text-gray-400 block mb-1">{lang === 'es' ? 'Actual:' : 'Current:'}</span>
                        <p className="text-gray-600 font-medium line-through">{selectedEventForChanges.title}</p>
                      </div>
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                        <span className="font-bold text-amber-600 block mb-1">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <p className="text-amber-900 font-extrabold">{selectedEventForChanges.pendingTitle}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-gray-100">
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleRejectField(selectedEventForChanges.id, 'title')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                      >
                        ❌ {lang === 'es' ? 'Rechazar' : 'Reject'}
                      </button>
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleApproveField(selectedEventForChanges.id, 'title')}
                        className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                      >
                        ✓ {lang === 'es' ? 'Aprobar' : 'Approve'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Event Image Change */}
                {selectedEventForChanges.pendingImageUrl && (
                  <div className="p-4 border border-gray-200 rounded-2xl bg-white space-y-3 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">{lang === 'es' ? 'Imagen del Evento' : 'Event Image'}</span>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="p-2 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="font-bold text-gray-400 block mb-2 px-1">{lang === 'es' ? 'Actual:' : 'Current:'}</span>
                        <div className="aspect-[4/3] rounded-lg overflow-hidden border border-gray-200 opacity-50 grayscale">
                          <img src={getImageUrl(selectedEventForChanges.imageUrl)} className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                        <span className="font-bold text-amber-600 block mb-2 px-1">{lang === 'es' ? 'Propuesta:' : 'Proposed:'}</span>
                        <div className="aspect-[4/3] rounded-lg overflow-hidden border border-amber-200 shadow-md">
                          <img src={getImageUrl(selectedEventForChanges.pendingImageUrl)} className="w-full h-full object-cover" />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-gray-100">
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleRejectField(selectedEventForChanges.id, 'imageUrl')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold active:scale-95 transition-all"
                      >
                        ❌ {lang === 'es' ? 'Rechazar' : 'Reject'}
                      </button>
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleApproveField(selectedEventForChanges.id, 'imageUrl')}
                        className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold active:scale-95 transition-all shadow-sm"
                      >
                        ✓ {lang === 'es' ? 'Aprobar' : 'Approve'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Banner Image Change */}
                {selectedEventForChanges.pendingBannerImageUrl && (
                  <div className="p-4 border border-gray-200 rounded-2xl bg-white space-y-3 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">{lang === 'es' ? 'Banner del Evento' : 'Event Banner'}</span>
                    <div className="space-y-4">
                      <div className="p-2 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="font-bold text-gray-400 block mb-2 text-xs">{lang === 'es' ? 'Banner Actual:' : 'Current Banner:'}</span>
                        <div className="aspect-[21/9] rounded-lg overflow-hidden border border-gray-200 opacity-50 grayscale">
                          <img src={getImageUrl(selectedEventForChanges.bannerImageUrl || selectedEventForChanges.imageUrl)} className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <div className="p-2 bg-amber-50 rounded-xl border border-amber-100">
                        <span className="font-bold text-amber-600 block mb-2 text-xs">{lang === 'es' ? 'Banner Propuesto:' : 'Proposed Banner:'}</span>
                        <div className="aspect-[21/9] rounded-lg overflow-hidden border border-amber-200 shadow-md">
                          <img src={getImageUrl(selectedEventForChanges.pendingBannerImageUrl)} className="w-full h-full object-cover" />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-gray-100">
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleRejectField(selectedEventForChanges.id, 'bannerImageUrl')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold active:scale-95 transition-all"
                      >
                        ❌ {lang === 'es' ? 'Rechazar' : 'Reject'}
                      </button>
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleApproveField(selectedEventForChanges.id, 'bannerImageUrl')}
                        className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold active:scale-95 transition-all shadow-sm"
                      >
                        ✓ {lang === 'es' ? 'Aprobar' : 'Approve'}
                      </button>
                    </div>
                  </div>
                )}
                {/* Description Change */}
                {selectedEventForChanges.pendingDescription && (
                  <div className="p-4 border border-gray-200 rounded-2xl bg-white space-y-3 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">{lang === 'es' ? 'Descripción' : 'Description'}</span>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="font-bold text-gray-400 block mb-1">{lang === 'es' ? 'Actual:' : 'Current:'}</span>
                        <p className="text-gray-600 line-clamp-3">{selectedEventForChanges.description}</p>
                      </div>
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                        <span className="font-bold text-amber-600 block mb-1">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <p className="text-amber-900 font-medium whitespace-pre-wrap">{selectedEventForChanges.pendingDescription}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-gray-100">
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleRejectField(selectedEventForChanges.id, 'description')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                      >
                        ❌ {lang === 'es' ? 'Rechazar' : 'Reject'}
                      </button>
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleApproveField(selectedEventForChanges.id, 'description')}
                        className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                      >
                        ✓ {lang === 'es' ? 'Aprobar' : 'Approve'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Venue Name Change */}
                {selectedEventForChanges.pendingVenueName && (
                  <div className="p-4 border border-gray-200 rounded-2xl bg-white space-y-3 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">{lang === 'es' ? 'Lugar / Venue' : 'Venue Name'}</span>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="font-bold text-gray-400 block mb-1">{lang === 'es' ? 'Actual:' : 'Current:'}</span>
                        <p className="text-gray-600 font-medium">{selectedEventForChanges.venueName}</p>
                      </div>
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                        <span className="font-bold text-amber-600 block mb-1">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <p className="text-amber-900 font-extrabold">{selectedEventForChanges.pendingVenueName}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-gray-100">
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleRejectField(selectedEventForChanges.id, 'venueName')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                      >
                        ❌ {lang === 'es' ? 'Rechazar' : 'Reject'}
                      </button>
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleApproveField(selectedEventForChanges.id, 'venueName')}
                        className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                      >
                        ✓ {lang === 'es' ? 'Aprobar' : 'Approve'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Event Date Change */}
                {selectedEventForChanges.pendingEventDate && (
                  <div className="p-4 border border-gray-200 rounded-2xl bg-white space-y-3 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">{lang === 'es' ? 'Fecha y Hora' : 'Date & Time'}</span>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="font-bold text-gray-400 block mb-1">{lang === 'es' ? 'Actual:' : 'Current:'}</span>
                        <p className="text-gray-600 font-medium">
                          {formatDateInTimezone(selectedEventForChanges.eventDate, selectedEventForChanges.eventTimezone || 'UTC', lang === 'es' ? 'es' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                      </div>
                      <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                        <span className="font-bold text-amber-600 block mb-1">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <p className="text-amber-900 font-extrabold">
                          {formatDateInTimezone(selectedEventForChanges.pendingEventDate, selectedEventForChanges.eventTimezone || 'UTC', lang === 'es' ? 'es' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-gray-100">
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleRejectField(selectedEventForChanges.id, 'eventDate')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                      >
                        ❌ {lang === 'es' ? 'Rechazar' : 'Reject'}
                      </button>
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleApproveField(selectedEventForChanges.id, 'eventDate')}
                        className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                      >
                        ✓ {lang === 'es' ? 'Aprobar' : 'Approve'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Cover Image Change */}
                {selectedEventForChanges.pendingImageUrl && (
                  <div className="p-4 border border-gray-200 rounded-2xl bg-white space-y-3 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">{lang === 'es' ? 'Foto de Portada / Flyer' : 'Cover Image / Flyer'}</span>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5">
                        <span className="font-bold text-gray-400 block">{lang === 'es' ? 'Actual:' : 'Current:'}</span>
                        <div className="aspect-video relative rounded-xl border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center">
                          {selectedEventForChanges.imageUrl ? (
                            <img src={getImageUrl(selectedEventForChanges.imageUrl)} alt="Current" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">{lang === 'es' ? 'Sin imagen' : 'No image'}</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <span className="font-bold text-amber-600 block">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <div className="aspect-video relative rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden flex items-center justify-center">
                          <img src={getImageUrl(selectedEventForChanges.pendingImageUrl)} alt="Proposed" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-gray-100">
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleRejectField(selectedEventForChanges.id, 'imageUrl')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                      >
                        ❌ {lang === 'es' ? 'Rechazar' : 'Reject'}
                      </button>
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleApproveField(selectedEventForChanges.id, 'imageUrl')}
                        className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                      >
                        ✓ {lang === 'es' ? 'Aprobar' : 'Approve'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Banner Image Change */}
                {selectedEventForChanges.pendingBannerImageUrl && (
                  <div className="p-4 border border-gray-200 rounded-2xl bg-white space-y-3 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">{lang === 'es' ? 'Banner de Inicio' : 'Homepage Carousel Banner'}</span>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1.5">
                        <span className="font-bold text-gray-400 block">{lang === 'es' ? 'Actual:' : 'Current:'}</span>
                        <div className="aspect-video relative rounded-xl border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center">
                          {selectedEventForChanges.bannerImageUrl ? (
                            <img src={getImageUrl(selectedEventForChanges.bannerImageUrl)} alt="Current" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">{lang === 'es' ? 'Sin imagen' : 'No image'}</span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <span className="font-bold text-amber-600 block">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <div className="aspect-video relative rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden flex items-center justify-center">
                          <img src={getImageUrl(selectedEventForChanges.pendingBannerImageUrl)} alt="Proposed" className="w-full h-full object-cover" />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-gray-100">
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleRejectField(selectedEventForChanges.id, 'bannerImageUrl')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                      >
                        ❌ {lang === 'es' ? 'Rechazar' : 'Reject'}
                      </button>
                      <button 
                        disabled={!!processingField}
                        onClick={() => handleApproveField(selectedEventForChanges.id, 'bannerImageUrl')}
                        className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                      >
                        ✓ {lang === 'es' ? 'Aprobar' : 'Approve'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-6 border-t border-gray-100 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedEventForChanges(null)}
                className="w-full py-3 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
              >
                {lang === 'es' ? 'Cerrar' : 'Close'}
              </button>
            </div>
          </div>

          <style jsx>{`
            @keyframes slideOver {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}

      {/* Fee Configuration Modal */}
      {selectedEventForFees && (
        <div className="fixed inset-0 h-screen w-screen z-[9999] overflow-hidden flex justify-end">
          <div 
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedEventForFees(null)}
          />
          
          <div className="relative w-full max-w-2xl bg-white h-screen shadow-2xl flex flex-col z-10 animate-[slideOver_0.3s_ease-out] border-l border-gray-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0 bg-purple-50/50">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <HiOutlineCog className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-extrabold text-lg text-gray-900 leading-tight">
                    {lang === 'es' ? 'Configuración de Fees' : 'Fee Configuration'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">{selectedEventForFees.title}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedEventForFees(null)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                <HiOutlineXCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6 bg-gray-50/30 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('global')}
                className={`py-3.5 px-5 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'global'
                    ? 'border-purple-600 text-purple-600 bg-purple-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {lang === 'es' ? 'Configuración Global del Evento' : 'Global Event Configuration'}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sections')}
                className={`py-3.5 px-5 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'sections'
                    ? 'border-purple-600 text-purple-600 bg-purple-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {lang === 'es' ? 'Por Tipo de Ticket (Secciones)' : 'Per Ticket Type (Sections)'}
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {feeLoading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => <div key={i} className="h-16 skeleton rounded-2xl" />)}
                </div>
              ) : eventFeeConfig ? (
                activeTab === 'global' ? (
                  <form onSubmit={handleSaveEventFees} className="space-y-6 animate-fade-in">
                    <div className="bg-purple-50/30 border border-purple-100 rounded-2xl p-4 text-xs text-purple-800 leading-relaxed">
                      {lang === 'es'
                        ? 'Configura los porcentajes y cargos fijos globales para este evento. Si dejas un campo vacío, se aplicarán los valores por defecto del sistema (12% LPTicket, 2.9% + $0.30 Stripe).'
                        : 'Configure global percentages and fixed fees for this event. If left empty, system defaults will apply (12% LPTicket, 2.9% + $0.30 Stripe).'}
                    </div>

                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Service Fee Percent */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-700 block">
                            {lang === 'es' ? 'Porcentaje Cargo por Servicio' : 'Service Fee Percentage'}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.0001"
                              placeholder="0.12 (12%)"
                              value={eventFeeConfig.event.serviceFeePercent}
                              onChange={(e) => setEventFeeConfig({
                                ...eventFeeConfig,
                                event: { ...eventFeeConfig.event, serviceFeePercent: e.target.value }
                              })}
                              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">ej: 0.12</span>
                          </div>
                          <p className="text-[10px] text-gray-400">{lang === 'es' ? 'Decimal (0.12 = 12%)' : 'Decimal (0.12 = 12%)'}</p>
                        </div>

                        {/* Service Fee Fixed */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-700 block">
                            {lang === 'es' ? 'Cargo Fijo por Servicio (por ticket)' : 'Fixed Service Fee (per ticket)'}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">$</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={eventFeeConfig.event.serviceFeeFixedPerTicket}
                              onChange={(e) => setEventFeeConfig({
                                ...eventFeeConfig,
                                event: { ...eventFeeConfig.event, serviceFeeFixedPerTicket: e.target.value }
                              })}
                              className="w-full pl-8 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                            />
                          </div>
                          <p className="text-[10px] text-gray-400">{lang === 'es' ? 'En la moneda del evento' : 'In event currency'}</p>
                        </div>
                      </div>

                      <div className="h-px bg-gray-100 my-4" />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Processing Fee Percent */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-700 block">
                            {lang === 'es' ? 'Porcentaje Tarifa Procesamiento' : 'Processing Fee Percentage'}
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.0001"
                              placeholder="0.029 (2.9%)"
                              value={eventFeeConfig.event.processingFeePercent}
                              onChange={(e) => setEventFeeConfig({
                                ...eventFeeConfig,
                                event: { ...eventFeeConfig.event, processingFeePercent: e.target.value }
                              })}
                              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">ej: 0.029</span>
                          </div>
                          <p className="text-[10px] text-gray-400">{lang === 'es' ? 'Decimal (0.029 = 2.9%)' : 'Decimal (0.029 = 2.9%)'}</p>
                        </div>

                        {/* Processing Fee Fixed */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-700 block">
                            {lang === 'es' ? 'Tarifa Fija Procesamiento (por ticket)' : 'Fixed Processing Fee (per ticket)'}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-bold">$</span>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.30"
                              value={eventFeeConfig.event.processingFeeFixedPerTicket}
                              onChange={(e) => setEventFeeConfig({
                                ...eventFeeConfig,
                                event: { ...eventFeeConfig.event, processingFeeFixedPerTicket: e.target.value }
                              })}
                              className="w-full pl-8 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                            />
                          </div>
                          <p className="text-[10px] text-gray-400">{lang === 'es' ? 'En la moneda del evento' : 'In event currency'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedEventForFees(null)}
                        className="px-5 py-2.5 text-xs font-bold border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
                      >
                        {lang === 'es' ? 'Cancelar' : 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        disabled={feeSaving}
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-200 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                      >
                        {feeSaving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        {lang === 'es' ? 'Guardar Fees Globales' : 'Save Global Fees'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-purple-50/30 border border-purple-100 rounded-2xl p-4 text-xs text-purple-800 leading-relaxed">
                      {lang === 'es'
                        ? 'Configura fees personalizados para secciones específicas. Estos valores sobreescriben la configuración global del evento para los tickets de esa sección.'
                        : 'Configure custom fees for specific sections. These values override the global event configuration for tickets in that section.'}
                    </div>

                    <div className="space-y-6">
                      {eventFeeConfig.sections.map((sec: any, index: number) => (
                        <div key={sec.id} className="border border-gray-200 rounded-2xl p-5 bg-white space-y-4 shadow-sm">
                          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                            <div>
                              <h4 className="font-extrabold text-sm text-gray-900">{sec.name}</h4>
                              <p className="text-xs text-gray-400 mt-0.5">Precio base: ${Number(sec.price).toFixed(2)}</p>
                            </div>
                            <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                              {sec.sectionType}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Service Fee Percent */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-gray-600 block">
                                {lang === 'es' ? 'Porcentaje Cargo Servicio' : 'Service Fee %'}
                              </label>
                              <input
                                type="number"
                                step="0.0001"
                                placeholder={eventFeeConfig.event.serviceFeePercent !== '' ? `${eventFeeConfig.event.serviceFeePercent} (Global)` : '0.12 (Defecto)'}
                                value={sec.serviceFeePercent}
                                onChange={(e) => {
                                  const updated = [...eventFeeConfig.sections];
                                  updated[index].serviceFeePercent = e.target.value;
                                  setEventFeeConfig({ ...eventFeeConfig, sections: updated });
                                }}
                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                              />
                            </div>

                            {/* Service Fee Fixed */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-gray-600 block">
                                {lang === 'es' ? 'Cargo Fijo Servicio' : 'Fixed Service Fee'}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder={eventFeeConfig.event.serviceFeeFixedPerTicket !== '' ? `$${eventFeeConfig.event.serviceFeeFixedPerTicket} (Global)` : '$0.00 (Defecto)'}
                                value={sec.serviceFeeFixedPerTicket}
                                onChange={(e) => {
                                  const updated = [...eventFeeConfig.sections];
                                  updated[index].serviceFeeFixedPerTicket = e.target.value;
                                  setEventFeeConfig({ ...eventFeeConfig, sections: updated });
                                }}
                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                              />
                            </div>

                            {/* Processing Fee Percent */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-gray-600 block">
                                {lang === 'es' ? 'Porcentaje Procesamiento' : 'Processing Fee %'}
                              </label>
                              <input
                                type="number"
                                step="0.0001"
                                placeholder={eventFeeConfig.event.processingFeePercent !== '' ? `${eventFeeConfig.event.processingFeePercent} (Global)` : '0.029 (Defecto)'}
                                value={sec.processingFeePercent}
                                onChange={(e) => {
                                  const updated = [...eventFeeConfig.sections];
                                  updated[index].processingFeePercent = e.target.value;
                                  setEventFeeConfig({ ...eventFeeConfig, sections: updated });
                                }}
                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                              />
                            </div>

                            {/* Processing Fee Fixed */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-gray-600 block">
                                {lang === 'es' ? 'Tarifa Fija Procesamiento' : 'Fixed Processing Fee'}
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                placeholder={eventFeeConfig.event.processingFeeFixedPerTicket !== '' ? `$${eventFeeConfig.event.processingFeeFixedPerTicket} (Global)` : '$0.30 (Defecto)'}
                                value={sec.processingFeeFixedPerTicket}
                                onChange={(e) => {
                                  const updated = [...eventFeeConfig.sections];
                                  updated[index].processingFeeFixedPerTicket = e.target.value;
                                  setEventFeeConfig({ ...eventFeeConfig, sections: updated });
                                }}
                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end pt-2 border-t border-dashed border-gray-100">
                            <button
                              type="button"
                              disabled={feeSaving}
                              onClick={() => handleSaveSectionFees(sec.id, sec)}
                              className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
                            >
                              {lang === 'es' ? `Guardar Fees de ${sec.name}` : `Save ${sec.name} Fees`}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
