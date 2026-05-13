'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Ticket } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  HiOutlineCheckCircle, 
  HiOutlineXCircle, 
  HiOutlineTicket, 
  HiOutlinePrinter, 
  HiOutlineArrowLeft 
} from 'react-icons/hi';

// Wavy line SVG separator component
const WavySeparator = () => (
  <svg viewBox="0 0 120 12" className="w-24 h-4 text-primary-500 my-2" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M0,6 C10,12 10,0 20,6 C30,12 30,0 40,6 C50,12 50,0 60,6 C70,12 70,0 80,6 C90,12 90,0 100,6 C110,12 110,0 120,6" />
    <path d="M0,9 C10,15 10,3 20,9 C30,15 30,3 40,9 C50,15 50,3 60,9 C70,15 70,3 80,9 C90,15 90,3 100,9 C110,15 110,3 120,9" stroke="#6366f1" strokeWidth="1.5" />
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

  useEffect(() => { loadTicket(); }, [code]);



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
    <div className="min-h-screen py-10 px-4 bg-slate-50 flex flex-col items-center justify-center print:bg-white print:py-0 print:px-0">
      
      {/* Action Bar (hidden on print) */}
      <div className="w-full max-w-3xl flex justify-between items-center mb-6 print:hidden">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium"
        >
          <HiOutlineArrowLeft className="w-4 h-4" /> Volver
        </button>
        <button 
          onClick={handlePrint} 
          className="btn-secondary py-2 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-gray-300"
        >
          <HiOutlinePrinter className="w-4 h-4" /> Imprimir / Descargar PDF
        </button>
      </div>
      {/* Actual Physical-Style Digital Ticket */}
      <div className="w-full max-w-[850px] bg-white shadow-2xl md:p-12 p-6 relative overflow-hidden print:shadow-none print:border-none print:p-0 print:scale-[0.95] print:origin-top-left mx-auto font-sans">
        
        {/* TOP SECTION */}
        <div className="flex flex-col md:flex-row print:flex-row items-start gap-8 print:gap-4 relative">
          {/* QR Code */}
          <div className="flex flex-col items-center shrink-0 w-full md:w-auto print:w-auto">
            {ticket.qrData ? (
              <img src={ticket.qrData} alt="QR Code" className="w-48 h-48 rounded-none object-contain" />
            ) : (
              <div className="w-48 h-48 bg-gray-100 flex items-center justify-center">
                <HiOutlineTicket className="w-16 h-16 text-gray-400" />
              </div>
            )}
            <span className="text-[13px] text-gray-500 mt-2 font-medium">Ticket 1 of 1</span>
          </div>

          {/* Event Details */}
          <div className="flex-1 space-y-1 mt-2 md:mt-0 print:mt-0">
            <h1 className="font-extrabold text-3xl print:text-2xl text-gray-900 leading-tight">
              {ticket.event?.title || 'Evento'}
            </h1>
            <p className="text-sm text-gray-600 uppercase tracking-wide">
              {ticket.event?.eventDate && format(parseSafeDate(ticket.event.eventDate), "EEE, MMM d, yyyy | 'Doors:' h:mm a", { locale: es })}
            </p>
            <p className="text-sm text-gray-600 uppercase tracking-wide">{ticket.event?.venueName || 'Lugar del Evento'}</p>
            <p className="text-sm text-gray-900 font-bold uppercase">{ticket.event?.venueAddress || ''}</p>

            <WavySeparator />

            <div className="mt-4">
              <span className="block text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Type of Ticket</span>
              <span className="block text-2xl font-black text-gray-900 uppercase">
                {ticket.sectionName || 'Boleto General'}
              </span>
              <span className="block text-sm text-gray-700 font-bold uppercase mt-1">
                STATUS: {isActive ? 'COMPLETE' : isUsed ? 'USED' : 'CANCELLED'}
              </span>
            </div>
            
            {/* LPTicket Logo replacement */}
            <div className="absolute bottom-0 right-10 text-3xl print:text-2xl font-black text-orange-500 tracking-tighter hidden md:block print:block">
              LPTicket
            </div>
          </div>

          {/* Right vertical bar */}
          <div className="hidden md:flex print:flex flex-col w-6 print:w-4 h-48 shrink-0 absolute right-0 top-0">
            <div className="bg-slate-900 h-3/4 w-full"></div>
            <div className="bg-orange-500 h-1/4 w-full"></div>
          </div>
        </div>

        {/* MIDDLE BOX */}
        <div className="border border-gray-300 mt-8 print:mt-4 p-6 md:p-8 print:p-5 bg-white text-sm print:text-xs relative">
          <span className="block text-xs text-gray-500 uppercase font-bold tracking-widest mb-1">Name</span>
          <span className="block text-xl font-black text-gray-900 uppercase mb-2">
            {ticket.user?.firstName} {ticket.user?.lastName}
          </span>
          <span className="block text-lg font-bold text-gray-900 uppercase mb-4">
            {ticket.sectionName || 'Boleto General'} | {ticket.rowLabel && ticket.rowLabel !== 'GA' ? `Row: ${ticket.rowLabel}, Seat: ${ticket.seatNumber}` : 'General Admission'}
          </span>
          
          <div className="text-gray-600 space-y-0.5 text-[13px] font-medium">
            <p><span className="font-bold text-gray-900">TICKET ID:</span> {ticket.id}</p>
            <p className="font-bold text-gray-900 mt-2">ORDER DETAILS</p>
            <p><span className="font-bold text-gray-900">PURCHASED BY:</span> {ticket.user?.firstName} {ticket.user?.lastName}</p>
            <p><span className="font-bold text-gray-900">TICKET TYPE:</span> {ticket.sectionName || 'Boleto General'}</p>
            <p><span className="font-bold text-gray-900">ORDER ID:</span> {ticket.orderId}</p>
            <p className="text-xs text-gray-500 uppercase mt-2 pt-2 border-t border-gray-200">
              <strong className="text-gray-900">DETAILS:</strong> NOTA: MESA ASIGNADA, ASIENTO POR ORDEN DE LLEGADA O SEGÚN DISPONIBILIDAD.
            </p>
          </div>
        </div>

        {/* BOTTOM SECTION */}
        <div className="mt-8 print:mt-4 flex flex-col md:flex-row print:flex-row items-start gap-8 print:gap-4 relative border-t border-gray-200 pt-8 print:pt-4 print:border-none">
          
          {/* Left Vertical Bar */}
          <div className="hidden md:flex print:flex flex-col w-4 print:w-3 h-full min-h-[160px] print:min-h-[120px] shrink-0 absolute left-0 top-8 print:top-4">
            <div className="bg-orange-500 h-1/6 w-full"></div>
            <div className="bg-slate-900 h-5/6 w-full"></div>
          </div>

          {/* Terms */}
          <div className="flex-1 md:pl-8 print:pl-6">
            <h4 className="font-bold text-gray-900 text-sm mb-1">Terms</h4>
            <div className="text-[10px] text-gray-600 space-y-2 uppercase leading-relaxed font-medium">
              <p>This ticket is not subject to any refund and shall bear no cash value. If issued complimentarily, this ticket shall not be exchangeable.</p>
              <p>HOLDER VOLUNTARILY ASSUMES ALL RISKS AND DANGER INCIDENTAL TO THE EVENT FOR WHICH THE TICKET IS ISSUED, WHETHER OCCURRING PRIOR TO, DURING OR AFTER THE EVENT. HOLDER VOLUNTARILY AGREES THAT THE MANAGEMENT, FACILITY, LEAGUE, PARTICIPANTS, PARTICIPATING CLUBS, LPTICKET, AND ALL OF THEIR RESPECTIVE AGENTS, OFFICERS, DIRECTORS, OWNERS AND EMPLOYEES ARE EXPRESSLY RELEASED BY HOLDER FROM ANY CLAIMS ARISING FROM SUCH CAUSES.</p>
              <p>Duplicate tickets or barcodes may be refused entry to event.</p>
            </div>
          </div>

          {/* Socials & Branding */}
          <div className="w-full md:w-1/3 print:w-1/3 flex justify-between md:justify-around print:justify-around items-end md:items-start print:items-start shrink-0">
            <div className="space-y-2">
              <div className="flex flex-col gap-0.5 text-orange-500 font-mono font-bold tracking-widest text-[8px] mb-3">
                <span>≈≈≈≈≈≈≈</span>
                <span className="text-slate-900">≈≈≈≈≈≈≈</span>
                <span>≈≈≈≈≈≈≈</span>
              </div>
              <p className="text-[11px] text-gray-500 font-medium">Find us on<br/>social media</p>
              <p className="text-[11px] font-bold text-gray-600 pt-1">f <span className="font-normal text-gray-500">lpticket</span></p>
              <p className="text-[11px] font-bold text-gray-600">X <span className="font-normal text-gray-500">@lpticket</span></p>
              <p className="text-[11px] font-bold text-gray-600">ig <span className="font-normal text-gray-500">lptickets</span></p>
            </div>

            <div className="text-right md:text-left print:text-left flex flex-col items-end md:items-start print:items-start border-l border-gray-200 pl-4 md:pl-6 print:pl-4 space-y-4 print:space-y-2">
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
