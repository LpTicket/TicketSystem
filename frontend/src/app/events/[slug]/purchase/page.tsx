'use client';

import { toast } from 'react-hot-toast';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api, { getImageUrl } from '@/lib/api';
import { formatSeatLabel } from '@/lib/seatLabel';
import { formatDateInTimezone } from '@/lib/dateUtils';
import { useAuthStore } from '@/stores/auth';
import type { Event } from '@/types';
import { VenueSection, Seat, SeatStatus } from '@/types';
import { useLang } from '@/context/LanguageContext';
import {
  HiOutlineCalendar, HiOutlineLocationMarker, HiOutlineChevronRight,
  HiOutlineCheckCircle, HiOutlineTrash,
} from 'react-icons/hi';
import SeatMapInteractive from '@/components/events/SeatMapInteractive';
import ReservationTimer from '@/components/events/ReservationTimer';
import InvoiceBreakdown, { InvoiceData } from '@/components/events/InvoiceBreakdown';

/**
 * Steps for the checkout wizard.
 */
type Step = 'section' | 'seats' | 'info' | 'payment';
const STEPS: { key: Step; label: string }[] = [
  { key: 'section', label: 'Section' },
  { key: 'seats',   label: 'Seats' },
  { key: 'info',    label: 'Identification' },
  { key: 'payment', label: 'Pay' },
];

/**
 * PurchasePage Component
 * Manages the entire ticket purchasing flow:
 * 1. Section Selection
 * 2. Seat/Quantity Selection & Locking
 * 3. User Info Verification
 * 4. Payment processing via Stripe
 */
export default function PurchasePage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { lang } = useLang();
  const { user, isAuthenticated } = useAuthStore();

  /**
   * Calculates the price for a specific seat, considering potential overrides
   * defined in the section's seat configuration.
   */
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
    } catch (e) {
      // If parsing fails, fall back to base section price
    }
    return Number(section.price || 0);
  };

  const [event, setEvent] = useState<Event | null>(null);
  const [seatMap, setSeatMap] = useState<(VenueSection & { seats: Seat[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('section');

  // Step 1: Current active section
  const [selectedSection, setSelectedSection] = useState<(VenueSection & { seats: Seat[] }) | null>(null);

  // Step 2: Selected seats or standing quantity
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [standingQuantity, setStandingQuantity] = useState<number>(1);
  const [seatsLocked, setSeatsLocked] = useState(false);

  // Step 3: Identification & Personal Info
  const [personalInfo, setPersonalInfo] = useState({
    firstName: '',
    lastName: '',
    idType: 'V',
    idNumber: '',
    email: '',
    phone: '',
  });

  // Step 4: Final Invoice and Payment state
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [buying, setBuying] = useState(false);
  const [hasLoadedSaved, setHasLoadedSaved] = useState(false);

  /**
   * Redirect to login if not authenticated.
   */
  useEffect(() => {
    if (!isAuthenticated) { 
      router.push(`/login?redirect=/events/${slug}/purchase`); 
      return; 
    }
    loadEvent();
  }, [slug, isAuthenticated]);

  /**
   * Pre-fill user information once available from the auth store.
   */
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

  /**
   * Fetches event data and its associated seat map.
   * Also attempts to recover a previously saved cart from localStorage.
   */
  const loadEvent = async () => {
    setLoading(true);
    try {
      const { data: evData } = await api.get(`/events/${slug}`);
      setEvent(evData);
      
      let finalMap = [];
      if (evData.id) {
        const { data: map } = await api.get(`/events/${evData.id}/seatmap`);
        setSeatMap(map);
        finalMap = map;
      }

      // Restore cart from localStorage if present
      const saved = localStorage.getItem(`selectedSeats_${evData.id}`);
      if (saved && !hasLoadedSaved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.length > 0) {
            // Only recover if the reservation hasn't expired (10 min)
            const valid = parsed.filter((s: any) => !s.addedAt || (Date.now() - s.addedAt < 10 * 60 * 1000));
            if (valid.length > 0) {
              const firstSeat = valid[0];
              const section = finalMap.find((s: any) => s.id === firstSeat.sectionId);
              if (section) {
                setSelectedSection(section);
                if (section.sectionType === 'standing') {
                  setStandingQuantity(valid.length);
                  setStep('info');
                } else {
                  setSelectedSeats(valid);
                  // Attempt to re-lock the seats on the server
                  try {
                    await api.post('/events/seats/lock', { seatIds: valid.map((s: any) => s.id) });
                    setSeatsLocked(true);
                    setStep('info');
                  } catch (err: any) {
                    console.error('Auto-lock failed:', err);
                    setStep('seats');
                  }
                }
              }
            } else {
              localStorage.removeItem(`selectedSeats_${evData.id}`);
              window.dispatchEvent(new Event('cart-updated'));
            }
          }
        } catch (e) {
          console.error("Error recovering cart:", e);
        }
        setHasLoadedSaved(true);
      }
    } catch { 
      router.push('/events'); 
    } finally { 
      setLoading(false); 
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const goToStep = (s: Step) => setStep(s);

  /**
   * Handles section selection and resets seat-specific state.
   */
  const handleSelectSection = (sec: VenueSection & { seats: Seat[] }) => {
    setSelectedSection(sec);
    setSelectedSeats([]);
    setStandingQuantity(1);
    setSeatsLocked(false);
    setStep('seats');
  };

  /**
   * Syncs the current selection (seats or standing quantity) to localStorage
   * so it persists and is visible in the Header cart popup.
   */
  useEffect(() => {
    if (!event?.id || !hasLoadedSaved) return;

    const cartData = selectedSection?.sectionType === 'standing'
      ? Array.from({ length: standingQuantity }).map((_, i) => ({
          id: `standing-${selectedSection.id}-${i + 1}`,
          sectionId: selectedSection.id,
          rowLabel: 'GA',
          seatNumber: i + 1,
          status: 'available',
          addedAt: Date.now(),
          eventTitle: event.title,
          eventSlug: event.slug,
          eventDate: event.eventDate,
          venueName: event.venueName,
          currency: event.currency
        }))
      : selectedSeats.map(s => ({
          ...s,
          sectionName: selectedSection?.name,
          sectionType: selectedSection?.sectionType,
          addedAt: (s as any).addedAt || Date.now(),
          eventTitle: event.title,
          eventSlug: event.slug,
          eventDate: event.eventDate,
          venueName: event.venueName,
          currency: event.currency
        }));

    localStorage.setItem(`selectedSeats_${event.id}`, JSON.stringify(cartData));
    window.dispatchEvent(new Event('cart-updated'));
  }, [selectedSeats, standingQuantity, selectedSection, event, hasLoadedSaved]);

  /**
   * Toggles a seat selection, enforcing a limit of 10 tickets.
   */
  const toggleSeats = useCallback((seats: Seat[]) => {
    setSelectedSeats((prev) => {
      let next = [...prev];
      for (const seat of seats) {
        const exists = next.find(s => s.id === seat.id);
        if (exists) {
          next = next.filter(s => s.id !== seat.id);
        } else {
          const limit = event?.maxTicketsPerTransaction || 10;
          if (next.length >= limit) {
            alert(lang === 'es' 
              ? `No puedes reservar más de ${limit} asientos por transacción.` 
              : `You cannot reserve more than ${limit} seats per transaction.`);
            break;
          }
          next.push(seat);
        }
      }
      return next;
    });
  }, [lang, event?.maxTicketsPerTransaction]);

  /**
   * Locks the selected seats on the server to prevent other users from buying them.
   */
  const handleConfirmSeats = async () => {
    if (selectedSeats.length === 0) return;
    try {
      await api.post('/events/seats/lock', { seatIds: selectedSeats.map((s) => s.id) });
      setSeatsLocked(true);
      setStep('info');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error reserving seats');
    }
  };

  /**
   * Handles the expiration of the 10-minute reservation timer.
   */
  const handleTimerExpire = async () => {
    try {
      await api.post('/events/seats/unlock');
    } catch {}
    setSeatsLocked(false);
    setSelectedSeats([]);
    toast.error(lang === 'es' ? '⏰ Tu reservación ha expirado. Los asientos fueron liberados.' : '⏰ Your reservation has expired. Seats have been released.');
    setStep('seats');
    
    // Refresh seat map to show updated availability
    if (event?.id) {
      const { data: map } = await api.get(`/events/${event.id}/seatmap`);
      setSeatMap(map);
    }
  };

  /**
   * Validates personal info and fetches a detailed invoice preview (fees, taxes, total).
   */
  const handleConfirmInfo = async () => {
    if (!personalInfo.firstName || !personalInfo.lastName || !personalInfo.email) return;
    
    setInvoiceLoading(true);
    try {
      const params: any = { eventId: event!.id };
      if (selectedSection?.sectionType === 'standing') {
        params.sectionId = selectedSection.id;
        params.quantity = standingQuantity;
      } else {
        params.seatIds = selectedSeats.map((s) => s.id).join(',');
      }

      const { data } = await api.get('/orders/preview-invoice', { params });
      setInvoice({ ...data, currency: event?.currency || 'USD' });
      setStep('payment');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error calculating invoice');
    } finally {
      setInvoiceLoading(false);
    }
  };

  /**
   * Initiates the Stripe checkout process by creating a session on the backend.
   */
  const handlePay = async () => {
    setBuying(true);
    try {
      const payload: any = { eventId: event!.id };
      if (selectedSection?.sectionType === 'standing') {
        payload.sectionId = selectedSection.id;
        payload.quantity = standingQuantity;
      } else {
        payload.seatIds = selectedSeats.map((s) => s.id);
      }

      const { data } = await api.post('/orders/checkout', payload);
      // Redirect the user to the Stripe-hosted checkout page
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error processing payment');
    } finally {
      setBuying(false);
    }
  };

  /**
   * Manually cancels the reservation and unlocks seats.
   */
  const handleCancel = async () => {
    const msg = lang === 'es' ? '¿Deseas cancelar la reservación? Los asientos serán liberados.' : 'Do you want to cancel the reservation? Seats will be released.';
    if (!confirm(msg)) return;
    try { await api.post('/events/seats/unlock'); } catch {}
    router.push(`/events/${slug}`);
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        <div className="h-6 skeleton rounded w-1/3" />
        <div className="h-48 skeleton rounded" />
      </div>
    );
  }
  if (!event) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Breadcrumb Wizard Navigation ── */}
      <nav className="wizard-breadcrumb sticky top-0 z-20 shadow-sm">
        <Link href="/" className="wizard-breadcrumb-item done text-xs">{lang === 'es' ? 'Inicio' : 'Home'}</Link>
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
              {lang === 'es' ? s.label : (s.key === 'section' ? 'Section' : s.key === 'seats' ? 'Seats' : s.key === 'info' ? 'Identification' : 'Pay')}
            </button>
          </span>
        ))}
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main Content Area ── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Event Header Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h1 className="font-bold text-lg text-gray-900 leading-tight">{event.title}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-blue-600">
              <span className="flex items-center gap-1.5">
                <HiOutlineLocationMarker className="w-4 h-4" />
                {event.venueName}
                {event.venueAddress && <span className="text-gray-500 font-normal">— {event.venueAddress}</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <HiOutlineCalendar className="w-4 h-4" />
                {formatDateInTimezone(event.eventDate, event.eventTimezone || 'UTC', 'es', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
            </div>
          </div>

          {/* Reservation Timer (Visible once seats are locked) */}
          {seatsLocked && (step === 'info' || step === 'payment') && (
            <ReservationTimer onExpire={handleTimerExpire} />
          )}

          {/* ── STEP 1: Section Selection ── */}
          {step === 'section' && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 step-panel">
              <h2 className="font-bold text-base text-blue-600 mb-4 border-b border-gray-100 pb-2">
                {lang === 'es' ? 'Escoge dónde quieres estar' : 'Choose where you want to be'}
              </h2>

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
                  {lang === 'es' ? 'ESCENARIO' : 'STAGE'}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Seat/Quantity Selection ── */}
          {step === 'seats' && selectedSection && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 step-panel">
              <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                <h2 className="font-bold text-base text-blue-600">
                  {selectedSection.sectionType === 'standing' ? (lang === 'es' ? 'Cantidad de entradas' : 'Number of tickets') : (lang === 'es' ? 'Selecciona tus asientos' : 'Select your seats')} — <span style={{ color: selectedSection.color }}>{selectedSection.name}</span>
                </h2>
                <button
                  onClick={() => setStep('section')}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  {lang === 'es' ? '← cambiar sección' : '← change section'}
                </button>
              </div>

              {selectedSection.sectionType === 'standing' ? (
                /* Standing Section Quantity Selector */
                <div className="py-8 px-4 flex flex-col items-center justify-center space-y-6 bg-gray-50 rounded-2xl border border-gray-200 shadow-inner">
                  <div className="text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                      {lang === 'es' ? 'Entradas para este sector' : 'Tickets for this sector'}
                    </p>
                    <p className="text-xl font-extrabold text-gray-900">
                      {selectedSection.name} — ${Number(selectedSection.price).toFixed(2)} {event.currency || 'USD'}
                    </p>
                  </div>

                  <div className="flex items-center gap-6 bg-white border border-gray-200 rounded-2xl p-2.5 shadow-md">
                    <button
                      type="button"
                      onClick={() => setStandingQuantity((q) => Math.max(0, q - 1))}
                      disabled={standingQuantity <= 0}
                      className="w-12 h-12 rounded-xl flex items-center justify-center border-2 border-gray-200 hover:border-blue-500 text-gray-600 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed font-extrabold text-xl transition-all active:scale-90"
                    >
                      －
                    </button>
                    <span className="text-2xl font-black text-gray-900 w-12 text-center select-none">
                      {standingQuantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStandingQuantity((q) => Math.min(event?.maxTicketsPerTransaction || 10, q + 1))}
                      disabled={standingQuantity >= (event?.maxTicketsPerTransaction || 10)}
                      className="w-12 h-12 rounded-xl flex items-center justify-center border-2 border-gray-200 hover:border-blue-500 text-gray-600 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed font-extrabold text-xl transition-all active:scale-90"
                    >
                      ＋
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 font-semibold bg-blue-50 border border-blue-100 text-blue-700 px-4 py-1.5 rounded-full shadow-sm">
                    {lang === 'es' 
                      ? `Puedes seleccionar un máximo de ${event?.maxTicketsPerTransaction || 10} entradas por transacción` 
                      : `You can select a maximum of ${event?.maxTicketsPerTransaction || 10} tickets per transaction`}
                  </p>
                </div>
              ) : (
                /* Numbered Seating Interactive Map */
                <>
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

                  {/* Visual chips for selected seats */}
                  {selectedSeats.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedSeats.map((seat) => {
                        const sec = seatMap.find(s => s.id === seat.sectionId);
                        return (
                          <span key={seat.id} className="seat-chip">
                            {formatSeatLabel(seat, sec, lang)}
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
                </>
              )}

              <button
                onClick={() => {
                  if (selectedSection.sectionType === 'standing') {
                    setStep('info');
                  } else {
                    handleConfirmSeats();
                  }
                }}
                disabled={(selectedSection.sectionType === 'standing' && standingQuantity === 0) || (selectedSection.sectionType !== 'standing' && selectedSeats.length === 0)}
                className="btn-primary w-full py-3 mt-4 disabled:opacity-40 disabled:cursor-not-allowed font-bold"
              >
                {selectedSection.sectionType === 'standing'
                  ? (standingQuantity === 0 ? (lang === 'es' ? 'Selecciona al menos 1 entrada' : 'Select at least 1 ticket') : 'Continuar →')
                  : selectedSeats.length === 0
                    ? (lang === 'es' ? 'Selecciona al menos 1 asiento' : 'Select at least 1 seat')
                    : (lang === 'es' ? `Reservar ${selectedSeats.length} asiento${selectedSeats.length > 1 ? 's' : ''} →` : `Reserve ${selectedSeats.length} seat${selectedSeats.length > 1 ? 's' : ''} →`)}
              </button>

              {selectedSection.sectionType !== 'standing' && (
                <p className="text-[10px] text-gray-400 text-center mt-2">
                  {lang === 'es' 
                    ? '*Una vez reservado, tendrás 10 minutos para completar el pago. De lo contrario los asientos serán liberados.'
                    : '*Once reserved, you will have 10 minutes to complete the payment. Otherwise, seats will be released.'}
                </p>
              )}
            </div>
          )}

          {/* ── STEP 3: Identification & Personal Info ── */}
          {step === 'info' && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 step-panel">
              <h2 className="font-bold text-base text-blue-600 mb-1 border-b border-gray-100 pb-2">
                {lang === 'es' ? 'Información personal' : 'Personal Information'}
              </h2>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div><span className="text-gray-500">{lang === 'es' ? 'Nombre y apellido:' : 'Full Name:'}</span> <strong>{personalInfo.firstName} {personalInfo.lastName}</strong></div>
                <div><span className="text-gray-500">Email:</span> <strong>{personalInfo.email}</strong></div>
                <div><span className="text-gray-500">{lang === 'es' ? 'Teléfono:' : 'Phone:'}</span> <strong>{personalInfo.phone || (lang === 'es' ? 'No registrado' : 'Not registered')}</strong></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{lang === 'es' ? 'Nombre:' : 'First Name:'}</label>
                  <input className="input text-sm" value={personalInfo.firstName}
                    onChange={(e) => setPersonalInfo((p) => ({ ...p, firstName: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{lang === 'es' ? 'Apellido:' : 'Last Name:'}</label>
                  <input className="input text-sm" value={personalInfo.lastName}
                    onChange={(e) => setPersonalInfo((p) => ({ ...p, lastName: e.target.value }))} required />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">{lang === 'es' ? 'Correo electrónico:' : 'Email Address:'}</label>
                  <input className="input text-sm" type="email" value={personalInfo.email}
                    onChange={(e) => setPersonalInfo((p) => ({ ...p, email: e.target.value }))} required />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">{lang === 'es' ? 'Teléfono:' : 'Phone:'}</label>
                  <input className="input text-sm" value={personalInfo.phone}
                    onChange={(e) => setPersonalInfo((p) => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>

              <button
                onClick={handleConfirmInfo}
                disabled={invoiceLoading || !personalInfo.firstName || !personalInfo.lastName || !personalInfo.email}
                className="btn-primary w-full py-3 mt-5 disabled:opacity-40"
              >
                {invoiceLoading ? (lang === 'es' ? 'Calculando...' : 'Calculating...') : (lang === 'es' ? 'Continuar →' : 'Continue →')}
              </button>

              <button onClick={handleCancel} className="w-full mt-2 py-2 text-xs text-red-500 hover:text-red-700 font-medium">
                {lang === 'es' ? 'Eliminar reservación' : 'Delete reservation'}
              </button>
            </div>
          )}

          {/* ── STEP 4: Payment Summary ── */}
          {step === 'payment' && invoice && (
            <div className="bg-white rounded-lg border border-gray-200 p-5 step-panel">
              <h2 className="font-bold text-base text-blue-600 mb-4 border-b border-gray-100 pb-2">
                {lang === 'es' ? 'Forma de pago' : 'Payment Method'}
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
                      {lang === 'es' ? 'Procesando...' : 'Processing...'}
                    </span>
                  ) : (
                    <>{lang === 'es' ? '💳 Pagar' : '💳 Pay'} ${Number(invoice.total).toFixed(2)} {invoice.currency || 'USD'} {lang === 'es' ? 'con Stripe' : 'with Stripe'}</>
                  )}
                </button>
                <p className="text-center text-[10px] text-gray-400">
                  {lang === 'es' ? 'Pagos seguros encriptados — procesado por Stripe' : 'Secure encrypted payments — processed by Stripe'}
                </p>
                <TrustBadges compact />
                <button onClick={handleCancel} className="w-full py-2 text-xs text-red-500 hover:text-red-700 font-medium">
                  🗑 {lang === 'es' ? 'Eliminar reservación' : 'Delete reservation'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar: Order Summary & Event Info ── */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            {/* Real-time Order Summary */}
            {((selectedSection?.sectionType === 'standing' && standingQuantity > 0) || selectedSeats.length > 0) && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-bold text-sm text-gray-800 mb-2">
                  {selectedSection?.sectionType === 'standing'
                    ? (lang === 'es' ? `${standingQuantity} entrada${standingQuantity > 1 ? 's' : ''} seleccionada${standingQuantity > 1 ? 's' : ''}` : `${standingQuantity} ticket${standingQuantity > 1 ? 's' : ''} selected`)
                    : (lang === 'es' ? `${selectedSeats.length} asiento${selectedSeats.length > 1 ? 's' : ''} seleccionado${selectedSeats.length > 1 ? 's' : ''}` : `${selectedSeats.length} seat${selectedSeats.length > 1 ? 's' : ''} selected`)
                  }
                </h3>
                <div className="space-y-1">
                  {selectedSection?.sectionType === 'standing' ? (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">{selectedSection.name}</span>
                      <span className="font-medium text-gray-800">${(Number(selectedSection.price) * standingQuantity).toFixed(2)}</span>
                    </div>
                  ) : (
                    selectedSeats.map((seat) => {
                      const sec = seatMap.find((s) => s.id === seat.sectionId);
                      return (
                        <div key={seat.id} className="flex justify-between text-xs">
                          <span className="text-gray-600">{formatSeatLabel(seat, sec, lang)}</span>
                          <span className="font-medium text-gray-800">${getSeatPrice(seat, sec).toFixed(2)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
                
                {/* Detailed invoice breakdown (available once Step 3 is completed) */}
                {invoice && (
                  <>
                    <div className="border-t border-gray-100 mt-2 pt-2 space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Subtotal</span>
                        <span>${Number(invoice.baseTotal).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{lang === 'es' ? 'Cargo por servicio' : 'Service Fee'}</span>
                        <span>${Number(invoice.lpFee).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{lang === 'es' ? 'Tarifa de procesamiento' : 'Processing Fee'}</span>
                        <span>${Number(invoice.processingFee).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm mt-1 pt-1 border-t border-dashed border-gray-100">
                        <span>Total</span>
                        <span className="text-primary-600">${Number(invoice.total).toFixed(2)} {event.currency || 'USD'}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Event Media */}
            {event.imageUrl && (
              <div className="rounded-lg overflow-hidden border border-gray-200">
                <img
                  src={getImageUrl(event.imageUrl)}
                  alt={event.title}
                  className="w-full object-cover aspect-[3/4]"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
