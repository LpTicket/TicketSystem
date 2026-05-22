'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { formatSeatLabel } from '@/lib/seatLabel';
import { HiOutlineArrowLeft, HiOutlinePrinter } from 'react-icons/hi';

const money = (value: any, currency = 'USD') => `$${Number(value || 0).toFixed(2)} ${currency}`;

const parseSafeDate = (value: any) => {
  if (!value) return null;
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
};

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
      } catch (error) {
        setOrder(null);
      } finally {
        setLoading(false);
      }
    };

    if (id) loadOrder();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm w-full bg-white border border-slate-200 rounded-2xl p-6 text-center">
          <h1 className="font-black text-xl text-slate-900 mb-2">Recibo no encontrado</h1>
          <p className="text-sm text-slate-500 mb-5">No pudimos encontrar este recibo o no tienes permiso para verlo.</p>
          <button onClick={() => router.push('/dashboard?tab=orders')} className="btn-primary w-full py-2.5 rounded-xl">
            Volver
          </button>
        </div>
      </div>
    );
  }

  const currency = order.event?.currency || 'USD';
  const purchaseDate = parseSafeDate(order.paidAt || order.createdAt);
  const eventDate = parseSafeDate(order.event?.eventDate);
  const tickets = Array.isArray(order.tickets) ? order.tickets : [];

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0">
      <div className="no-print max-w-3xl mx-auto mb-4 flex items-center justify-between gap-3">
        <Link href="/dashboard?tab=orders" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900">
          <HiOutlineArrowLeft className="w-4 h-4" />
          Volver
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-slate-900 text-white text-xs font-black px-4 py-2 rounded-xl"
        >
          <HiOutlinePrinter className="w-4 h-4" />
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden print:shadow-none print:border-slate-300">
        <div className="p-8 border-b border-slate-100">
          <div className="flex items-start justify-between gap-6">
            <div>
              <img src="/logo.png" alt="LPTicket" className="w-44 h-auto object-contain mb-5" />
              <p className="text-[11px] font-black text-orange-600 uppercase tracking-widest">Recibo de compra</p>
              <h1 className="text-2xl font-black text-[#0A375A] mt-2 leading-tight">{order.event?.title || 'Evento'}</h1>
              {eventDate && (
                <p className="text-sm text-slate-500 mt-2">
                  Evento: {eventDate.toLocaleString('es-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-black text-slate-900">Orden</p>
              <p className="font-mono break-all max-w-[220px]">{order.id}</p>
              {purchaseDate && <p className="mt-2">Compra: {purchaseDate.toLocaleString('es-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
              <p className="mt-2 uppercase font-black text-green-700">{order.status}</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-3">
              <p className="text-xs font-black text-[#0A375A] uppercase tracking-widest">Entradas incluidas</p>
            </div>
            <div className="divide-y divide-slate-100">
              {tickets.map((ticket: any) => (
                <div key={ticket.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-900">{formatSeatLabel(ticket, ticket.sectionName, 'es')}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{ticket.ticketCode}</p>
                  </div>
                  <div className="text-sm font-black text-slate-900">{money(ticket.price, currency)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-black text-[#0A375A] uppercase tracking-widest mb-4">Resumen de pago</p>
            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between gap-4">
                <span>Subtotal de entradas:</span>
                <strong className="text-slate-900">{money(order.subtotal, currency)}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Cargo por servicio:</span>
                <strong className="text-slate-900">{money(order.lpFee, currency)}</strong>
              </div>
              <div className="flex justify-between gap-4">
                <span>Tarifa de procesamiento:</span>
                <strong className="text-slate-900">{money(order.processingFee, currency)}</strong>
              </div>
              <div className="flex justify-between gap-4 border-t border-dashed border-slate-200 pt-3 mt-3">
                <span className="font-black text-slate-900">Total cobrado:</span>
                <strong className="text-orange-600 text-lg">{money(order.total, currency)}</strong>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 text-center uppercase font-bold">
            Este recibo corresponde a la orden completa. Los tickets individuales se gestionan desde Mis Tickets.
          </p>
        </div>
      </div>
    </div>
  );
}
