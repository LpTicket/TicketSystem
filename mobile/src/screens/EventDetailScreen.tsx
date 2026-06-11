import { useEffect, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { GradientButton } from '../components/GradientButton';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileEvent } from '../types/event';
import { apiGet, getImageUrl } from '../services/api';
import { ClientVenueMap } from '../components/events/ClientVenueMap';

const fallbackImage = require('../../assets/demo-concert.png');

type Props = {
  event: MobileEvent;
  onBack: () => void;
  onBuy: () => void;
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

export function EventDetailScreen({ event, onBack, onBuy }: Props) {
  const { t, lang } = useLanguage();
  const [detail, setDetail] = useState(event);
  const [seatMap, setSeatMap] = useState<VenueSection[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(false);

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
    const image = detail.bannerImageUrl || detail.imageUrl;
    return image ? { uri: image } : fallbackImage;
  }, [detail.bannerImageUrl, detail.imageUrl]);


  const toggleSeat = (seat: Seat) => {
    const status = String(seat.status || 'available').toLowerCase();
    if (status !== 'available') return;

    setSelectedSeats((current) => {
      const exists = current.some((item) => item.id === seat.id);
      return exists ? current.filter((item) => item.id !== seat.id) : [...current, seat];
    });
  };

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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>{t('‹ Eventos', '‹ Events')}</Text>
      </TouchableOpacity>

      <View style={styles.hero}>
        <Image source={imageSource} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.categoryBadge}>
          <View style={styles.categoryDot} />
          <Text style={styles.categoryText}>{detail.tag}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.eyebrow}>{loading ? t('CARGANDO EVENTO', 'LOADING EVENT') : detail.tag}</Text>
        <Text style={styles.title}>{detail.title}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.orange} style={styles.infoIcon} />
          <Text style={styles.infoText}>{detail.date}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={18} color={colors.orange} style={styles.infoIcon} />
          <View style={styles.infoCopy}>
            <Text style={styles.infoText}>{detail.venue}</Text>
            {!!detail.address && <Text style={styles.address}>{detail.address}</Text>}
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>{t('Sobre este evento', 'About this event')}</Text>
        <Text style={styles.description}>{description}</Text>


        <View style={styles.divider} />

        <View style={styles.seatMapHeader}>
          <View style={styles.seatMapHeaderCopy}>
            <Text style={styles.sectionTitle}>{t('Selecciona tus asientos', 'Select your seats')}</Text>
            <Text style={styles.mapSubtitle}>{t('Toca una silla disponible para agregarla a tu compra.', 'Tap an available seat to add it to your purchase.')}</Text>
          </View>
          <View style={styles.selectedPill}>
            <Text style={styles.selectedPillText}>{selectedSeats.length}</Text>
          </View>
        </View>

        <ClientVenueMap
          seatMap={seatMap}
          selectedSeats={selectedSeats}
          onToggleSeat={toggleSeat}
        />

        {selectedSeats.length > 0 && (
          <View style={styles.selectionSummary}>
            <Text style={styles.selectionText}>{selectedSeats.length} {t('seleccionado(s)', 'selected')}</Text>
            <Text style={styles.selectionTotal}>${selectedTotal.toFixed(2)}</Text>
          </View>
        )}

        <View style={styles.priceBox}>
          <Text style={styles.priceLabel}>{t('Desde', 'From')}</Text>
          <Text style={styles.price}>{detail.price}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareButton}>
            <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <GradientButton
            onPress={onBuy}
            height={56}
            style={styles.buyButton}
            textStyle={styles.buyText}
            label={t('COMPRAR TICKETS', 'BUY TICKETS')}
          />
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
  screen: { flex: 1, backgroundColor: '#030B14' },
  content: { paddingHorizontal: 16, paddingTop: 72, paddingBottom: 130, backgroundColor: '#030B14' },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 14,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  backText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  hero: {
    height: 330,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#081F33',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.20)',
  },
  heroImage: { width: '100%', height: '100%' },
  categoryBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 8,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: '#FFFFFF',
  },
  categoryDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#F97316' },
  categoryText: { color: '#0A375A', fontSize: 10, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  panel: {
    marginTop: 14,
    borderRadius: 16,
    padding: 18,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
  },
  eyebrow: { color: colors.orange, fontSize: 11, fontWeight: '900', letterSpacing: 3, marginBottom: 9 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', lineHeight: 35, marginBottom: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  infoIcon: { width: 22, textAlign: 'center', marginTop: 1 },
  infoCopy: { flex: 1 },
  infoText: { color: 'rgba(255,255,255,0.86)', fontSize: 15, lineHeight: 21, fontWeight: '600' },
  address: { color: 'rgba(203,213,225,0.68)', fontSize: 13, lineHeight: 19, fontWeight: '400', marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: 20 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginBottom: 8 },
  description: { color: 'rgba(203,213,225,0.78)', fontSize: 15, lineHeight: 23, fontWeight: '400' },

  seatMapHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12, overflow: 'hidden' },
  seatMapHeaderCopy: { flex: 1, paddingRight: 8 },
  mapSubtitle: { color: 'rgba(203,213,225,0.68)', fontSize: 13, lineHeight: 19, fontWeight: '400', marginTop: 4 },
  selectedPill: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 3 },
  selectedPillText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  mapPanel: { borderRadius: 16, backgroundColor: 'rgba(8,31,51,0.66)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)', padding: 14, overflow: 'hidden' },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { color: 'rgba(203,213,225,0.78)', fontSize: 11, fontWeight: '600' },
  mapScroller: { gap: 12, paddingRight: 4 },
  sectionCard: { width: 286, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 13 },
  sectionTop: { marginBottom: 12 },
  sectionName: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  sectionMeta: { color: 'rgba(203,213,225,0.68)', fontSize: 12, fontWeight: '500', marginTop: 4 },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  seat: { width: 42, height: 34, borderRadius: 9, backgroundColor: 'rgba(34,197,94,0.88)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.70)', alignItems: 'center', justifyContent: 'center' },
  seatSelected: { backgroundColor: '#F97316', borderColor: '#FFFFFF' },
  seatDisabled: { backgroundColor: 'rgba(100,116,139,0.55)', borderColor: 'rgba(148,163,184,0.38)' },
  seatText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  seatTextSelected: { color: '#FFFFFF' },
  seatTextDisabled: { color: 'rgba(226,232,240,0.44)' },
  generalAdmission: { height: 52, flex: 1, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  generalAdmissionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 1.4 },
  selectionSummary: { marginTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)', paddingTop: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  selectionTotal: { color: '#F97316', fontSize: 20, fontWeight: '900' },
  mapEmpty: { borderRadius: 15, padding: 16, backgroundColor: 'rgba(8,31,51,0.52)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)' },
  mapEmptyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  mapEmptyText: { color: 'rgba(203,213,225,0.68)', fontSize: 13, lineHeight: 19, fontWeight: '400', marginTop: 5 },

  priceBox: {
    marginTop: 18,
    borderRadius: 14,
    padding: 15,
    backgroundColor: 'rgba(8,31,51,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.18)',
  },
  priceLabel: { color: 'rgba(203,213,225,0.70)', fontSize: 12, fontWeight: '700', marginBottom: 5 },
  price: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  shareButton: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#081F33',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareText: { color: '#FFFFFF', fontSize: 25, fontWeight: '800' },
  buyButton: { flex: 1 },
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
  buyText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 2.8, zIndex: 3 },
});
