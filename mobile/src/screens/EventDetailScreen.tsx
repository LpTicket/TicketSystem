import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileEvent } from '../types/event';
import { apiGet, getImageUrl } from '../services/api';
import { ClientVenueMap } from '../components/events/ClientVenueMap';

const fallbackImage = require('../../assets/demo-concert.png');

type Props = {
  event: MobileEvent;
  onBack: () => void;
  onBuy: () => void;
  onSelectionCountChange?: (count: number) => void;
};


type SeatStatus = 'available' | 'sold' | 'locked' | 'reserved' | string;

type Seat = {
  id: string;
  sectionId?: string;
  rowLabel?: string;
  seatNumber?: string | number;
  status?: SeatStatus;
};

type VenueSection = {
  id: string;
  name?: string;
  label?: string;
  price?: number;
  color?: string;
  type?: string;
  capacity?: number | string;
  mapX?: number;
  mapY?: number;
  mapWidth?: number;
  mapHeight?: number;
  seats?: Seat[];
};

type ApiEventDetail = {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  eventDate?: string;
  eventTimezone?: string;
  venueName?: string;
  venueAddress?: string;
  price?: number;
  minPrice?: number;
  currency?: string;
  category?: string;
  categoryName?: string;
  tag?: string;
  ageRestriction?: string;
  imageUrl?: string;
  bannerImageUrl?: string;
  mobileImageData?: string;
  imageData?: string;
};

function formatDate(value?: string, lang?: string) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function pickImage(...values: Array<string | undefined>) {
  return values.find(Boolean) || '';
}

function mergeEvent(base: MobileEvent, data?: ApiEventDetail, lang?: string): MobileEvent {
  if (!data) return base;

  const currency = data.currency || base.currency || 'USD';
  const price = Number(data.minPrice ?? data.price ?? base.minPrice ?? 0);

  return {
    ...base,
    id: data.id || base.id,
    slug: data.slug || base.slug,
    title: data.title || base.title,
    date: formatDate(data.eventDate, lang) || base.date,
    venue: data.venueName || base.venue,
    address: data.venueAddress || base.address,
    price: `${price.toFixed(2)} ${currency}`,
    tag: data.tag || data.categoryName || data.category || base.tag,
    age: data.ageRestriction || base.age,
    description: data.description || base.description,
    currency,
    minPrice: price,
    eventDate: data.eventDate || base.eventDate,
    eventTimezone: data.eventTimezone || base.eventTimezone,
    venueName: data.venueName || base.venueName,
    venueAddress: data.venueAddress || base.venueAddress,
    imageUrl: getImageUrl(pickImage(data.imageUrl, data.imageData)) || base.imageUrl,
    bannerImageUrl: getImageUrl(pickImage(data.bannerImageUrl, data.mobileImageData, data.imageUrl, data.imageData)) || base.bannerImageUrl,
  };
}

export function EventDetailScreen({ event, onBack, onBuy, onSelectionCountChange }: Props) {
  const { t, lang } = useLanguage();
  const [detail, setDetail] = useState(event);
  const [seatMap, setSeatMap] = useState<VenueSection[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(false);
  const [zonesOpen, setZonesOpen] = useState(false);
  const scrollRef = useRef<import('react-native').ScrollView>(null);
  const purchaseY = useRef(0);

  useEffect(() => {
    const key = event.slug || event.id;
    if (!key) return;

    let mounted = true;
    setLoading(true);

    apiGet<ApiEventDetail>(`/events/${key}`)
      .then((data) => {
        const nextEvent = mergeEvent(event, data, lang);
        if (mounted) setDetail(nextEvent);

        const eventId = data?.id || nextEvent.id;
        if (eventId) {
          apiGet<VenueSection[]>(`/events/${eventId}/seatmap`)
            .then((map) => {
              if (mounted) setSeatMap(Array.isArray(map) ? map : []);
            })
            .catch(() => {
              if (mounted) setSeatMap([]);
            });
        }
      })
      .catch(() => {
        if (mounted) setDetail(event);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [event.id, event.slug, lang]);

  const imageSource = useMemo(() => {
    const image = detail.imageUrl || detail.bannerImageUrl;
    return image ? { uri: image } : fallbackImage;
  }, [detail.imageUrl, detail.bannerImageUrl]);


  const toggleSeat = (seat: Seat) => {
    const status = String(seat.status || 'available').toLowerCase();
    if (status !== 'available') return;

    setSelectedSeats((current) => {
      const exists = current.some((item) => item.id === seat.id);
      const next = exists ? current.filter((item) => item.id !== seat.id) : [...current, seat];
      if (next.length > 0 && purchaseY.current > 0) {
        setTimeout(() => scrollRef.current?.scrollTo({ y: purchaseY.current - 20, animated: true }), 120);
      }
      return next;
    });
  };

  useEffect(() => {
    onSelectionCountChange?.(selectedSeats.length);
    return () => onSelectionCountChange?.(0);
  }, [onSelectionCountChange, selectedSeats.length]);

  const seatLabel = (seat: Seat) => {
    const row = seat.rowLabel && seat.rowLabel !== 'GA' ? seat.rowLabel : '';
    return [row, seat.seatNumber].filter(Boolean).join('-') || 'GA';
  };

  const selectedTotal = selectedSeats.reduce((sum, seat) => {
    const section = seatMap.find((item) => item.id === seat.sectionId);
    return sum + Number(section?.price || detail.minPrice || 0);
  }, 0);

  const description = detail.description?.trim()
    || t(
      'Vive una experiencia segura con compra rápida, tickets digitales y acceso por código QR.',
      'Enjoy a secure experience with fast checkout, digital tickets and QR access.'
    );

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>{t('‹ Eventos', '‹ Events')}</Text>
      </TouchableOpacity>

      <View style={styles.hero}>
        <Image source={imageSource} style={styles.heroImage} resizeMode="contain" />
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{detail.tag}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.eyebrow}>{loading ? t('CARGANDO EVENTO', 'LOADING EVENT') : detail.tag}</Text>
        <Text style={styles.title}>{detail.title}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>▣</Text>
          <Text style={styles.infoText}>{detail.date}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoIcon}>⌖</Text>
          <View style={styles.infoCopy}>
            <Text style={styles.infoText}>{detail.venue}</Text>
            {!!detail.address && <Text style={styles.address}>{detail.address}</Text>}
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>{t('Sobre este evento', 'About this event')}</Text>
        <Text style={styles.description}>{description}</Text>


      </View>

      {/* Map section is now fully self-contained inside ClientVenueMap to match web card layout */}

      <View style={styles.mapContainer}>
        <ClientVenueMap
          seatMap={seatMap}
          selectedSeats={selectedSeats}
          onToggleSeat={toggleSeat}
        />
      </View>

      <View style={styles.purchaseOuter} onLayout={(e) => { purchaseY.current = e.nativeEvent.layout.y; }}>
        {selectedSeats.length > 0 && (
          <View style={styles.selectionSummary}>
            <Text style={styles.selectionText}>{selectedSeats.length} {t('seleccionado(s)', 'selected')}</Text>
            <Text style={styles.selectionTotal}>${selectedTotal.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.purchaseCard}>
          <Text style={styles.purchaseTitle}>{t('Resumen de compra', 'Purchase Summary')}</Text>

          {/* Collapsible zones dropdown */}
          <TouchableOpacity
            style={styles.zonesDropdown}
            onPress={() => setZonesOpen((v) => !v)}
            activeOpacity={0.82}
          >
            <Text style={styles.zonesDropdownText}>{t('Ver precios y zonas', 'View Prices & Zones')}</Text>
            <Ionicons
              name={zonesOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color="rgba(226,232,240,0.70)"
            />
          </TouchableOpacity>

          {zonesOpen && (
            <View style={styles.zonesBox}>
              {seatMap.filter((s) => s.price && Number(s.price) > 0).length === 0 ? (
                <Text style={styles.zonesEmpty}>{t('Sin precios configurados', 'No prices configured')}</Text>
              ) : (
                seatMap.filter((s) => s.price && Number(s.price) > 0).map((s, index) => {
                  const rawName = s.name || s.label || '';
                  const isTable = /^(mesa|table)\b/i.test(rawName) || /^\d+$/.test(rawName.trim());
                  const displayName = isTable
                    ? /^(mesa|table)\b/i.test(rawName) ? rawName : `${t('Mesa', 'Table')} ${rawName}`
                    : rawName;
                  const seatCount = s.seats?.length || Number((s as any).capacity) || (Number((s as any).rows || 0) * Number((s as any).seatsPerRow || 0)) || 0;
                  return (
                    <View key={`${s.id || s.name || 'zone'}-${index}`} style={styles.zoneRow}>
                      <View style={[styles.zoneDot, { backgroundColor: s.color || '#5667FF' }]} />
                      <Text style={styles.zoneName} numberOfLines={1}>
                        {displayName}{seatCount > 0 ? ` · ${seatCount} ${t('sillas', 'seats')}` : ''}
                      </Text>
                      <Text style={styles.zonePrice}>${Number(s.price).toFixed(2)}</Text>
                    </View>
                  );
                })
              )}
            </View>
          )}

          <TouchableOpacity style={styles.buyButton} onPress={onBuy} activeOpacity={0.88}>
            <View pointerEvents="none" style={styles.orangeButtonTop} />
            <View pointerEvents="none" style={styles.orangeButtonBottom} />
            <Text style={styles.buyText}>{t('COMPRAR TICKETS', 'BUY TICKETS')}</Text>
          </TouchableOpacity>

          <Text style={styles.stripeNote}>{t('Pagos seguros procesados por Stripe', 'Secure payments processed by Stripe')}</Text>

          {([
            { icon: 'card-outline', title: t('Pagos seguros', 'Secure payments'), sub: t('Procesado por Stripe', 'Processed by Stripe') },
            { icon: 'shield-checkmark-outline', title: t('Tickets verificados', 'Verified tickets'), sub: t('Entrada digital protegida', 'Protected digital entry') },
            { icon: 'qr-code-outline', title: t('QR único', 'Unique QR'), sub: t('Validación rápida en puerta', 'Fast door validation') },
            { icon: 'headset-outline', title: t('Soporte disponible', 'Support available'), sub: t('Antes y después de la compra', 'Before and after purchase') },
          ] as { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[]).map((item, index) => (
            <View key={`${item.title}-${index}`} style={styles.trustRow}>
              <View style={styles.trustIcon}>
                <Ionicons name={item.icon} size={18} color={colors.orange} />
              </View>
              <View style={styles.trustCopy}>
                <Text style={styles.trustTitle}>{item.title}</Text>
                <Text style={styles.trustSub}>{item.sub}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}


function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingTop: 10, paddingBottom: 130, backgroundColor: 'transparent' },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 14,
    marginHorizontal: 16,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  backText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  hero: {
    height: 500,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    backgroundColor: 'rgba(2,8,15,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.20)',
  },
  heroImage: { width: '100%', height: '100%', transform: [{ scale: 1.12 }] },
  categoryBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(3,11,20,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  categoryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0 },
  panel: {
    marginTop: 14,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  eyebrow: { color: colors.orange, fontSize: 11, fontWeight: '700', letterSpacing: 0, marginBottom: 9 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', lineHeight: 35, marginBottom: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  infoIcon: { color: colors.orange, fontSize: 19, width: 22, textAlign: 'center' },
  infoCopy: { flex: 1 },
  infoText: { color: 'rgba(255,255,255,0.86)', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  address: { color: 'rgba(203,213,225,0.68)', fontSize: 13, lineHeight: 19, fontWeight: '400', marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: 20 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  description: { color: 'rgba(203,213,225,0.78)', fontSize: 15, lineHeight: 23, fontWeight: '400' },

  mapContainer: { marginHorizontal: 16, marginTop: 22, marginBottom: 10 },
  purchaseOuter: { marginHorizontal: 16 },
  mapPanel: { borderRadius: 16, backgroundColor: 'rgba(8,31,51,0.66)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)', padding: 14, overflow: 'hidden' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: 'rgba(203,213,225,0.78)', fontSize: 11, fontWeight: '600' },
  mapScroller: { gap: 12, paddingRight: 4 },
  sectionCard: { width: 286, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 13 },
  sectionTop: { marginBottom: 12 },
  sectionName: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  sectionMeta: { color: 'rgba(203,213,225,0.68)', fontSize: 12, fontWeight: '500', marginTop: 4 },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  seat: { width: 42, height: 34, borderRadius: 9, backgroundColor: 'rgba(34,197,94,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.70)', alignItems: 'center', justifyContent: 'center' },
  seatSelected: { backgroundColor: '#F97316', borderColor: '#FFFFFF' },
  seatDisabled: { backgroundColor: 'rgba(100,116,139,0.55)', borderColor: 'rgba(148,163,184,0.38)' },
  seatText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  seatTextSelected: { color: '#FFFFFF' },
  seatTextDisabled: { color: 'rgba(226,232,240,0.44)' },
  generalAdmission: { height: 52, flex: 1, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  generalAdmissionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 0 },
  selectionSummary: { marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)', paddingTop: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  selectionTotal: { color: '#F97316', fontSize: 20, fontWeight: '700' },
  mapEmpty: { borderRadius: 15, padding: 16, backgroundColor: 'rgba(8,31,51,0.52)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)' },
  mapEmptyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  mapEmptyText: { color: 'rgba(203,213,225,0.68)', fontSize: 13, lineHeight: 19, fontWeight: '400', marginTop: 5 },

  purchaseCard: {
    marginTop: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(8,20,36,0.90)',
    padding: 18,
    gap: 12,
  },
  purchaseTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginBottom: 2 },
  zonesDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  zonesDropdownText: { color: 'rgba(226,232,240,0.85)', fontSize: 14, fontWeight: '600' },
  zonesBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    gap: 10,
  },
  zonesEmpty: { color: 'rgba(203,213,225,0.55)', fontSize: 13, fontWeight: '500' },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  zoneDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  zoneName: { flex: 1, color: 'rgba(226,232,240,0.80)', fontSize: 13, fontWeight: '600' },
  zonePrice: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  buyButton: {
    height: 56,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  orangeButtonTop: {
    position: 'absolute',
    top: 4,
    left: 14,
    right: 14,
    height: 1.5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.26)',
    zIndex: 2,
  },
  orangeButtonBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
    backgroundColor: 'rgba(154,52,18,0.22)',
    zIndex: 1,
  },
  buyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.4, zIndex: 3 },
  stripeNote: {
    color: 'rgba(226,232,240,0.40)',
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },
  trustIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.28)',
    backgroundColor: 'rgba(249,115,22,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  trustCopy: { flex: 1 },
  trustTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  trustSub: { color: 'rgba(203,213,225,0.58)', fontSize: 12, fontWeight: '400', marginTop: 1 },
});
