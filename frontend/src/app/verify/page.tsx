'use client';

import { useState, useEffect } from 'react';
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
  HiOutlineTicket,
  HiOutlineExternalLink,
  HiOutlineRefresh,
  HiOutlineClock,
} from 'react-icons/hi';
import Link from 'next/link';

type RecentScan = {
  code: string;
  valid: boolean;
  message: string;
  attendee?: string;
  location?: string;
  time: string;
};

export default function TicketScannerPage() {
  const { lang } = useLang();
  const { isAuthenticated } = useAuthStore();
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [scannerInstance, setScannerInstance] = useState<any>(null);
  const [highContrast, setHighContrast] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [liveStats, setLiveStats] = useState({ total: 0, approved: 0, denied: 0 });
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message: string;
    ticket?: any;
    code: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (scannerInstance && scannerInstance.isScanning) {
        scannerInstance.stop().catch(() => {});
      }
    };
  }, [scannerInstance]);

  const playFeedback = (valid: boolean) => {
    if (typeof window === 'undefined') return;

    if ('vibrate' in navigator) {
      navigator.vibrate(valid ? [80] : [120, 60, 120]);
    }

    if (!soundEnabled) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = valid ? 880 : 220;
      gain.gain.value = 0.08;

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + (valid ? 0.12 : 0.22));
    } catch {}
  };

  const registerScan = (result: { valid: boolean; message: string; code: string; ticket?: any }) => {
    setLiveStats((prev) => ({
      total: prev.total + 1,
      approved: prev.approved + (result.valid ? 1 : 0),
      denied: prev.denied + (result.valid ? 0 : 1),
    }));

    const attendee = result.ticket?.user
      ? `${result.ticket.user.firstName || ''} ${result.ticket.user.lastName || ''}`.trim()
      : undefined;

    const location = result.ticket
      ? formatSeatLabel(result.ticket, result.ticket.sectionName, lang)
      : undefined;

    setRecentScans((prev) => [
      {
        code: result.code,
        valid: result.valid,
        message: result.message,
        attendee,
        location,
        time: new Date().toLocaleTimeString(lang === 'es' ? 'es-US' : 'en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      },
      ...prev,
    ].slice(0, 6));

    playFeedback(result.valid);
  };

  const stopCameraScan = async () => {
    if (scannerInstance) {
      try {
        if (scannerInstance.isScanning) {
          await scannerInstance.stop();
        }
      } catch {}
      setScannerInstance(null);
    }
    setIsScanning(false);
  };

  const handleValidateTicket = async (code: string) => {
    const cleanCode = code.trim().toUpperCase();
    setValidating(true);
    setValidationResult(null);
    setScanResult(null);
    setManualCode('');

    try {
      let ticketData: any = null;

      try {
        const { data } = await api.get(`/orders/ticket/${cleanCode}`);
        ticketData = data;
      } catch {
        const result = {
          valid: false,
          message: lang === 'es' ? 'Código de ticket no encontrado o inválido.' : 'Ticket code not found or invalid.',
          code: cleanCode,
        };
        setValidationResult(result);
        registerScan(result);
        return;
      }

      const { data: res } = await api.post(`/orders/ticket/${cleanCode}/validate`);
      const result = {
        valid: Boolean(res.valid),
        message: res.message,
        ticket: res.ticket || ticketData,
        code: cleanCode,
      };

      setValidationResult(result);
      registerScan(result);
    } catch (err: any) {
      const result = {
        valid: false,
        message: err.response?.data?.message || (lang === 'es' ? 'Ocurrió un error al procesar la validación.' : 'An error occurred during verification.'),
        code: cleanCode,
      };
      setValidationResult(result);
      registerScan(result);
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
      const { Html5Qrcode } = await import('html5-qrcode');

      setTimeout(async () => {
        try {
          const qrCodeScanner = new Html5Qrcode('reader');
          setScannerInstance(qrCodeScanner);

          await qrCodeScanner.start(
            { facingMode: 'environment' },
            {
              fps: 30,
              qrbox: (width, height) => {
                const size = Math.min(width, height) * 0.82;
                return { width: size, height: size };
              },
              aspectRatio: 1.0,
            },
            async (decodedText) => {
              try {
                await qrCodeScanner.stop();
              } catch {}

              setIsScanning(false);
              setScannerInstance(null);

              let code = decodedText.trim();
              if (decodedText.includes('/verify/')) {
                const parts = decodedText.split('/verify/');
                code = parts[parts.length - 1];
              }

              handleValidateTicket(code);
            },
            () => {}
          );
        } catch {
          setIsScanning(false);
          setScanResult({
            success: false,
            message: lang === 'es' ? 'Error de acceso. Revisa los permisos de cámara.' : 'Access error. Please verify camera permission settings.',
          });
        }
      }, 200);
    } catch {
      setIsScanning(false);
      setScanResult({
        success: false,
        message: lang === 'es' ? 'No se pudo cargar el scanner de cámara.' : 'Could not load camera scanner.',
      });
    }
  };

  const resetTerminal = () => {
    setValidationResult(null);
    setScanResult(null);
    startCameraScan();
  };

  const resetStats = () => {
    setLiveStats({ total: 0, approved: 0, denied: 0 });
    setRecentScans([]);
  };

  const shellClass = 'min-h-screen bg-white text-slate-900';

  const panelClass = 'bg-white border-gray-150 shadow-[0_20px_60px_rgba(15,23,42,0.04)]';

  return (
    <div className={`${shellClass} flex flex-col items-center justify-center px-4 py-8 md:py-12`}>
      <div className="w-full max-w-6xl grid grid-cols-1 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)] gap-5">
        <div className={`w-full rounded-3xl border p-5 md:p-7 space-y-5 overflow-hidden ${panelClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F97316] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                <HiOutlineQrcode className="h-4 w-4" />
                {lang === 'es' ? 'Modo evento' : 'Event mode'}
              </div>
              <h1 className={`mt-3 text-2xl font-black tracking-tight ${highContrast ? 'text-white' : 'text-slate-900'}`}>
                {lang === 'es' ? 'Scanner de puerta' : 'Door scanner'}
              </h1>
              <p className={`mt-1 max-w-xs text-xs font-semibold ${highContrast ? 'text-white/60' : 'text-slate-500'}`}>
                {lang === 'es' ? 'Validación rápida con cámara, vibración, sonido y conteo en vivo.' : 'Fast validation with camera, vibration, sound and live counts.'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setHighContrast((v) => !v)}
                className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide transition ${highContrast ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-[#0A375A] text-white hover:bg-[#082d49]'}`}
              >
                {highContrast ? (lang === 'es' ? 'Claro' : 'Light') : (lang === 'es' ? 'Oscuro' : 'Dark')}
              </button>
              <button
                type="button"
                onClick={() => setSoundEnabled((v) => !v)}
                className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide transition ${soundEnabled ? 'bg-[#F97316] text-white' : 'bg-white/10 text-white'}`}
              >
                {soundEnabled ? (lang === 'es' ? 'Sonido ON' : 'Sound ON') : (lang === 'es' ? 'Sonido OFF' : 'Sound OFF')}
              </button>
            </div>
          </div>

          {!isAuthenticated && (
            <div className="rounded-2xl border border-[#F97316]/30 bg-[#F97316]/10 px-4 py-3 text-xs font-bold text-[#F97316]">
              {lang === 'es' ? 'Debes iniciar sesión como organizador o admin para validar entradas.' : 'You must be signed in as organizer or admin to validate tickets.'}
            </div>
          )}

          {!validationResult && !validating && (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black text-white">
              {isScanning ? (
                <div className="relative w-full overflow-hidden">
                  <div id="reader" className="relative w-full overflow-hidden" />
                  <div className="pointer-events-none absolute inset-x-8 top-8 bottom-8 rounded-3xl border-2 border-[#F97316]/80 shadow-[0_0_30px_rgba(249,115,22,0.30)]" />
                  <div className="absolute left-8 right-8 top-0 h-0.5 bg-[#F97316] shadow-[0_0_18px_#F97316] animate-[scan_2.1s_infinite] pointer-events-none z-10" />

                  <button
                    type="button"
                    onClick={stopCameraScan}
                    className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-xl bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#0A375A] shadow-lg transition hover:bg-orange-50"
                  >
                    {lang === 'es' ? 'Detener cámara' : 'Stop camera'}
                  </button>
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-[#F97316]">
                    <HiOutlineCamera className="h-8 w-8" />
                  </div>
                  <button
                    type="button"
                    onClick={startCameraScan}
                    className="mx-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-600 active:scale-[0.98]"
                  >
                    <HiOutlineCamera className="h-4 w-4" />
                    {lang === 'es' ? 'Iniciar scanner' : 'Start scanner'}
                  </button>
                </div>
              )}
            </div>
          )}

          {validating && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="h-11 w-11 animate-spin rounded-full border-4 border-[#F97316] border-t-transparent" />
              <p className={`text-xs font-black uppercase tracking-widest ${highContrast ? 'text-white/60' : 'text-slate-500'}`}>
                {lang === 'es' ? 'Verificando entrada...' : 'Verifying ticket...'}
              </p>
            </div>
          )}

          {validationResult && !validating && (
            <div className={`rounded-3xl border p-6 text-center ${
              validationResult.valid
                ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                : 'border-red-400/40 bg-red-500/10 text-red-100'
            }`}>
              <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg ${
                validationResult.valid ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-red-500 shadow-red-500/20'
              }`}>
                {validationResult.valid ? <HiOutlineCheckCircle className="h-12 w-12" /> : <HiOutlineXCircle className="h-12 w-12" />}
              </div>

              <p className="mt-5 text-[11px] font-black uppercase tracking-[0.24em]">
                {validationResult.valid ? (lang === 'es' ? 'Aprobado' : 'Approved') : (lang === 'es' ? 'Denegado' : 'Denied')}
              </p>
              <h3 className="mt-2 text-2xl font-black text-white">
                {validationResult.valid
                  ? (lang === 'es' ? 'Entrada confirmada' : 'Entry confirmed')
                  : (lang === 'es' ? 'Boleto inválido' : 'Invalid ticket')}
              </h3>
              <p className="mt-2 text-xs font-bold text-white/65">{validationResult.message}</p>

              {validationResult.ticket && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/95 p-4 text-left text-xs text-slate-800">
                  <div className="border-b border-slate-100 pb-3">
                    <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {lang === 'es' ? 'Evento' : 'Event'}
                    </span>
                    <span className="block truncate text-sm font-black uppercase text-[#0A375A]">
                      {validationResult.ticket.event?.title || '-'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3">
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {lang === 'es' ? 'Asistente' : 'Attendee'}
                      </span>
                      <span className="block truncate font-bold">
                        {validationResult.ticket.user?.firstName} {validationResult.ticket.user?.lastName}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {lang === 'es' ? 'Ubicación' : 'Location'}
                      </span>
                      <span className="block truncate font-mono font-bold">
                        {formatSeatLabel(validationResult.ticket, validationResult.ticket.sectionName, lang)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {lang === 'es' ? 'Sección' : 'Section'}
                      </span>
                      <span className="block truncate font-bold">{validationResult.ticket.sectionName || 'General'}</span>
                    </div>
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {lang === 'es' ? 'Código' : 'Code'}
                      </span>
                      <span className="block truncate font-mono font-black text-[#F97316]">{validationResult.code}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={resetTerminal}
                  className="rounded-2xl bg-[#F97316] px-5 py-3 text-xs font-black uppercase tracking-wide text-white transition hover:bg-orange-600"
                >
                  {lang === 'es' ? 'Validar siguiente entrada' : 'Validate next ticket'}
                </button>

                {validationResult.ticket && (
                  <Link
                    href={`/verify/${validationResult.code}`}
                    target="_blank"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-wide text-white transition hover:bg-white/15"
                  >
                    <HiOutlineExternalLink className="h-4 w-4" />
                    {lang === 'es' ? 'Ver boleto digital' : 'View digital ticket'}
                  </Link>
                )}
              </div>
            </div>
          )}

          {scanResult && !validationResult && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-200">
              <HiOutlineXCircle className="h-6 w-6 shrink-0" />
              <span className="text-xs font-bold">{scanResult.message}</span>
            </div>
          )}

          {!validationResult && !validating && (
            <>
              <div className="relative flex items-center py-1">
                <div className={`flex-grow border-t ${highContrast ? 'border-white/10' : 'border-slate-200'}`} />
                <span className={`mx-4 flex-shrink text-[10px] font-black uppercase tracking-widest ${highContrast ? 'text-white/40' : 'text-slate-400'}`}>
                  {lang === 'es' ? 'Código manual' : 'Manual code'}
                </span>
                <div className={`flex-grow border-t ${highContrast ? 'border-white/10' : 'border-slate-200'}`} />
              </div>

              <form onSubmit={handleManualSearch} className="space-y-3">
                <div className="relative">
                  <HiOutlineSearch className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder={lang === 'es' ? 'Código del ticket' : 'Ticket code'}
                    className={`w-full rounded-2xl border px-12 py-3 text-sm font-black uppercase tracking-widest outline-none transition focus:ring-2 focus:ring-[#F97316] ${
                      highContrast ? 'border-white/10 bg-white/5 text-white placeholder:text-white/30' : 'border-slate-200 bg-white text-slate-900'
                    }`}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-2xl bg-[#0A375A] px-5 py-3.5 text-xs font-black uppercase tracking-wide text-white shadow-md transition hover:bg-[#082d49]"
                >
                  {lang === 'es' ? 'Validar código' : 'Validate code'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className={`rounded-3xl border p-5 md:p-7 ${panelClass}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#F97316]">
                {lang === 'es' ? 'Conteo en vivo' : 'Live count'}
              </p>
              <h2 className={`mt-2 text-2xl font-black ${highContrast ? 'text-white' : 'text-slate-900'}`}>
                {lang === 'es' ? 'Operación de puerta' : 'Door operation'}
              </h2>
            </div>

            <button
              type="button"
              onClick={resetStats}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide transition ${
                highContrast ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <HiOutlineRefresh className="h-4 w-4" />
              {lang === 'es' ? 'Reiniciar' : 'Reset'}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className={`rounded-2xl border p-4 ${highContrast ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{lang === 'es' ? 'Total' : 'Total'}</p>
              <p className={`mt-2 text-3xl font-black ${highContrast ? 'text-white' : 'text-[#0A375A]'}`}>{liveStats.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-emerald-300">{lang === 'es' ? 'Aprobados' : 'Approved'}</p>
              <p className="mt-2 text-3xl font-black text-emerald-300">{liveStats.approved}</p>
            </div>
            <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-red-300">{lang === 'es' ? 'Denegados' : 'Denied'}</p>
              <p className="mt-2 text-3xl font-black text-red-300">{liveStats.denied}</p>
            </div>
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className={`text-sm font-black ${highContrast ? 'text-white' : 'text-slate-900'}`}>
                {lang === 'es' ? 'Últimos escaneados' : 'Last scanned'}
              </h3>
              <HiOutlineClock className="h-5 w-5 text-[#F97316]" />
            </div>

            {recentScans.length > 0 ? (
              <div className="space-y-3">
                {recentScans.map((scan, index) => (
                  <div
                    key={`${scan.code}-${scan.time}-${index}`}
                    className={`rounded-2xl border p-4 ${
                      scan.valid
                        ? 'border-emerald-400/20 bg-emerald-500/10'
                        : 'border-red-400/20 bg-red-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {scan.valid ? (
                            <HiOutlineCheckCircle className="h-5 w-5 shrink-0 text-emerald-300" />
                          ) : (
                            <HiOutlineXCircle className="h-5 w-5 shrink-0 text-red-300" />
                          )}
                          <p className={`truncate text-sm font-black ${highContrast ? 'text-white' : 'text-slate-900'}`}>
                            {scan.attendee || scan.message}
                          </p>
                        </div>
                        <p className={`mt-1 truncate text-xs font-semibold ${highContrast ? 'text-white/50' : 'text-slate-500'}`}>
                          {scan.location || '-'} · {scan.code}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${highContrast ? 'bg-white/10 text-white' : 'bg-white text-slate-600'}`}>
                        {scan.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`rounded-2xl border px-5 py-12 text-center ${highContrast ? 'border-white/10 bg-white/5 text-white/45' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>
                <HiOutlineTicket className="mx-auto mb-3 h-10 w-10 opacity-50" />
                <p className="text-sm font-bold">
                  {lang === 'es' ? 'Todavía no hay escaneos en esta sesión.' : 'No scans in this session yet.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

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
          min-height: 320px !important;
          max-height: 520px !important;
          object-fit: cover !important;
          border-radius: 1rem !important;
          background: #020617 !important;
        }
        #reader__header,
        #reader__footer {
          display: none !important;
        }
        #reader__scan_region {
          border: none !important;
          display: flex !important;
          justify-content: center !important;
          align-items: center !important;
        }
        @keyframes scan {
          0% { top: 8%; }
          50% { top: 92%; }
          100% { top: 8%; }
        }
      `}</style>
    </div>
  );
}
