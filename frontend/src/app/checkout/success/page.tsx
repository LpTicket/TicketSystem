'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { formatSeatLabel } from '@/lib/seatLabel';
import { HiOutlineCheckCircle, HiOutlineTicket, HiOutlineHome, HiOutlineDownload } from 'react-icons/hi';
import { motion } from 'framer-motion';

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        const pendingEventId = localStorage.getItem('pendingCheckoutEventId');
        if (pendingEventId) {
          localStorage.removeItem(`selectedSeats_${pendingEventId}`);
          localStorage.removeItem('pendingCheckoutEventId');
          localStorage.removeItem('pendingCheckoutEventSlug');
          window.dispatchEvent(new Event('cart-updated'));
        }

        // Wait a bit for the webhook to process
        await new Promise(r => setTimeout(r, 2000));
        
        const { data: myTickets } = await api.get('/orders/my-tickets', {
          params: { sessionId }
        });
        const recentTickets = Array.isArray(myTickets) ? myTickets : (myTickets?.data || []);
        setTickets(recentTickets); // Show only recent ones from this session
        
        // Clear cart for all events in this session
        if (recentTickets && recentTickets.length > 0) {
          const eventIds = Array.from(new Set(recentTickets.map((t: any) => t.eventId)));
          eventIds.forEach(id => {
            localStorage.removeItem(`selectedSeats_${id}`);
          });
          window.dispatchEvent(new Event('cart-updated'));
        }

        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchOrder();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 animate-pulse font-medium text-sm">Validando tu pago y generando tickets...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100"
      >
        {/* Success Header */}
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-8 text-center text-white">
          <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30 shadow-xl">
            <HiOutlineCheckCircle className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">¡Pago Confirmado!</h1>
          <p className="text-green-50/90 text-sm font-medium">Tu compra ha sido procesada exitosamente por Stripe.</p>
        </div>

        <div className="p-8">
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-gray-600 text-sm leading-relaxed">
                Tus tickets digitales ya están disponibles. Hemos enviado una copia a tu correo electrónico y también puedes descargarlos ahora mismo.
              </p>
            </div>

            {/* Tickets Preview */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center">Tus Tickets</h3>
              {tickets.length > 0 ? (
                <div className="grid gap-4">
                  {tickets.map((ticket, idx) => (
                    <motion.div 
                      key={ticket.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:shadow-md transition-all group"
                    >
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-gray-200 shadow-sm group-hover:border-primary-200 transition-colors">
                        <img src={ticket.qrData} alt="QR" className="w-10 h-10" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{ticket.event?.title}</p>
                        <p className="text-[10px] text-gray-500 font-mono">CODE: {ticket.ticketCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full inline-block">
                          {formatSeatLabel(ticket, ticket.sectionName)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <HiOutlineTicket className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Generando visualización de tickets...</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              <Link 
                href="/dashboard/tickets" 
                className="flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-primary-200 transition-all active:scale-95"
              >
                <HiOutlineTicket className="w-5 h-5" />
                MIS TICKETS
              </Link>
              <Link 
                href="/events" 
                className="flex items-center justify-center gap-2 bg-white border-2 border-gray-100 hover:border-gray-200 text-gray-700 font-bold py-3.5 px-6 rounded-2xl transition-all active:scale-95"
              >
                <HiOutlineHome className="w-5 h-5" />
                INICIO
              </Link>
            </div>

            <p className="text-center text-[10px] text-gray-400 pt-4">
              ¿Problemas con tu compra? <a href="mailto:info@lpticket.com" className="text-primary-500 font-bold hover:underline">info@lpticket.com</a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-[#fcfcfd] px-4">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  );
}
