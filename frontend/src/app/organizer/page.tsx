'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api, { getImageUrl } from '@/lib/api';
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
} from 'react-icons/hi';

export default function OrganizerDashboard() {
  const { user } = useAuthStore();
  const { t, lang } = useLang();
  const { getCategoryInfo } = useCategories();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0, totalTickets: 0, activeEvents: 0, totalOrders: 0,
    netEstimated: 0, scannedTickets: 0, pendingTickets: 0,
    salesByDay: [] as { date: string; orders: number; tickets: number; revenue: number }[],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Fetch organizer events and aggregated stats in parallel via dedicated
      // endpoints (1 DB query each) instead of N+1 requests per event.
      const [eventsRes, statsRes] = await Promise.all([
        api.get('/events/mine/list'),
        api.get('/orders/organizer/stats'),
      ]);

      const myEvents: Event[] = eventsRes.data || [];
      setEvents(myEvents);

      const activeEvents = myEvents.filter(
        (e) => e.status === 'published' && parseSafeDate(e.eventDate).getTime() >= Date.now(),
      ).length;

      setStats({
        totalRevenue: statsRes.data.totalRevenue || 0,
        totalTickets: statsRes.data.totalTickets || 0,
        totalOrders: statsRes.data.totalOrders || 0,
        activeEvents,
        netEstimated: statsRes.data.netEstimated || 0,
        scannedTickets: statsRes.data.scannedTickets || 0,
        pendingTickets: statsRes.data.pendingTickets || 0,
        salesByDay: statsRes.data.salesByDay || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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
              <div className="public-premium-icon w-10 h-10 flex items-center justify-center">
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Sales chart + access control */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales by day (last 14 days) */}
        <div className="premium-section-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-lg text-gray-900">{lang === 'es' ? 'Ventas por día' : 'Sales by day'}</h2>
              <p className="text-xs font-semibold text-gray-500">{lang === 'es' ? 'Últimos 14 días · todos tus eventos' : 'Last 14 days · all your events'}</p>
            </div>
            <HiOutlineChartBar className="w-5 h-5 text-[#F97316]" />
          </div>
          {stats.salesByDay.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">{lang === 'es' ? 'Aún no hay ventas en este periodo.' : 'No sales in this period yet.'}</p>
          ) : (
            <div className="space-y-2.5">
              {(() => {
                const maxRevenue = Math.max(...stats.salesByDay.map((d) => d.revenue), 1);
                return stats.salesByDay.map((day) => (
                  <div key={day.date}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-300">
                        {format(parseSafeDate(`${day.date}T12:00:00`), 'd MMM', { locale: dateFnsLocale })}
                      </span>
                      <span className="font-black text-[#F97316]">${day.revenue.toFixed(2)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-[#F97316]" style={{ width: `${Math.max(4, (day.revenue / maxRevenue) * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">{day.orders} {lang === 'es' ? 'órdenes' : 'orders'} · {day.tickets} tickets</p>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>

        {/* Access control + net revenue */}
        <div className="space-y-4">
          <div className="premium-section-card p-6">
            <h2 className="font-bold text-lg text-gray-900 mb-1">{lang === 'es' ? 'Control de acceso' : 'Access control'}</h2>
            <p className="text-xs font-semibold text-gray-500 mb-4">{lang === 'es' ? 'Tickets escaneados vs pendientes' : 'Scanned vs pending tickets'}</p>
            {(() => {
              const total = stats.scannedTickets + stats.pendingTickets;
              const pct = total > 0 ? Math.round((stats.scannedTickets / total) * 100) : 0;
              return (
                <>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-3xl font-black text-green-400">{pct}%</span>
                    <span className="text-xs text-gray-400">{stats.scannedTickets} / {total} {lang === 'es' ? 'ingresados' : 'checked in'}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl p-3 bg-green-500/10 border border-green-500/20 text-center">
                      <p className="text-xl font-black text-green-400">{stats.scannedTickets}</p>
                      <p className="text-[10px] uppercase tracking-wider text-green-300/80 font-bold">{lang === 'es' ? 'Ingresados' : 'Scanned'}</p>
                    </div>
                    <div className="rounded-xl p-3 bg-orange-500/10 border border-orange-500/20 text-center">
                      <p className="text-xl font-black text-[#F97316]">{stats.pendingTickets}</p>
                      <p className="text-[10px] uppercase tracking-wider text-orange-300/80 font-bold">{lang === 'es' ? 'Pendientes' : 'Pending'}</p>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          <div className="premium-section-card p-6">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{lang === 'es' ? 'Neto estimado' : 'Estimated net'}</p>
            <p className="text-2xl font-black text-green-400 mt-1">${stats.netEstimated.toFixed(2)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{lang === 'es' ? 'Venta de entradas menos comisión de pago estimada.' : 'Ticket sales minus estimated processing fee.'}</p>
          </div>
        </div>
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
                      <img src={getImageUrl(ev.imageUrl)} alt={ev.title} className="w-full h-full object-cover" />
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
    </div>
  );
}
