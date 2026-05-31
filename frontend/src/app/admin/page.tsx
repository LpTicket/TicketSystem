'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import {
  HiOutlineUsers,
  HiOutlineCalendar,
  HiOutlineCurrencyDollar,
  HiOutlineShoppingCart,
  HiOutlineTicket,
  HiOutlineUserGroup,
} from 'react-icons/hi';

interface DashboardStats {
  totalUsers: number;
  clients: number;
  admins: number;
  totalEvents: number;
  publishedEvents: number;
  draftEvents: number;
  totalOrders: number;
  paidOrders: number;
  totalRevenue: number;
  ticketSales: number;
  serviceFees: number;
  stripeFees: number;
  stripePercent: number;
  stripeFixed: number;
  lpticketProfit: number;
  totalTickets: number;
}

interface EventFinancial {
  id: string;
  title: string;
  slug: string;
  status: string;
  eventDate: string;
  totalCharged: number;
  ticketSales: number;
  serviceFees: number;
  stripeFees: number;
  lpticketProfit: number;
  ticketsSold: number;
  orders: number;
}

export default function AdminDashboard() {
  const { t, lang } = useLang();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [eventFinancials, setEventFinancials] = useState<EventFinancial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    try {
      const [statsRes, finRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/events/financials').catch(() => ({ data: { events: [] } })),
      ]);
      setStats(statsRes.data);
      setEventFinancials(finRes.data?.events || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="h-8 skeleton rounded w-1/4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 skeleton rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className="h-40 skeleton rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const mainCards = [
    { label: t('adminTotalRevenue'), value: `$${stats.totalRevenue.toFixed(2)}`, icon: HiOutlineCurrencyDollar, bg: 'bg-green-50', iconColor: 'text-green-600', iconBg: 'bg-green-100' },
    { label: t('adminTotalUsers'), value: stats.totalUsers.toString(), icon: HiOutlineUsers, bg: 'bg-[rgba(10,55,90,0.06)]', iconColor: 'text-[#0A375A]', iconBg: 'bg-[rgba(10,55,90,0.10)]' },
    { label: t('adminTotalEvents'), value: stats.totalEvents.toString(), icon: HiOutlineCalendar, bg: 'bg-orange-50', iconColor: 'text-[#F97316]', iconBg: 'bg-orange-50' },
    { label: t('adminTotalOrders'), value: stats.totalOrders.toString(), icon: HiOutlineShoppingCart, bg: 'bg-[rgba(10,55,90,0.05)]', iconColor: 'text-[#0A375A]', iconBg: 'bg-[rgba(10,55,90,0.10)]' },
  ];

  return (
    <div className="premium-shell p-6 lg:p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="premium-page-title font-black text-2xl">{t('adminDashboard')}</h1>
        <p className="premium-muted text-sm mt-1 font-medium">{lang === 'es' ? 'Vista general de la plataforma' : 'Platform overview'}</p>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainCards.map((card, i) => (
          <div key={i} className="premium-stat-card p-5 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500">{card.label}</span>
              <div className={`w-10 h-10 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.iconColor}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Breakdown */}
        <div className="premium-section-card p-6 transition-all">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <HiOutlineUserGroup className="w-5 h-5 text-gray-400" />
            {t('adminUserManagement')}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[rgba(10,55,90,0.06)] rounded-xl p-4 text-center border border-[rgba(10,55,90,0.14)] shadow-sm">
              <p className="text-2xl font-black text-[#0A375A]">{stats.clients}</p>
              <p className="text-xs text-[#0A375A] font-bold mt-1 uppercase tracking-wider">
                {lang === 'es' ? 'Clientes-Organizadores' : 'Clients-Organizers'}
              </p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100 shadow-sm">
              <p className="text-2xl font-black text-red-700">{stats.admins}</p>
              <p className="text-xs text-red-600 font-bold mt-1 uppercase tracking-wider">
                {lang === 'es' ? 'Administradores' : 'Administrators'}
              </p>
            </div>
          </div>
        </div>

        {/* Events & Tickets */}
        <div className="premium-section-card p-6 transition-all">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <HiOutlineTicket className="w-5 h-5 text-gray-400" />
            {t('adminEventManagement')}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-700">{stats.publishedEvents}</p>
              <p className="text-xs text-green-600 font-medium">{t('adminPublished')}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-yellow-700">{stats.draftEvents}</p>
              <p className="text-xs text-yellow-600 font-medium">{t('adminDrafts')}</p>
            </div>
            <div className="bg-[rgba(10,55,90,0.05)] rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-[#0A375A]">{stats.totalTickets}</p>
              <p className="text-xs text-[#0A375A] font-medium">{t('adminTicketsSold')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial breakdown */}
      <div className="premium-section-card p-6 transition-all">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <HiOutlineCurrencyDollar className="w-5 h-5 text-gray-400" />
            {lang === 'es' ? 'Desglose financiero' : 'Financial breakdown'}
          </h3>
          <span className="text-[11px] font-bold text-gray-400">
            {lang === 'es' ? 'Solo órdenes pagadas' : 'Paid orders only'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total charged */}
          <div className="rounded-xl p-4 border border-[rgba(10,55,90,0.14)] bg-[rgba(10,55,90,0.06)]">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#0A375A]">{lang === 'es' ? 'Total cobrado' : 'Total charged'}</p>
            <p className="text-2xl font-black text-[#0A375A] mt-1">${stats.totalRevenue.toFixed(2)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{lang === 'es' ? 'Lo que pagaron los compradores' : 'What buyers paid'}</p>
          </div>
          {/* Ticket sales (to organizers) */}
          <div className="rounded-xl p-4 border border-blue-100 bg-blue-50">
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-700">{lang === 'es' ? 'Venta de entradas' : 'Ticket sales'}</p>
            <p className="text-2xl font-black text-blue-700 mt-1">${stats.ticketSales.toFixed(2)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{lang === 'es' ? 'Para los organizadores' : 'To organizers'}</p>
          </div>
          {/* Service fees collected */}
          <div className="rounded-xl p-4 border border-orange-100 bg-orange-50">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#F97316]">{lang === 'es' ? 'Comisión LPTicket' : 'LPTicket fees'}</p>
            <p className="text-2xl font-black text-[#F97316] mt-1">${stats.serviceFees.toFixed(2)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{lang === 'es' ? 'Cargo sobre el precio base' : 'Markup over base price'}</p>
          </div>
          {/* Stripe fees */}
          <div className="rounded-xl p-4 border border-[rgba(168,85,247,0.3)] bg-[rgba(168,85,247,0.12)]">
            <p className="text-[11px] font-black uppercase tracking-wider text-purple-300">{lang === 'es' ? 'Comisión Stripe' : 'Stripe fees'}</p>
            <p className="text-2xl font-black text-purple-300 mt-1">-${stats.stripeFees.toFixed(2)}</p>
            <p className="text-[11px] text-gray-400 mt-1">{(stats.stripePercent * 100).toFixed(1)}% + ${stats.stripeFixed.toFixed(2)} {lang === 'es' ? 'por orden' : 'per order'}</p>
          </div>
          {/* LPTicket net profit */}
          <div className="rounded-xl p-4 border border-green-200 bg-green-50 sm:col-span-2 lg:col-span-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-green-700">{lang === 'es' ? 'Ganancia LPTicket' : 'LPTicket profit'}</p>
            <p className="text-2xl font-black text-green-700 mt-1">${stats.lpticketProfit.toFixed(2)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{lang === 'es' ? 'Comisión − Stripe (neto)' : 'Fees − Stripe (net)'}</p>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          {lang === 'es'
            ? 'La comisión de Stripe es estimada con su tarifa estándar (2.9% + $0.30 por cargo).'
            : 'Stripe fees are estimated using its standard rate (2.9% + $0.30 per charge).'}
        </p>
      </div>

      {/* Per-event financial breakdown */}
      <div className="premium-section-card p-6 transition-all">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <HiOutlineCurrencyDollar className="w-5 h-5 text-gray-400" />
            {lang === 'es' ? 'Métricas por evento' : 'Per-event metrics'}
          </h3>
          <span className="text-[11px] font-bold text-gray-400">{eventFinancials.length} {lang === 'es' ? 'eventos' : 'events'}</span>
        </div>

        {eventFinancials.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">{lang === 'es' ? 'No hay eventos todavía.' : 'No events yet.'}</p>
        ) : (
          <div className="overflow-x-auto custom-scrollbar -mx-2 px-2">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-white/10">
                  <th className="py-3 pr-4 font-bold">{lang === 'es' ? 'Evento' : 'Event'}</th>
                  <th className="py-3 px-3 font-bold text-center">{lang === 'es' ? 'Boletos' : 'Tickets'}</th>
                  <th className="py-3 px-3 font-bold text-right">{lang === 'es' ? 'Total cobrado' : 'Total charged'}</th>
                  <th className="py-3 px-3 font-bold text-right">{lang === 'es' ? 'Venta entradas' : 'Ticket sales'}</th>
                  <th className="py-3 px-3 font-bold text-right">{lang === 'es' ? 'Comisión LPT' : 'LPTicket fees'}</th>
                  <th className="py-3 px-3 font-bold text-right">Stripe</th>
                  <th className="py-3 pl-3 font-bold text-right">{lang === 'es' ? 'Ganancia LPT' : 'LPTicket profit'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {eventFinancials.map((ev) => (
                  <tr key={ev.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 pr-4 max-w-[240px]">
                      <Link href={`/events/${ev.slug}`} className="font-bold text-[#e2e8f0] hover:text-[#F97316] truncate block">{ev.title}</Link>
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">{ev.status} · {ev.orders} {lang === 'es' ? 'órdenes' : 'orders'}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-slate-300">{ev.ticketsSold}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-200">${ev.totalCharged.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-bold text-blue-300">${ev.ticketSales.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-bold text-[#F97316]">${ev.serviceFees.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right font-bold text-purple-300">-${ev.stripeFees.toFixed(2)}</td>
                    <td className="py-3 pl-3 text-right font-black text-green-400">${ev.lpticketProfit.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-3">
          {lang === 'es'
            ? 'Comisión Stripe estimada (2.9% + $0.30 por orden). Ganancia LPT = comisión − Stripe.'
            : 'Stripe fees estimated (2.9% + $0.30 per order). LPTicket profit = fees − Stripe.'}
        </p>
      </div>
    </div>
  );
}
