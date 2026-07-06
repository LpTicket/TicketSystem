/**
 * PurchaseScreen (mobile)
 * EN: Checkout flow — shows the order summary/invoice for the selected seats and
 *     starts payment, then routes to the success screen with the issued tickets.
 * ES: Flujo de checkout — muestra el resumen/factura de la orden para los
 *     asientos elegidos e inicia el pago, luego dirige a la pantalla de éxito con
 *     los tickets emitidos.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileEvent } from '../types/event';
import { AuthUser } from '../services/api';
import { getEventSeatMap } from '../services/events';
import { createCheckout } from '../services/orders';
import { ClientSeat, ClientVenueMap } from '../components/events/ClientVenueMap';

export type CartItem = {
  label: string;
  price: number;
  seatId: string;
  sectionId?: string;
  sectionType?: string;
};

type Props = {
  event: MobileEvent;
  user?: AuthUser | null;
  onBack: () => void;
  onPaid: () => void;
  onSelectionCountChange?: (count: number) => void;
  onCartChange?: (items: CartItem[], subtotal: number, total: number) => void;
  initialSeats?: ClientSeat[];
  initialGa?: { id: string; name: string; price: number };
  initialGaQty?: number;
};

const MAX_PER_TX = 10;

function seatPrice(seat: ClientSeat, section: any): number {
  try {
    const overrides = section?.seatsConfig ? JSON.parse(section.seatsConfig) : {};
    const key = section?.sectionType === 'table' ? `seat-${seat.seatNumber}` : `${seat.rowLabel}-${seat.seatNumber}`;
    const override = overrides[key];
    if (override && typeof override.price === 'number') return override.price;
  } catch {
    /* ignore bad config */
  }
  return Number(section?.price || 0);
}

export function PurchaseScreen({ event, user, onBack, onPaid, onSelectionCountChange, onCartChange, initialSeats, initialGa, initialGaQty }: Props) {
  const { t } = useLanguage();
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  // Seated/table mode — pre-populated from EventDetailScreen
  const [selectedSeats, setSelectedSeats] = useState<ClientSeat[]>(initialSeats || []);
  // General-admission mode
  const [gaSectionId, setGaSectionId] = useState(initialGa?.id || '');
  const [gaQty, setGaQty] = useState(initialGaQty || 1);

  const seatedSections = useMemo(
    () => sections.filter((s) => (s.seats || []).length > 0 && s.sectionType !== 'standing'),
    [sections],
  );
  const gaSections = useMemo(
    () =>
      sections
        .filter((s) => s.sectionType === 'standing')
        .map((s) => {
          const seats = s.seats || [];
          const sold = seats.filter((x: any) => x.status === 'sold' || (x.status === 'locked' && !x.lockExpiresAt)).length;
          const capacity = Number(s.capacity) || seats.length;
          return { id: s.id, name: s.name || 'General', price: Number(s.price || 0), available: Math.max(0, capacity - sold) };
        })
        .filter((s) => s.available > 0),
    [sections],
  );

  const mode: 'seats' | 'ga' | 'none' = seatedSections.length > 0 ? 'seats' : gaSections.length > 0 ? 'ga' : 'none';

  useEffect(() => {
    // If pre-selected seats were passed from EventDetailScreen, skip seatmap load and auto-pay
    if (initialSeats?.length) {
      setLoading(false);
      pay(initialSeats);
      return;
    }
    if (initialGa) {
      setLoading(false);
      pay([], initialGa, initialGaQty ?? 1);
      return;
    }
    let mounted = true;
    getEventSeatMap(event.id)
      .then((items) => {
        if (!mounted) return;
        setSections(items);
        const firstGa = items.find((s: any) => s.sectionType === 'standing');
        if (firstGa && !gaSectionId) setGaSectionId(firstGa.id);
      })
      .catch(() => mounted && setSections([]))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSeat = (seat: ClientSeat) => {
    setSelectedSeats((current) => {
      const exists = current.some((s) => s.id === seat.id);
      if (exists) return current.filter((s) => s.id !== seat.id);
      if (current.length >= MAX_PER_TX) return current;
      return [...current, seat];
    });
  };

  // Batch toggle for whole-table purchase mode
  const toggleSeats = (seats: ClientSeat[]) => {
    setSelectedSeats((current) => {
      const anySelected = seats.some((s) => current.some((c) => c.id === s.id));
      if (anySelected) {
        // deselect all of these seats
        const removeIds = new Set(seats.map((s) => s.id));
        return current.filter((c) => !removeIds.has(c.id));
      }
      // select all, respecting MAX_PER_TX
      const toAdd = seats.filter((s) => !current.some((c) => c.id === s.id));
      const remaining = MAX_PER_TX - current.length;
      return [...current, ...toAdd.slice(0, remaining)];
    });
  };

  const sectionById = useMemo(() => {
    const map: Record<string, any> = {};
    sections.forEach((s) => (map[s.id] = s));
    return map;
  }, [sections]);

  const gaSelected = gaSections.find((s) => s.id === gaSectionId) || gaSections[0];
  const gaMax = Math.min(gaSelected?.available ?? 1, MAX_PER_TX);

  const subtotal =
    mode === 'seats'
      ? selectedSeats.reduce((sum, seat) => sum + seatPrice(seat, sectionById[seat.sectionId || '']), 0)
      : (gaSelected?.price ?? 0) * gaQty;
  const serviceFee = subtotal > 0 ? Math.round(subtotal * 0.08 * 100) / 100 : 0;
  const processingFee = subtotal > 0 ? Math.round((subtotal + serviceFee) * 0.035 * 100) / 100 : 0;
  const service = serviceFee; // kept for legacy compat
  const total = subtotal + serviceFee + processingFee;

  const canPay = mode === 'seats' ? selectedSeats.length > 0 : mode === 'ga' ? !!gaSelected : false;

  useEffect(() => {
    const count = mode === 'seats' ? selectedSeats.length : mode === 'ga' && gaSelected ? gaQty : 0;
    onSelectionCountChange?.(count);
    return () => onSelectionCountChange?.(0);
  }, [gaQty, gaSelected, mode, onSelectionCountChange, selectedSeats.length]);

  useEffect(() => {
    if (!onCartChange) return;
    if (mode === 'seats') {
      const items: CartItem[] = selectedSeats.map((seat) => {
        const sec = sectionById[seat.sectionId || ''];
        const label = sec?.sectionType === 'table'
          ? `Mesa ${sec?.name} · Silla ${seat.seatNumber}`
          : `${sec?.name || ''} ${seat.rowLabel ? ` ${seat.rowLabel}` : ''}${seat.seatNumber ? `-${seat.seatNumber}` : ''}`.trim();
        return { label, price: seatPrice(seat, sec), seatId: seat.id };
      });
      onCartChange(items, subtotal, total);
    } else if (mode === 'ga' && gaSelected) {
      const items: CartItem[] = [{ label: gaSelected.name, price: gaSelected.price * gaQty, seatId: `ga-${gaSelected.id}` }];
      onCartChange(items, subtotal, total);
    } else {
      onCartChange([], 0, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaQty, gaSelected, mode, selectedSeats, sectionById, subtotal, total]);

  const pay = async (overrideSeats?: ClientSeat[], overrideGa?: { id: string; price: number }, overrideGaQty?: number) => {
    setError('');
    setPaying(true);
    try {
      const seats = overrideSeats ?? selectedSeats;
      const ga = overrideGa ?? (gaSelected ? { id: gaSelected.id, price: gaSelected.price } : undefined);
      const qty = overrideGaQty ?? gaQty;
      const payload = seats.length > 0
        ? { eventId: event.id, seatIds: seats.map((s) => s.id) }
        : ga
        ? { eventId: event.id, sectionId: ga.id, quantity: qty }
        : null;
      if (!payload) { setError(t('Selecciona asientos primero.', 'Select seats first.')); return; }
      const { url } = await createCheckout({
        ...payload,
        buyerEmail: user?.email,
        buyerName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || undefined,
      });
      await WebBrowser.openBrowserAsync(url);
      onPaid();
    } catch (err: any) {
      setError(err?.message || t('No pudimos iniciar el pago.', 'We could not start the payment.'));
    } finally {
      setPaying(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.textMuted} />
          <Text style={styles.backText}>{t('Evento', 'Event')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => Share.share({ title: event.title, message: `${event.title}\nhttps://www.lpticket.com/events/${event.slug || event.id}` })}
        >
          <Ionicons name="share-social-outline" size={18} color={colors.orange} />
        </TouchableOpacity>
      </View>

      {/* Event identity */}
      <View style={styles.eventHero}>
        <Text style={styles.eyebrow}>{t('CHECKOUT · COMPRA SEGURA', 'CHECKOUT · SECURE PURCHASE')}</Text>
        <Text style={styles.title}>{event.title}</Text>
        {!!event.date && <Text style={styles.subtitle}>{event.date}{event.venue ? ` · ${event.venue}` : ''}</Text>}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.orange} size="large" />
          <Text style={styles.loadingText}>{t('Cargando disponibilidad...', 'Loading availability...')}</Text>
        </View>
      ) : mode === 'none' ? (
        <View style={styles.notice}>
          <Ionicons name="ticket-outline" size={28} color="#FDBA74" style={{ marginBottom: 10 }} />
          <Text style={styles.noticeText}>{t('Este evento aún no tiene entradas disponibles.', 'This event has no tickets available yet.')}</Text>
        </View>
      ) : mode === 'seats' ? (
        <>
          {!initialSeats?.length && (
            <ClientVenueMap
              seatMap={sections}
              selectedSeats={selectedSeats}
              onToggleSeat={toggleSeat}
              onToggleSeats={toggleSeats}
              defaultViewX={(event as any).defaultViewX}
              defaultViewY={(event as any).defaultViewY}
              defaultViewZoom={(event as any).defaultViewZoom}
            />
          )}

          {/* Selected seats list */}
          <View style={styles.summary}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>{t('Asientos seleccionados', 'Selected seats')}</Text>
              {selectedSeats.length > 0 && (
                <View style={styles.countBadge}><Text style={styles.countBadgeText}>{selectedSeats.length}</Text></View>
              )}
            </View>
            {selectedSeats.length === 0 ? (
              <View style={styles.emptySeats}>
                <Ionicons name="hand-left-outline" size={20} color="rgba(249,115,22,0.55)" />
                <Text style={styles.emptySeatsText}>{t('Toca un asiento en el mapa para seleccionarlo.', 'Tap a seat on the map to select it.')}</Text>
              </View>
            ) : (
              selectedSeats.map((seat, index) => {
                const sec = sectionById[seat.sectionId || ''];
                const label = sec?.sectionType === 'table'
                  ? `${t('Mesa', 'Table')} ${sec?.name} · ${t('Silla', 'Chair')} ${seat.seatNumber}`
                  : `${sec?.name || ''} ${seat.rowLabel ? ` ${seat.rowLabel}` : ''}${seat.seatNumber ? `-${seat.seatNumber}` : ''}`.trim();
                return (
                  <View key={`${seat.id || 'seat'}-${index}`} style={styles.row}>
                    <View style={styles.rowLeft}>
                      <View style={styles.seatDot} />
                      <Text style={styles.rowLabel}>{label}</Text>
                    </View>
                    <Text style={styles.rowValue}>${seatPrice(seat, sec).toFixed(2)}</Text>
                  </View>
                );
              })
            )}
          </View>
        </>
      ) : (
        <>
          {gaSections.map((s, index) => {
            const isActive = s.id === gaSelected?.id;
            return (
              <TouchableOpacity key={`${s.id || s.name || 'section'}-${index}`} onPress={() => { setGaSectionId(s.id); setGaQty(1); }} style={[styles.ticketType, isActive && styles.ticketTypeActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeLabel}>{t('ACCESO GENERAL', 'GENERAL ACCESS')}</Text>
                  <Text style={styles.typeName}>{s.name}</Text>
                  <Text style={styles.typeMeta}>{s.available} {t('disponibles', 'available')}</Text>
                </View>
                <View style={styles.typePriceCol}>
                  <Text style={styles.typePrice}>${s.price.toFixed(2)}</Text>
                  <Text style={styles.typePriceSub}>{t('por persona', 'per person')}</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          <View style={styles.qtyCard}>
            <Text style={styles.qtyLabel}>{t('Cantidad', 'Quantity')}</Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity style={styles.qtyButton} onPress={() => setGaQty(Math.max(1, gaQty - 1))}>
                <Text style={styles.qtyButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{gaQty}</Text>
              <TouchableOpacity style={styles.qtyButton} onPress={() => setGaQty(Math.min(gaMax, gaQty + 1))}>
                <Text style={styles.qtyButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {!loading && mode !== 'none' && (
        <>
          {/* Order summary card */}
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{t('Resumen de orden', 'Order summary')}</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('Subtotal', 'Subtotal')}</Text>
              <Text style={styles.rowValue}>${subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('Cargo por servicio', 'Service fee')}</Text>
              <Text style={styles.rowValue}>${serviceFee.toFixed(2)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('Cargo de procesamiento', 'Processing fee')}</Text>
              <Text style={styles.rowValue}>${processingFee.toFixed(2)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('Total', 'Total')}</Text>
              <Text style={styles.totalValue}>${total.toFixed(2)} USD</Text>
            </View>
          </View>

          {!!error && (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
              <Text style={styles.error}>{error}</Text>
            </View>
          )}

          {/* Pay button */}
          <TouchableOpacity style={[styles.payButton, (!canPay || paying) && styles.payButtonDisabled]} onPress={() => pay()} disabled={!canPay || paying} activeOpacity={0.88}>
            <View pointerEvents="none" style={styles.payButtonShine} />
            {paying ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="card-outline" size={19} color="#FFFFFF" />
            )}
            <Text style={styles.payText}>
              {paying ? t('PROCESANDO...', 'PROCESSING...') : canPay ? `${t('PAGAR', 'PAY')} $${total.toFixed(2)}` : t('SELECCIONA TUS ASIENTOS', 'SELECT YOUR SEATS')}
            </Text>
          </TouchableOpacity>

          {/* Trust row */}
          <View style={styles.trustRow}>
            <Ionicons name="lock-closed-outline" size={13} color="rgba(134,239,172,0.7)" />
            <Text style={styles.secureNote}>{t('Pago 100% seguro · Procesado por Stripe', '100% secure payment · Powered by Stripe')}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen },
  content: { padding: 18, paddingTop: 10, paddingBottom: 140 },
  // Header
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.cardSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.cardBorder },
  backText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  shareBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', alignItems: 'center', justifyContent: 'center' },
  // Event hero
  eventHero: { marginBottom: 18 },
  eyebrow: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '600', marginTop: 18, marginBottom: 6 },
  title: { color: colors.textPrimary, fontSize: 26, lineHeight: 30, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18, fontWeight: '500', marginTop: 6 },
  // Loading/empty
  center: { paddingVertical: 60, alignItems: 'center', gap: 14 },
  loadingText: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  notice: { marginTop: 18, backgroundColor: 'rgba(249,115,22,0.08)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', borderRadius: 20, padding: 24, alignItems: 'center' },
  noticeText: { color: '#FDBA74', fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  // GA ticket type cards
  ticketType: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.goldBorder, padding: 18, flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 12, alignItems: 'center' },
  ticketTypeActive: { borderColor: colors.orange, borderWidth: 2, backgroundColor: 'rgba(249,115,22,0.06)' },
  typeLabel: { color: colors.orange, fontSize: 10, fontWeight: '600', letterSpacing: 0.5 },
  typeName: { color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 6 },
  typeMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '500', marginTop: 4 },
  typePriceCol: { alignItems: 'flex-end' },
  typePrice: { color: colors.textPrimary, fontSize: 22, fontWeight: '600' },
  typePriceSub: { color: colors.textMuted, fontSize: 11, fontWeight: '500', marginTop: 2 },
  // Qty card
  qtyCard: { marginTop: 4, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.goldBorder, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  qtyButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', alignItems: 'center', justifyContent: 'center' },
  qtyButtonText: { color: colors.orange, fontSize: 22, fontWeight: '600', lineHeight: 26 },
  qtyValue: { color: colors.textPrimary, fontSize: 24, fontWeight: '600', minWidth: 30, textAlign: 'center' },
  // Summary card
  summary: { marginTop: 16, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 18 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  summaryTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  countBadge: { minWidth: 26, height: 26, borderRadius: 13, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  countBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  emptySeats: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  emptySeatsText: { color: colors.textMuted, fontSize: 13, fontWeight: '500', flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  seatDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  rowLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '500', flex: 1 },
  rowValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: colors.textPrimary, fontSize: 17, fontWeight: '600' },
  totalValue: { color: colors.orange, fontSize: 26, fontWeight: '600' },
  // Error
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: 'rgba(252,165,165,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(252,165,165,0.2)' },
  error: { color: '#FCA5A5', fontSize: 13, fontWeight: '600', flex: 1 },
  // Pay button
  payButton: { marginTop: 22, height: 60, borderRadius: 16, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, overflow: 'hidden', shadowColor: colors.orange, shadowOpacity: 0.38, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  payButtonDisabled: { opacity: 0.45 },
  payButtonShine: { position: 'absolute', top: 4, left: 20, right: 20, height: 1.5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.28)' },
  payText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  // Trust
  trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12 },
  secureNote: { color: 'rgba(134,239,172,0.6)', fontSize: 11, fontWeight: '600' },
});
