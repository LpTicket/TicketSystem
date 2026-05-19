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
  HiOutlineArrowLeft ,
  HiOutlineShare
} from 'react-icons/hi';

// Wavy line SVG separator component
const WavySeparator = () => (
  <svg viewBox="0 0 120 12" className="w-24 h-4 text-orange-500 my-2" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M0,6 C10,12 10,0 20,6 C30,12 30,0 40,6 C50,12 50,0 60,6 C70,12 70,0 80,6 C90,12 90,0 100,6 C110,12 110,0 120,6" />
    <path d="M0,9 C10,15 10,3 20,9 C30,15 30,3 40,9 C50,15 50,3 60,9 C70,15 70,3 80,9 C90,15 90,3 100,9 C110,15 110,3 120,9" stroke="#f97316" strokeOpacity="0.4" strokeWidth="1.5" />
  </svg>
);

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
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [shareLabel, setShareLabel] = useState('Compartir');
  const [printLabel, setPrintLabel] = useState('Imprimir');

  useEffect(() => { 
    loadTicket(); 
    // Clear cart for this event if it exists
    if (ticket?.eventId) {
      localStorage.removeItem(`selectedSeats_${ticket.eventId}`);
      window.dispatchEvent(new Event('cart-updated'));
    }
  }, [code, ticket?.eventId]);



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

  const validate = async () => {
    setValidating(true);
    try { 
      const { data } = await api.post(`/orders/ticket/${code}/validate`); 
      setResult(data); 
      if (data.ticket) setTicket(data.ticket); 
    } catch { 
      setResult({ valid: false, message: 'Error al validar' }); 
    } finally { 
      setValidating(false); 
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
          text: shareLabel === 'Share' ? 'Here is my ticket.' : 'Aqui esta mi entrada.',
          url: ticketUrl,
        });
        return;
      }

      await navigator.clipboard.writeText(ticketUrl);
      alert(shareLabel === 'Share' ? 'Ticket link copied.' : 'Enlace de la entrada copiado.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      alert(shareLabel === 'Share' ? 'Could not share this ticket.' : 'No se pudo compartir esta entrada.');
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
        <div className="text-center bg-white p-8 rounded-3xl border border-gray-150 shadow-sm max-w-sm w-full">
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

  return (
    <div className="min-h-screen py-10 px-4 bg-slate-50 flex flex-col items-center justify-center print:bg-white print:py-0 print:px-0 print:min-h-0 print:block">
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0.25in;
          }

          html,
          body {
            width: 8.5in !important;
            min-height: 11in !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .fixed,
          [class*="fixed"] {
            display: none !important;
          }

          .ticket-print-sheet {
            width: 7.6in !important;
            max-width: 7.6in !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            transform: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .ticket-print-sheet > div:first-of-type {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.16in !important;
          }

          .ticket-print-sheet > div:first-of-type > div:first-child {
            width: 100% !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .ticket-print-sheet img {
            width: 1.15in !important;
            height: 1.15in !important;
            object-fit: contain !important;
          }

          .ticket-print-sheet h1 {
            font-size: 22px !important;
            line-height: 1.05 !important;
          }

          .ticket-print-sheet p,
          .ticket-print-sheet span {
            line-height: 1.16 !important;
          }

          .ticket-print-sheet .border {
            margin-top: 0.16in !important;
            padding: 0.13in !important;
          }

          .ticket-print-sheet > div:last-of-type {
            margin-top: 0.13in !important;
            padding-top: 0.13in !important;
            display: flex !important;
            flex-direction: row !important;
            gap: 0.2in !important;
          }

          .ticket-print-sheet > div:last-of-type p {
            margin: 1px 0 !important;
          }
        }
      `}</style>
      {/* Action Bar (hidden on print) */}
      <div className="w-full max-w-3xl flex justify-between items-center gap-3 mb-6 print:hidden">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium"
        >
          <HiOutlineArrowLeft className="w-4 h-4" /> Volver
        </button>

        <div className="flex flex-row items-center justify-end gap-3">
          <button
            onClick={handleShare}
            className="h-10 w-[130px] rounded-[10px] px-3 text-[11px] font-extrabold tracking-[0.07em] uppercase flex items-center justify-center gap-2 bg-[#1f6aa5] text-white shadow-sm shadow-blue-700/20 hover:bg-[#185987] transition-all"
          >
            <HiOutlineShare className="w-4 h-4" /> {shareLabel}
          </button>

          <button 
            onClick={handlePrint} 
            className="h-10 w-[130px] rounded-[10px] px-3 text-[11px] font-extrabold tracking-[0.07em] uppercase flex items-center justify-center gap-2 bg-orange-500 text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600 transition-all"
          >
            <HiOutlinePrinter className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>
      {/* Actual Physical-Style Digital Ticket */}
      <div className="ticket-print-sheet w-full max-w-[850px] bg-white shadow-2xl md:p-12 p-6 relative overflow-hidden print:shadow-none print:border-none print:p-0 mx-auto font-sans print:break-inside-avoid">
        
        {/* TOP SECTION */}
        <div className="flex flex-col md:flex-row items-start gap-8 print:gap-4 relative">
          {/* QR Code */}
          <div className="flex flex-col items-center shrink-0 w-full md:w-auto">
            {ticket.qrData ? (
              <img src={ticket.qrData} alt="QR Code" className="w-48 h-48 print:w-36 print:h-36 rounded-none object-contain" />
            ) : (
              <div className="w-48 h-48 print:w-36 print:h-36 bg-gray-100 flex items-center justify-center">
                <HiOutlineTicket className="w-16 h-16 text-gray-400" />
              </div>
            )}
            <span className="text-[13px] text-gray-500 mt-2 font-medium">Ticket 1 of 1</span>
          </div>

          {/* Event Details */}
          <div className="flex-1 space-y-1 mt-2 md:mt-0 print:mt-2 md:print:mt-0">
            <h1 className="font-extrabold text-3xl print:text-xl text-gray-900 leading-tight">
              {ticket.event?.title || 'Evento'}
            </h1>
            <p className="text-sm text-gray-600 uppercase tracking-wide">
              {ticket.event?.eventDate && format(parseSafeDate(ticket.event.eventDate), "EEE, MMM d, yyyy | 'Doors:' h:mm a", { locale: es })}
            </p>
            <p className="text-sm text-gray-600 uppercase tracking-wide">{ticket.event?.venueName || 'Lugar del Evento'}</p>
            <p className="text-sm text-gray-900 font-bold uppercase">{ticket.event?.venueAddress || ''}</p>

            <WavySeparator />

            {(() => {
              const section = ticket.sectionName || '';
              const cleanSection = section.trim();
              const shouldShowSection = cleanSection && 
                !['general', 'general admission', 'ga', 'default', 'default section', 'null', 'undefined', 'sección única', 'seccion unica'].includes(cleanSection.toLowerCase());

              if (!shouldShowSection) return null;
              return (
                <div className="mt-4">
                  <span className="block text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Type of Ticket</span>
                  <span className="block text-2xl font-black text-gray-900 uppercase">
                    {ticket.sectionName}
                  </span>
                </div>
              );
            })()}
            <div className="mt-2">
              <span className="block text-sm text-gray-700 font-bold uppercase">
                STATUS: {isActive ? 'COMPLETE' : isUsed ? 'USED' : 'CANCELLED'}
              </span>
            </div>
            
            {/* LPTicket Logo replacement */}
            <div className="absolute bottom-0 right-10 text-3xl print:text-2xl font-black text-orange-500 tracking-tighter hidden md:block print:block">
              LPTicket
            </div>
          </div>

          {/* Right vertical bar */}
          <div className="hidden md:flex flex-col w-6 h-48 shrink-0 absolute right-0 top-0">
            <div className="bg-orange-500 h-full w-full"></div>
          </div>
        </div>

        {/* MIDDLE BOX */}
        <div className="border border-gray-300 mt-8 print:mt-3 p-6 md:p-8 print:p-3 bg-white text-sm print:text-xs relative">
          <span className="block text-xs text-gray-500 uppercase font-bold tracking-widest mb-1">Name</span>
          <span className="block text-xl font-black text-gray-900 uppercase mb-2">
            {ticket.user?.firstName} {ticket.user?.lastName}
          </span>
          <span className="block text-lg font-bold text-gray-900 uppercase mb-4">
            {formatSeatLabel(ticket, ticket.sectionName, 'en')}
          </span>
          
          <div className="text-gray-600 space-y-0.5 text-[13px] font-medium">
            <p><span className="font-bold text-gray-900">TICKET ID:</span> {ticket.id}</p>
            <p className="font-bold text-gray-900 mt-2">ORDER DETAILS</p>
            <p><span className="font-bold text-gray-900">PURCHASED BY:</span> {ticket.user?.firstName} {ticket.user?.lastName}</p>
            {ticket.createdAt && <p><span className="font-bold text-gray-900">PURCHASED ON:</span> {format(parseSafeDate(ticket.createdAt), "dd MMM yyyy - hh:mm a", { locale: es })}</p>}
            {(() => {
              const section = ticket.sectionName || '';
              const cleanSection = section.trim();
              const shouldShowSection = cleanSection && 
                !['general', 'general admission', 'ga', 'default', 'default section', 'null', 'undefined', 'sección única', 'seccion unica'].includes(cleanSection.toLowerCase());

              return shouldShowSection ? (
                <p><span className="font-bold text-gray-900">TICKET TYPE:</span> {ticket.sectionName}</p>
              ) : null;
            })()}
            <p><span className="font-bold text-gray-900">ORDER ID:</span> {ticket.orderId}</p>
          </div>
        </div>

        {/* BOTTOM SECTION */}
        <div className="mt-8 print:mt-3 flex flex-col md:flex-row items-start gap-8 print:gap-6 relative border-t border-gray-200 pt-8 print:pt-3 print:border-t">
          
          {/* Left Vertical Bar */}
          <div className="hidden md:flex flex-col w-4 h-full min-h-[160px] shrink-0 absolute left-0 top-8">
            <div className="bg-orange-500 h-full w-full"></div>
          </div>

          {/* Terms */}
          <div className="flex-1 md:pl-8 print:pl-6">
            <h4 className="font-bold text-gray-900 text-sm mb-1">Terms</h4>
            <div className="text-[10px] print:text-[7.5px] text-gray-600 space-y-2 print:space-y-1 uppercase leading-relaxed print:leading-snug font-medium">
              <p>This ticket is not subject to any refund and shall bear no cash value. If issued complimentarily, this ticket shall not be exchangeable.</p>
              <p>HOLDER VOLUNTARILY ASSUMES ALL RISKS AND DANGER INCIDENTAL TO THE EVENT FOR WHICH THE TICKET IS ISSUED, WHETHER OCCURRING PRIOR TO, DURING OR AFTER THE EVENT. HOLDER VOLUNTARILY AGREES THAT THE MANAGEMENT, FACILITY, LEAGUE, PARTICIPANTS, PARTICIPATING CLUBS, LPTICKET, AND ALL OF THEIR RESPECTIVE AGENTS, OFFICERS, DIRECTORS, OWNERS AND EMPLOYEES ARE EXPRESSLY RELEASED BY HOLDER FROM ANY CLAIMS ARISING FROM SUCH CAUSES.</p>
              <p>Duplicate tickets or barcodes may be refused entry to event.</p>
            </div>
          </div>

          {/* Socials & Branding */}
          <div className="w-full md:w-1/3 flex justify-between md:justify-around items-end md:items-start shrink-0 pt-4 md:pt-0">
            <div className="space-y-2">
              <div className="flex flex-col gap-0.5 text-orange-500 font-mono font-bold tracking-widest text-[8px] mb-3">
                <span>≈≈≈≈≈≈≈</span>
                <span className="text-orange-600">≈≈≈≈≈≈≈</span>
                <span>≈≈≈≈≈≈≈</span>
              </div>
            </div>

            <div className="text-right md:text-left flex flex-col items-end md:items-start border-l border-gray-200 pl-4 md:pl-6 space-y-4 print:space-y-2">
              <div>
                <span className="text-2xl font-black text-orange-500 tracking-tighter">LPTicket</span>
                <p className="text-xs text-gray-500">Tus tickets.<br/>Tus eventos.</p>
              </div>
              <div>
                <span className="text-lg font-black text-gray-900 block leading-tight">Thank<br/>You</span>
                <p className="text-[10px] text-gray-500 mt-1">for using <strong className="text-orange-500">lpticket.com</strong></p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
