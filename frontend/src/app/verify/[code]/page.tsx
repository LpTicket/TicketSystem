'use client';

import { toast } from 'react-hot-toast';

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

const money = (value: any, currency = 'USD') => `$${Number(value || 0).toFixed(2)} ${currency}`;

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
    } catch { 
      setTicket(null); 
    } finally { 
      setLoading(false); 
    }
  };

  const handlePrint = () => {
    const isMobilePrint = window.innerWidth <= 640;
    document.documentElement.classList.toggle('mobile-print-mode', isMobilePrint);
    window.print();
  };

  useEffect(() => {
    const setMobilePrintMode = () => {
      document.documentElement.classList.toggle('mobile-print-mode', window.innerWidth <= 640);
    };

    const clearMobilePrintMode = () => {
      document.documentElement.classList.remove('mobile-print-mode');
    };

    window.addEventListener('beforeprint', setMobilePrintMode);
    window.addEventListener('afterprint', clearMobilePrintMode);

    return () => {
      window.removeEventListener('beforeprint', setMobilePrintMode);
      window.removeEventListener('afterprint', clearMobilePrintMode);
      clearMobilePrintMode();
    };
  }, []);

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
      toast.success('¡Enlace de la entrada copiado al portapapeles!');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error('No se pudo compartir esta entrada.');
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

  const eventTz = ticket.event?.eventTimezone || 'UTC';
  const receiptCurrency = ticket.event?.currency || 'USD';
  const eventDateFormatted = ticket.event?.eventDate
    ? new Intl.DateTimeFormat('es', {
        timeZone: eventTz,
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(parseSafeDate(ticket.event.eventDate))
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
            border-radius: 6pt !important;
            overflow: hidden !important;
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


        @media print {
          /* PRINT RECEIPT FOOTER FINAL POSITION */
          .ticket-card {
            position: relative !important;
            height: 9.42in !important;
            min-height: 9.42in !important;
            padding-bottom: 100pt !important;
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
            bottom: 10pt !important;
            min-height: 90pt !important;
            border-radius: 0 0 5pt 5pt !important;
            box-sizing: border-box !important;
          }
          /* END PRINT RECEIPT FOOTER FINAL POSITION */
        }

        @media screen and (max-width: 640px) {
          .ticket-card {
            position: static !important;
            height: auto !important;
            min-height: 0 !important;
            padding-bottom: 0 !important;
            overflow: hidden !important;
          }

          .ticket-body {
            padding-bottom: 1.25rem !important;
          }

          .ticket-footer {
            position: static !important;
            min-height: 0 !important;
            margin-top: 0 !important;
          }
        }

          .ticket-card {
            position: relative !important;
            height: calc(11in - 12mm) !important;
            min-height: calc(11in - 12mm) !important;
            padding-bottom: 92pt !important;
            box-sizing: border-box !important;
          }

          .ticket-header {
            padding: 12pt 14pt 0 !important;
          }

          .ticket-body {
            padding: 10pt 14pt 8pt !important;
            flex: none !important;
          }

          .ticket-footer {
            position: absolute !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            min-height: 84pt !important;
            padding: 10pt 14pt !important;
            box-sizing: border-box !important;
          }

          .brand-logo {
            width: 135pt !important;
          }

          .qr-img {
            width: 88pt !important;
            height: 88pt !important;
          }

          .event-title {
            font-size: 15pt !important;
          }

          .terms-text {
            font-size: 5.6pt !important;
            line-height: 1.28 !important;
          }
        }


        @media print {
          html.mobile-print-mode,
          html.mobile-print-mode body {
            width: 100% !important;
            min-height: auto !important;
            overflow: visible !important;
          }

          html.mobile-print-mode .ticket-wrapper {
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
            padding: 2mm 0 !important;
            margin: 0 !important;
            background: #fff !important;
          }

          html.mobile-print-mode .ticket-page {
            width: 3.45in !important;
            max-width: calc(100% - 12mm) !important;
            margin: 0 auto !important;
          }

          html.mobile-print-mode .ticket-card {
            position: static !important;
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            padding-bottom: 0 !important;
            overflow: visible !important;
            border-radius: 8pt !important;
            font-size: 7.2pt !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          html.mobile-print-mode .ticket-header {
            padding: 6pt 8pt 0 !important;
          }

          html.mobile-print-mode .ticket-body {
            display: block !important;
            padding: 5pt 8pt 5pt !important;
            flex: none !important;
          }

          html.mobile-print-mode .ticket-footer {
            position: static !important;
            left: auto !important;
            right: auto !important;
            bottom: auto !important;
            min-height: 0 !important;
            margin-top: 0 !important;
            padding: 5pt 8pt !important;
            background: #0a375a !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          html.mobile-print-mode .ticket-footer > div {
            display: flex !important;
            flex-direction: row !important;
            align-items: flex-end !important;
            gap: 8pt !important;
          }

          html.mobile-print-mode .brand-logo {
            width: 90pt !important;
            height: auto !important;
          }

          html.mobile-print-mode .qr-img {
            width: 54pt !important;
            height: 54pt !important;
          }

          html.mobile-print-mode .event-title {
            font-size: 10.5pt !important;
            line-height: 1.05 !important;
          }

          html.mobile-print-mode .premium-divider {
            margin-top: 5pt !important;
            height: 4pt !important;
          }

          html.mobile-print-mode .ticket-body .grid {
            gap: 4pt !important;
          }

          html.mobile-print-mode .ticket-body .rounded-xl,
          html.mobile-print-mode .ticket-body .rounded-2xl {
            padding: 5pt !important;
          }

          html.mobile-print-mode .terms-text {
            font-size: 4.2pt !important;
            line-height: 1.1 !important;
          }
        }


        /* IOS MOBILE PRINT ONLY */
        @media print {
          @supports (-webkit-touch-callout: none) {
            html.mobile-print-mode,
            html.mobile-print-mode body {
              background: #ffffff !important;
              overflow: visible !important;
              width: 100% !important;
              min-height: 0 !important;
            }

            html.mobile-print-mode .ticket-wrapper {
              display: flex !important;
              justify-content: center !important;
              align-items: flex-start !important;
              background: #ffffff !important;
              padding: 2mm 0 !important;
              margin: 0 !important;
              min-height: 0 !important;
              overflow: visible !important;
            }

            html.mobile-print-mode .ticket-page {
              width: 3.4in !important;
              max-width: calc(100% - 12mm) !important;
              margin: 0 auto !important;
              padding: 0 !important;
            }

            html.mobile-print-mode .ticket-card {
              position: static !important;
              display: block !important;
              height: auto !important;
              min-height: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              background: #ffffff !important;
              border: 1px solid #cbd5e1 !important;
              border-radius: 8pt !important;
              box-shadow: none !important;
              font-size: 7pt !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            html.mobile-print-mode .ticket-header {
              padding: 5pt 8pt 0 !important;
              background: #ffffff !important;
            }

            html.mobile-print-mode .ticket-body {
              display: block !important;
              padding: 4pt 8pt 4pt !important;
              flex: none !important;
              background: #ffffff !important;
            }

            html.mobile-print-mode .ticket-footer {
              position: static !important;
              left: auto !important;
              right: auto !important;
              bottom: auto !important;
              display: block !important;
              min-height: 0 !important;
              margin: 0 !important;
              padding: 5pt 8pt !important;
              background: #0a375a !important;
              color: #ffffff !important;
              box-sizing: border-box !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }

            html.mobile-print-mode .ticket-footer > div {
              display: flex !important;
              flex-direction: row !important;
              align-items: flex-end !important;
              gap: 8pt !important;
            }

            html.mobile-print-mode .brand-logo {
              width: 84pt !important;
              height: auto !important;
            }

            html.mobile-print-mode .qr-img {
              width: 50pt !important;
              height: 50pt !important;
            }

            html.mobile-print-mode .event-title {
              font-size: 10pt !important;
              line-height: 1.05 !important;
              margin-bottom: 2pt !important;
            }

            html.mobile-print-mode .premium-divider {
              margin-top: 4pt !important;
              height: 4pt !important;
            }

            html.mobile-print-mode .ticket-body .grid {
              gap: 4pt !important;
            }

            html.mobile-print-mode .ticket-body .rounded-xl,
            html.mobile-print-mode .ticket-body .rounded-2xl {
              padding: 5pt !important;
            }

            html.mobile-print-mode .terms-text {
              font-size: 4pt !important;
              line-height: 1.08 !important;
            }
          }
        }
        /* END IOS MOBILE PRINT ONLY */

        /* RECEIPT OVERLAP FIX */
        @media screen {
          .ticket-card {
            height: auto !important;
            min-height: 0 !important;
            padding-bottom: 0 !important;
          }

          .ticket-footer {
            position: static !important;
          }
        }

        @media print {
          .receipt-summary {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .ticket-card {
            height: auto !important;
            min-height: 0 !important;
            padding-bottom: 0 !important;
          }

          .ticket-footer {
            position: static !important;
            margin-top: 0 !important;
          }
        }
        /* END RECEIPT OVERLAP FIX */

        /* ==================== SCREEN STYLES ==================== */
        @media screen {
          .print-only { display: none !important; }
        }

        .premium-divider {
          height: 8px;
          background:
            linear-gradient(90deg, #f97316 0%, #f97316 42%, #0a375a 42%, #0a375a 100%);
          border: none;
          margin: 0;
        }

        .premium-watermark {
          background-image:
            radial-gradient(circle at 15% 20%, rgba(249, 115, 22, 0.09), transparent 28%),
            radial-gradient(circle at 85% 10%, rgba(10, 55, 90, 0.10), transparent 32%);
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
              className="flex items-center gap-2 bg-[#0a375a] hover:bg-[#0a375a] text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-sm"
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
                  <p className="text-sm text-[#0a375a] font-black uppercase tracking-wide mt-1">
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
                <p className="text-[10px] font-black text-[#0a375a] uppercase tracking-widest mb-3">Detalles del Pedido</p>
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

              {ticket.order && (
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                  <p className="text-[10px] font-black text-[#0a375a] uppercase tracking-widest mb-3">Resumen de Pago</p>
                  <div className="space-y-1.5 text-sm text-slate-600">
                    <div className="flex justify-between gap-4">
                      <span>Subtotal de entradas</span>
                      <strong className="text-slate-900">{money(ticket.order.subtotal, receiptCurrency)}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Cargo por servicio</span>
                      <strong className="text-slate-900">{money(ticket.order.lpFee, receiptCurrency)}</strong>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>Tarifa de procesamiento</span>
                      <strong className="text-slate-900">{money(ticket.order.processingFee, receiptCurrency)}</strong>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-dashed border-slate-200 pt-2 mt-2">
                      <span className="font-black text-slate-900">Total cobrado</span>
                      <strong className="text-orange-600">{money(ticket.order.total, receiptCurrency)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ===== FOOTER: Terms + Branding ===== */}
            <div className="ticket-footer px-8 py-6 bg-[#0a375a] text-white">
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
