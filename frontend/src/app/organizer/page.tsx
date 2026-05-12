'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
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
  const [stats, setStats] = useState({ totalRevenue: 0, totalTickets: 0, activeEvents: 0, totalOrders: 0 });

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
      const activeEvents = myEvents.filter((e: Event) => e.status === 'published' && new Date(e.eventDate).getTime() >= Date.now()).length;

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

  const dateFnsLocale = lang === 'es' ? es : enUS;

  const statCards = [
    { label: t('orgTotalRevenue'), value: `$${stats.totalRevenue.toFixed(2)}`, icon: HiOutlineCurrencyDollar, color: 'from-green-500 to-emerald-600', bg: 'bg-green-50', iconColor: 'text-green-600' },
    { label: t('orgTicketsSold'), value: stats.totalTickets.toString(), icon: HiOutlineTicket, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', iconColor: 'text-blue-600' },
    { label: t('orgActiveEvents'), value: stats.activeEvents.toString(), icon: HiOutlineCalendar, color: 'from-orange-500 to-amber-600', bg: 'bg-orange-50', iconColor: 'text-orange-600' },
    { label: t('orgTotalOrders'), value: stats.totalOrders.toString(), icon: HiOutlineShoppingCart, color: 'from-purple-500 to-violet-600', bg: 'bg-purple-50', iconColor: 'text-purple-600' },
  ];

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
    <div className="p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-bold text-2xl text-gray-900">{t('orgWelcome')}, {user?.firstName} 👋</h1>
          <p className="text-gray-500 text-sm mt-1">{t('orgManageEvents')}</p>
        </div>
        <Link href="/organizer/events/create" className="btn-primary text-sm inline-flex items-center gap-2 self-start">
          <HiOutlinePlusCircle className="w-5 h-5" />
          {t('orgCreateEvent')}
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-md transition-shadow">
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

      {/* Recent Events */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-bold text-lg text-gray-900">{t('orgRecentEvents')}</h2>
          <Link href="/organizer/events" className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
            {t('orgViewAll')} <HiOutlineArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {events.length > 0 ? (
          <div className="divide-y divide-gray-100">
            {events.slice(0, 5).map((ev) => {
              const isPast = new Date(ev.eventDate).getTime() < Date.now();
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
                      📅 {format(new Date(ev.eventDate), "dd MMM yyyy — HH:mm", { locale: dateFnsLocale })} · 📍 {ev.venueName}
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
