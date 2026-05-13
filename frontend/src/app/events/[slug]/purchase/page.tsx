'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getImageUrl } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import type { Event } from '@/types';
import { VenueSection, Seat, SeatStatus } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useLang } from '@/context/LanguageContext';
import {
  HiOutlineCalendar, HiOutlineLocationMarker, HiOutlineChevronRight,
  HiOutlineCheckCircle, HiOutlineTrash,
} from 'react-icons/hi';
import SeatMapInteractive from '@/components/events/SeatMapInteractive';
import ReservationTimer from '@/components/events/ReservationTimer';
import InvoiceBreakdown, { InvoiceData } from '@/components/events/InvoiceBreakdown';

type Step = 'section' | 'seats' | 'info' | 'payment';
const STEPS: { key: Step; label: string }[] = [
  { key: 'section', label: 'Sección' },
  { key: 'seats',   label: 'Asientos' },
  { key: 'info',    label: 'Identificación' },
  { key: 'payment', label: 'Pagar' },
];

export default function PurchasePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { lang } = useLang();
  const { user, isAuthenticated } = useAuthStore();

  const getSeatPrice = (seat: Seat, section?: VenueSection) => {
    if (!section) return 0;
    try {
      if (section.seatsConfig) {
        const config = JSON.parse(section.seatsConfig);
        let seatKey = '';
        if (seat.rowLabel && seat.rowLabel !== 'GA') {
          seatKey = `${seat.rowLabel}-${seat.seatNumber}`;
        } else {
          seatKey = `seat-${seat.seatNumber}`;
        }
        const override = config[seatKey];
        if (override && override.price !== undefined && override.price !== null) {
          return Number(override.price);
        }
      }
    } catch (e) {}
    return Number(section.price || 0);
  };

  const [event, setEvent] = useState<Event | null>(null);
  const [seatMap, setSeatMap] = useState<(VenueSection & { seats: Seat[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('section');

  // Step 1
  const [selectedSection, setSelectedSection] = useState<(VenueSection & { seats: Seat[] }) | null>(null);

  // Step 2
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [seatsLocked, setSeatsLocked] = useState(false);

  // Step 3 — personal info (pre-filled from user)
  const [personalInfo, setPersonalInfo] = useState({
    firstName: '',
    lastName: '',
    idType: 'V',
    idNumber: '',
    email: '',
    phone: '',
  });

  // Step 4 — invoice
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [hasLoadedSaved, setHasLoadedSaved] = useState(false);

  // ── Load event ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) { router.push(`/login?redirect=/events/${slug}/purchase`); return; }
    loadEvent();
  }, [slug, isAuthenticated]);

  useEffect(() => {
    if (user) {
      setPersonalInfo({
        firstName: user.firstName || '',
        lastName:  user.lastName || '',
        idType:    user.idType   || 'V',
        idNumber:  user.idNumber || '',
        email:     user.email    || '',
        phone:     user.phone    || '',
      });
    }
  }, [user]);

  const loadEvent = async () => {
    try {
      const { data } = await api.get(`/events/${slug}`);
      setEvent(data);
      if (data.id) {
        const { data: map } = await api.get(`/events/${data.id}/seatmap`);
        setSeatMap(map);
      }
    } catch { router.push('/events'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (event?.id && seatMap.length > 0 && !hasLoadedSaved) {
      const saved = localStorage.getItem(`selectedSeats_${event.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.length > 0) {
            // Filter out items older than 10 minutes
            const valid = parsed.filter((s: any) => !s.addedAt || (Date.now() - s.addedAt < 10 * 60 * 1000));
            if (valid.length > 0) {
              setSelectedSeats(valid);
              const firstSeat = valid[0];
              const section = seatMap.find((s) => s.id === firstSeat.sectionId);
              if (section) {
                setSelectedSection(section);
                // Auto-lock and skip to info
                api.post('/events/seats/lock', { seatIds: valid.map((s: any) => s.id) })
                  .then(() => {
                    setSeatsLocked(true);
                    setStep('info');
                  })
                  .catch(() => {
                    setStep('seats'); // if lock fails, let them pick again
                  });
              }
            } else {
              localStorage.removeItem(`selectedSeats_${event.id}`);
              window.dispatchEvent(new Event('cart-updated'));
            }
          }
        } catch (e) {}
      }
      setHasLoadedSaved(true);
    }
  }, [event, seatMap, hasLoadedSaved]);

  // ── Step navigation ────────────────────────────────────────────────────────
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const goToStep = (s: Step) => setStep(s);

  // ── Step 1: pick section ───────────────────────────────────────────────────
  const handleSelectSection = (sec: VenueSection & { seats: Seat[] }) => {
    setSelectedSection(sec);
    setSelectedSeats([]);
    setSeatsLocked(false);
    setStep('seats');
  };

  // Synchronize state changes to localStorage and dispatch cart-updated
  useEffect(() => {
    if (!event?.id || !hasLoadedSaved) return;

    const cartData = selectedSeats.map(s => ({
      ...s,
      addedAt: (s as any).addedAt || Date.now(),
      eventTitle: event.title,
      eventSlug: event.slug,
      eventDate: event.eventDate,
      venueName: event.venueName,
      currency: event.currency
    }));
    localStorage.setItem(`selectedSeats_${event.id}`, JSON.stringify(cartData));
    window.dispatchEvent(new Event('cart-updated'));
  }, [selectedSeats, event, hasLoadedSaved]);

  // ── Step 2: toggle seat ────────────────────────────────────────────────────
  const toggleSeats = useCallback((seats: Seat[]) => {
    setSelectedSeats((prev) => {
      let next = [...prev];
      for (const seat of seats) {
        const exists = next.find(s => s.id === seat.id);
        if (exists) {
          next = next.filter(s => s.id !== seat.id);
        } else {
          if (next.length >= 10) {
            alert(lang === 'es' ? 'No puedes reservar más de 10 asientos por transacción.' : 'You cannot reserve more than 10 seats per transaction.');
            break;
          }
          next.push(seat);
        }
      }
      return next;
    });
  }, [lang]);

  const handleConfirmSeats = async () => {
    if (selectedSeats.length === 0) return;
    try {
      await api.post('/events/seats/lock', { seatIds: selectedSeats.map((s) => s.id) });
      setSeatsLocked(true);
      setStep('info');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al reservar asientos');
    }
  };

  // ── Step 2: timer expire ───────────────────────────────────────────────────
  const handleTimerExpire = async () => {
    try {
      await api.post('/events/seats/unlock');
    } catch {}
    setSeatsLocked(false);
    setSelectedSeats([]);
    alert('⏰ Tu reservación ha expirado. Los asientos fueron liberados.');
    setStep('seats');
    // Reload fresh seat map
    if (event?.id) {
      const { data: map } = await api.get(`/events/${event.id}/seatmap`);
      setSeatMap(map);
    }
  };

  // ── Step 3: next ───────────────────────────────────────────────────────────
  const handleConfirmInfo = async () => {
    if (!personalInfo.firstName || !personalInfo.lastName || !personalInfo.email) return;
    // Load invoice preview
    setInvoiceLoading(true);
    try {
      const { data } = await api.get('/orders/preview-invoice', {
        params: {
          eventId: event!.id,
          seatIds: selectedSeats.map((s) => s.id).join(','),
        },
      });
      setInvoice({ ...data, currency: event?.currency || 'USD' });
      setStep('payment');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al calcular factura');
    } finally {
      setInvoiceLoading(false);
    }
  };

  // ── Step 4: pay ────────────────────────────────────────────────────────────
  const handlePay = async () => {
    setBuying(true);
    try {
      const { data } = await api.post('/orders/checkout', {
        eventId: event!.id,
        seatIds: selectedSeats.map((s) => s.id),
      });
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al procesar pago');
    } finally {
      setBuying(false);
    }
  };

  // ── Cancel / unlock ────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!confirm('¿Deseas cancelar la reservación? Los asientos serán liberados.')) return;
    try { await api.post('/events/seats/unlock'); } catch {}
    router.push(`/events/${slug}`);
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <div className="h-6 skeleton rounded w-1/3" />
        <div className="h-48 skeleton rounded" />
      </div>
    );
  }
  if (!event) return null;

  const eventDate = new Date(event.eventDate);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
      <nav className="wizard-breadcrumb sticky top-0 z-20 shadow-sm">
        <Link href="/" className="wizard-breadcrumb-item done text-xs">Inicio</Link>
        <span className="wizard-breadcrumb-sep">›</span>
        <Link href={`/events/${slug}`} className="wizard-breadcrumb-item done text-xs truncate max-w-[140px]">
          {event.title}
        </Link>
        {STEPS.map((s, i) => (
          <span key={s.key} className="flex items-center">
            <span className="wizard-breadcrumb-sep">›</span>
            <button
              className={`wizard-breadcrumb-item text-xs ${
                s.key === step ? 'active' : i < stepIndex ? 'done' : ''
              }`}
              onClick={() => i < stepIndex && goToStep(s.key)}
            >
              {i < stepIndex && <HiOutlineCheckCircle className="w-3.5 h-3.5 shrink-0" />}
              {s.label}
            </button>
          </span>
        ))}
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main panel ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Event title bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h1 className="font-bold text-lg text-gray-900 leading-tight">{event.title}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-blue-600">
              <span className="flex items-center gap-1.5">
                <HiOutlineLocationMarker className="w-4 h-4" />
                {event.venueName}
              </span>
              <span className="flex items-center gap-1.5">
                <HiOutlineCalendar className="w-4 h-4" />
                {format(eventDate, "dd/MM/yyyy 'a las' hh:mm a", { locale: es })}
              </span>
            </div>
          </div>

          {/* Timer — shown from step 2 onward if seats are locked */}
          {seatsLocked && (step === 'info' || step === 'payment') && (
            <ReservationTimer onExpire={handleTimerExpire} />
          )}

          {/* ── STEP 1: Selección de sección ─────────────────────────────── */}
          {step === 'section' && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 step-panel">
              <h2 className="font-bold text-base text-blue-600 mb-4 border-b border-gray-100 pb-2">
                Escoge dónde quieres estar
              </h2>

              {/* Venue map thumbnail showing sections */}
              <div className="relative bg-gray-50 border border-gray-200 rounded-lg overflow-hidden mb-5" style={{ minHeight: 200 }}>
                <div className="p-4 flex flex-col gap-2">
                  {seatMap.map((sec) => (
                    <button
                      key={sec.id}
                      onClick={() => handleSelectSection(sec)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all hover:shadow-md hover:-translate-y-0.5"
                      style={{ borderColor: sec.color, background: `${sec.color}15` }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="w-4 h-4 rounded-full shrink-0"
                          style={{ background: sec.color }}
                        />
                        <span className="font-bold text-gray-900 text-sm">{sec.name}</span>
                        <span className="text-xs text-gray-500">
                          {sec.sectionType === 'vip' ? '⭐ VIP' : sec.sectionType === 'standing' ? '🧍 General' : '💺 Numerado'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm" style={{ color: sec.color }}>
                          ${Number(sec.price).toFixed(2)} {event.currency || 'USD'}
                        </span>
                        <HiOutlineChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
                <div className="stage mx-4 mb-4" style={{ fontSize: '0.65rem', padding: '0.4rem' }}>
                  ESCENARIO
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Selección de asientos ──────────────────────────────── */}
          {step === 'seats' && selectedSection && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 step-panel">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                <h2 className="font-bold text-base text-blue-600">
                  Selecciona tus asientos — <span style={{ color: selectedSection.color }}>{selectedSection.name}</span>
                </h2>
                <button
                  onClick={() => setStep('section')}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  ← cambiar sección
                </button>
              </div>

              <SeatMapInteractive
                seatMap={seatMap}
                selectedSeats={selectedSeats}
                onToggleSeats={toggleSeats}
                filterSectionId={selectedSection.id}
                defaultViewX={event.defaultViewX}
                defaultViewY={event.defaultViewY}
                defaultViewZoom={event.defaultViewZoom}
                showStage={event?.showStage}
              />

              {/* Selected seats chips */}
              {selectedSeats.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedSeats.map((seat) => {
                    const sec = seatMap.find(s => s.id === seat.sectionId);
                    return (
                      <span key={seat.id} className="seat-chip">
                        {selectedSection.name} {seat.rowLabel}{seat.seatNumber}
                        <button onClick={() => {
                          if (sec && sec.tablePurchaseMode === 'whole') {
                            const allSeats = sec.seats || [];
                            const tableSelectedSeats = allSeats.filter(s => selectedSeats.some(ss => ss.id === s.id));
                            toggleSeats(tableSelectedSeats);
                          } else {
                            toggleSeats([seat]);
                          }
                        }}>×</button>
                      </span>
                    );
                  })}
                </div>
              )}

              <button
                onClick={handleConfirmSeats}
                disabled={selectedSeats.length === 0}
                className="btn-primary w-full py-3 mt-4 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {selectedSeats.length === 0
                  ? 'Selecciona al menos 1 asiento'
                  : `Reservar ${selectedSeats.length} asiento${selectedSeats.length > 1 ? 's' : ''} →`}
              </button>
              <p className="text-[10px] text-gray-400 text-center mt-2">
                *Una vez reservado, tendrás 10 minutos para completar el pago. De lo contrario los asientos serán liberados.
              </p>
            </div>
          )}

          {/* ── STEP 3: Información personal ─────────────────────────────── */}
          {step === 'info' && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 step-panel">
              <h2 className="font-bold text-base text-blue-600 mb-1 border-b border-gray-100 pb-2">
                Información personal
              </h2>
              {/* Read-only summary */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div><span className="text-gray-500">Nombre y apellido:</span> <strong>{personalInfo.firstName} {personalInfo.lastName}</strong></div>
                <div><span className="text-gray-500">Email:</span> <strong>{personalInfo.email}</strong></div>
                <div><span className="text-gray-500">Teléfono:</span> <strong>{personalInfo.phone || 'No registrado'}</strong></div>
              </div>

              {/* Editable fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre:</label>
                  <input className="input text-sm" value={personalInfo.firstName}
                    onChange={(e) => setPersonalInfo((p) => ({ ...p, firstName: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Apellido:</label>
                  <input className="input text-sm" value={personalInfo.lastName}
                    onChange={(e) => setPersonalInfo((p) => ({ ...p, lastName: e.target.value }))} required />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Correo electrónico:</label>
                  <input className="input text-sm" type="email" value={personalInfo.email}
                    onChange={(e) => setPersonalInfo((p) => ({ ...p, email: e.target.value }))} required />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono:</label>
                  <input className="input text-sm" value={personalInfo.phone}
                    onChange={(e) => setPersonalInfo((p) => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>

              <button
                onClick={handleConfirmInfo}
                disabled={invoiceLoading || !personalInfo.firstName || !personalInfo.lastName || !personalInfo.email}
                className="btn-primary w-full py-3 mt-5 disabled:opacity-40"
              >
                {invoiceLoading ? 'Calculando...' : 'Continuar →'}
              </button>

              <button onClick={handleCancel} className="w-full mt-2 py-2 text-xs text-red-500 hover:text-red-700 font-medium">
                Eliminar reservación
              </button>
            </div>
          )}

          {/* ── STEP 4: Forma de pago ─────────────────────────────────────── */}
          {step === 'payment' && invoice && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 step-panel">
              <h2 className="font-bold text-base text-blue-600 mb-4 border-b border-gray-100 pb-2">
                Forma de pago
              </h2>

              <InvoiceBreakdown invoice={invoice} eventTitle={event.title} />

              <div className="mt-5 space-y-3">
                <button
                  onClick={handlePay}
                  disabled={buying}
                  className="btn-primary w-full py-3.5 text-sm disabled:opacity-50"
                >
                  {buying ? (
                    <span className="flex items-center gap-2 justify-center">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                      </svg>
                      Procesando...
                    </span>
                  ) : (
                    <>💳 Pagar ${Number(invoice.total).toFixed(2)} {invoice.currency || 'USD'} con Stripe</>
                  )}
                </button>
                <p className="text-center text-[10px] text-gray-400">
                  Pagos seguros encriptados — procesado por Stripe
                </p>
                <button onClick={handleCancel} className="w-full py-2 text-xs text-red-500 hover:text-red-700 font-medium">
                  🗑 Eliminar reservación
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            {/* Selected seats summary */}
            {selectedSeats.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-bold text-sm text-gray-800 mb-2">
                  {selectedSeats.length} asiento{selectedSeats.length > 1 ? 's' : ''} seleccionado{selectedSeats.length > 1 ? 's' : ''}
                </h3>
                <div className="space-y-1">
                  {selectedSeats.map((seat) => {
                    const sec = seatMap.find((s) => s.id === seat.sectionId);
                    return (
                      <div key={seat.id} className="flex justify-between text-xs">
                        <span className="text-gray-600">{sec?.name} — {seat.rowLabel}{seat.seatNumber}</span>
                        <span className="font-medium text-gray-800">${getSeatPrice(seat, sec).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
                {invoice && (
                  <>
                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Subtotal</span>
                        <span>${Number(invoice.baseTotal).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Servicio + impuestos</span>
                        <span>${(invoice.total - invoice.baseTotal).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm mt-1">
                        <span>Total</span>
                        <span className="text-primary-600">${Number(invoice.total).toFixed(2)} {event.currency || 'USD'}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Event image */}
            {event.imageUrl && (
              <div className="rounded-lg overflow-hidden border border-gray-200">
                <img
                  src={getImageUrl(event.imageUrl)}
                  alt={event.title}
                  className="w-full object-cover aspect-[4/3]"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
