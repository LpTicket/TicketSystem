'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { parseSafeDate, formatDateInTimezone } from '@/lib/dateUtils';
import { useAuthStore } from '@/stores/auth';
import { useLang } from '@/context/LanguageContext';
import { Event, SalesReport } from '@/types';
import { useCategories } from '@/context/CategoryContext';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import {
  HiOutlineCurrencyDollar,
  HiOutlineTicket,
  HiOutlineCalendar,
  HiOutlineShoppingCart,
  HiOutlinePlusCircle,
  HiOutlineChartBar,
  HiOutlineArrowRight,
  HiOutlineX,
  HiOutlineCheckCircle,
  HiOutlineClock,
} from 'react-icons/hi';

export default function OrganizerDashboard() {
  const { user } = useAuthStore();
  const { t, lang } = useLang();
  const { getCategoryInfo } = useCategories();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalRevenue: 0, totalTickets: 0, activeEvents: 0, totalOrders: 0 });

  // Creator commission drawer
  const [showCommission, setShowCommission] = useState(false);
  const [commissionInputs, setCommissionInputs] = useState<Record<string, string>>({});
  const [commissionModes, setCommissionModes] = useState<Record<string, 'fixed' | 'percent'>>({});
  const [commissionSaving, setCommissionSaving] = useState<string | null>(null);
  const [eventSections, setEventSections] = useState<Record<string, any[]>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await api.get('/events', { params: { limit: 100, includePast: 'true' } });
      const myEvents = (data.events || []).filter((e: Event) => e.organizerId === user?.id);
      setEvents(myEvents);

      // Aggregate stats from all events
      let totalRevenue = 0;
      let totalTickets = 0;
      let totalOrders = 0;
      const activeEvents = myEvents.filter((e: Event) => e.status === 'published' && parseSafeDate(e.eventDate).getTime() >= Date.now()).length;

      for (const ev of myEvents) {
        try {
          const { data: sales } = await api.get(`/orders/event/${ev.id}/sales`);
          totalRevenue += sales.totalRevenue || 0;
          totalTickets += sales.totalTickets || 0;
          totalOrders += sales.totalOrders || 0;
        } catch {}
      }

      setStats({ totalRevenue, totalTickets, activeEvents, totalOrders });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCommissionDrawer = async () => {
    setShowCommission(true);
    const inputs: Record<string, string> = {};
    const modes: Record<string, 'fixed' | 'percent'> = {};
    const sections: Record<string, any[]> = {};
    for (const ev of events) {
      inputs[ev.id] = Number(ev.creatorCommission || 0).toFixed(2);
      modes[ev.id] = 'fixed';
      try {
        const { data } = await api.get(`/events/${ev.id}/sections`);
        sections[ev.id] = (data || []).filter((s: any) => s.sectionType !== 'stage' && s.sectionType !== 'decor');
      } catch { sections[ev.id] = []; }
    }
    setCommissionInputs(inputs);
    setCommissionModes(modes);
    setEventSections(sections);
  };

  const handleSaveCommission = async (ev: Event) => {
    const raw = parseFloat(commissionInputs[ev.id] ?? '0');
    if (isNaN(raw) || raw < 0) return;
    const mode = commissionModes[ev.id] ?? 'fixed';
    const secs = eventSections[ev.id] ?? [];
    let amount = raw;
    if (mode === 'percent' && secs.length > 0) {
      const avg = secs.reduce((s: number, sec: any) => s + Number(sec.price), 0) / secs.length;
      amount = Math.round(avg * (raw / 100) * 100) / 100;
    }
    setCommissionSaving(ev.id);
    try {
      await api.patch(`/events/${ev.id}/creator-commission`, { amount });
      const { default: toast } = await import('react-hot-toast');
      toast.success(
        ev.status === 'published'
          ? (lang === 'es' ? 'Solicitud enviada al admin' : 'Request sent to admin')
          : (lang === 'es' ? 'Comisión guardada' : 'Commission saved')
      );
      await loadData();
    } catch (err: any) {
      const { default: toast } = await import('react-hot-toast');
      toast.error(err.response?.data?.message || 'Error');
    } finally {
      setCommissionSaving(null);
    }
  };

  const dateFnsLocale = lang === 'es' ? es : enUS;

  const statCards = [
    { label: t('orgTotalRevenue'), value: `$${stats.totalRevenue.toFixed(2)}`, icon: HiOutlineCurrencyDollar, color: 'from-green-500 to-emerald-600', bg: 'bg-green-50', iconColor: 'text-green-600' },
    { label: t('orgTicketsSold'), value: stats.totalTickets.toString(), icon: HiOutlineTicket, color: 'from-blue-500 to-[#0A375A]', bg: 'bg-[rgba(10,55,90,0.06)]', iconColor: 'text-[#0A375A]' },
    { label: t('orgActiveEvents'), value: stats.activeEvents.toString(), icon: HiOutlineCalendar, color: 'from-orange-500 to-amber-600', bg: 'bg-orange-50', iconColor: 'text-[#F97316]' },
    { label: t('orgTotalOrders'), value: stats.totalOrders.toString(), icon: HiOutlineShoppingCart, color: 'from-[rgba(10,55,90,0.06)] to-[rgba(10,55,90,0.12)]', bg: 'bg-[rgba(10,55,90,0.05)]', iconColor: 'text-[#0A375A]' },
  ];

  const getStatusBadge = (status: string, isPast: boolean) => {
    if (isPast) {
      return { label: lang === 'es' ? 'Finalizado' : 'Ended', classes: 'bg-gray-100 text-gray-500 border border-gray-200' };
    }
    switch (status) {
      case 'published': return { label: t('orgPublished'), classes: 'bg-green-100 text-green-700' };
      case 'draft': return { label: t('orgDraft'), classes: 'bg-yellow-100 text-yellow-700' };
      case 'pending_approval': return { label: t('orgPending'), classes: 'bg-[rgba(10,55,90,0.10)] text-[#0A375A]' };
      case 'cancelled': return { label: t('orgCancelled'), classes: 'bg-red-100 text-red-700' };
      default: return { label: status, classes: 'bg-gray-100 text-gray-700' };
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="h-4 skeleton rounded w-2/3 mb-3" />
              <div className="h-8 skeleton rounded w-1/2" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="h-5 skeleton rounded w-1/4 mb-4" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 skeleton rounded mb-3" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="premium-shell p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="premium-page-title font-black text-2xl">{t('orgWelcome')}, {user?.firstName} 👋</h1>
          <p className="premium-muted text-sm mt-1 font-medium">{t('orgManageEvents')}</p>
        </div>
        <Link href="/organizer/events/create" className="btn-primary text-sm inline-flex items-center gap-2 self-start">
          <HiOutlinePlusCircle className="w-5 h-5" />
          {t('orgCreateEvent')}
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="premium-stat-card p-5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Creator Commission Card */}
      <div className="premium-section-card">
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
              <HiOutlineCurrencyDollar className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="font-extrabold text-gray-900 text-base">
                {lang === 'es' ? 'Comisión para Códigos de Creador' : 'Creator Code Commission'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {lang === 'es'
                  ? 'Define cuánto gana un creador/influencer por cada entrada vendida con su código en tus eventos.'
                  : 'Set how much a creator/influencer earns per ticket sold with their code at your events.'}
              </p>
            </div>
          </div>
          <button
            onClick={openCommissionDrawer}
            className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-sm shrink-0"
          >
            {lang === 'es' ? 'Configurar' : 'Configure'}
            <HiOutlineArrowRight className="w-4 h-4" />
          </button>
        </div>
        {events.some(ev => Number(ev.creatorCommission) > 0 || (ev.pendingCreatorCommission !== null && ev.pendingCreatorCommission !== undefined)) && (
          <div className="px-6 pb-5 flex flex-wrap gap-2">
            {events.filter(ev => Number(ev.creatorCommission) > 0 || (ev.pendingCreatorCommission !== null && ev.pendingCreatorCommission !== undefined)).map(ev => (
              <div key={ev.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold bg-white border-gray-200">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.pendingCreatorCommission != null ? '#f59e0b' : '#10b981' }} />
                <span className="text-gray-700 truncate max-w-[120px]">{ev.title}</span>
                <span className={ev.pendingCreatorCommission != null ? 'text-amber-600' : 'text-emerald-700'}>
                  ${ev.pendingCreatorCommission != null ? Number(ev.pendingCreatorCommission).toFixed(2) : Number(ev.creatorCommission).toFixed(2)}
                </span>
                {ev.pendingCreatorCommission != null && <HiOutlineClock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                {ev.pendingCreatorCommission == null && Number(ev.creatorCommission) > 0 && <HiOutlineCheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Events */}
      <div className="premium-section-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-lg text-gray-900">{t('orgRecentEvents')}</h2>
          <Link href="/organizer/events" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
            {t('orgViewAll')} <HiOutlineArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {events.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {events.slice(0, 5).map((ev) => {
              const isPast = parseSafeDate(ev.eventDate).getTime() < Date.now();
              const badge = getStatusBadge(ev.status, isPast);
              const catInfo = getCategoryInfo(ev.category);
              return (
                <div key={ev.id} className={`px-6 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors ${isPast ? 'opacity-60 bg-gray-50/20' : ''}`}>
                  {/* Event image */}
                  <div className={`w-14 h-14 rounded-lg bg-gray-100 overflow-hidden shrink-0 ${isPast ? 'grayscale' : ''}`}>
                    {ev.imageUrl ? (
                      <img src={ev.imageUrl} alt={ev.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">{catInfo?.icon || '🎫'}</div>
                    )}
                  </div>

                  {/* Event info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className={`font-semibold text-gray-900 truncate text-sm ${isPast ? 'line-through text-gray-400' : ''}`}>{ev.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.classes}`}>{badge.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      📅 {formatDateInTimezone(ev.eventDate, ev.eventTimezone || 'UTC', lang === 'es' ? 'es' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} · 📍 {ev.venueName}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="hidden sm:block text-right shrink-0">
                    {ev.minPrice ? (
                      <span className="text-sm font-bold text-gray-900">${ev.minPrice}</span>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </div>

                  {/* Action */}
                  <Link
                    href={`/organizer/events/${ev.id}`}
                    className="shrink-0 text-primary-600 hover:text-primary-700 text-xs font-medium flex items-center gap-1"
                  >
                    <HiOutlineChartBar className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('orgViewSales')}</span>
                  </Link>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <HiOutlineCalendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium mb-4">{t('orgNoEvents')}</p>
            <Link href="/organizer/events/create" className="btn-primary text-sm inline-flex items-center gap-2">
              <HiOutlinePlusCircle className="w-5 h-5" />
              {t('orgCreateFirst')}
            </Link>
          </div>
        )}
      </div>
      {/* Creator Commission Drawer */}
      {showCommission && (
        <div className="fixed inset-0 z-[9999] flex justify-end">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowCommission(false)} />
          <div className="relative w-full max-w-xl bg-white h-screen shadow-2xl flex flex-col z-10 border-l border-gray-100 animate-[slideOver_0.25s_ease-out]">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-orange-50/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <HiOutlineCurrencyDollar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-extrabold text-gray-900 text-base leading-tight">
                    {lang === 'es' ? 'Comisión para Códigos de Creador' : 'Creator Code Commission'}
                  </h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {lang === 'es' ? 'Por entrada vendida con código' : 'Per ticket sold with code'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCommission(false)} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            {/* Explanation */}
            <div className="px-6 py-4 bg-orange-50/30 border-b border-orange-100 shrink-0">
              <p className="text-xs text-gray-600 leading-relaxed">
                {lang === 'es'
                  ? 'Cada vez que alguien compra una entrada usando el código de un creador, ese creador recibe el monto que configures aquí. En eventos publicados, el monto va a aprobación del admin antes de activarse.'
                  : 'Every time someone buys a ticket using a creator\'s code, that creator receives the amount you set here. On published events, the amount goes to admin approval before activating.'}
              </p>
            </div>

            {/* Events list */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {events.filter(ev => ev.status !== 'cancelled').length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">{lang === 'es' ? 'No tienes eventos.' : 'You have no events.'}</p>
              ) : (
                events.filter(ev => ev.status !== 'cancelled').map(ev => {
                  const secs = eventSections[ev.id] ?? [];
                  const mode = commissionModes[ev.id] ?? 'fixed';
                  const rawVal = parseFloat(commissionInputs[ev.id] ?? '0') || 0;
                  const activeCommission = Number(ev.creatorCommission || 0);
                  const pending = ev.pendingCreatorCommission;

                  const calcEarning = (ticketPrice: number) =>
                    mode === 'percent' ? ticketPrice * (rawVal / 100) : rawVal;

                  return (
                    <div key={ev.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                      {/* Event header */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <div className="w-8 h-8 rounded-lg bg-gray-200 overflow-hidden shrink-0">
                          {ev.imageUrl
                            ? <img src={ev.imageUrl} className="w-full h-full object-cover" alt="" />
                            : <div className="w-full h-full flex items-center justify-center text-sm">🎫</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-gray-900 truncate">{ev.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${ev.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {ev.status === 'published' ? (lang === 'es' ? 'Publicado' : 'Published') : (lang === 'es' ? 'Borrador' : 'Draft')}
                            </span>
                            {activeCommission > 0 && pending == null && (
                              <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                                <HiOutlineCheckCircle className="w-3.5 h-3.5" />
                                ${activeCommission.toFixed(2)} {lang === 'es' ? 'activo' : 'active'}
                              </span>
                            )}
                            {pending != null && (
                              <span className="flex items-center gap-1 text-[10px] text-amber-700 font-semibold">
                                <HiOutlineClock className="w-3.5 h-3.5" />
                                ${Number(pending).toFixed(2)} {lang === 'es' ? 'pendiente' : 'pending'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        {/* Mode toggle + input */}
                        <div className="flex gap-2 items-center">
                          <div className="flex rounded-xl overflow-hidden border border-gray-200 shrink-0 text-[11px] font-bold">
                            <button type="button" onClick={() => setCommissionModes(p => ({ ...p, [ev.id]: 'fixed' }))}
                              className={`px-3 py-2 transition-colors ${mode === 'fixed' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                              $ {lang === 'es' ? 'Fijo' : 'Fixed'}
                            </button>
                            <button type="button" onClick={() => setCommissionModes(p => ({ ...p, [ev.id]: 'percent' }))}
                              className={`px-3 py-2 transition-colors ${mode === 'percent' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                              % {lang === 'es' ? 'del precio' : 'of price'}
                            </button>
                          </div>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">{mode === 'fixed' ? '$' : '%'}</span>
                            <input
                              type="number" step="0.01" min="0" max={mode === 'percent' ? 100 : undefined}
                              value={commissionInputs[ev.id] ?? '0'}
                              onChange={e => setCommissionInputs(p => ({ ...p, [ev.id]: e.target.value }))}
                              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300"
                            />
                          </div>
                          <button
                            disabled={commissionSaving === ev.id}
                            onClick={() => handleSaveCommission(ev)}
                            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 shrink-0"
                          >
                            {commissionSaving === ev.id
                              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              : ev.status === 'published' ? (lang === 'es' ? 'Solicitar' : 'Request') : (lang === 'es' ? 'Guardar' : 'Save')}
                          </button>
                        </div>

                        {/* Per-section preview */}
                        {secs.length > 0 && rawVal > 0 && (
                          <div className="rounded-xl border border-gray-100 overflow-hidden">
                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {lang === 'es' ? 'Ganancias del creador por sección' : 'Creator earnings per section'}
                              </p>
                            </div>
                            {secs.map((sec: any) => {
                              const earning = calcEarning(Number(sec.price));
                              const pct = Number(sec.price) > 0 ? (earning / Number(sec.price)) * 100 : 0;
                              return (
                                <div key={sec.id} className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-50 last:border-0">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sec.color }} />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-gray-800 truncate">{sec.name}</p>
                                    <p className="text-[10px] text-gray-400">
                                      {lang === 'es' ? 'Precio entrada' : 'Ticket price'}: <span className="font-semibold text-gray-600">${Number(sec.price).toFixed(2)}</span>
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-extrabold text-orange-600">${earning.toFixed(2)}</p>
                                    <p className="text-[10px] text-gray-400">{pct.toFixed(1)}%</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 shrink-0">
              <button onClick={() => setShowCommission(false)}
                className="w-full py-3 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
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
    </div>
  );
}
