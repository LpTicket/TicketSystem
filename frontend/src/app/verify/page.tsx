'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLang } from '@/context/LanguageContext';
import { useAuthStore } from '@/stores/auth';
import {
  HiOutlineQrcode,
  HiOutlineSearch,
  HiOutlineUpload,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineCamera,
} from 'react-icons/hi';

export default function TicketScannerPage() {
  const router = useRouter();
  const { lang } = useLang();
  const { isAuthenticated } = useAuthStore();
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [scannerInstance, setScannerInstance] = useState<any>(null);

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

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      router.push(`/verify/${manualCode.trim()}`);
    }
  };

  const startCameraScan = async () => {
    setIsScanning(true);
    setScanResult(null);

    try {
      // Dynamic import to avoid NextJS SSR document build issues
      const { Html5Qrcode } = await import('html5-qrcode');

      setTimeout(async () => {
        try {
          const qrCodeScanner = new Html5Qrcode('reader');
          setScannerInstance(qrCodeScanner);

          await qrCodeScanner.start(
            { facingMode: 'environment' }, // Default back camera on mobiles
            {
              fps: 10,
              qrbox: { width: 220, height: 220 },
            },
            async (decodedText) => {
              // Decoded QR text! Stop camera and go to code validation page
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
              router.push(`/verify/${code}`);
            },
            (errorMessage) => {
              // Verbose scan search errors, quiet in production
            }
          );
        } catch (err: any) {
          console.error('Camera access failed', err);
          setIsScanning(false);
          setScanResult({
            success: false,
            message: lang === 'es' ? 'Error al iniciar la cámara. Verifica los permisos de acceso en tu navegador.' : 'Error starting camera. Please verify permission settings in your browser.'
          });
        }
      }, 300);
    } catch (err) {
      console.error('Html5Qrcode dynamic load failed', err);
      setIsScanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-[0_15px_50px_rgba(0,0,0,0.03)] p-8 space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mx-auto mb-4 animate-bounce">
            <HiOutlineQrcode className="w-8 h-8" />
          </div>
          <h1 className="font-bold text-2xl text-gray-900">
            {lang === 'es' ? 'Control de Accesos' : 'Access Gate Control'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {lang === 'es' ? 'Escanea códigos QR de entradas o introduce el código manualmente' : 'Scan ticket QR codes or input ticket IDs manually'}
          </p>
        </div>

        {/* Live Camera Scanner Box */}
        <div className="relative border border-gray-100 rounded-2xl overflow-hidden bg-gray-900 min-h-[220px] aspect-video flex flex-col items-center justify-center text-white">
          {isScanning ? (
            <div className="w-full h-full relative flex flex-col justify-between">
              {/* HTML5 QrCode target render node */}
              <div id="reader" className="w-full h-full relative" />
              {/* Laser beam animation */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 shadow-[0_0_15px_#ef4444] animate-[scan_2s_infinite] pointer-events-none z-10" />
              
              <button
                type="button"
                onClick={stopCameraScan}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10px] px-4 py-2 rounded-xl shadow-lg z-20 uppercase tracking-widest transition-all hover:scale-105 active:scale-95"
              >
                {lang === 'es' ? 'Detener Cámara' : 'Stop Camera'}
              </button>
            </div>
          ) : (
            <div className="text-center p-6 space-y-4">
              <HiOutlineQrcode className="w-12 h-12 text-gray-500 mx-auto" />
              <button
                type="button"
                onClick={startCameraScan}
                className="btn-primary text-xs font-bold py-2.5 px-4 shadow-lg shadow-primary-500/10 flex items-center gap-1.5 mx-auto hover:scale-105 transition-all"
              >
                <HiOutlineCamera className="w-4 h-4 animate-pulse" />
                {lang === 'es' ? 'Iniciar Cámara' : 'Start Camera'}
              </button>
            </div>
          )}
        </div>

        {/* Scan Result Feedback */}
        {scanResult && (
          <div className={`p-4 rounded-xl border flex items-center gap-3 ${
            scanResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {scanResult.success ? (
              <HiOutlineCheckCircle className="w-6 h-6 shrink-0 text-green-500" />
            ) : (
              <HiOutlineXCircle className="w-6 h-6 shrink-0 text-red-500" />
            )}
            <span className="text-xs font-medium">{scanResult.message}</span>
          </div>
        )}

        {/* Manual Input Divider */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-gray-100"></div>
          <span className="flex-shrink mx-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
            {lang === 'es' ? 'O introduce el código' : 'Or enter manual code'}
          </span>
          <div className="flex-grow border-t border-gray-100"></div>
        </div>

        {/* Manual Form */}
        <form onSubmit={handleManualSearch} className="space-y-4">
          <div className="relative">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={lang === 'es' ? 'Ej: TKT-628491' : 'Ex: TKT-628491'}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm font-mono tracking-widest uppercase font-bold"
              required
            />
          </div>
          <button
            type="submit"
            className="btn-primary w-full py-3.5 rounded-xl font-bold text-sm shadow-md"
          >
            {lang === 'es' ? 'Validar Código' : 'Validate Code'}
          </button>
        </form>

      </div>

      {/* Embedded CSS for animated scan laser line */}
      <style jsx global>{`
        @keyframes scan {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}
