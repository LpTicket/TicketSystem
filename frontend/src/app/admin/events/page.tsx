'use client';

import { useState, useEffect } from 'react';
import api, { getImageUrl } from '@/lib/api';
import { formatDateInTimezone } from '@/lib/dateUtils';
import toast from 'react-hot-toast';
import { useLang } from '@/context/LanguageContext';
import { Event } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { confirmDialog } from '@/lib/dialog';
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
  HiOutlineCurrencyDollar,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineMail,
  HiOutlineDocumentText,
} from 'react-icons/hi';
import Link from 'next/link';

// Stale-while-revalidate cache key for the admin events list
const ADMIN_EVENTS_CACHE_KEY = 'admin_events_cache_v2';

type AdminEventsCache = {
  events: Event[];
  total: number;
  page: number;
  filter: string;
  cachedAt: number;
};

type PostEventReportPreview = {
  defaultEmail: string;
  sentAt?: string | null;
  report: {
    eventTitle: string;
    eventDateLabel: string;
    venueLabel: string;
    currency: string;
    totals: {
      grossSales: number;
      ticketRevenue: number;
      lpFees: number;
      processingFees: number;
      netEstimated: number;
      totalOrders: number;
      totalTickets: number;
      scannedTickets: number;
      pendingTickets: number;
      scanRate: number;
      averageOrder: number;
    };
    topSections: Array<{ name: string; tickets: number; revenue: number }>;
    salesByDay: Array<{ date: string; orders: number; tickets: number; revenue: number }>;
    specialCodes: Array<{ code: string; orders: number; tickets: number; revenue: number; commission: number }>;
  };
};

function readEventsCache(filter: string, page: number): AdminEventsCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ADMIN_EVENTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminEventsCache;
    if (parsed.filter === filter && parsed.page === page) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeEventsCache(data: AdminEventsCache) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(ADMIN_EVENTS_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

export default function AdminEventsPage() {
  const { t, lang } = useLang();
  const { getCategoryInfo } = useCategories();
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Seed state from session cache so the first paint shows real rows, not skeletons.
  const initialCache = typeof window !== 'undefined' ? readEventsCache('all', 1) : null;
  const [events, setEvents] = useState<Event[]>(initialCache?.events || []);
  const [total, setTotal] = useState(initialCache?.total || 0);
  const [loading, setLoading] = useState(!initialCache);
  const [search, setSearch] = useState('');
  const [selectedEventForChanges, setSelectedEventForChanges] = useState<Event | null>(null);
  const [processingField, setProcessingField] = useState<string | null>(null);
  const [selectedEventForReport, setSelectedEventForReport] = useState<Event | null>(null);
  const [reportPreview, setReportPreview] = useState<PostEventReportPreview | null>(null);
  const [reportEmail, setReportEmail] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSending, setReportSending] = useState(false);

  // Fee configuration state
  const [selectedEventForFees, setSelectedEventForFees] = useState<Event | null>(null);
  const [eventFeeConfig, setEventFeeConfig] = useState<any>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeSaving, setFeeSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'sections'>('global');

  // Price management state
  const [selectedEventForPrices, setSelectedEventForPrices] = useState<Event | null>(null);
  const [eventPricesConfig, setEventPricesConfig] = useState<{ event: any; sections: any[] } | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});

  const money = (value: number, currency = 'USD') => `${Number(value || 0).toFixed(2)} ${currency}`;

  const handleOpenReportModal = async (ev: Event) => {
    setSelectedEventForReport(ev);
    setReportPreview(null);
    setReportEmail(ev.organizer?.email || '');
    setReportLoading(true);
    try {
      const { data } = await api.get(`/admin/events/${ev.id}/post-event-report`);
      setReportPreview(data);
      setReportEmail(data.defaultEmail || ev.organizer?.email || '');
    } catch (err: any) {
      toast.error(err.response?.data?.message || (lang === 'es' ? 'No se pudo cargar el resumen' : 'Could not load report'));
    } finally {
      setReportLoading(false);
    }
  };

  const handleSendReport = async () => {
    if (!selectedEventForReport) return;
    if (!reportEmail.trim()) {
      toast.error(lang === 'es' ? 'Coloca un correo destino' : 'Enter a destination email');
      return;
    }
    setReportSending(true);
    try {
      const { data } = await api.post(`/admin/events/${selectedEventForReport.id}/post-event-report/send`, { email: reportEmail.trim() });
      const accepted = Array.isArray(data?.delivery?.accepted) && data.delivery.accepted.length > 0
        ? data.delivery.accepted.join(', ')
        : reportEmail.trim();
      toast.success(lang === 'es' ? `Servidor aceptó: ${accepted}` : `Server accepted: ${accepted}`);
      setSelectedEventForReport(null);
      setReportPreview(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || (lang === 'es' ? 'No se pudo enviar el resumen' : 'Could not send report'));
    } finally {
      setReportSending(false);
    }
  };

  const handleOpenFeesModal = (_ev: Event) => {
    toast(lang === 'es'
      ? 'Tarifas globales fijas: 3.02% + $1.98 por entrada; 2.9% + $0.30 por orden.'
      : 'Fixed global fees: 3.02% + $1.98 per ticket; 2.9% + $0.30 per order.');
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

  const handleOpenPricesModal = async (ev: Event) => {
    setSelectedEventForPrices(ev);
    setPricesLoading(true);
    try {
      const { data } = await api.get(`/admin/events/${ev.id}/prices`);
      setEventPricesConfig(data);
      const inputs: Record<string, string> = {};
      for (const sec of data.sections) {
        inputs[sec.id] = String(sec.price ?? '');
      }
      setPriceInputs(inputs);
    } catch {
      toast.error(lang === 'es' ? 'Error al cargar precios' : 'Error loading prices');
    } finally {
      setPricesLoading(false);
    }
  };

  const handleApproveSectionPrice = async (sectionId: string) => {
    try {
      await api.patch(`/admin/sections/${sectionId}/approve-price`);
      toast.success(lang === 'es' ? 'Precio aprobado' : 'Price approved');
      if (selectedEventForPrices) await handleOpenPricesModal(selectedEventForPrices);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleRejectSectionPrice = async (sectionId: string) => {
    try {
      await api.patch(`/admin/sections/${sectionId}/reject-price`);
      toast.success(lang === 'es' ? 'Precio rechazado' : 'Price rejected');
      if (selectedEventForPrices) await handleOpenPricesModal(selectedEventForPrices);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleSetSectionPrice = async (sectionId: string) => {
    const val = parseFloat(priceInputs[sectionId]);
    if (isNaN(val) || val < 0) {
      toast.error(lang === 'es' ? 'Precio inválido' : 'Invalid price');
      return;
    }
    try {
      await api.patch(`/admin/sections/${sectionId}/price`, { price: val });
      toast.success(lang === 'es' ? 'Precio actualizado' : 'Price updated');
      if (selectedEventForPrices) await handleOpenPricesModal(selectedEventForPrices);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
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
      ev.pendingEventDate ||
      ev.pendingCreatorCommission !== null && ev.pendingCreatorCommission !== undefined
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
    // Stale-while-revalidate: if we have cached data for this (filter, page),
    // show it immediately and refresh in the background. Otherwise, show skeleton.
    const cached = readEventsCache(filter, page);
    if (cached) {
      setEvents(cached.events);
      setTotal(cached.total);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const params: any = { page, limit: 15 };
      if (filter !== 'all') params.status = filter;
      const { data } = await api.get('/admin/events', { params });
      setEvents(data.events);
      setTotal(data.total);
      writeEventsCache({
        events: data.events,
        total: data.total,
        page,
        filter,
        cachedAt: Date.now(),
      });
    } catch {} finally { setLoading(false); }
  };

  const handleApprove = async (event: Event) => {
    const organizerName = [event.organizer?.firstName, event.organizer?.lastName].filter(Boolean).join(' ') || (lang === 'es' ? 'Organizador sin nombre' : 'Unnamed organizer');
    const organizerEmail = event.organizer?.email || (lang === 'es' ? 'Correo no disponible' : 'Email unavailable');
    if (!await confirmDialog({
      title: lang === 'es' ? 'Aprobar y notificar' : 'Approve and notify',
      message: lang === 'es'
        ? `Se publicará “${event.title}” y se enviará un aviso a ${organizerName} (${organizerEmail}).`
        : `“${event.title}” will be published and a notice will be sent to ${organizerName} (${organizerEmail}).`,
      confirmLabel: lang === 'es' ? 'Aprobar y notificar' : 'Approve and notify',
    })) return;
    try {
      const { data } = await api.patch(`/admin/events/${event.id}/approve`);
      await loadEvents();
      if (data.notificationSent) {
        toast.success(lang === 'es' ? 'Evento aprobado y organizador notificado' : 'Event approved and organizer notified');
      } else {
        toast.error(lang === 'es' ? 'Evento aprobado, pero el correo no pudo enviarse' : 'Event approved, but the email could not be sent');
      }
    }
    catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleReject = async (id: string) => {
    if (!await confirmDialog({
      title: lang === 'es' ? 'Rechazar evento' : 'Reject event',
      message: lang === 'es' ? '¿Rechazar este evento?' : 'Reject this event?',
      tone: 'danger',
    })) return;
    try { await api.patch(`/admin/events/${id}/reject`); await loadEvents(); }
    catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!await confirmDialog({
      title: lang === 'es' ? 'Eliminar evento' : 'Delete event',
      message: lang === 'es' ? `¿Estás seguro de eliminar el evento "${title}"?` : `Are you sure you want to delete "${title}"?`,
      tone: 'danger',
    })) return;
    try {
      await api.delete(`/admin/events/${id}`);
      setEvents((current) => current.filter((event) => event.id !== id));
      setTotal((current) => Math.max(0, current - 1));
      toast.success(lang === 'es' ? 'Evento eliminado' : 'Event deleted');
    }
    catch (err: any) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleToggleFeatured = async (id: string) => {
    try {
      await api.patch(`/admin/events/${id}/toggle-featured`);
      await loadEvents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleTogglePublicVisibility = async (id: string) => {
    try {
      await api.patch(`/admin/events/${id}/toggle-public-visibility`);
      await loadEvents();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error');
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
    if (selectedEventForChanges.pendingCreatorCommission !== null && selectedEventForChanges.pendingCreatorCommission !== undefined) fields.push('creatorCommission');

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

  const filteredEvents = events.filter((event) => {
    if (!search) return true;
    const query = search.toLowerCase();
    const organizerName = [event.organizer?.firstName, event.organizer?.lastName].filter(Boolean).join(' ');
    return [event.title, organizerName, event.organizer?.email]
      .some((value) => value?.toLowerCase().includes(query));
  });

  return (
    <div>
      <div className="premium-shell px-4 py-6 sm:px-6 lg:px-8 lg:py-10 space-y-8 animate-fade-in">
      <div>
        <h1 className="premium-page-title font-black text-2xl">{t('adminEventManagement')}</h1>
        <p className="text-sm text-gray-500 mt-1">{lang === 'es' ? 'Aprueba, rechaza y gestiona los eventos de la plataforma' : 'Approve, reject and manage platform events'}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col xl:flex-row xl:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilter(f.key); setPage(1); }}
              className={`justify-center px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-all active:scale-95 ${
                filter === f.key ? 'bg-gradient-to-b from-[#ff8a18] via-[#f46c00] to-[#c93f00] text-white font-bold border border-[rgba(255,151,45,0.62)] shadow-[0_10px_24px_rgba(255,104,0,0.24)]' : 'bg-[rgba(8,31,51,0.6)] border border-[rgba(246,198,95,0.18)] text-slate-300 hover:bg-[rgba(249,115,22,0.12)] hover:border-[rgba(249,115,22,0.4)] hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:max-w-sm xl:ml-auto xl:w-80 xl:shrink-0">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={lang === 'es' ? 'Buscar evento u organizador...' : 'Search event or organizer...'}
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
          <div className="divide-y divide-white/10">
            {filteredEvents.map((ev) => {
              const badge = getStatusBadge(ev.status);
              const catInfo = getCategoryInfo(ev.category);
              const catLabel = catInfo ? (lang === 'en' ? catInfo.labelEn : catInfo.labelEs) : ev.category;
              const organizerName = [ev.organizer?.firstName, ev.organizer?.lastName].filter(Boolean).join(' ') || (lang === 'es' ? 'Sin nombre' : 'No name');
              const actionClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors';
              return (
                <article key={ev.id} className="px-4 py-5 sm:px-6 sm:py-6 hover:bg-white/[0.025] transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#102b43] flex items-center justify-center sm:h-16 sm:w-16">
                        {ev.imageUrl ? <img src={getImageUrl(ev.imageUrl)} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl">{catInfo?.icon || '🎫'}</span>}
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <h2 className="text-base font-bold leading-snug text-white break-words sm:text-lg">{ev.title}</h2>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${badge.classes}`}>{badge.label}</span>
                  </div>

                  <div className="mt-5 grid gap-4 rounded-xl border border-white/10 bg-[#071b2d]/60 p-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{lang === 'es' ? 'Organizador' : 'Organizer'}</p>
                      <p className="mt-1.5 text-sm font-semibold text-slate-100 break-words">{organizerName}</p>
                      {ev.organizer?.email ? <a href={`mailto:${ev.organizer.email}?subject=${encodeURIComponent(`${lang === 'es' ? 'Información sobre' : 'Information about'} ${ev.title}`)}`} className="mt-1 block text-xs text-sky-400 hover:underline break-all">{ev.organizer.email}</a> : <p className="mt-1 text-xs text-slate-500">{lang === 'es' ? 'Correo no disponible' : 'Email unavailable'}</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{lang === 'es' ? 'Fecha' : 'Date'}</p>
                      <p className="mt-1.5 text-sm font-medium text-slate-100">{formatDateInTimezone(ev.eventDate, ev.eventTimezone || 'UTC', lang === 'es' ? 'es' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{lang === 'es' ? 'Categoría' : 'Category'}</p>
                      <p className="mt-1.5 text-sm font-medium text-slate-100 break-words">{catLabel}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-5">
                    {(ev.status === 'draft' || ev.status === 'pending_approval') && (
                      <>
                        <button onClick={() => handleApprove(ev)} className={`${actionClass} border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20`}><HiOutlineCheckCircle className="h-4 w-4 shrink-0" />{t('adminApprove' as any)}</button>
                        <button onClick={() => handleReject(ev.id)} className={`${actionClass} border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20`}><HiOutlineXCircle className="h-4 w-4 shrink-0" />{t('adminReject' as any)}</button>
                      </>
                    )}
                    {ev.status === 'published' && (
                      <>
                        <button onClick={() => handleToggleFeatured(ev.id)} className={`${actionClass} ${ev.isFeatured ? 'border-amber-400/40 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'}`}>
                          {ev.isFeatured ? <HiStar className="h-4 w-4 shrink-0" /> : <HiOutlineStar className="h-4 w-4 shrink-0" />}
                          {ev.isFeatured ? (lang === 'es' ? 'Banner activo' : 'Banner active') : (lang === 'es' ? 'Poner banner' : 'Set banner')}
                        </button>
                        <button onClick={() => handleTogglePublicVisibility(ev.id)} title={ev.publicVisible === false ? (lang === 'es' ? 'Oculto de Home y Eventos' : 'Hidden from Home and Events') : (lang === 'es' ? 'Visible en Home y Eventos' : 'Visible on Home and Events')} className={`${actionClass} border-sky-400/30 bg-sky-400/10 text-sky-200 hover:bg-sky-400/20`}>
                          {ev.publicVisible === false ? <HiOutlineEyeOff className="h-4 w-4 shrink-0" /> : <HiOutlineEye className="h-4 w-4 shrink-0" />}
                          {ev.publicVisible === false ? (lang === 'es' ? 'Oculto' : 'Hidden') : (lang === 'es' ? 'Visible' : 'Visible')}
                        </button>
                      </>
                    )}
                    {hasPendingChanges(ev) && <button onClick={() => setSelectedEventForChanges(ev)} className={`${actionClass} border-amber-400/40 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25`}><HiOutlineCheckCircle className="h-4 w-4 shrink-0" />{lang === 'es' ? 'Ver cambios' : 'Review changes'}</button>}
                    <button onClick={() => handleOpenReportModal(ev)} title={lang === 'es' ? 'Enviar resumen final del evento' : 'Send final event report'} className={`${actionClass} border-orange-400 bg-[#f97316] text-white hover:bg-[#e9680d]`}><HiOutlineMail className="h-4 w-4 shrink-0" />{lang === 'es' ? 'Enviar resumen' : 'Send report'}</button>
                    <button onClick={() => handleOpenPricesModal(ev)} className={`${actionClass} border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20`}><HiOutlineCurrencyDollar className="h-4 w-4 shrink-0" />{lang === 'es' ? 'Precios' : 'Prices'}</button>
                    <button onClick={() => handleOpenFeesModal(ev)} className={`${actionClass} border-white/15 bg-white/5 text-slate-200 hover:bg-white/10`}><HiOutlineCog className="h-4 w-4 shrink-0" />{lang === 'es' ? 'Tarifa fija' : 'Fixed fees'}</button>
                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                      <Link href={`/admin/events/edit/${ev.id}`} title={lang === 'es' ? 'Editar evento' : 'Edit event'} aria-label={lang === 'es' ? `Editar ${ev.title}` : `Edit ${ev.title}`} className={`${actionClass} border-white/15 bg-white/5 text-slate-200 hover:bg-white/10`}><HiOutlinePencilAlt className="h-4 w-4" /></Link>
                      <Link href={`/admin/events/${ev.id}`} title={lang === 'es' ? 'Ver detalle administrativo' : 'View admin detail'} aria-label={lang === 'es' ? `Ver detalle de ${ev.title}` : `View details of ${ev.title}`} className={`${actionClass} border-white/15 bg-white/5 text-slate-200 hover:bg-white/10`}><HiOutlineDocumentText className="h-4 w-4" /></Link>
                      <button onClick={() => handleDelete(ev.id, ev.title)} title={lang === 'es' ? 'Eliminar evento' : 'Delete event'} aria-label={lang === 'es' ? `Eliminar ${ev.title}` : `Delete ${ev.title}`} className={`${actionClass} border-red-500/25 bg-red-500/10 text-red-300 hover:bg-red-500/20`}><HiOutlineTrash className="h-4 w-4" /></button>
                    </div>
                  </div>
                </article>
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

      {/* Post-event Report Modal */}
      {selectedEventForReport && (
        <div className="fixed inset-0 h-screen w-screen z-[9999] overflow-hidden flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={() => !reportSending && setSelectedEventForReport(null)}
          />
          <div className="relative w-full max-w-2xl max-h-[92vh] overflow-hidden bg-white rounded-2xl shadow-2xl border border-gray-150 z-10 flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 bg-[rgba(249,115,22,0.06)] flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#F97316] text-white flex items-center justify-center shadow-sm">
                  <HiOutlineMail className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-extrabold text-lg text-gray-900 leading-tight">{lang === 'es' ? 'Enviar resumen' : 'Send report'}</h2>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium truncate">{selectedEventForReport.title}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEventForReport(null)}
                disabled={reportSending}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white transition-all disabled:opacity-50"
              >
                <HiOutlineXCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-500 block mb-2">
                  {lang === 'es' ? 'Correo destino' : 'Destination email'}
                </label>
                <input
                  type="email"
                  value={reportEmail}
                  onChange={(e) => setReportEmail(e.target.value)}
                  placeholder="organizer@email.com"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-orange-100"
                />
                <p className="mt-2 text-[11px] text-gray-500">
                  {lang === 'es'
                    ? 'Puedes dejar el correo del organizador o cambiarlo para probar cómo llegará.'
                    : 'You can keep the organizer email or change it to test delivery.'}
                </p>
              </div>

              {reportLoading ? (
                <div className="py-12 text-center text-sm font-semibold text-gray-500">
                  {lang === 'es' ? 'Cargando resumen...' : 'Loading report...'}
                </div>
              ) : reportPreview ? (
                <>
                  {reportPreview.sentAt && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
                      {lang === 'es' ? 'Este resumen ya fue enviado antes. Puedes reenviarlo manualmente.' : 'This report was already sent. You can resend it manually.'}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{lang === 'es' ? 'Ventas cobradas' : 'Gross sales'}</p>
                      <p className="mt-1 text-xl font-black text-[#F97316]">{money(reportPreview.report.totals.grossSales, reportPreview.report.currency)}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{lang === 'es' ? 'Entradas' : 'Tickets'}</p>
                      <p className="mt-1 text-xl font-black text-gray-900">{reportPreview.report.totals.totalTickets}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{lang === 'es' ? 'Escaneados' : 'Scanned'}</p>
                      <p className="mt-1 text-xl font-black text-gray-900">{reportPreview.report.totals.scannedTickets} / {reportPreview.report.totals.totalTickets}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{lang === 'es' ? 'Asistencia' : 'Attendance'}</p>
                      <p className="mt-1 text-xl font-black text-[#F97316]">{reportPreview.report.totals.scanRate}%</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-100 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-2">{lang === 'es' ? 'Evento' : 'Event'}</p>
                    <p className="text-sm font-extrabold text-gray-900">{reportPreview.report.eventTitle}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">{reportPreview.report.eventDateLabel}</p>
                    <p className="mt-1 text-xs font-semibold text-gray-500">{reportPreview.report.venueLabel}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-gray-100 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-3">{lang === 'es' ? 'Secciones / mesas' : 'Sections / tables'}</p>
                      <div className="space-y-2">
                        {reportPreview.report.topSections.length > 0 ? reportPreview.report.topSections.slice(0, 4).map((item) => (
                          <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-bold text-gray-700 truncate">{item.name}</span>
                            <span className="font-black text-[#F97316]">{item.tickets}</span>
                          </div>
                        )) : <p className="text-xs font-semibold text-gray-400">{lang === 'es' ? 'Sin ventas.' : 'No sales.'}</p>}
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-100 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400 mb-3">{lang === 'es' ? 'Códigos' : 'Codes'}</p>
                      <div className="space-y-2">
                        {reportPreview.report.specialCodes.length > 0 ? reportPreview.report.specialCodes.slice(0, 4).map((item) => (
                          <div key={item.code} className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-bold text-gray-700 truncate">{item.code}</span>
                            <span className="font-black text-[#F97316]">{item.tickets}</span>
                          </div>
                        )) : <p className="text-xs font-semibold text-gray-400">{lang === 'es' ? 'Sin códigos usados.' : 'No codes used.'}</p>}
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setSelectedEventForReport(null)}
                disabled={reportSending}
                className="btn-secondary px-5 py-3 text-sm font-bold justify-center disabled:opacity-50"
              >
                {lang === 'es' ? 'Cancelar' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSendReport}
                disabled={reportLoading || reportSending || !reportPreview}
                className="btn-primary px-5 py-3 text-sm font-black justify-center disabled:opacity-60"
              >
                {reportSending ? (lang === 'es' ? 'Enviando...' : 'Sending...') : (lang === 'es' ? 'Enviar resumen' : 'Send report')}
              </button>
            </div>
          </div>
        </div>
      )}

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
                      <div className="p-2.5 bg-[#F97316] rounded-xl border border-[#F97316]">
                        <span className="font-bold text-white block mb-1">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <p className="text-white font-extrabold">{selectedEventForChanges.pendingTitle}</p>
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
                      <div className="p-2 bg-[#F97316] rounded-xl border border-[#F97316]">
                        <span className="font-bold text-white block mb-2 px-1">{lang === 'es' ? 'Propuesta:' : 'Proposed:'}</span>
                        <div className="aspect-[4/3] rounded-lg overflow-hidden border border-white/40 shadow-md">
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
                      <div className="p-2 bg-[#F97316] rounded-xl border border-[#F97316]">
                        <span className="font-bold text-white block mb-2 text-xs">{lang === 'es' ? 'Banner Propuesto:' : 'Proposed Banner:'}</span>
                        <div className="aspect-[21/9] rounded-lg overflow-hidden border border-white/40 shadow-md">
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
                      <div className="p-2.5 bg-[#F97316] rounded-xl border border-[#F97316]">
                        <span className="font-bold text-white block mb-1">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <p className="text-white font-medium whitespace-pre-wrap">{selectedEventForChanges.pendingDescription}</p>
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
                      <div className="p-2.5 bg-[#F97316] rounded-xl border border-[#F97316]">
                        <span className="font-bold text-white block mb-1">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <p className="text-white font-extrabold">{selectedEventForChanges.pendingVenueName}</p>
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
                      <div className="p-2.5 bg-[#F97316] rounded-xl border border-[#F97316]">
                        <span className="font-bold text-white block mb-1">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <p className="text-white font-extrabold">
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
                        <span className="font-bold text-white block bg-[#F97316] rounded-t-xl px-2 py-1">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <div className="aspect-video relative rounded-b-xl border border-[#F97316] bg-[#F97316] overflow-hidden flex items-center justify-center">
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

                {/* Creator Commission Change */}
                {selectedEventForChanges.pendingCreatorCommission !== null && selectedEventForChanges.pendingCreatorCommission !== undefined && (
                  <div className="p-4 border border-emerald-200 rounded-2xl bg-emerald-50/40 space-y-3 shadow-sm">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">
                      {lang === 'es' ? 'Comisión para Códigos de Creador' : 'Creator Code Commission'}
                    </span>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="p-2.5 bg-white rounded-xl border border-gray-100">
                        <span className="font-bold text-gray-400 block mb-1">{lang === 'es' ? 'Actual:' : 'Current:'}</span>
                        <p className="text-gray-600 font-bold text-base">${Number(selectedEventForChanges.creatorCommission || 0).toFixed(2)}</p>
                        <p className="text-gray-400 text-[10px]">{lang === 'es' ? 'por entrada' : 'per ticket'}</p>
                      </div>
                      <div className="p-2.5 bg-[#F97316] rounded-xl border border-[#F97316]">
                        <span className="font-bold text-white block mb-1">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <p className="text-white font-extrabold text-base">${Number(selectedEventForChanges.pendingCreatorCommission).toFixed(2)}</p>
                        <p className="text-white text-[10px]">{lang === 'es' ? 'por entrada' : 'per ticket'}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-emerald-100">
                      <button
                        disabled={!!processingField}
                        onClick={() => handleRejectField(selectedEventForChanges.id, 'creatorCommission')}
                        className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all"
                      >
                        ❌ {lang === 'es' ? 'Rechazar' : 'Reject'}
                      </button>
                      <button
                        disabled={!!processingField}
                        onClick={() => handleApproveField(selectedEventForChanges.id, 'creatorCommission')}
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
                        <span className="font-bold text-white block bg-[#F97316] rounded-t-xl px-2 py-1">{lang === 'es' ? 'Propuesto:' : 'Proposed:'}</span>
                        <div className="aspect-video relative rounded-b-xl border border-[#F97316] bg-[#F97316] overflow-hidden flex items-center justify-center">
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

            {/* Drawer Footer — Admin direct commission override */}
            <div className="p-6 border-t border-gray-100 space-y-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    id={`commission-override-${selectedEventForChanges.id}`}
                    defaultValue={Number(selectedEventForChanges.creatorCommission || 0).toFixed(2)}
                    placeholder="0.00"
                    className="w-full pl-7 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const input = document.getElementById(`commission-override-${selectedEventForChanges.id}`) as HTMLInputElement;
                    const val = parseFloat(input?.value ?? '');
                    if (isNaN(val) || val < 0) { toast.error(lang === 'es' ? 'Monto inválido' : 'Invalid amount'); return; }
                    try {
                      await api.patch(`/admin/events/${selectedEventForChanges.id}/creator-commission`, { amount: val });
                      toast.success(lang === 'es' ? 'Comisión establecida' : 'Commission set');
                      await loadEvents();
                      setSelectedEventForChanges(null);
                    } catch (err: any) {
                      toast.error(err.response?.data?.message || 'Error');
                    }
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all active:scale-95 whitespace-nowrap"
                >
                  {lang === 'es' ? 'Fijar comisión' : 'Set commission'}
                </button>
              </div>
              <p className="text-[10px] text-gray-400">{lang === 'es' ? 'Fija la comisión directamente sin necesitar solicitud del organizador.' : 'Set commission directly without needing an organizer request.'}</p>
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
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0 bg-[rgba(10,55,90,0.05)]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(10,55,90,0.10)] text-[#0A375A] flex items-center justify-center">
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
                    ? 'border-[#0A375A] text-[#0A375A] bg-[rgba(10,55,90,0.05)]'
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
                    ? 'border-[#0A375A] text-[#0A375A] bg-[rgba(10,55,90,0.05)]'
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
                    <div className="bg-[rgba(10,55,90,0.05)] border border-[rgba(10,55,90,0.10)] rounded-2xl p-4 text-xs text-[#0A375A] leading-relaxed">
                      {lang === 'es'
                        ? 'Si dejas un campo vacío, se aplicarán los valores por defecto: LPTicket 3.02% + $1.98 por entrada; Stripe 2.9% + $0.30 una vez por orden.'
                        : 'If left empty, the defaults apply: LPTicket 3.02% + $1.98 per ticket; Stripe 2.9% + $0.30 once per order.'}
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
                              placeholder="0.0302 (3.02%)"
                              value={eventFeeConfig.event.serviceFeePercent}
                              onChange={(e) => setEventFeeConfig({
                                ...eventFeeConfig,
                                event: { ...eventFeeConfig.event, serviceFeePercent: e.target.value }
                              })}
                              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[rgba(10,55,90,0.05)]0 bg-white"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">ej: 0.0302</span>
                          </div>
                          <p className="text-[10px] text-gray-400">{lang === 'es' ? 'Decimal (0.0302 = 3.02%)' : 'Decimal (0.0302 = 3.02%)'}</p>
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
                              placeholder="1.98"
                              value={eventFeeConfig.event.serviceFeeFixedPerTicket}
                              onChange={(e) => setEventFeeConfig({
                                ...eventFeeConfig,
                                event: { ...eventFeeConfig.event, serviceFeeFixedPerTicket: e.target.value }
                              })}
                              className="w-full pl-8 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[rgba(10,55,90,0.05)]0 bg-white"
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
                              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[rgba(10,55,90,0.05)]0 bg-white"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">ej: 0.029</span>
                          </div>
                          <p className="text-[10px] text-gray-400">{lang === 'es' ? 'Decimal (0.029 = 2.9%)' : 'Decimal (0.029 = 2.9%)'}</p>
                        </div>

                        {/* Processing Fee Fixed */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-gray-700 block">
                            {lang === 'es' ? 'Tarifa Fija Procesamiento (por orden)' : 'Fixed Processing Fee (per order)'}
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
                              className="w-full pl-8 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[rgba(10,55,90,0.05)]0 bg-white"
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
                        className="px-6 py-2.5 bg-[#0A375A] hover:bg-[#0A375A] text-white text-xs font-bold rounded-xl shadow-lg shadow-[rgba(10,55,90,0.12)] transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                      >
                        {feeSaving && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        {lang === 'es' ? 'Guardar Fees Globales' : 'Save Global Fees'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6 animate-fade-in">
                    <div className="bg-[rgba(10,55,90,0.05)] border border-[rgba(10,55,90,0.10)] rounded-2xl p-4 text-xs text-[#0A375A] leading-relaxed">
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
                                placeholder={eventFeeConfig.event.serviceFeePercent !== '' ? `${eventFeeConfig.event.serviceFeePercent} (Global)` : '0.0302 (Defecto)'}
                                value={sec.serviceFeePercent}
                                onChange={(e) => {
                                  const updated = [...eventFeeConfig.sections];
                                  updated[index].serviceFeePercent = e.target.value;
                                  setEventFeeConfig({ ...eventFeeConfig, sections: updated });
                                }}
                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgba(10,55,90,0.05)]0 bg-white"
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
                                placeholder={eventFeeConfig.event.serviceFeeFixedPerTicket !== '' ? `$${eventFeeConfig.event.serviceFeeFixedPerTicket} (Global)` : '$1.98 (Defecto)'}
                                value={sec.serviceFeeFixedPerTicket}
                                onChange={(e) => {
                                  const updated = [...eventFeeConfig.sections];
                                  updated[index].serviceFeeFixedPerTicket = e.target.value;
                                  setEventFeeConfig({ ...eventFeeConfig, sections: updated });
                                }}
                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgba(10,55,90,0.05)]0 bg-white"
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
                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgba(10,55,90,0.05)]0 bg-white"
                              />
                            </div>

                            {/* Processing Fee Fixed */}
                            <div className="space-y-1">
                              <label className="text-[11px] font-bold text-gray-600 block">
                                {lang === 'es' ? 'Tarifa Fija Procesamiento (por orden)' : 'Fixed Processing Fee (per order)'}
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
                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgba(10,55,90,0.05)]0 bg-white"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end pt-2 border-t border-dashed border-gray-100">
                            <button
                              type="button"
                              disabled={feeSaving}
                              onClick={() => handleSaveSectionFees(sec.id, sec)}
                              className="px-4 py-2 bg-[rgba(10,55,90,0.10)] hover:bg-[rgba(10,55,90,0.12)] text-[#0A375A] text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50"
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

      {/* Prices Management Modal */}
      {selectedEventForPrices && (
        <div className="fixed inset-0 h-screen w-screen z-[9999] overflow-hidden flex justify-end">
          <div
            className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedEventForPrices(null)}
          />
          <div className="relative w-full max-w-2xl bg-white h-screen shadow-2xl flex flex-col z-10 animate-[slideOver_0.3s_ease-out] border-l border-gray-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 shrink-0 bg-emerald-50/60">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <HiOutlineCurrencyDollar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-extrabold text-lg text-gray-900 leading-tight">
                    {lang === 'es' ? 'Gestión de Precios' : 'Price Management'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">{selectedEventForPrices.title}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEventForPrices(null)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                <HiOutlineXCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {pricesLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-20 skeleton rounded-xl" />)}</div>
              ) : !eventPricesConfig ? null : eventPricesConfig.sections.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">{lang === 'es' ? 'Este evento no tiene secciones configuradas.' : 'This event has no sections configured.'}</p>
              ) : (
                eventPricesConfig.sections.map((sec: any) => (
                  <div key={sec.id} className="p-4 border border-gray-200 rounded-2xl bg-white space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-sm text-gray-900">{sec.name}</h4>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-bold uppercase tracking-wider">{sec.sectionType}</span>
                      </div>
                      <span className="text-lg font-extrabold text-gray-800">${Number(sec.price).toFixed(2)}</span>
                    </div>

                    {/* Pending price approval */}
                    {sec.pendingPrice !== null && sec.pendingPrice !== undefined && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                        <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                          {lang === 'es' ? 'Cambio de precio pendiente' : 'Pending price change'}
                        </p>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-gray-500 line-through">${Number(sec.price).toFixed(2)}</span>
                          <span className="text-amber-800 font-extrabold text-base">${Number(sec.pendingPrice).toFixed(2)}</span>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleRejectSectionPrice(sec.id)}
                            className="flex-1 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-all active:scale-95"
                          >
                            ❌ {lang === 'es' ? 'Rechazar' : 'Reject'}
                          </button>
                          <button
                            onClick={() => handleApproveSectionPrice(sec.id)}
                            className="flex-1 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-all active:scale-95 shadow-sm"
                          >
                            ✓ {lang === 'es' ? 'Aprobar' : 'Approve'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Admin direct edit */}
                    <div className="flex gap-2 items-center pt-1 border-t border-dashed border-gray-100">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={priceInputs[sec.id] ?? ''}
                        onChange={(e) => setPriceInputs(prev => ({ ...prev, [sec.id]: e.target.value }))}
                        placeholder={lang === 'es' ? 'Nuevo precio...' : 'New price...'}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-300"
                      />
                      <button
                        onClick={() => handleSetSectionPrice(sec.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all active:scale-95 shadow-sm whitespace-nowrap"
                      >
                        {lang === 'es' ? 'Establecer precio' : 'Set price'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-gray-100 shrink-0 space-y-2">
              {eventPricesConfig?.sections?.some((s: any) => s.pendingPrice !== null && s.pendingPrice !== undefined) && (
                <button
                  onClick={async () => {
                    const pending = (eventPricesConfig?.sections ?? []).filter((s: any) => s.pendingPrice !== null && s.pendingPrice !== undefined);
                    for (const sec of pending) {
                      await handleApproveSectionPrice(sec.id);
                    }
                  }}
                  className="w-full py-3 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all active:scale-95 shadow-sm"
                >
                  ✓ {lang === 'es' ? 'Aprobar todos los cambios pendientes' : 'Approve all pending changes'}
                </button>
              )}
              <button
                onClick={() => setSelectedEventForPrices(null)}
                className="w-full py-3 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
              >
                {lang === 'es' ? 'Cerrar' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
