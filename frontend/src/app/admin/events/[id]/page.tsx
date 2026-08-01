'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  HiOutlineArrowLeft,
  HiOutlineCheckCircle,
  HiOutlineClipboardList,
  HiOutlineCurrencyDollar,
  HiOutlineExclamationCircle,
  HiOutlineTicket,
  HiOutlineUsers,
} from 'react-icons/hi';
import api from '@/lib/api';
import { useLang } from '@/context/LanguageContext';

type FinancialOrder = {
  id: string;
  paidAt: string;
  buyer: { firstName?: string; lastName?: string; email?: string } | null;
  expectedTickets: number;
  issuedTickets: number;
  extraIssuedTickets: number;
  subtotal: number;
  lpFee: number;
  processingFee: number;
  total: number;
  salesChannel: string | null;
  ticketPrices: Record<string, number>;
};

type FinancialDetail = {
  event: {
    id: string;
    title: string;
    eventDate: string;
    eventTimezone?: string;
    venueName?: string;
    currency?: string;
    organizer?: { firstName?: string; lastName?: string; email?: string } | null;
  };
  summary: {
    paidOrders: number;
    buyers: number;
    expectedTickets: number;
    issuedTickets: number;
    extraIssuedTickets: number;
    missingTickets: number;
    cancelledTickets: number;
    scannedTickets: number;
    pendingTickets: number;
    lockedSeats: number;
    ticketRevenue: number;
    lpFees: number;
    processingFees: number;
    grossCharged: number;
  };
  sections: Array<{ name: string; issued: number; scanned: number; pending: number }>;
  orders: FinancialOrder[];
};

export default function AdminEventFinancialDetailPage() {
  const { lang } = useLang();
  const params = useParams<{ id: string }>();
  const eventId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [detail, setDetail] = useState<FinancialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    setLoading(true);
    setError('');
    api.get(`/admin/events/${eventId}/financial-detail`)
      .then(({ data }) => {
        if (active) setDetail(data);
      })
      .catch((requestError: any) => {
        if (active) setError(requestError.response?.data?.message || (lang === 'es' ? 'No se pudo cargar el detalle financiero.' : 'Could not load the financial detail.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [eventId, lang]);

  const currency = detail?.event.currency || 'USD';
  const money = (value: number) => new Intl.NumberFormat(lang === 'es' ? 'es-US' : 'en-US', {
    style: 'currency', currency, minimumFractionDigits: 2,
  }).format(Number(value || 0));
  const date = detail?.event.eventDate ? new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: detail.event.eventTimezone || undefined,
  }).format(new Date(detail.event.eventDate)) : '';
  const organizer = detail?.event.organizer
    ? `${detail.event.organizer.firstName || ''} ${detail.event.organizer.lastName || ''}`.trim() || detail.event.organizer.email
    : '—';
  const discrepancy = detail ? detail.summary.extraIssuedTickets > 0 || detail.summary.missingTickets > 0 : false;

  if (loading) {
    return <div className="premium-shell space-y-4 p-6 lg:p-8"><div className="h-8 w-64 animate-pulse rounded bg-slate-200" /><div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /><div className="h-28 animate-pulse rounded-2xl bg-slate-100" /></div></div>;
  }

  if (error || !detail) {
    return <div className="premium-shell p-6 lg:p-8"><Link href="/admin/events" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary-500"><HiOutlineArrowLeft className="h-4 w-4" />{lang === 'es' ? 'Eventos' : 'Events'}</Link><div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error || (lang === 'es' ? 'Evento no encontrado.' : 'Event not found.')}</div></div>;
  }

  const { summary } = detail;
  const cards = [
    { label: lang === 'es' ? 'Ingresos por entradas' : 'Ticket revenue', value: money(summary.ticketRevenue), note: lang === 'es' ? 'Precio de entradas, sin fees' : 'Ticket prices, excluding fees', icon: HiOutlineCurrencyDollar },
    { label: lang === 'es' ? 'Ingresos cobrados (con fees)' : 'Gross revenue (with fees)', value: money(summary.grossCharged), note: `${money(summary.lpFees + summary.processingFees)} ${lang === 'es' ? 'en fees cobrados' : 'in fees charged'}`, icon: HiOutlineCurrencyDollar },
    { label: lang === 'es' ? 'Órdenes pagadas' : 'Paid orders', value: String(summary.paidOrders), note: `${summary.buyers} ${lang === 'es' ? 'compradores únicos' : 'unique buyers'}`, icon: HiOutlineClipboardList },
    { label: lang === 'es' ? 'Entradas pagadas' : 'Paid tickets', value: String(summary.expectedTickets), note: lang === 'es' ? 'Cantidad confirmada en órdenes' : 'Quantity confirmed in orders', icon: HiOutlineTicket },
    { label: lang === 'es' ? 'Entradas emitidas' : 'Issued tickets', value: String(summary.issuedTickets), note: `${summary.scannedTickets} ${lang === 'es' ? 'escaneadas ·' : 'scanned ·'} ${summary.pendingTickets} ${lang === 'es' ? 'pendientes' : 'pending'}`, icon: HiOutlineCheckCircle },
    { label: lang === 'es' ? 'Bloqueos de mapa' : 'Map locks', value: String(summary.lockedSeats), note: lang === 'es' ? 'No son ventas ni ingresos' : 'Not sales or revenue', icon: HiOutlineUsers },
  ];

  return (
    <div className="premium-shell space-y-6 p-6 lg:p-8">
      <div>
        <Link href="/admin/events" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 transition-colors hover:text-primary-500"><HiOutlineArrowLeft className="h-4 w-4" />{lang === 'es' ? 'Volver a eventos' : 'Back to events'}</Link>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#F97316]">{lang === 'es' ? 'Solo administración' : 'Admin only'}</p>
            <h1 className="mt-1 text-3xl font-black text-[#0A375A]">{detail.event.title}</h1>
            <p className="mt-2 text-sm font-medium text-gray-500">{[date, detail.event.venueName, organizer].filter(Boolean).join(' · ')}</p>
          </div>
          <span className="inline-flex w-fit rounded-full border border-[#F97316]/25 bg-orange-50 px-3 py-1.5 text-xs font-black text-[#C65A09]">{lang === 'es' ? 'Auditoría financiera' : 'Financial audit'}</span>
        </div>
      </div>

      {discrepancy && <div className="flex gap-3 rounded-2xl border border-[#EA580C] bg-[#F97316] p-4 text-white shadow-sm shadow-orange-950/20"><HiOutlineExclamationCircle className="mt-0.5 h-5 w-5 shrink-0 text-white" /><div><p className="font-black text-white">{lang === 'es' ? 'Diferencia entre órdenes y entradas emitidas' : 'Difference between orders and issued tickets'}</p><p className="mt-1 text-sm font-medium text-white/90">{summary.extraIssuedTickets > 0 ? `${summary.extraIssuedTickets} ${lang === 'es' ? 'entrada(s) adicional(es) emitida(s).' : 'extra ticket(s) issued.'}` : `${summary.missingTickets} ${lang === 'es' ? 'entrada(s) pendiente(s) de emitir.' : 'ticket(s) still missing.'}`} {lang === 'es' ? 'Los ingresos se calculan desde las órdenes pagadas, no desde estas entradas.' : 'Revenue is calculated from paid orders, not from these tickets.'}</p></div></div>}

      <section className="overflow-hidden rounded-2xl border border-[rgba(10,55,90,0.10)] bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gradient-to-r from-[#0A375A] to-[#123f65] px-5 py-4 text-white"><p className="text-xs font-black uppercase tracking-[0.18em] text-orange-300">{lang === 'es' ? 'Resumen exacto' : 'Exact summary'}</p><p className="mt-1 text-sm font-medium text-white/75">{lang === 'es' ? 'Los montos vienen de órdenes pagadas; las entradas emitidas se auditan aparte.' : 'Amounts come from paid orders; issued tickets are audited separately.'}</p></div>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <div key={card.label} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-gray-500">{card.label}</p><p className="mt-2 text-2xl font-black text-[#0A375A]">{card.value}</p><p className="mt-1 text-xs font-semibold text-gray-500">{card.note}</p></div><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[#0A375A]"><card.icon className="h-5 w-5" /></div></div></div>)}</div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-100 px-5 py-4"><h2 className="font-black text-[#0A375A]">{lang === 'es' ? 'Entradas por sección' : 'Tickets by section'}</h2><p className="mt-1 text-sm text-gray-500">{lang === 'es' ? 'Conteo físico de los códigos emitidos. Se muestran hasta 10 filas; usa el scroll para ver las demás.' : 'Physical count of issued ticket codes. Up to 10 rows are visible; scroll for the rest.'}</p></div><div className="max-h-[548px] overflow-auto"><table className="min-w-full text-left text-sm"><thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase tracking-wide text-gray-500 shadow-[0_1px_0_0_rgba(229,231,235,1)]"><tr><th className="px-5 py-3">{lang === 'es' ? 'Sección' : 'Section'}</th><th className="px-5 py-3 text-right">{lang === 'es' ? 'Emitidas' : 'Issued'}</th><th className="px-5 py-3 text-right">{lang === 'es' ? 'Escaneadas' : 'Scanned'}</th><th className="px-5 py-3 text-right">{lang === 'es' ? 'Pendientes' : 'Pending'}</th></tr></thead><tbody>{detail.sections.length ? detail.sections.map((section) => <tr key={section.name} className="border-t border-gray-100"><td className="px-5 py-3 font-bold text-gray-800">{section.name}</td><td className="px-5 py-3 text-right font-semibold">{section.issued}</td><td className="px-5 py-3 text-right font-semibold text-emerald-700">{section.scanned}</td><td className="px-5 py-3 text-right font-semibold text-amber-700">{section.pending}</td></tr>) : <tr><td className="px-5 py-5 text-gray-500" colSpan={4}>{lang === 'es' ? 'Aún no hay entradas emitidas.' : 'No tickets have been issued yet.'}</td></tr>}</tbody></table></div></section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-100 px-5 py-4"><h2 className="font-black text-[#0A375A]">{lang === 'es' ? 'Órdenes pagadas y emisión' : 'Paid orders and issuance'}</h2><p className="mt-1 text-sm text-gray-500">{lang === 'es' ? 'Permite detectar diferencias por orden sin cambiar datos de venta. Se muestran hasta 10 órdenes; usa el scroll para ver las demás.' : 'Detects order-level differences without changing sales data. Up to 10 orders are visible; scroll for the rest.'}</p></div><div className="max-h-[708px] overflow-auto"><table className="min-w-[980px] w-full text-left text-sm"><thead className="sticky top-0 z-10 bg-gray-50 text-xs font-black uppercase tracking-wide text-gray-500 shadow-[0_1px_0_0_rgba(229,231,235,1)]"><tr><th className="px-5 py-3">{lang === 'es' ? 'Comprador' : 'Buyer'}</th><th className="px-5 py-3">{lang === 'es' ? 'Fecha' : 'Date'}</th><th className="px-5 py-3 text-right">{lang === 'es' ? 'Pagadas' : 'Paid'}</th><th className="px-5 py-3 text-right">{lang === 'es' ? 'Emitidas' : 'Issued'}</th><th className="px-5 py-3 text-right">{lang === 'es' ? 'Entradas' : 'Tickets'}</th><th className="px-5 py-3 text-right">Fees</th><th className="px-5 py-3 text-right">{lang === 'es' ? 'Total cobrado' : 'Total charged'}</th><th className="px-5 py-3">{lang === 'es' ? 'Canal' : 'Channel'}</th></tr></thead><tbody>{detail.orders.map((order) => { const buyer = order.buyer ? `${order.buyer.firstName || ''} ${order.buyer.lastName || ''}`.trim() || order.buyer.email : '—'; const prices = Object.entries(order.ticketPrices).map(([price, count]) => `${money(Number(price))} × ${count}`).join(', ') || '—'; return <tr key={order.id} className="border-t border-gray-100"><td className="px-5 py-3"><p className="font-bold text-gray-800">{buyer}</p><p className="text-xs text-gray-500">{order.buyer?.email || ''}</p></td><td className="px-5 py-3 text-gray-600">{new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: detail.event.eventTimezone || undefined }).format(new Date(order.paidAt))}</td><td className="px-5 py-3 text-right font-semibold">{order.expectedTickets}</td><td className={`px-5 py-3 text-right font-black ${order.extraIssuedTickets ? 'text-amber-700' : 'text-gray-800'}`}>{order.issuedTickets}{order.extraIssuedTickets ? ` (+${order.extraIssuedTickets})` : ''}</td><td className="px-5 py-3 text-right text-gray-700">{prices}</td><td className="px-5 py-3 text-right text-gray-700">{money(order.lpFee + order.processingFee)}</td><td className="px-5 py-3 text-right font-black text-[#0A375A]">{money(order.total)}</td><td className="px-5 py-3 capitalize text-gray-600">{order.salesChannel || '—'}</td></tr>; })}</tbody></table></div></section>
    </div>
  );
}
