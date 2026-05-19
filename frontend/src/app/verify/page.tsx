'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/context/LanguageContext';
import { useAuthStore } from '@/stores/auth';
import api from '@/lib/api';
import { formatSeatLabel } from '@/lib/seatLabel';
import {
  HiOutlineQrcode,
  HiOutlineSearch,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineCamera,
  HiOutlineUser,
  HiOutlineTicket,
  HiOutlineExternalLink,
} from 'react-icons/hi';

export default function TicketScannerPage() {
  const router = useRouter();
  const { lang } = useLang();
  const { isAuthenticated } = useAuthStore();
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [scannerInstance, setScannerInstance] = useState<any>(null);

  // Verification Terminal States
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
    ticket?: any;
    code: string;
  } | null>(null);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerInstance && scannerInstance.isScanning) {
        scannerInstance.stop().catch(() => {});
      }
    };
  }, [scannerInstance]);

  const stopCameraScan = async () => {
    if (scannerInstance) {
      try {
        if (scannerInstance.isScanning) {
          await scannerInstance.stop();
        }
      } catch (err) {
        console.warn("Scanner stop error ignored:", err);
      }
      setScannerInstance(null);
    }
    setIsScanning(false);
  };

  const handleValidateTicket = async (code: string) => {
    setValidating(true);
    setValidationResult(null);
    setScanResult(null);
    setManualCode('');

    try {
      // 1. Load ticket metadata to check event and attendee info
      let ticketData: any = null;
      try {
        const { data } = await api.get(`/orders/ticket/${code.trim().toUpperCase()}`);
        ticketData = data;
      } catch (err) {
        // Ticket code does not exist in platform database
        setValidationResult({
          valid: false,
          message: lang === 'es' ? 'Código de ticket no encontrado o inválido.' : 'Ticket code not found or invalid.',
          code: code.trim().toUpperCase()
        });
        return;
      }

      // 2. Submit validation action to the API
      const { data: res } = await api.post(`/orders/ticket/${code.trim().toUpperCase()}/validate`);
      setValidationResult({
        valid: res.valid,
        message: res.message,
        ticket: ticketData || res.ticket,
        code: code.trim().toUpperCase()
      });
    } catch (err: any) {
      console.error(err);
      setValidationResult({
        valid: false,
        message: lang === 'es' ? 'Ocurrió un error al procesar la validación.' : 'An error occurred during verification.',
        code: code.trim().toUpperCase()
      });
    } finally {
      setValidating(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      stopCameraScan();
      handleValidateTicket(manualCode.trim());
    }
  };

  const startCameraScan = async () => {
    setIsScanning(true);
    setScanResult(null);
    setValidationResult(null);

    try {
      // Dynamic client-side import of html5-qrcode to support SSR building
      const { Html5Qrcode } = await import('html5-qrcode');

      setTimeout(async () => {
        try {
          const qrCodeScanner = new Html5Qrcode('reader');
          setScannerInstance(qrCodeScanner);

          await qrCodeScanner.start(
            { facingMode: 'environment' }, // Open device back camera
            {
              fps: 30, // Process 30 frames per second for ultra-fast response
              qrbox: (width, height) => {
                // Slightly larger box for easier alignment
                const size = Math.min(width, height) * 0.8;
                return { width: size, height: size };
              },
              aspectRatio: 1.0, // Standard square aspect ratio for optimal QR resolution
              experimentalFeatures: {
                useBarCodeDetectorIfSupported: true, // Utilizes hardware-accelerated native mobile API if available (5x faster)
              },
            },
            async (decodedText) => {
              // Successfully decoded code! Stop camera first to prevent duplicate trigger loops
              try {
                await qrCodeScanner.stop();
              } catch (err) {}
              setIsScanning(false);
              setScannerInstance(null);

              let code = decodedText.trim();
              if (decodedText.includes('/verify/')) {
                const parts = decodedText.split('/verify/');
                code = parts[parts.length - 1];
              }
              handleValidateTicket(code);
            },
            (errorMessage) => {
              // Quiet scanning frame-misses
            }
          );
        } catch (err: any) {
          console.error('Camera starting failed:', err);
          setIsScanning(false);
          setScanResult({
            success: false,
            message: lang === 'es' ? 'Error de acceso. Por favor revisa los permisos de tu cámara.' : 'Access error. Please verify camera permission settings.'
          });
        }
      }, 200);
    } catch (err) {
      console.error('Html5Qrcode dynamic load failed:', err);
      setIsScanning(false);
    }
  };

  const resetTerminal = () => {
    setValidationResult(null);
    setScanResult(null);
    startCameraScan();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-8 md:py-12">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-150 shadow-[0_20px_60px_rgba(15,23,42,0.04)] p-6 md:p-8 space-y-6 overflow-hidden">
        
        {/* Terminal Header */}
        <div className="text-center">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mx-auto mb-3 animate-pulse">
            <HiOutlineQrcode className="w-7 h-7" />
          </div>
          <h1 className="font-extrabold text-2xl text-slate-900 tracking-tight">
            {lang === 'es' ? 'Terminal de Accesos' : 'Access Control Terminal'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            {lang === 'es' ? 'Valida códigos de entrada en tiempo real con la cámara o de forma manual.' : 'Validate entry ticket codes in real-time using camera or manual input.'}
          </p>
        </div>

        {/* Live Responsive Camera Scanner Container */}
        {!validationResult && !validating && (
          <div className="relative border border-slate-100 rounded-2xl overflow-hidden bg-slate-950 flex flex-col items-center justify-center text-white w-full max-w-full">
            {isScanning ? (
              <div className="w-full relative flex flex-col justify-between overflow-hidden max-w-full">
                {/* HTML5 QrCode target render node */}
                <div id="reader" className="w-full relative overflow-hidden" />
                {/* Laser beam overlay animation */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-[scan_2.5s_infinite] pointer-events-none z-10" />
                
                <button
                  type="button"
                  onClick={stopCameraScan}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/90 hover:bg-slate-800 text-white font-extrabold text-[10px] px-4 py-2 rounded-xl shadow-lg z-20 uppercase tracking-widest transition-all backdrop-blur-sm"
                >
                  {lang === 'es' ? 'Detener Cámara' : 'Stop Camera'}
                </button>
              </div>
            ) : (
              <div className="text-center py-10 px-6 space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mx-auto border border-slate-800">
                  <HiOutlineCamera className="w-8 h-8 text-slate-400" />
                </div>
                <button
                  type="button"
                  onClick={startCameraScan}
                  className="btn-primary text-xs font-black tracking-wider py-3 px-5 shadow-lg shadow-indigo-500/10 flex items-center gap-2 mx-auto hover:scale-[1.03] active:scale-[0.98] transition-all uppercase"
                >
                  <HiOutlineCamera className="w-4 h-4 animate-bounce" />
                  {lang === 'es' ? 'Iniciar Escaneo de Cámara' : 'Start Camera Scanner'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading validating spinner */}
        {validating && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-500 animate-pulse uppercase tracking-widest">
              {lang === 'es' ? 'Verificando entrada...' : 'Verifying ticket...'}
            </p>
          </div>
        )}

        {/* SECURE SCANNER FEEDBACK DASHBOARD OVERLAY */}
        {validationResult && !validating && (
          <div className={`p-6 rounded-2xl border flex flex-col items-center text-center space-y-5 animate-[bounce_1s_1] ${
            validationResult.valid 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
              : 'bg-rose-50/80 border-rose-200 text-rose-900'
          }`}>
            
            {/* Pulsing result icon */}
            <div>
              {validationResult.valid ? (
                <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-pulse">
                  <HiOutlineCheckCircle className="w-10 h-10" />
                </div>
              ) : (
                <div className="w-16 h-16 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-rose-500/20 animate-shake">
                  <HiOutlineXCircle className="w-10 h-10" />
                </div>
              )}
            </div>

            {/* Validation Title */}
            <div>
              <span className={`text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full ${
                validationResult.valid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                {validationResult.valid ? (lang === 'es' ? 'APROBADO' : 'APPROVED') : (lang === 'es' ? 'DENEGADO' : 'DENIED')}
              </span>
              <h3 className="font-black text-xl mt-3 tracking-tight">
                {validationResult.valid 
                  ? (lang === 'es' ? 'Entrada Confirmada' : 'Entry Confirmed') 
                  : (lang === 'es' ? 'Boleto Inválido' : 'Invalid Ticket')}
              </h3>
              <p className="text-xs font-bold text-slate-500 mt-1 max-w-xs">{validationResult.message}</p>
            </div>

            {/* Ticket & Attendee Details Card */}
            {validationResult.ticket && (
              <div className="w-full bg-white/90 border border-slate-100 rounded-xl p-4 text-left space-y-3 shadow-sm text-xs">
                
                {/* Event Name */}
                <div className="border-b border-slate-50 pb-2">
                  <span className="block text-[8px] uppercase text-slate-400 font-bold tracking-wider">Evento</span>
                  <span className="font-extrabold text-sm text-slate-800 uppercase block truncate">
                    {validationResult.ticket.event?.title || 'Noche de TBT'}
                  </span>
                </div>

                {/* Attendee Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[8px] uppercase text-slate-400 font-bold tracking-wider">Asistente</span>
                    <span className="font-bold text-slate-700 block truncate">
                      {validationResult.ticket.user?.firstName} {validationResult.ticket.user?.lastName}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase text-slate-400 font-bold tracking-wider">Ubicación</span>
                    <span className="font-mono font-bold text-slate-700 block truncate">
                      {formatSeatLabel(validationResult.ticket, validationResult.ticket.sectionName, lang)}
                    </span>
                  </div>
                </div>

                {/* Ticket ID & Class */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-50">
                  <div>
                    <span className="block text-[8px] uppercase text-slate-400 font-bold tracking-wider">Sección</span>
                    <span className="font-semibold text-slate-600 block truncate">
                      {validationResult.ticket.sectionName || 'General'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase text-slate-400 font-bold tracking-wider">Código Boleto</span>
                    <span className="font-mono font-bold text-indigo-600 block truncate">
                      {validationResult.code}
                    </span>
                  </div>
                </div>

              </div>
            )}

            {/* Actions Panel */}
            <div className="w-full flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={resetTerminal}
                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-md transition-all ${
                  validationResult.valid 
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/10' 
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/10'
                }`}
              >
                {lang === 'es' ? 'Validar Siguiente Entrada' : 'Validate Next Ticket'}
              </button>

              {validationResult.ticket && (
                <Link
                  href={`/verify/${validationResult.code}`}
                  target="_blank"
                  className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-[10px] text-slate-600 uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all"
                >
                  <HiOutlineExternalLink className="w-4 h-4" />
                  {lang === 'es' ? 'Ver Boleto Digital' : 'View Digital Receipt'}
                </Link>
              )}
            </div>

          </div>
        )}

        {/* Camera scan issues or error alerts */}
        {scanResult && !validationResult && (
          <div className="p-4 rounded-xl border bg-rose-50 border-rose-100 text-rose-800 flex items-center gap-3">
            <HiOutlineXCircle className="w-6 h-6 shrink-0 text-rose-500" />
            <span className="text-xs font-medium">{scanResult.message}</span>
          </div>
        )}

        {/* Manual input validation drawer (hidden during loading or feedback overlay) */}
        {!validationResult && !validating && (
          <>
            {/* Manual Input Divider */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-150"></div>
              <span className="flex-shrink mx-4 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                {lang === 'es' ? 'O introduce el código' : 'Or enter manual code'}
              </span>
              <div className="flex-grow border-t border-slate-150"></div>
            </div>

            {/* Manual Form */}
            <form onSubmit={handleManualSearch} className="space-y-4">
              <div className="relative">
                <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder={lang === 'es' ? 'Ej: TKT-628491' : 'Ex: TKT-628491'}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono tracking-widest uppercase font-bold text-slate-800"
                  required
                />
              </div>
              <button
                type="submit"
                className="btn-primary w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md"
              >
                {lang === 'es' ? 'Validar Código' : 'Validate Code'}
              </button>
            </form>
          </>
        )}

      </div>

      {/* Strict local CSS styling overrides to enforce full responsiveness on html5-qrcode element injections */}
      <style jsx global>{`
        #reader {
          width: 100% !important;
          max-width: 100% !important;
          border: none !important;
          border-radius: 1rem !important;
          overflow: hidden !important;
          background-color: #020617 !important;
        }
        #reader video {
          width: 100% !important;
          height: auto !important;
          max-height: 280px !important;
          object-fit: cover !important;
          border-radius: 1rem !important;
        }
        #reader__header, #reader__footer {
          display: none !important;
        }
        #reader__scan_region {
          border: none !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
        }
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}
