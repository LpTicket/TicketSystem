'use client';

/**
 * Admin home (web) — /admin
 * EN: Admin landing with dashboard stats; gateways to user, event, category,
 *     marketing, special-code and analytics management (admin role required).
 * ES: Inicio de admin con estadísticas del panel; acceso a la gestión de
 *     usuarios, eventos, categorías, marketing, códigos especiales y analítica
 *     (requiere rol admin).
 */
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { formatDateInTimezone } from '@/lib/dateUtils';
import { useLang } from '@/context/LanguageContext';
import {
  HiOutlineUsers,
  HiOutlineCalendar,
  HiOutlineCurrencyDollar,
  HiOutlineShoppingCart,
  HiOutlineTicket,
  HiOutlineUserGroup,
  HiOutlineExclamationCircle,
  HiOutlineRefresh,
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
  organizerProcessingAdjustments: number;
  organizerPaid: number;
  organizerPending: number;
  klarnaOrders: number;
  klarnaTotalCharged: number;
  klarnaTicketSales: number;
  pendingFeeReconciliations: number;
  recentKlarnaOrders: KlarnaOrder[];
  totalTickets: number;
}

interface KlarnaOrder {
  id: string;
  paidAt: string | null;
  total: number;
  subtotal: number;
  ticketCount: number;
  organizerProcessingAdjustment: number;
  stripeFeeReconciliationStatus: string;
  buyer: { firstName: string | null; lastName: string | null; email: string | null };
  event: { id: string; title: string };
}

interface EventFinancial {
  id: string;
  title: string;
  slug: string;
  status: string;
  eventDate: string;
  eventTimezone?: string;
  totalCharged: number;
  ticketSales: number;
  serviceFees: number;
  stripeFees: number;
  lpticketProfit: number;
  organizerProcessingAdjustments: number;
  organizerPaid: number;
  organizerPending: number;
  klarnaOrders: number;
  klarnaTotalCharged: number;
  pendingFeeReconciliations: number;
  ticketsSold: number;
  orders: number;
}

export default function AdminDashboard() {
  const { t, lang } = useLang();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [eventFinancials, setEventFinancials] = useState<EventFinancial[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => { loadStats(); }, []);

  const loadStats = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [statsRes, finRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/events/financials').catch(() => ({ data: { events: [] } })),
      ]);
      setStats({
        ...statsRes.data,
        organizerProcessingAdjustments: Number(statsRes.data?.organizerProcessingAdjustments || 0),
        organizerPaid: Number(statsRes.data?.organizerPaid || 0),
        organizerPending: Number(statsRes.data?.organizerPending || 0),
        klarnaOrders: Number(statsRes.data?.klarnaOrders || 0),
        klarnaTotalCharged: Number(statsRes.data?.klarnaTotalCharged || 0),
        klarnaTicketSales: Number(statsRes.data?.klarnaTicketSales || 0),
        pendingFeeReconciliations: Number(statsRes.data?.pendingFeeReconciliations || 0),
        recentKlarnaOrders: statsRes.data?.recentKlarnaOrders || [],
      });
      setEventFinancials((finRes.data?.events || []).map((event: EventFinancial) => ({
        ...event,
        organizerProcessingAdjustments: Number(event.organizerProcessingAdjustments || 0),
        organizerPaid: Number(event.organizerPaid || 0),
        organizerPending: Number(event.organizerPending || 0),
        klarnaOrders: Number(event.klarnaOrders || 0),
        klarnaTotalCharged: Number(event.klarnaTotalCharged || 0),
        pendingFeeReconciliations: Number(event.pendingFeeReconciliations || 0),
      })));
    } catch (err) {
      console.error(err);
      setLoadError(lang === 'es'
        ? 'No se pudo cargar el dashboard. Intenta nuevamente.'
        : 'The dashboard could not be loaded. Please try again.');
    }
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

  if (!stats) {
    return (
      <div className="p-6 lg:p-8">
        <section className="mx-auto max-w-2xl rounded-2xl border border-orange-400/40 bg-[#071f32]/95 p-6 text-center shadow-lg shadow-black/20">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-300">
            <HiOutlineExclamationCircle className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-black text-white">
            {lang === 'es' ? 'No pudimos cargar el dashboard' : 'We could not load the dashboard'}
          </h1>
          <p className="mt-2 text-sm font-medium text-white/70">
            {loadError || (lang === 'es' ? 'Ocurrió un error temporal.' : 'A temporary error occurred.')}
          </p>
          <button
            type="button"
            onClick={loadStats}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-3 text-sm font-black text-white transition hover:bg-[#EA580C]"
          >
            <HiOutlineRefresh className="h-5 w-5" />
            {lang === 'es' ? 'Reintentar' : 'Try again'}
          </button>
        </section>
      </div>
    );
  }

  const mainCards = [
    { label: t('adminTotalRevenue'), value: `$${stats.totalRevenue.toFixed(2)}`, icon: HiOutlineCurrencyDollar, bg: 'bg-green-50', iconColor: 'text-green-600', iconBg: 'bg-green-100' },
    { label: t('adminTotalUsers'), value: stats.totalUsers.toString(), icon: HiOutlineUsers, bg: 'bg-[rgba(10,55,90,0.06)]', iconColor: 'text-[#0A375A]', iconBg: 'bg-[rgba(10,55,90,0.10)]' },
    { label: t('adminTotalEvents'), value: stats.totalEvents.toString(), icon: HiOutlineCalendar, bg: 'bg-orange-50', iconColor: 'text-[#F97316]', iconBg: 'bg-orange-50' },
    { label: t('adminTotalOrders'), value: stats.totalOrders.toString(), icon: HiOutlineShoppingCart, bg: 'bg-[rgba(10,55,90,0.05)]', iconColor: 'text-[#0A375A]', iconBg: 'bg-[rgba(10,55,90,0.10)]' },
  ];

  // Financial figures for the selected scope: a single event, or all events (global stats).
  const selectedEvent = selectedEventId ? eventFinancials.find((e) => e.id === selectedEventId) : null;
  const fin = selectedEvent
    ? {
        totalRevenue: selectedEvent.totalCharged,
        ticketSales: selectedEvent.ticketSales,
        serviceFees: selectedEvent.serviceFees,
        stripeFees: selectedEvent.stripeFees,
        lpticketProfit: selectedEvent.lpticketProfit,
        organizerProcessingAdjustments: selectedEvent.organizerProcessingAdjustments,
        organizerPaid: selectedEvent.organizerPaid,
        organizerPending: selectedEvent.organizerPending,
        klarnaOrders: selectedEvent.klarnaOrders,
        klarnaTotalCharged: selectedEvent.klarnaTotalCharged,
        pendingFeeReconciliations: selectedEvent.pendingFeeReconciliations,
      }
    : {
        totalRevenue: stats.totalRevenue,
        ticketSales: stats.ticketSales,
        serviceFees: stats.serviceFees,
        stripeFees: stats.stripeFees,
        lpticketProfit: stats.lpticketProfit,
        organizerProcessingAdjustments: stats.organizerProcessingAdjustments,
        organizerPaid: stats.organizerPaid,
        organizerPending: stats.organizerPending,
        klarnaOrders: stats.klarnaOrders,
        klarnaTotalCharged: stats.klarnaTotalCharged,
        pendingFeeReconciliations: stats.pendingFeeReconciliations,
      };

  const eventOptionLabel = (event: EventFinancial) => {
    const date = formatDateInTimezone(
      event.eventDate,
      event.eventTimezone || 'America/Chicago',
      lang === 'es' ? 'es-US' : 'en-US',
      { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' },
    );
    return `${event.title} — ${date}`;
  };

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
              <div className="public-premium-icon w-10 h-10 flex items-center justify-center">
                <card.icon className="w-5 h-5" />
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

      {/* Financial breakdown — global or per selected event */}
      <div className="premium-section-card p-6 transition-all">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <HiOutlineCurrencyDollar className="w-5 h-5 text-gray-400" />
            {lang === 'es' ? 'Desglose financiero' : 'Financial breakdown'}
          </h3>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="input text-sm max-w-full sm:max-w-[440px]"
          >
            <option value="">{lang === 'es' ? 'Todos los eventos (global)' : 'All events (global)'}</option>
            {eventFinancials.map((ev) => (
              <option key={ev.id} value={ev.id}>{eventOptionLabel(ev)}</option>
            ))}
          </select>
        </div>

        {selectedEvent && (
          <p className="text-xs text-gray-400 mb-4">
            {selectedEvent.ticketsSold} {lang === 'es' ? 'boletos' : 'tickets'} · {selectedEvent.orders} {lang === 'es' ? 'órdenes pagadas' : 'paid orders'}
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total charged */}
          <div className="rounded-xl p-4 border border-[rgba(10,55,90,0.14)] bg-[rgba(10,55,90,0.06)]">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#0A375A]">{lang === 'es' ? 'Total cobrado' : 'Total charged'}</p>
            <p className="text-2xl font-black text-[#0A375A] mt-1">${fin.totalRevenue.toFixed(2)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{lang === 'es' ? 'Lo que pagaron los compradores' : 'What buyers paid'}</p>
          </div>
          {/* Ticket sales (to organizers) */}
          <div className="rounded-xl p-4 border border-blue-100 bg-blue-50">
            <p className="text-[11px] font-black uppercase tracking-wider text-blue-700">{lang === 'es' ? 'Venta de entradas' : 'Ticket sales'}</p>
            <p className="text-2xl font-black text-blue-700 mt-1">${fin.ticketSales.toFixed(2)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{lang === 'es' ? 'Para los organizadores' : 'To organizers'}</p>
          </div>
          {/* Service fees collected */}
          <div className="rounded-xl p-4 border border-orange-100 bg-orange-50">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#F97316]">{lang === 'es' ? 'Comisión LPTicket' : 'LPTicket fees'}</p>
            <p className="text-2xl font-black text-[#F97316] mt-1">${fin.serviceFees.toFixed(2)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{lang === 'es' ? 'Cargo sobre el precio base' : 'Markup over base price'}</p>
          </div>
          {/* Stripe fees */}
          <div className="rounded-xl p-4 border border-[rgba(168,85,247,0.3)] bg-[rgba(168,85,247,0.12)]">
            <p className="text-[11px] font-black uppercase tracking-wider text-purple-300">{lang === 'es' ? 'Comisión Stripe' : 'Stripe fees'}</p>
            <p className="text-2xl font-black text-purple-300 mt-1">-${fin.stripeFees.toFixed(2)}</p>
            <p className="text-[11px] text-gray-400 mt-1">{(stats.stripePercent * 100).toFixed(1)}% + ${stats.stripeFixed.toFixed(2)} {lang === 'es' ? 'por orden' : 'per order'}</p>
          </div>
          {/* LPTicket net profit */}
          <div className="rounded-xl p-4 border border-green-200 bg-green-50 sm:col-span-2 lg:col-span-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-green-700">{lang === 'es' ? 'Ganancia LPTicket' : 'LPTicket profit'}</p>
            <p className="text-2xl font-black text-green-700 mt-1">${fin.lpticketProfit.toFixed(2)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{lang === 'es' ? 'Comisión − Stripe (neto)' : 'Fees − Stripe (net)'}</p>
          </div>
          <div className="rounded-xl p-4 border border-pink-200 bg-pink-50">
            <p className="text-[11px] font-black uppercase tracking-wider text-pink-700">Klarna</p>
            <p className="text-2xl font-black text-pink-700 mt-1">{fin.klarnaOrders} {lang === 'es' ? 'compras' : 'purchases'}</p>
            <p className="text-[11px] text-gray-500 mt-1">${fin.klarnaTotalCharged.toFixed(2)} {lang === 'es' ? 'cobrados a compradores' : 'charged to buyers'}</p>
          </div>
          <div className="rounded-xl p-4 border border-amber-200 bg-amber-50">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-700">{lang === 'es' ? 'Ajuste adicional Klarna' : 'Additional Klarna adjustment'}</p>
            <p className="text-2xl font-black text-amber-700 mt-1">-${fin.organizerProcessingAdjustments.toFixed(2)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{lang === 'es' ? 'Se descuenta del saldo del organizador' : 'Deducted from the organizer balance'}</p>
          </div>
          <div className="rounded-xl p-4 border border-red-200 bg-red-50">
            <p className="text-[11px] font-black uppercase tracking-wider text-red-700">{lang === 'es' ? 'Pendiente al organizador' : 'Pending to organizer'}</p>
            <p className="text-2xl font-black text-red-700 mt-1">${fin.organizerPending.toFixed(2)}</p>
            <p className="text-[11px] text-gray-500 mt-1">${fin.organizerPaid.toFixed(2)} {lang === 'es' ? 'ya registrados como pagados' : 'already recorded as paid'}</p>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          {lang === 'es'
            ? `La comisión general de Stripe sigue estimada con 2.9% + $0.30. El ajuste Klarna usa el costo real conciliado y no duplica la tarifa estándar.${fin.pendingFeeReconciliations ? ` Hay ${fin.pendingFeeReconciliations} orden(es) esperando conciliación.` : ''}`
            : `General Stripe fees remain estimated at 2.9% + $0.30. The Klarna adjustment uses the reconciled actual cost without duplicating the standard fee.${fin.pendingFeeReconciliations ? ` ${fin.pendingFeeReconciliations} order(s) are awaiting reconciliation.` : ''}`}
        </p>
      </div>

      <div className="premium-section-card overflow-hidden transition-all">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="font-bold text-gray-900">{lang === 'es' ? 'Compras recientes con Klarna' : 'Recent Klarna purchases'}</h3>
          <p className="mt-1 text-xs font-medium text-gray-500">{lang === 'es' ? 'Comprador, evento, total y ajuste aplicado al organizador.' : 'Buyer, event, total and organizer adjustment.'}</p>
        </div>
        {stats.recentKlarnaOrders.length === 0 ? (
          <p className="px-6 py-5 text-sm font-medium text-gray-500">{lang === 'es' ? 'Todavía no hay compras pagadas con Klarna.' : 'There are no paid Klarna purchases yet.'}</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs font-black uppercase tracking-wide text-gray-500">
                <tr><th className="px-6 py-3">{lang === 'es' ? 'Comprador' : 'Buyer'}</th><th className="px-6 py-3">{lang === 'es' ? 'Evento' : 'Event'}</th><th className="px-6 py-3 text-right">{lang === 'es' ? 'Entradas' : 'Tickets'}</th><th className="px-6 py-3 text-right">Total</th><th className="px-6 py-3 text-right">{lang === 'es' ? 'Ajuste' : 'Adjustment'}</th><th className="px-6 py-3">{lang === 'es' ? 'Estado' : 'Status'}</th></tr>
              </thead>
              <tbody>
                {stats.recentKlarnaOrders.map((order) => {
                  const buyerName = `${order.buyer.firstName || ''} ${order.buyer.lastName || ''}`.trim();
                  return (
                    <tr key={order.id} className="border-t border-gray-100">
                      <td className="px-6 py-3"><p className="font-bold text-gray-800">{buyerName || order.buyer.email || '—'}</p><p className="text-xs text-gray-500">{order.buyer.email || ''}</p></td>
                      <td className="px-6 py-3 font-semibold text-gray-700">{order.event.title}</td>
                      <td className="px-6 py-3 text-right text-gray-700">{order.ticketCount}</td>
                      <td className="px-6 py-3 text-right font-black text-[#0A375A]">${order.total.toFixed(2)}</td>
                      <td className="px-6 py-3 text-right font-bold text-amber-700">-${order.organizerProcessingAdjustment.toFixed(2)}</td>
                      <td className="px-6 py-3"><span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${order.stripeFeeReconciliationStatus === 'reconciled' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{order.stripeFeeReconciliationStatus === 'reconciled' ? (lang === 'es' ? 'Conciliado' : 'Reconciled') : (lang === 'es' ? 'Esperando Stripe' : 'Waiting for Stripe')}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
