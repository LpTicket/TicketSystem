'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatDateInTimezone, parseSafeDate } from '@/lib/dateUtils';
import { formatSeatLabel } from '@/lib/seatLabel';
import { HiOutlineArrowLeft, HiOutlinePrinter } from 'react-icons/hi';

const money = (value: any, currency = 'USD') => `$${Number(value || 0).toFixed(2)} ${currency}`;

export default function OrderReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrder = async () => {
      try {
        const { data } = await api.get(`/orders/${id}`);
        setOrder(data);
      } catch {
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };
    if (id) loadOrder();
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-100"><div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;

  if (!order) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-6 text-center">
        <h1 className="font-black text-xl text-slate-900 mb-2">Recibo no encontrado</h1>
        <p className="text-sm text-slate-500 mb-5">No pudimos encontrar este recibo o no tienes permiso para verlo.</p>
        <button onClick={() => router.back()} className="btn-primary w-full py-2.5 rounded-xl">Volver</button>
      </div>
    </div>
  );

  const currency = order.event?.currency || 'USD';
  const tickets = Array.isArray(order.tickets) ? order.tickets : [];
  const firstTicket = tickets[0];
  const eventTimezone = order.event?.eventTimezone || 'UTC';
  const eventDate = order.event?.eventDate
    ? formatDateInTimezone(order.event.eventDate, eventTimezone, 'es-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    : '';
  const purchaseDate = order.paidAt || order.createdAt
    ? new Intl.DateTimeFormat('es-US', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(parseSafeDate(order.paidAt || order.createdAt))
    : '';
  const status = String(order.status || '').toUpperCase();
  const statusClass = order.status === 'paid' ? 'bg-green-100 text-green-700' : order.status === 'refunded' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600';

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 8mm; }
          html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #fff !important; }
          .no-print { display: none !important; }
          .order-receipt-shell { padding: 0 !important; background: #fff !important; }
          .order-receipt-card { box-shadow: none !important; break-inside: avoid !important; page-break-inside: avoid !important; }
        }
      `}</style>

      <div className="no-print w-full bg-white border-b border-slate-100 shadow-sm sticky top-0 z-10 px-4">
        <div className="max-w-2xl mx-auto py-3 flex justify-between items-center gap-3">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-950 font-medium"><HiOutlineArrowLeft className="w-4 h-4" /> Volver</button>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-[#0a375a] hover:bg-[#082c49] text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm"><HiOutlinePrinter className="w-4 h-4" /> Imprimir / Guardar PDF</button>
        </div>
      </div>

      <main className="order-receipt-shell min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
        <article className="order-receipt-card max-w-[8.5in] mx-auto overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl print:shadow-none">
          <div className="order-receipt-header bg-white px-8 pt-8 pb-0">
            <div className="flex items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <img src="/lp-logo.png" alt="LPTicket" className="h-10 w-auto object-contain mb-5" />
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 mb-3"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" /><span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Digital Ticket Receipt</span></div>
                <h1 className="font-black text-3xl text-slate-950 uppercase leading-tight tracking-tight">{order.event?.title || 'Evento'}</h1>
                {eventDate && <p className="mt-2 text-sm font-black uppercase tracking-wide text-[#0a375a]">{eventDate}</p>}
                {order.event?.venueName && <p className="mt-1 text-sm font-black uppercase text-slate-800">{order.event.venueName}</p>}
                {order.event?.venueAddress && <p className="mt-1 text-sm font-semibold text-slate-500">{order.event.venueAddress}</p>}
              </div>
              {firstTicket && <div className="flex shrink-0 flex-col items-center"><img src={firstTicket.qrData || `${api.defaults.baseURL}/orders/ticket/${firstTicket.ticketCode}/qr.png`} alt="Código QR de la entrada" className="h-32 w-32 rounded-xl border border-slate-200 bg-white p-2 shadow-sm" /><span className="mt-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">Present at entry</span></div>}
            </div>
            <div className="h-2 mt-5 -mx-8 bg-[linear-gradient(90deg,#f97316_0%,#f97316_42%,#0a375a_42%,#0a375a_100%)]" />
          </div>

          <section className="px-8 py-5 space-y-4">
            <span className={`inline-flex rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${statusClass}`}>Status: {status}</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comprado por / Buyer</p><p className="mt-1 text-lg font-black uppercase leading-tight text-slate-950">{[order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ') || 'Cliente'}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entradas / Tickets</p><p className="mt-1 text-lg font-black uppercase leading-tight text-slate-950">{tickets.length || order.ticketCount || 0} {(tickets.length || order.ticketCount) === 1 ? 'entrada' : 'entradas'}</p></div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"><p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#0a375a]">Detalles del pedido</p><div className="space-y-2 text-sm text-slate-600"><p><span className="inline-block w-32 font-black text-slate-900">ORDER ID:</span><span className="font-mono break-all">{order.id}</span></p>{purchaseDate && <p><span className="inline-block w-32 font-black text-slate-900">FECHA COMPRA:</span>{purchaseDate}</p>}{tickets.map((ticket: any) => <p key={ticket.id}><span className="inline-block w-32 font-black text-slate-900">TICKET:</span>{formatSeatLabel(ticket, ticket.sectionName, 'es')} <span className="font-mono text-xs">{ticket.ticketCode}</span></p>)}</div></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#0a375a]">Resumen de pago</p><div className="space-y-1.5 text-sm text-slate-600"><p className="flex justify-between gap-4"><span>Subtotal de entradas:</span><strong className="text-slate-900">{money(order.subtotal, currency)}</strong></p><p className="flex justify-between gap-4"><span>Cargo por servicio:</span><strong className="text-slate-900">{money(order.lpFee, currency)}</strong></p><p className="flex justify-between gap-4"><span>Tarifa de procesamiento:</span><strong className="text-slate-900">{money(order.processingFee, currency)}</strong></p><p className="flex justify-between gap-4 border-t border-dashed border-slate-200 pt-2 mt-2"><span className="font-black text-slate-900">Total cobrado:</span><strong className="text-orange-600">{money(order.total, currency)}</strong></p></div></div>
          </section>

          <div className="order-receipt-footer bg-[#0a375a] px-8 py-6 text-white"><div className="flex flex-col gap-5 sm:flex-row sm:gap-8"><div className="flex-1"><p className="mb-2 text-[10px] font-black uppercase tracking-widest text-orange-300">Terms & Conditions</p><p className="text-[8px] font-medium uppercase leading-relaxed text-white/75">This ticket is not subject to any refund and shall bear no cash value. Holder voluntarily assumes all risks incidental to the event. Duplicate tickets or barcodes may be refused entry.</p></div><div className="flex items-end justify-between gap-4 sm:flex-col sm:items-center"><div className="text-center"><p className="text-2xl font-black leading-none tracking-tight text-orange-400">LPTicket</p><p className="text-[9px] font-semibold text-white/60">lpticket.com</p></div><p className="text-sm font-black">Thank You</p></div></div></div>
        </article>
      </main>
    </>
  );
}
