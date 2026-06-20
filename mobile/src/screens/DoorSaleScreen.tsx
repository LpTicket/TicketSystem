import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { GradientButton } from '../components/GradientButton';
import { useLanguage } from '../i18n/LanguageContext';
import { AuthUser, apiGet, getImageUrl } from '../services/api';
import { createDoorSaleCheckout, DoorSaleCheckout, DoorSalePreview, previewDoorSale } from '../services/doorSales';
import { runDoorSaleTapToPay } from '../services/tapToPay';

type Props = {
  user?: AuthUser | null;
  onBack: () => void;
};

type DoorEvent = {
  id: string;
  title: string;
  eventDate?: string;
  venueName?: string;
  imageUrl?: string;
  status?: string;
};

type PaymentMethod = 'qr' | 'link' | 'tap';

function listFrom(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data || payload?.events || payload?.items || [];
}

function money(value: any) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function fmtDate(value?: string) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('es-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch {
    return value;
  }
}

export function DoorSaleScreen({ user, onBack }: Props) {
  const { t } = useLanguage();
  const [events, setEvents] = useState<DoorEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [amount, setAmount] = useState('20');
  const [quantity, setQuantity] = useState(1);
  const [preview, setPreview] = useState<DoorSalePreview | null>(null);
  const [checkout, setCheckout] = useState<DoorSaleCheckout | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('qr');
  const [tapStatus, setTapStatus] = useState('');
  const [eventQuery, setEventQuery] = useState('');

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId), [events, selectedEventId]);
  const filteredEvents = useMemo(() => {
    const query = eventQuery.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) => {
      const text = [
        event.title,
        event.venueName,
        fmtDate(event.eventDate),
      ].filter(Boolean).join(' ').toLowerCase();
      return text.includes(query);
    });
  }, [events, eventQuery]);

  useEffect(() => {
    let mounted = true;
    apiGet<any>('/events/mine/list')
      .then((data) => {
        if (!mounted) return;
        const items = listFrom(data)
          .filter((event) => (event.status || 'published') === 'published')
          .map((event) => ({
            id: String(event.id),
            title: event.title || 'Evento',
            eventDate: event.eventDate,
            venueName: event.venueName || event.venue,
            imageUrl: getImageUrl(event.imageUrl || event.bannerImageUrl),
            status: event.status,
          }));
        setEvents(items);
        setSelectedEventId((current) => current || items[0]?.id || '');
      })
      .catch((err: any) => setError(err?.message || t('No se pudieron cargar tus eventos.', 'Could not load your events.')));
    return () => { mounted = false; };
  }, [t]);

  useEffect(() => {
    setCheckout(null);
  }, [selectedEventId]);

  useEffect(() => {
    if (!eventQuery.trim()) return;
    if (filteredEvents.length === 1 && filteredEvents[0].id !== selectedEventId) {
      setSelectedEventId(filteredEvents[0].id);
    }
  }, [eventQuery, filteredEvents, selectedEventId]);

  useEffect(() => {
    const value = Number(amount || 0);
    if (!selectedEventId || value <= 0) { setPreview(null); return; }
    setLoading(true);
    const timer = setTimeout(() => {
      previewDoorSale({ eventId: selectedEventId, amount: value, quantity })
        .then((data) => {
          setPreview(data);
        })
        .catch(() => {
          const baseTotal = Math.round(value * quantity * 100) / 100;
          const lpFee = Math.round(baseTotal * 0.12 * 100) / 100;
          const processingFee = Math.round((baseTotal * 0.029 + 0.30 * quantity) * 100) / 100;
          setPreview({
            unitPrice: value,
            quantity,
            baseTotal,
            lpFee,
            processingFee,
            total: Math.round((baseTotal + lpFee + processingFee) * 100) / 100,
          });
        })
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [amount, quantity, selectedEventId, t]);

  const primaryLabel = paymentMethod === 'qr'
    ? t('CREAR QR DE PAGO', 'CREATE PAYMENT QR')
    : paymentMethod === 'link'
      ? t('CREAR LINK DE PAGO', 'CREATE PAYMENT LINK')
      : t('COBRAR CON TAP TO PAY', 'CHARGE WITH TAP TO PAY');

  const makeCheckout = async () => {
    if (!selectedEventId || Number(amount || 0) <= 0 || creating) return;
    setCreating(true);
    setError('');
    setTapStatus('');
    try {
      if (paymentMethod === 'tap') {
        await runDoorSaleTapToPay({
          eventId: selectedEventId,
          amount: Number(amount),
          quantity,
          merchantDisplayName: selectedEvent?.title || 'LPTicket',
          onStatus: setTapStatus,
        });
        setCheckout(null);
        return;
      }

      const data = await createDoorSaleCheckout({
        eventId: selectedEventId,
        amount: Number(amount),
        quantity,
      });
      setCheckout(data);
      if (paymentMethod === 'link') {
        Share.share({ message: data.url }).catch(() => {});
      }
    } catch (err: any) {
      setError(err?.message || t('No se pudo crear el cobro.', 'Could not create payment.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.78}>
          <Ionicons name="chevron-back" size={18} color="#F8FAFC" />
        </TouchableOpacity>
        <View style={styles.modeBadge}>
          <Ionicons name="card-outline" size={14} color="#F97316" />
          <Text style={styles.modeBadgeText}>{t('VENTA EN PUERTA', 'DOOR SALE')}</Text>
        </View>
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={17} color="#FCA5A5" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.eyebrow}>{t('EVENTO', 'EVENT')}</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color="rgba(226,232,240,0.55)" />
          <TextInput
            value={eventQuery}
            onChangeText={setEventQuery}
            placeholder={t('Buscar evento', 'Search event')}
            placeholderTextColor="rgba(226,232,240,0.42)"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {eventQuery ? (
            <TouchableOpacity onPress={() => setEventQuery('')} style={styles.clearSearchButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={14} color="rgba(226,232,240,0.65)" />
            </TouchableOpacity>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.eventScroll}>
          {filteredEvents.map((event, index) => (
            <TouchableOpacity
              key={`${event.id}-${index}`}
              style={[styles.eventCard, selectedEventId === event.id && styles.eventCardActive]}
              onPress={() => setSelectedEventId(event.id)}
              activeOpacity={0.86}
            >
              <View style={styles.eventThumb}>
                {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={styles.eventImage} resizeMode="cover" /> : <Ionicons name="ticket-outline" size={24} color="#F97316" />}
              </View>
              <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
              <Text style={styles.eventMeta} numberOfLines={1}>{fmtDate(event.eventDate)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {filteredEvents.length === 0 ? (
          <View style={styles.emptySearch}>
            <Ionicons name="calendar-clear-outline" size={22} color="rgba(249,115,22,0.58)" />
            <Text style={styles.emptySearchText}>{t('No encontramos eventos con esa búsqueda.', 'No events match that search.')}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.keypadCard}>
        <View style={styles.doorTicketHeader}>
          <Ionicons name="ticket-outline" size={18} color="#F97316" />
          <View>
            <Text style={styles.doorTicketTitle}>{t('Entrada en puerta', 'Door ticket')}</Text>
            <Text style={styles.doorTicketCopy}>{t('Precio manual para esta venta', 'Manual price for this sale')}</Text>
          </View>
        </View>
        <View style={styles.amountRow}>
          <Text style={styles.currency}>$</Text>
          <TextInput value={amount} onChangeText={(v) => { setAmount(v.replace(/[^0-9.]/g, '')); setCheckout(null); }} keyboardType="decimal-pad" style={styles.amountInput} />
        </View>
        <View style={styles.quantityRow}>
          <TouchableOpacity style={styles.qtyButton} onPress={() => { setQuantity((v) => Math.max(1, v - 1)); setCheckout(null); }}>
            <Ionicons name="remove" size={17} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{quantity} {t('entrada(s)', 'ticket(s)')}</Text>
          <TouchableOpacity style={styles.qtyButton} onPress={() => { setQuantity((v) => Math.min(20, v + 1)); setCheckout(null); }}>
            <Ionicons name="add" size={17} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.invoiceCard}>
        <View style={styles.invoiceHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{t('RECIBO', 'RECEIPT')}</Text>
            <Text style={styles.receiptTitle}>{selectedEvent?.title || t('Evento', 'Event')}</Text>
            <Text style={styles.receiptMeta}>{[t('Entrada en puerta', 'Door ticket'), selectedEvent?.venueName].filter(Boolean).join(' · ')}</Text>
          </View>
          {preview?.total ? <Text style={styles.receiptTotal}>{money(preview.total)}</Text> : null}
        </View>
        {loading ? (
          <ActivityIndicator color="#F97316" style={{ marginTop: 14 }} />
        ) : preview ? (
          <>
            <Line label={t('Entrada', 'Ticket')} value={money(preview.baseTotal)} />
            <Line label={t('Fee LPTicket', 'LPTicket fee')} value={money(preview.lpFee)} />
            <Line label={t('Procesamiento', 'Processing')} value={money(preview.processingFee)} />
            <View style={styles.divider} />
            <Line label={t('Total a cobrar', 'Total to charge')} value={money(preview.total)} total />
          </>
        ) : null}
      </View>

      <View style={styles.payMethodCard}>
        <Text style={styles.eyebrow}>{t('FORMA DE COBRO', 'PAYMENT METHOD')}</Text>
        <PaymentOption
          icon="qr-code-outline"
          title={t('QR de pago', 'Payment QR')}
          copy={t('El cliente escanea y paga con Apple Pay o tarjeta.', 'Customer scans and pays with Apple Pay or card.')}
          status={paymentMethod === 'qr' ? t('Seleccionado', 'Selected') : t('Disponible', 'Available')}
          active={paymentMethod === 'qr'}
          onPress={() => setPaymentMethod('qr')}
        />
        <PaymentOption
          icon="link-outline"
          title={t('Link de pago', 'Payment link')}
          copy={t('Genera un link para abrirlo o compartirlo rápido.', 'Create a link to open or share quickly.')}
          status={paymentMethod === 'link' ? t('Seleccionado', 'Selected') : t('Disponible', 'Available')}
          active={paymentMethod === 'link'}
          onPress={() => setPaymentMethod('link')}
        />
        <PaymentOption
          icon="phone-portrait-outline"
          title={t('Tap to Pay en iPhone', 'Tap to Pay on iPhone')}
          copy={t('Cobra acercando tarjeta o teléfono al iPhone.', 'Charge by tapping a card or phone on the iPhone.')}
          status={paymentMethod === 'tap' ? t('Seleccionado', 'Selected') : t('App nativa', 'Native app')}
          active={paymentMethod === 'tap'}
          onPress={() => setPaymentMethod('tap')}
        />
        {tapStatus ? <Text style={styles.tapStatus}>{tapStatus}</Text> : null}
      </View>

      <GradientButton height={56} onPress={makeCheckout} disabled={creating || !preview}>
        {creating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{primaryLabel}</Text>}
      </GradientButton>

      {checkout && paymentMethod === 'qr' && (
        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>{t('QR listo para pagar', 'QR ready to pay')}</Text>
          <Text style={styles.qrCopy}>{t('El cliente escanea este código y paga con Apple Pay o tarjeta.', 'Customer scans this code and pays with Apple Pay or card.')}</Text>
          <Image source={{ uri: checkout.qrData }} style={styles.qrImage} resizeMode="contain" />
          <GradientButton label={t('ABRIR LINK DE PAGO', 'OPEN PAYMENT LINK')} height={48} onPress={() => WebBrowser.openBrowserAsync(checkout.url)} style={{ marginTop: 12, alignSelf: 'stretch' }} />
          <TouchableOpacity style={styles.shareButton} onPress={() => Share.share({ message: checkout.url })}>
            <Ionicons name="share-outline" size={16} color="#F97316" />
            <Text style={styles.shareText}>{t('Compartir link', 'Share link')}</Text>
          </TouchableOpacity>
        </View>
      )}
      {checkout && paymentMethod === 'link' && (
        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>{t('Link listo para pagar', 'Payment link ready')}</Text>
          <Text style={styles.qrCopy}>{t('Compártelo o ábrelo para que el cliente pague con Apple Pay o tarjeta.', 'Share or open it so the customer can pay with Apple Pay or card.')}</Text>
          <GradientButton label={t('ABRIR LINK DE PAGO', 'OPEN PAYMENT LINK')} height={48} onPress={() => WebBrowser.openBrowserAsync(checkout.url)} style={{ marginTop: 12, alignSelf: 'stretch' }} />
          <TouchableOpacity style={styles.shareButton} onPress={() => Share.share({ message: checkout.url })}>
            <Ionicons name="share-outline" size={16} color="#F97316" />
            <Text style={styles.shareText}>{t('Compartir link', 'Share link')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

function PaymentOption({ icon, title, copy, status, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; copy: string; status: string; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.paymentOption, active && styles.paymentOptionActive]} onPress={onPress} activeOpacity={0.78}>
      <View style={[styles.paymentIcon, active && styles.paymentIconActive]}>
        <Ionicons name={icon} size={20} color={active ? '#FFFFFF' : 'rgba(226,232,240,0.58)'} />
      </View>
      <View style={styles.paymentText}>
        <Text style={styles.paymentTitle}>{title}</Text>
        <Text style={styles.paymentCopy}>{copy}</Text>
      </View>
      <Text style={[styles.paymentStatus, active && styles.paymentStatusActive]}>{status}</Text>
    </TouchableOpacity>
  );
}

function Line({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, total && styles.totalLabel]}>{label}</Text>
      <Text style={[styles.lineValue, total && styles.totalValue]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 132, gap: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backButton: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center' },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, borderRadius: 14, paddingHorizontal: 13, borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', backgroundColor: '#030B14' },
  modeBadgeText: { color: '#F8FAFC', fontSize: 10, fontWeight: '800' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 30, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(249,115,22,0.30)', backgroundColor: 'rgba(249,115,22,0.08)' },
  liveBadgeText: { color: '#F8FAFC', fontSize: 11, fontWeight: '900' },
  title: { color: '#F8FAFC', fontSize: 30, lineHeight: 34, fontWeight: '900' },
  subtitle: { color: 'rgba(226,232,240,0.62)', fontSize: 13, lineHeight: 20 },
  logoCard: { minHeight: 76, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#030B14', padding: 14, justifyContent: 'center' },
  logo: { width: 165, height: 42 },
  logoCopy: { color: 'rgba(226,232,240,0.48)', fontSize: 11, fontWeight: '700', marginTop: 4 },
  errorCard: { flexDirection: 'row', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(248,113,113,0.28)', backgroundColor: 'rgba(239,68,68,0.10)', padding: 12 },
  errorText: { flex: 1, color: '#FCA5A5', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  noticeCard: { flexDirection: 'row', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(251,146,60,0.28)', backgroundColor: 'rgba(251,146,60,0.09)', padding: 12 },
  noticeText: { flex: 1, color: '#FDBA74', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  section: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 14 },
  eyebrow: { color: '#F97316', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  searchBox: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#030B14', paddingHorizontal: 12, marginTop: 12 },
  searchInput: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '700', outlineStyle: 'none' as any },
  clearSearchButton: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  eventScroll: { marginTop: 12 },
  eventCard: { width: 132, minHeight: 150, marginRight: 10, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#030B14', padding: 9 },
  eventCardActive: { borderColor: 'rgba(249,115,22,0.72)', backgroundColor: 'rgba(249,115,22,0.10)' },
  eventThumb: { height: 76, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.08)' },
  eventImage: { width: '100%', height: '100%' },
  eventTitle: { color: '#F8FAFC', fontSize: 12, lineHeight: 15, fontWeight: '800', marginTop: 8 },
  eventMeta: { color: 'rgba(249,115,22,0.78)', fontSize: 10, fontWeight: '700', marginTop: 4 },
  emptySearch: { minHeight: 78, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: '#030B14', marginTop: 12, padding: 12 },
  emptySearchText: { color: 'rgba(226,232,240,0.58)', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  chipScroll: { marginTop: 12 },
  sectionChip: { width: 128, minHeight: 66, marginRight: 9, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#030B14', padding: 11, justifyContent: 'center' },
  sectionChipActive: { borderColor: 'rgba(249,115,22,0.72)', backgroundColor: 'rgba(249,115,22,0.10)' },
  sectionChipTitle: { color: 'rgba(226,232,240,0.76)', fontSize: 12, fontWeight: '800' },
  sectionChipTitleActive: { color: '#FFFFFF' },
  sectionChipPrice: { color: '#F97316', fontSize: 11, fontWeight: '800', marginTop: 5 },
  keypadCard: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 18, shadowColor: '#000000', shadowOpacity: 0.24, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  doorTicketHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(249,115,22,0.26)', backgroundColor: 'rgba(249,115,22,0.08)', padding: 12, marginBottom: 14 },
  doorTicketTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  doorTicketCopy: { color: 'rgba(226,232,240,0.56)', fontSize: 11, fontWeight: '700', marginTop: 2 },
  amountRow: { height: 92, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  currency: { position: 'absolute', left: '24%', color: '#F97316', fontSize: 36, fontWeight: '900' },
  amountInput: { width: 190, color: '#FFFFFF', fontSize: 56, lineHeight: 64, fontWeight: '900', textAlign: 'center', outlineStyle: 'none' as any },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 12 },
  qtyButton: { width: 38, height: 38, borderRadius: 14, backgroundColor: 'rgba(249,115,22,0.82)', alignItems: 'center', justifyContent: 'center' },
  qtyText: { color: '#E2E8F0', fontSize: 13, fontWeight: '800', minWidth: 92, textAlign: 'center' },
  invoiceCard: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.025)', padding: 16 },
  invoiceHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  receiptTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '900', marginTop: 8 },
  receiptMeta: { color: 'rgba(226,232,240,0.56)', fontSize: 12, marginTop: 4, marginBottom: 10 },
  receiptTotal: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', marginTop: 6 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 },
  lineLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '700' },
  lineValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: 8 },
  totalLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  totalValue: { color: '#F97316', fontSize: 22, fontWeight: '900' },
  estimateText: { color: 'rgba(251,146,60,0.78)', fontSize: 11, fontWeight: '700', marginTop: 4 },
  payMethodCard: { borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 14, gap: 10 },
  paymentOption: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 74, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.025)', padding: 12 },
  paymentOptionActive: { borderColor: 'rgba(249,115,22,0.34)', backgroundColor: 'rgba(249,115,22,0.08)' },
  paymentIcon: { width: 38, height: 38, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  paymentIconActive: { borderColor: 'rgba(249,115,22,0.38)', backgroundColor: '#F97316' },
  paymentText: { flex: 1 },
  paymentTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '900' },
  paymentCopy: { color: 'rgba(226,232,240,0.58)', fontSize: 11, lineHeight: 15, marginTop: 3, fontWeight: '600' },
  paymentStatus: { color: 'rgba(226,232,240,0.54)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  paymentStatusActive: { color: '#F97316' },
  tapStatus: { color: 'rgba(226,232,240,0.72)', fontSize: 12, lineHeight: 17, fontWeight: '700', paddingHorizontal: 4 },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  qrCard: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(249,115,22,0.30)', backgroundColor: 'rgba(249,115,22,0.08)', padding: 16, alignItems: 'center' },
  qrTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  qrCopy: { color: 'rgba(226,232,240,0.62)', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  qrImage: { width: 228, height: 228, borderRadius: 18, marginTop: 14, backgroundColor: '#FFFFFF' },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, minHeight: 38, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(249,115,22,0.36)', backgroundColor: '#030B14' },
  shareText: { color: '#F97316', fontSize: 12, fontWeight: '900' },
});
