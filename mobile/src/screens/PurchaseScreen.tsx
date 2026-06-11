import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileEvent } from '../types/event';
import { AuthUser } from '../services/api';
import { getEventSeatMap } from '../services/events';
import { createCheckout } from '../services/orders';
import { ClientSeat, ClientVenueMap } from '../components/events/ClientVenueMap';

type Props = {
  event: MobileEvent;
  user?: AuthUser | null;
  onBack: () => void;
  onPaid: () => void;
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

export function PurchaseScreen({ event, user, onBack, onPaid }: Props) {
  const { t } = useLanguage();
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  // Seated/table mode
  const [selectedSeats, setSelectedSeats] = useState<ClientSeat[]>([]);
  // General-admission mode
  const [gaSectionId, setGaSectionId] = useState('');
  const [gaQty, setGaQty] = useState(1);

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
    let mounted = true;
    getEventSeatMap(event.id)
      .then((items) => {
        if (!mounted) return;
        setSections(items);
        const firstGa = items.find((s: any) => s.sectionType === 'standing');
        if (firstGa) setGaSectionId(firstGa.id);
      })
      .catch(() => mounted && setSections([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [event.id]);

  const toggleSeat = (seat: ClientSeat) => {
    setSelectedSeats((current) => {
      const exists = current.some((s) => s.id === seat.id);
      if (exists) return current.filter((s) => s.id !== seat.id);
      if (current.length >= MAX_PER_TX) return current;
      return [...current, seat];
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
  const service = subtotal > 0 ? subtotal * 0.08 + 1.5 : 0;
  const total = subtotal + service;

  const canPay = mode === 'seats' ? selectedSeats.length > 0 : mode === 'ga' ? !!gaSelected : false;

  const pay = async () => {
    setError('');
    setPaying(true);
    try {
      const payload =
        mode === 'seats'
          ? { eventId: event.id, seatIds: selectedSeats.map((s) => s.id) }
          : { eventId: event.id, sectionId: gaSelected!.id, quantity: gaQty };
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ {t('Evento', 'Event')}</Text>
      </TouchableOpacity>

      <Text style={styles.eyebrow}>{t('CHECKOUT', 'CHECKOUT')}</Text>
      <Text style={styles.title}>{mode === 'seats' ? t('Elige tus asientos', 'Pick your seats') : t('Selecciona tus tickets', 'Select your tickets')}</Text>
      <Text style={styles.subtitle}>{event.title}</Text>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.orange} /></View>
      ) : mode === 'none' ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{t('Este evento aún no tiene entradas disponibles.', 'This event has no tickets available yet.')}</Text>
        </View>
      ) : mode === 'seats' ? (
        <>
          <ClientVenueMap seatMap={sections} selectedSeats={selectedSeats} onToggleSeat={toggleSeat} />

          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{t('Asientos seleccionados', 'Selected seats')} ({selectedSeats.length})</Text>
            {selectedSeats.length === 0 ? (
              <Text style={styles.rowLabel}>{t('Toca un asiento disponible en el mapa.', 'Tap an available seat on the map.')}</Text>
            ) : (
              selectedSeats.map((seat) => {
                const sec = sectionById[seat.sectionId || ''];
                const label = sec?.sectionType === 'table'
                  ? `${t('Mesa', 'Table')} ${sec?.name} · ${t('Silla', 'Seat')} ${seat.seatNumber}`
                  : `${sec?.name || ''} ${seat.rowLabel || ''}${seat.seatNumber}`;
                return (
                  <View key={seat.id} style={styles.row}>
                    <Text style={styles.rowLabel}>{label}</Text>
                    <Text style={styles.rowValue}>${seatPrice(seat, sec).toFixed(2)}</Text>
                  </View>
                );
              })
            )}
          </View>
        </>
      ) : (
        <>
          {gaSections.map((s) => {
            const active = s.id === gaSelected?.id;
            return (
              <TouchableOpacity key={s.id} onPress={() => { setGaSectionId(s.id); setGaQty(1); }} style={[styles.ticketType, active && styles.ticketTypeActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeLabel}>{t('ACCESO GENERAL', 'GENERAL ACCESS')}</Text>
                  <Text style={styles.typeName}>{s.name}</Text>
                  <Text style={styles.typeMeta}>{s.available} {t('disponibles', 'available')}</Text>
                </View>
                <Text style={styles.typePrice}>${s.price.toFixed(2)}</Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.qtyCard}>
            <Text style={styles.qtyLabel}>{t('Cantidad', 'Quantity')}</Text>
            <View style={styles.qtyControls}>
              <TouchableOpacity style={styles.qtyButton} onPress={() => setGaQty(Math.max(1, gaQty - 1))}><Text style={styles.qtyButtonText}>−</Text></TouchableOpacity>
              <Text style={styles.qtyValue}>{gaQty}</Text>
              <TouchableOpacity style={styles.qtyButton} onPress={() => setGaQty(Math.min(gaMax, gaQty + 1))}><Text style={styles.qtyButtonText}>＋</Text></TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {!loading && mode !== 'none' && (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{t('Resumen de orden', 'Order summary')}</Text>
            <View style={styles.row}><Text style={styles.rowLabel}>{t('Subtotal', 'Subtotal')}</Text><Text style={styles.rowValue}>${subtotal.toFixed(2)}</Text></View>
            <View style={styles.row}><Text style={styles.rowLabel}>{t('Cargo de servicio', 'Service fee')}</Text><Text style={styles.rowValue}>${service.toFixed(2)}</Text></View>
            <View style={styles.divider} />
            <View style={styles.row}><Text style={styles.totalLabel}>{t('Total', 'Total')}</Text><Text style={styles.totalValue}>${total.toFixed(2)}</Text></View>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={[styles.continueButton, (!canPay || paying) && { opacity: 0.5 }]} onPress={pay} disabled={!canPay || paying}>
            <Text style={styles.continueText}>{paying ? t('ABRIENDO PAGO...', 'OPENING PAYMENT...') : t('PAGAR CON TARJETA', 'PAY WITH CARD')}</Text>
          </TouchableOpacity>
          <Text style={styles.secureNote}>{t('Pago seguro procesado por Stripe.', 'Secure payment processed by Stripe.')}</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screen },
  content: { padding: 18, paddingTop: 18, paddingBottom: 140 },
  center: { paddingVertical: 60, alignItems: 'center' },
  notice: { marginTop: 18, backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', borderRadius: 16, padding: 16 },
  noticeText: { color: '#FDBA74', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  backButton: { alignSelf: 'flex-start', backgroundColor: colors.cardSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.cardBorder },
  backText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 4, fontWeight: '800', marginTop: 22 },
  title: { color: colors.textPrimary, fontSize: 30, lineHeight: 34, fontWeight: '900', marginTop: 12 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 22, fontWeight: '400', marginTop: 8, marginBottom: 18 },
  ticketType: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.goldBorder, padding: 18, flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 12, alignItems: 'center' },
  ticketTypeActive: { borderColor: colors.orange, borderWidth: 2 },
  typeLabel: { color: colors.orange, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  typeName: { color: colors.textPrimary, fontSize: 19, fontWeight: '800', marginTop: 8 },
  typeMeta: { color: colors.textMuted, fontSize: 13, fontWeight: '400', marginTop: 6 },
  typePrice: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  qtyCard: { marginTop: 4, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.goldBorder, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyLabel: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.cardSoft, alignItems: 'center', justifyContent: 'center' },
  qtyButtonText: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  qtyValue: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  summary: { marginTop: 16, backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.goldBorder, padding: 18 },
  summaryTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  rowLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '500', flex: 1 },
  rowValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },
  totalLabel: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
  totalValue: { color: colors.orange, fontSize: 22, fontWeight: '800' },
  error: { color: '#FCA5A5', fontSize: 13, marginTop: 14, fontWeight: '600' },
  continueButton: { marginTop: 18, height: 56, borderRadius: 10, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  continueText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 2.6 },
  secureNote: { color: colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 10, fontWeight: '500' },
});
