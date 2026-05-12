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
      <div className="w-full max-w-3xl bg-white shadow-2xl rounded-3xl border border-gray-150 p-6 md:p-10 space-y-8 relative overflow-hidden print:shadow-none print:border-none print:rounded-none print:p-0">
        
        {/* Ticket Header (QR, Meta, Side bars) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          
          {/* Left: QR Code Block */}
          <div className="md:col-span-3 flex flex-col items-center text-center space-y-2">
            {ticket.qrData ? (
              <div className="p-2 border border-gray-200 rounded-2xl bg-white shadow-sm shrink-0">
                <img src={ticket.qrData} alt="QR Code" className="w-36 h-36 md:w-40 md:h-40 rounded-lg" />
              </div>
            ) : (
              <div className="w-36 h-36 bg-gray-100 flex items-center justify-center rounded-2xl">
                <HiOutlineTicket className="w-12 h-12 text-gray-400" />
              </div>
            )}
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ticket 1 de 1</span>
          </div>

          {/* Center: Event Details and Ticket Class */}
          <div className="md:col-span-6 space-y-3">
            <div>
              <h1 className="font-extrabold text-2xl text-gray-900 leading-tight tracking-tight uppercase">
                {ticket.event?.title || 'Evento'}
              </h1>
              <p className="text-xs text-gray-500 font-bold mt-1">
                {ticket.event?.eventDate && format(parseSafeDate(ticket.event.eventDate), "eeee, d 'de' MMMM, yyyy | 'Puertas:' h:mm a", { locale: es }).toUpperCase()}
              </p>
            </div>

            <div className="text-xs text-gray-600 font-bold space-y-0.5">
              <p className="text-gray-900 uppercase font-extrabold tracking-wide">{ticket.event?.venueName || 'Lugar del Evento'}</p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">{ticket.event?.venueAddress || ''}</p>
            </div>

            {/* Colored Separator Waves */}
            <WavySeparator />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-[9px] uppercase font-bold text-gray-400 tracking-wider">Tipo de Boleto</span>
                <span className="text-base font-black text-gray-900 uppercase tracking-tight">
                  {ticket.sectionName || 'Boleto General'}
                </span>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-gray-400 tracking-wider">Estado</span>
                <span className={`inline-block text-[11px] font-black uppercase tracking-wider rounded ${
                  isActive ? 'text-green-600' : isUsed ? 'text-gray-500' : 'text-red-500'
                }`}>
                  {isActive ? 'COMPLETO / ACTIVO' : isUsed ? 'UTILIZADO' : 'CANCELADO'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Decorative Side Bar and App Branding */}
          <div className="hidden md:flex md:col-span-3 flex-col items-end justify-between self-stretch">
            {/* Color accent bars */}
            <div className="flex h-16 w-4 rounded-full overflow-hidden self-end shrink-0">
              <div className="w-1/2 bg-indigo-500 h-full" />
              <div className="w-1/2 bg-primary-500 h-full" />
            </div>
            
            {/* Branding Logo */}
            <div className="text-right">
              <span className="text-2xl font-black text-primary-500 tracking-tighter uppercase font-mono block">LPTicket</span>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mt-0.5">Tus Tickets. Tus Eventos.</span>
            </div>
          </div>
        </div>

        {/* Middle: Details Box Container */}
        <div className="border border-gray-300 rounded-2xl p-6 bg-white space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
            <div>
              <span className="block text-[9px] uppercase font-bold text-gray-400 tracking-wider">Nombre del Asistente</span>
              <span className="text-lg font-black text-gray-900 uppercase tracking-tight">
                {ticket.user?.firstName} {ticket.user?.lastName}
              </span>
            </div>

            <div>
              <span className="block text-[9px] uppercase font-bold text-gray-400 tracking-wider">Detalles de Ubicación</span>
              <span className="text-lg font-black text-gray-900 uppercase tracking-tight">
                {ticket.rowLabel && ticket.rowLabel !== 'GA' 
                  ? `${ticket.sectionName} | Fila: ${ticket.rowLabel}, Asiento: ${ticket.seatNumber}` 
                  : `${ticket.sectionName || 'Entrada General'}`}
              </span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200 pt-4 space-y-3">
            <span className="block text-[10px] uppercase font-extrabold text-slate-800 tracking-wider">Detalles del Pedido</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs text-gray-600">
              <div>
                <span className="block text-[9px] text-gray-400 uppercase font-bold">ID de Boleto:</span>
                <span className="font-mono text-[11px] font-bold text-gray-800 select-all">{ticket.id || '2B3DCBF6-99BC-46EB-834C'}</span>
              </div>
              <div>
                <span className="block text-[9px] text-gray-400 uppercase font-bold">Comprador:</span>
                <span className="font-bold text-gray-800">{ticket.user?.firstName} {ticket.user?.lastName}</span>
              </div>
              <div>
                <span className="block text-[9px] text-gray-400 uppercase font-bold">Código de Entrada:</span>
                <span className="font-mono text-[11px] font-bold text-gray-800 tracking-wider uppercase select-all">{ticket.ticketCode}</span>
              </div>
              <div>
                <span className="block text-[9px] text-gray-400 uppercase font-bold">Precio Pagado:</span>
                <span className="font-bold text-gray-800">
                  {ticket.event?.currency === 'USD' ? '$' : 'Bs. '}{Number(ticket.price || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="pt-2 text-[10px] text-gray-400 uppercase font-bold leading-relaxed">
              <strong>Nota:</strong> Presenta este código QR en la entrada del evento para su correspondiente escaneo y validación de acceso.
            </div>
          </div>
        </div>

        {/* Verification Result Display (Admin-only validation visual feedback) */}
        {result && (
          <div className={`p-5 rounded-2xl text-center border animate-bounce ${
            result.valid 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {result.valid ? (
              <HiOutlineCheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
            ) : (
              <HiOutlineXCircle className="w-12 h-12 text-red-600 mx-auto mb-2" />
            )}
            <h4 className="font-extrabold text-base uppercase tracking-wide">
              {result.valid ? 'Validación Exitosa' : 'Validación Incorrecta'}
            </h4>
            <p className="text-sm font-semibold mt-1">{result.message}</p>
          </div>
        )}

        {/* Bottom Panel (Terms, waves and social metadata) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-6 border-t border-gray-150 items-start">
          
          {/* Left Terms */}
          <div className="md:col-span-6 flex gap-3">
            <div className="w-2.5 bg-indigo-500 self-stretch shrink-0 rounded-full flex flex-col overflow-hidden">
              <div className="h-2/3 bg-indigo-500" />
              <div className="h-1/3 bg-primary-500" />
            </div>
            <div className="space-y-1.5 text-[8.5px] text-gray-400 font-semibold leading-normal uppercase">
              <p className="font-bold text-gray-700 text-[10px]">Términos y Condiciones</p>
              <p>Este boleto no está sujeto a cambios ni reembolsos. El portador asume todos los riesgos inherentes al evento antes, durante o después de su realización.</p>
              <p>Queda prohibida la duplicación de este boleto. La primera copia escaneada en el acceso invalidará las demás copias idénticas.</p>
            </div>
          </div>

          {/* Middle social links */}
          <div className="md:col-span-3 flex flex-col items-center justify-center text-center space-y-2">
            {/* small visual waves pattern */}
            <div className="flex flex-col gap-0.5 text-primary-500 leading-none shrink-0 font-mono font-bold select-none">
              <span>≈≈≈≈≈≈≈</span>
              <span>≈≈≈≈≈≈≈</span>
            </div>
            <div className="text-[9px] uppercase text-gray-400 font-bold tracking-widest">
              Síguenos en redes sociales
              <div className="font-black text-gray-700 lowercase mt-1 block">@lpticket</div>
            </div>
          </div>

          {/* Right taglines */}
          <div className="md:col-span-3 text-center md:text-right space-y-1">
            <div className="text-xl font-black text-primary-500 tracking-tighter uppercase font-mono">LPTicket</div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Tus tickets. Tus eventos.</p>
            <div className="border-t border-gray-150 pt-1.5 mt-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Muchas Gracias</span>
              <p className="text-[9.5px] font-semibold text-gray-500 lowercase">por preferir a <span className="text-primary-500 font-bold">lpticket.com</span></p>
            </div>
          </div>
        </div>

        {/* Scanner Host Action (Floating or centered button to validate) */}
        {isActive && !result && (
          <div className="pt-4 text-center print:hidden">
            <button 
              onClick={validate} 
              disabled={validating} 
              className="btn-primary py-3.5 px-8 text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary-500/20 w-full"
            >
              {validating ? 'Verificando...' : '🔍 Escanear / Validar Entrada'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
