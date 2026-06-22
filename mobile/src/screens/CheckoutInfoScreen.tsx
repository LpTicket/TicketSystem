import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { AuthUser } from '../services/api';
import { createCheckout, unlockSeats } from '../services/orders';
import { ClientSeat } from '../components/events/ClientVenueMap';
import { ReservationTimer } from '../components/events/ReservationTimer';

type Props = {
  event: any;
  user?: AuthUser | null;
  onBack: () => void | Promise<void>;
  onPaid: () => void;
  seats?: ClientSeat[];
  gaSection?: { id: string; name: string; price: number };
  gaQty?: number;
  // legacy — kept so old callers don't break
  onContinue?: () => void;
};

export function CheckoutInfoScreen({ event, user, onBack, onPaid, seats = [], gaSection, gaQty = 1 }: Props) {
  const { t } = useLanguage();
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName]   = useState(user?.lastName  || '');
  const [email, setEmail]         = useState(user?.email     || '');
  const [phone, setPhone]         = useState(user?.phone     || '');
  const [code, setCode]           = useState('');
  const [paying, setPaying]       = useState(false);
  const [error, setError]         = useState('');
  const [reservationAddedAt, setReservationAddedAt] = useState<number | null>(null);

  // Read addedAt from the stored cart to drive the real countdown
  useEffect(() => {
    if (!event?.id) return;
    AsyncStorage.getItem(`selectedSeats_${event.id}`).then((raw) => {
      if (!raw) return;
      try {
        const parsed: any[] = JSON.parse(raw);
        const ts = parsed.find((s) => s.addedAt)?.addedAt;
        if (ts) setReservationAddedAt(ts);
      } catch {}
    });
  }, [event?.id]);

  const formatEventDate = (val?: string) => {
    if (!val) return '';
    try {
      return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(val));
    } catch { return val; }
  };

  const seatCount  = seats.length;
  const gaTotal    = gaSection ? gaSection.price * gaQty : 0;
  const ticketLine = seatCount > 0
    ? `${seatCount} ${t('asiento(s) seleccionado(s)', 'seat(s) selected')}`
    : gaSection
    ? `${gaQty} × ${gaSection.name}`
    : '';

  const canContinue = !!email.trim();

  const cancelReservation = async () => {
    try { await unlockSeats(); } catch {}
    try {
      await AsyncStorage.removeItem(`selectedSeats_${event.id}`);
      await AsyncStorage.removeItem('lp_active_cart_event');
    } catch {}
    await onBack();
  };

  const pay = async () => {
    if (!canContinue) return;
    setError('');
    setPaying(true);
    try {
      const payload = seatCount > 0
        ? { eventId: event.id, seatIds: seats.map((s) => s.id) }
        : gaSection
        ? { eventId: event.id, sectionId: gaSection.id, quantity: gaQty }
        : null;
      if (!payload) { setError(t('Sin asientos seleccionados.', 'No seats selected.')); setPaying(false); return; }
      const buyerName = `${firstName} ${lastName}`.trim() || undefined;
      const { url } = await createCheckout({
        ...payload,
        buyerEmail: email.trim() || undefined,
        buyerName,
        ...(phone.trim() ? { buyerPhone: phone.trim() } : {}),
        ...(code.trim()  ? { promoCode: code.trim()   } : {}),
      });
      await WebBrowser.openBrowserAsync(url);
      // Clear persisted cart after redirect to Stripe
      try { await AsyncStorage.removeItem(`selectedSeats_${event.id}`); await AsyncStorage.removeItem('lp_active_cart_event'); } catch {}
      onPaid();
    } catch (err: any) {
      setError(err?.message || t('No pudimos iniciar el pago.', 'We could not start the payment.'));
    } finally {
      setPaying(false);
    }
  };

  return (
    <View style={st.root}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={cancelReservation} style={st.backBtn}>
          <Ionicons name="arrow-back" size={18} color="rgba(226,232,240,0.8)" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.eyebrow}>{t('CHECKOUT · COMPRA SEGURA', 'CHECKOUT · SECURE PURCHASE')}</Text>
          <Text style={st.headerTitle}>{t('Información personal', 'Personal Information')}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">

        {/* Reservation countdown timer */}
        {reservationAddedAt != null && (
          <ReservationTimer
            addedAt={reservationAddedAt}
            onExpire={cancelReservation}
          />
        )}

        {/* Event card */}
        <View style={st.eventCard}>
          <Text style={st.eventTitle}>{event?.title}</Text>
          {!!(event?.venue || event?.venueName) && (
            <View style={st.eventRow}>
              <Ionicons name="location-outline" size={13} color={colors.orange} />
              <Text style={st.eventMeta}>{event.venue || event.venueName}{event.address || event.venueAddress ? ` — ${event.address || event.venueAddress}` : ''}</Text>
            </View>
          )}
          {!!(event?.date || event?.eventDate) && (
            <View style={st.eventRow}>
              <Ionicons name="calendar-outline" size={13} color={colors.orange} />
              <Text style={st.eventMeta}>{event.date || formatEventDate(event.eventDate)}</Text>
            </View>
          )}
        </View>

        {/* Ticket summary */}
        {!!ticketLine && (
          <View style={st.summaryCard}>
            <View style={st.summaryRow}>
              <View style={st.dot} />
              <Text style={st.summaryLabel}>{ticketLine}</Text>
              {gaSection && <Text style={st.summaryPrice}>${gaTotal.toFixed(2)}</Text>}
            </View>
          </View>
        )}

        {/* Personal info form */}
        <View style={st.formCard}>
          <Text style={st.formTitle}>{t('Personal Information', 'Personal Information')}</Text>

          {user && (
            <View style={st.prefillRow}>
              <Text style={st.prefillText}>{t('Nombre completo', 'Full Name')}: <Text style={st.prefillVal}>{`${user.firstName || ''} ${user.lastName || ''}`.trim()}</Text></Text>
              {!!user.email && <Text style={st.prefillText}>{t('Email', 'Email')}: <Text style={st.prefillVal}>{user.email}</Text></Text>}
              {!!user.phone && <Text style={st.prefillText}>{t('Teléfono', 'Phone')}: <Text style={st.prefillVal}>{user.phone}</Text></Text>}
            </View>
          )}

          <View style={st.field}>
            <Text style={st.label}>{t('Nombre:', 'First Name:')}</Text>
            <TextInput value={firstName} onChangeText={setFirstName} placeholder={t('Tu nombre', 'Your first name')} placeholderTextColor="rgba(148,163,184,0.5)" style={st.input} />
          </View>
          <View style={st.field}>
            <Text style={st.label}>{t('Apellido:', 'Last Name:')}</Text>
            <TextInput value={lastName} onChangeText={setLastName} placeholder={t('Tu apellido', 'Your last name')} placeholderTextColor="rgba(148,163,184,0.5)" style={st.input} />
          </View>
          <View style={st.field}>
            <Text style={st.label}>{t('Correo electrónico:', 'Email Address:')}</Text>
            <TextInput value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor="rgba(148,163,184,0.5)" keyboardType="email-address" autoCapitalize="none" style={st.input} />
          </View>
          <View style={st.field}>
            <Text style={st.label}>{t('Teléfono:', 'Phone:')}</Text>
            <TextInput value={phone} onChangeText={setPhone} placeholder="+1 (000) 000-0000" placeholderTextColor="rgba(148,163,184,0.5)" keyboardType="phone-pad" style={st.input} />
          </View>
          <View style={st.field}>
            <Text style={st.label}>{t('Código especial (opcional):', 'Special code (optional):')}</Text>
            <TextInput value={code} onChangeText={setCode} placeholder="E.G. LPTICKET2026" placeholderTextColor="rgba(148,163,184,0.5)" autoCapitalize="characters" style={st.input} />
          </View>
        </View>

        {!!error && (
          <View style={st.errorCard}>
            <Ionicons name="alert-circle-outline" size={16} color="#FCA5A5" />
            <Text style={st.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={[st.continueBtn, (!canContinue || paying) && st.continueBtnDisabled]} onPress={pay} disabled={!canContinue || paying} activeOpacity={0.88}>
          <View pointerEvents="none" style={st.btnShine} />
          {paying
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={st.continueBtnText}>{t('CONTINUAR →', 'CONTINUE →')}</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={cancelReservation} style={st.deleteLink}>
          <Text style={st.deleteLinkText}>{t('Cancelar reserva', 'Delete reservation')}</Text>
        </TouchableOpacity>

        <View style={st.secureRow}>
          <Ionicons name="lock-closed-outline" size={12} color="rgba(134,239,172,0.7)" />
          <Text style={st.secureText}>{t('Pago 100% seguro · Procesado por Stripe', '100% secure · Powered by Stripe')}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.screen },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.orange, fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
  headerTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '600', marginTop: 2 },
  content: { padding: 16, paddingBottom: 48, gap: 14 },
  eventCard: { backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 16, gap: 6 },
  eventTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '600', marginBottom: 4 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  eventMeta: { color: 'rgba(203,213,225,0.70)', fontSize: 13, flex: 1, lineHeight: 18 },
  summaryCard: { backgroundColor: 'rgba(249,115,22,0.07)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.22)', padding: 14 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, flexShrink: 0 },
  summaryLabel: { flex: 1, color: 'rgba(226,232,240,0.85)', fontSize: 13, fontWeight: '600' },
  summaryPrice: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  formCard: { backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', padding: 18, gap: 14 },
  formTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 2 },
  prefillRow: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  prefillText: { color: 'rgba(148,163,184,0.8)', fontSize: 12, fontWeight: '500' },
  prefillVal: { color: '#F8FAFC', fontWeight: '600' },
  field: { gap: 6 },
  label: { color: 'rgba(203,213,225,0.70)', fontSize: 13, fontWeight: '600' },
  input: { height: 52, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, color: '#F8FAFC', fontSize: 15, fontWeight: '600' },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(252,165,165,0.08)', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: 'rgba(252,165,165,0.2)' },
  errorText: { color: '#FCA5A5', fontSize: 13, fontWeight: '600', flex: 1 },
  continueBtn: { height: 58, borderRadius: 14, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: colors.orange, shadowOpacity: 0.30, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  continueBtnDisabled: { opacity: 0.45 },
  btnShine: { position: 'absolute', top: 4, left: 20, right: 20, height: 1.5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.26)' },
  continueBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
  deleteLink: { alignItems: 'center', paddingVertical: 4 },
  deleteLinkText: { color: '#f87171', fontSize: 13, fontWeight: '600' },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  secureText: { color: 'rgba(134,239,172,0.6)', fontSize: 11, fontWeight: '600' },
});
