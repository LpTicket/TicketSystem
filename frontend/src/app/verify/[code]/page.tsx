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
            margin: 8mm 10mm;
          }

          html, body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background: #fff !important;
            font-size: 11pt !important;
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
            padding: 12pt 14pt !important;
          }

          .ticket-body {
            padding: 10pt 14pt !important;
          }

          .ticket-footer {
            padding: 8pt 14pt !important;
          }

          .qr-img {
            width: 110pt !important;
            height: 110pt !important;
          }

          .event-title {
            font-size: 16pt !important;
          }

          .terms-text {
            font-size: 6pt !important;
            line-height: 1.35 !important;
          }

          .status-banner { display: none !important; }
        }

        /* ==================== SCREEN STYLES ==================== */
        @media screen {
          .print-only { display: none !important; }
        }

        /* ==================== SHARED WAVY BORDER ==================== */
        .tear-line {
          height: 12px;
          background-image: radial-gradient(circle at 6px 6px, #f8fafc 6px, transparent 0),
                            radial-gradient(circle at 6px 6px, #f8fafc 6px, transparent 0);
          background-size: 12px 12px;
          background-position: 0 0, 6px 0;
          background-color: #e2e8f0;
          border: none;
          margin: 0;
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
      <div className="ticket-wrapper min-h-screen bg-slate-100 py-6 px-4 print:bg-white print:py-0 print:px-0">
        <div className="max-w-2xl mx-auto">

          {/* ===== MAIN TICKET CARD ===== */}
          <div className="ticket-card bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200 print:rounded-none print:shadow-none">

            {/* Header: Logo + Event Name */}
            <div className="ticket-header bg-white px-6 pt-6 pb-0 print:px-4 print:pt-4">
              {/* Top row: Logo left, QR right */}
              <div className="flex items-start justify-between gap-4">
                {/* Left: Branding + Event info */}
                <div className="flex-1 min-w-0">
                  {/* LP Ticket Logo text */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl font-black text-orange-500 tracking-tight print:text-xl leading-none">LP</span>
                    <span className="text-2xl font-black text-gray-900 tracking-tight print:text-xl leading-none">Ticket</span>
                    <span className="ml-1 text-[9px] font-black text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded uppercase tracking-widest">DIGITAL</span>
                  </div>

                  {/* Event Title */}
                  <h1 className="event-title font-black text-2xl text-gray-900 uppercase leading-tight tracking-tight print:text-base mb-1">
                    {ticket.event?.title || 'Evento'}
                  </h1>

                  {/* Date & Venue */}
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mt-1">
                    {eventDateFormatted}
                  </p>
                  {ticket.event?.venueName && (
                    <p className="text-xs text-gray-600 font-bold uppercase mt-0.5">
                      {ticket.event.venueName}
                    </p>
                  )}
                  {ticket.event?.venueAddress && (
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
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
                      className="qr-img w-32 h-32 print:w-28 print:h-28 object-contain border border-gray-100 rounded-lg p-1 bg-white" 
                    />
                  ) : (
                    <div className="w-32 h-32 bg-gray-100 flex items-center justify-center rounded-lg border border-gray-200">
                      <HiOutlineTicket className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  <span className="text-[9px] text-gray-400 mt-1 font-medium text-center">Presentar en acceso</span>
                </div>
              </div>

              {/* Orange accent line */}
              <div className="h-1 bg-gradient-to-r from-orange-500 via-orange-400 to-amber-300 mt-4 -mx-6 print:-mx-4" />
            </div>

            {/* Tear-style divider */}
            <div className="tear-line" />

            {/* ===== TICKET BODY: Attendee & Seat Info ===== */}
            <div className="ticket-body px-6 py-5 print:px-4 print:py-3 space-y-4">

              {/* Status chip */}
              <div className="flex items-center gap-2 no-print">
                <span 
                  className="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full"
                  style={{ 
                    backgroundColor: isActive ? '#dcfce7' : isUsed ? '#f3f4f6' : '#fee2e2',
                    color: statusColor
                  }}
                >
                  STATUS: {statusLabel}
                </span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 print:gap-y-2">
                {/* Holder */}
                <div className="col-span-2 sm:col-span-1">
                  <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Nombre / Name</span>
                  <span className="block text-base font-black text-gray-900 uppercase leading-tight print:text-sm">
                    {ticket.user?.firstName} {ticket.user?.lastName}
                  </span>
                </div>

                {/* Seat */}
                <div className="col-span-2 sm:col-span-1">
                  <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Ubicación / Seat</span>
                  <span className="block text-base font-black text-gray-900 uppercase leading-tight print:text-sm">
                    {seatLabel}
                  </span>
                </div>

                {/* Section (if applicable) */}
                {shouldShowSection && (
                  <div className="col-span-2 sm:col-span-1">
                    <span className="block text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Sección / Section</span>
                    <span className="block text-sm font-bold text-orange-600 uppercase">
                      {ticket.sectionName}
                    </span>
                  </div>
                )}
              </div>

              {/* Order Details divider */}
              <div className="border-t border-dashed border-gray-200 pt-3 print:pt-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Detalles del Pedido</p>
                <div className="space-y-0.5 text-xs text-gray-600 print:text-[8pt]">
                  <div className="flex gap-2">
                    <span className="font-bold text-gray-800 w-28 shrink-0">TICKET ID:</span>
                    <span className="font-mono text-gray-600 break-all">{ticket.id}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-bold text-gray-800 w-28 shrink-0">COMPRADO POR:</span>
                    <span>{ticket.user?.firstName} {ticket.user?.lastName}</span>
                  </div>
                  {ticket.createdAt && (
                    <div className="flex gap-2">
                      <span className="font-bold text-gray-800 w-28 shrink-0">FECHA COMPRA:</span>
                      <span>{format(parseSafeDate(ticket.createdAt), "dd MMM yyyy - hh:mm a", { locale: es })}</span>
                    </div>
                  )}
                  {shouldShowSection && (
                    <div className="flex gap-2">
                      <span className="font-bold text-gray-800 w-28 shrink-0">TICKET TYPE:</span>
                      <span>{ticket.sectionName}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className="font-bold text-gray-800 w-28 shrink-0">ORDER ID:</span>
                    <span className="font-mono text-gray-600 break-all">{ticket.orderId}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tear-style divider */}
            <div className="tear-line" />

            {/* ===== FOOTER: Terms + Branding ===== */}
            <div className="ticket-footer px-6 py-4 print:px-4 print:py-2 bg-gray-50 print:bg-white">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 print:gap-4">

                {/* Terms */}
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 print:mb-0.5">Terms & Conditions</p>
                  <div className="terms-text text-[7px] text-gray-500 leading-relaxed space-y-0.5 uppercase font-medium print:text-[5.5pt] print:leading-tight print:space-y-0">
                    <p>This ticket is not subject to any refund and shall bear no cash value. If issued complimentarily, this ticket shall not be exchangeable.</p>
                    <p>Holder voluntarily assumes all risks and danger incidental to the event. Duplicate tickets or barcodes may be refused entry.</p>
                    <p>LPTicket and all respective agents are expressly released by holder from any claims arising from such causes.</p>
                  </div>
                </div>

                {/* Branding */}
                <div className="flex sm:flex-col items-center justify-between gap-2 sm:shrink-0 print:hidden">
                  <div className="text-center">
                    <p className="text-xl font-black text-orange-500 tracking-tight leading-none">LPTicket</p>
                    <p className="text-[8px] text-gray-400 font-medium leading-tight">lpticket.com</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-gray-900 leading-tight">Thank You</p>
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
