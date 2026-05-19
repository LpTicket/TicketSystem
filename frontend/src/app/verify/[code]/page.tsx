'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { formatSeatLabel } from '@/lib/seatLabel';
import { Ticket } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  HiOutlineCheckCircle, 
  HiOutlineXCircle, 
  HiOutlineTicket, 
  HiOutlinePrinter, 
  HiOutlineArrowLeft,
  HiOutlineShare
} from 'react-icons/hi';

const parseSafeDate = (dateStr: any) => {
  if (!dateStr) return new Date();
  const cleaned = String(dateStr).replace(' ', 'T');
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? new Date(dateStr) : d;
};

export default function VerifyTicketPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareLabel, setShareLabel] = useState('Compartir');

  useEffect(() => { 
    loadTicket(); 
  }, [code]);

  const loadTicket = async () => {
    try { 
      const { data } = await api.get(`/orders/ticket/${code}`); 
      setTicket(data); 
      // Clear cart for this event
      if (data?.eventId) {
        localStorage.removeItem(`selectedSeats_${data.eventId}`);
        window.dispatchEvent(new Event('cart-updated'));
      }
    } catch { 
      setTicket(null); 
    } finally { 
      setLoading(false); 
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const ticketUrl = window.location.href;
    const title = ticket?.event?.title ? `${ticket.event.title} - LPTicket` : 'LPTicket';

    try {
      if (navigator.share) {
        await navigator.share({
          title,
          text: 'Aquí está mi entrada para el evento.',
          url: ticketUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(ticketUrl);
      alert('¡Enlace de la entrada copiado al portapapeles!');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      alert('No se pudo compartir esta entrada.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
        <div className="text-center bg-white p-8 rounded-3xl border border-gray-200 shadow-sm max-w-sm w-full">
          <HiOutlineXCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="font-extrabold text-2xl text-gray-900 mb-2">Ticket no encontrado</h1>
          <p className="text-gray-500 text-sm mb-6">El código <span className="font-mono text-red-500 font-bold">{code}</span> no corresponde a un boleto activo.</p>
          <button onClick={() => router.push('/')} className="btn-primary w-full py-2.5 rounded-xl">Ir al Inicio</button>
        </div>
      </div>
    );
  }

  const isUsed = ticket.status === 'used';
  const isCancelled = ticket.status === 'cancelled';
  const isActive = ticket.status === 'active';

  const statusLabel = isActive ? 'ACTIVE' : isUsed ? 'USED' : 'CANCELLED';
  const statusColor = isActive ? '#16a34a' : isUsed ? '#6b7280' : '#dc2626';

  const section = ticket.sectionName || '';
  const cleanSection = section.trim();
  const shouldShowSection = cleanSection &&
    !['general', 'general admission', 'ga', 'default', 'default section', 'null', 'undefined', 'sección única', 'seccion unica'].includes(cleanSection.toLowerCase());

  const seatLabel = formatSeatLabel(ticket, ticket.sectionName, 'en');

  const eventDateFormatted = ticket.event?.eventDate
    ? format(parseSafeDate(ticket.event.eventDate), "EEEE, MMM d, yyyy · h:mm a", { locale: es })
    : '';

  return (
    <>
      <style>{`
        /* ==================== PRINT STYLES ==================== */
        @media print {
          @page {
            size: letter portrait;
            margin: 8mm;
          }

          html, body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #fff !important;
            font-size: 10pt !important;\n            width: 100% !important;\n            min-height: 100% !important;
          }

          .no-print { display: none !important; }
          .print-only { display: block !important; }

          .ticket-wrapper {
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }

          .ticket-card {
            box-shadow: none !important;
            border: 1px solid #d1d5db !important;
            border-radius: 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .ticket-header {
            padding: 22pt 24pt 0 !important;
          }

          .ticket-body {
            padding: 18pt 24pt !important;\n            flex: 1 1 auto !important;
          }

          .ticket-footer {
            padding: 14pt 24pt !important;
            margin-top: auto !important;
            margin-top: auto !important;
          }

          .qr-img {
            width: 110pt !important;
            height: 110pt !important;
          }

          .event-title {
            font-size: 19pt !important;
          }

          .terms-text {
            font-size: 6pt !important;
            line-height: 1.35 !important;
          }

          .status-banner { display: none !important; }\n\n          .brand-logo {\n            width: 190pt !important;\n            height: auto !important;\n          }\n\n          .premium-watermark {\n            display: block !important;\n          }
        }


          /* PRINT RECEIPT FOOTER FINAL POSITION */
          .ticket-card {
            position: relative !important;
            height: 9.72in !important;
            min-height: 9.72in !important;
            padding-bottom: 112pt !important;
            box-sizing: border-box !important;
          }

          .ticket-body {
            flex: none !important;
            padding-bottom: 10pt !important;
          }

          .ticket-footer {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            min-height: 104pt !important;
            box-sizing: border-box !important;
          }
          /* END PRINT RECEIPT FOOTER FINAL POSITION */

        /* ==================== SCREEN STYLES ==================== */
        @media screen {
          .print-only { display: none !important; }
        }

        .premium-divider {
          height: 8px;
          background:
            linear-gradient(90deg, #f97316 0%, #f97316 42%, #1a73b5 42%, #1a73b5 100%);
          border: none;
          margin: 0;
        }

        .premium-watermark {
          background-image:
            radial-gradient(circle at 15% 20%, rgba(249, 115, 22, 0.09), transparent 28%),
            radial-gradient(circle at 85% 10%, rgba(26, 115, 181, 0.10), transparent 32%);
        }
      `}</style>

      {/* Screen-only action bar */}
      <div className="no-print w-full bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10 px-4">
        <div className="max-w-2xl mx-auto py-3 flex justify-between items-center gap-3">
          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium"
          >
            <HiOutlineArrowLeft className="w-4 h-4" /> Volver
          </button>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              <HiOutlineShare className="w-4 h-4" /> {shareLabel}
            </button>

            <button 
              onClick={handlePrint} 
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
            >
              <HiOutlinePrinter className="w-4 h-4" /> Imprimir / Guardar PDF
            </button>
          </div>
        </div>
      </div>

      {/* Page wrapper */}
      <div className="ticket-wrapper min-h-screen bg-slate-100 py-8 px-4 print:bg-white print:py-0 print:px-0">
        <div className="ticket-page max-w-[8.5in] mx-auto">

          {/* ===== MAIN TICKET CARD ===== */}
          <div className="ticket-card relative bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 print:shadow-none premium-watermark">

            {/* Header: Logo + Event Name */}
            <div className="ticket-header relative bg-white px-8 pt-8 pb-0">
              {/* Top row: Logo left, QR right */}
              <div className="flex items-start justify-between gap-6">
                {/* Left: Branding + Event info */}
                <div className="flex-1 min-w-0">
                  <div className="mb-5">
                    <img
                      src="/logo.png"
                      alt="LPTicket"
                      className="brand-logo w-52 h-auto object-contain"
                    />
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 border border-orange-100 px-3 py-1 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Digital Ticket Receipt</span>
                  </div>

                  <h1 className="event-title font-black text-3xl text-slate-950 uppercase leading-tight tracking-tight mb-2">
                    {ticket.event?.title || 'Evento'}
                  </h1>

                  {/* Date & Venue */}
                  <p className="text-sm text-blue-900 font-black uppercase tracking-wide mt-1">
                    {eventDateFormatted}
                  </p>
                  {ticket.event?.venueName && (
                    <p className="text-sm text-slate-800 font-black uppercase mt-1">
                      {ticket.event.venueName}
                    </p>
                  )}
                  {ticket.event?.venueAddress && (
                    <p className="text-sm text-slate-500 font-semibold mt-1">
                      {ticket.event.venueAddress}
                    </p>
                  )}
                </div>

                {/* Right: QR Code */}
                <div className="flex flex-col items-center shrink-0">
                  {ticket.qrData ? (
                    <img 
                      src={ticket.qrData} 
                      alt="QR Code" 
                      className="qr-img w-36 h-36 object-contain border border-slate-200 rounded-xl p-2 bg-white shadow-sm" 
                    />
                  ) : (
                    <div className="w-40 h-40 bg-gray-100 flex items-center justify-center rounded-xl border border-gray-200">
                      <HiOutlineTicket className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  <span className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-wide text-center">Present at entry</span>
                </div>
              </div>

              {/* Orange accent line */}
              <div className="premium-divider mt-5 -mx-8" />
            </div>

            {/* ===== TICKET BODY: Attendee & Seat Info ===== */}
            <div className="ticket-body px-8 py-5 space-y-4">

              {/* Status chip */}
              <div className="flex items-center gap-2">
                <span 
                  className="text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full"
                  style={{ 
                    backgroundColor: isActive ? '#dcfce7' : isUsed ? '#f3f4f6' : '#fee2e2',
                    color: statusColor
                  }}
                >
                  STATUS: {statusLabel}
                </span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Holder */}
                <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-white/80 p-4">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre / Name</span>
                  <span className="block text-lg font-black text-slate-950 uppercase leading-tight">
                    {ticket.user?.firstName} {ticket.user?.lastName}
                  </span>
                </div>

                {/* Seat */}
                <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-white/80 p-4">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ubicación / Seat</span>
                  <span className="block text-lg font-black text-slate-950 uppercase leading-tight">
                    {seatLabel}
                  </span>
                </div>

                {/* Section (if applicable) */}
                {shouldShowSection && (
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sección / Section</span>
                    <span className="block text-lg font-black text-orange-600 uppercase">
                      {ticket.sectionName}
                    </span>
                  </div>
                )}
              </div>

              {/* Order Details divider */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest mb-3">Detalles del Pedido</p>
                <div className="grid grid-cols-1 gap-1.5 text-sm text-slate-600">
                  <div className="flex gap-2">
                    <span className="font-black text-slate-900 w-32 shrink-0">TICKET ID:</span>
                    <span className="font-mono text-slate-600 break-all">{ticket.id}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-black text-slate-900 w-32 shrink-0">COMPRADO POR:</span>
                    <span>{ticket.user?.firstName} {ticket.user?.lastName}</span>
                  </div>
                  {ticket.createdAt && (
                    <div className="flex gap-2">
                      <span className="font-black text-slate-900 w-32 shrink-0">FECHA COMPRA:</span>
                      <span>{format(parseSafeDate(ticket.createdAt), "dd MMM yyyy - hh:mm a", { locale: es })}</span>
                    </div>
                  )}
                  {shouldShowSection && (
                    <div className="flex gap-2">
                      <span className="font-black text-slate-900 w-32 shrink-0">TICKET TYPE:</span>
                      <span>{ticket.sectionName}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="font-black text-slate-900 w-32 shrink-0">ORDER ID:</span>
                    <span className="font-mono text-slate-600 break-all">{ticket.orderId}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== FOOTER: Terms + Branding ===== */}
            <div className="ticket-footer px-8 py-6 bg-blue-950 text-white">
              <div className="flex flex-col sm:flex-row gap-5 sm:gap-8">

                {/* Terms */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-orange-300 uppercase tracking-widest mb-2">Terms & Conditions</p>
                  <div className="terms-text text-[8px] text-white/75 leading-relaxed space-y-1 uppercase font-medium">
                    <p>This ticket is not subject to any refund and shall bear no cash value. If issued complimentarily, this ticket shall not be exchangeable.</p>
                    <p>Holder voluntarily assumes all risks and danger incidental to the event. Duplicate tickets or barcodes may be refused entry.</p>
                    <p>LPTicket and all respective agents are expressly released by holder from any claims arising from such causes.</p>
                  </div>
                </div>

                {/* Branding */}
                <div className="flex sm:flex-col items-center justify-between gap-3 sm:shrink-0">
                  <div className="text-center">
                    <p className="text-2xl font-black text-orange-400 tracking-tight leading-none">LPTicket</p>
                    <p className="text-[9px] text-white/60 font-semibold leading-tight">lpticket.com</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-white leading-tight">Thank You</p>
                  </div>
                </div>

              </div>
            </div>

          </div>
          {/* End ticket card */}

          {/* Screen-only bottom spacer */}
          <div className="no-print h-8" />

        </div>
      </div>
    </>
  );
}
