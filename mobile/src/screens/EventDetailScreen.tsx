import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Share, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileEvent } from '../types/event';
import { apiGet, getImageUrl } from '../services/api';
import { getEventSeatMap } from '../services/events';
import { lockSeats, unlockSeats } from '../services/orders';
import { ClientSeat, ClientVenueMap, ClientVenueSection } from '../components/events/ClientVenueMap';

const fallbackImage = require('../../assets/demo-concert.png');

type Props = {
  event: MobileEvent;
  onBack: () => void;
  onBuy: (selectedSeats: ClientSeat[], gaSection?: { id: string; name: string; price: number }, gaQty?: number) => void;
  onSelectionCountChange?: (count: number) => void;
  isLoggedIn?: boolean;
  onRequestLogin?: () => void;
  cartSyncToken?: number;
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
  defaultViewX?: number;
  defaultViewY?: number;
  defaultViewZoom?: number;
};

function formatDate(value?: string, lang?: string, timeZone?: string) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', {
      ...(timeZone ? { timeZone } : {}),
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(new Date(value));
  } catch { return value; }
}

function pickImage(...values: Array<string | undefined>) { return values.find(Boolean) || ''; }

function mergeEvent(base: MobileEvent, data?: ApiEventDetail, lang?: string): MobileEvent {
  if (!data) return base;
  const currency = data.currency || base.currency || 'USD';
  const price = Number(data.minPrice ?? data.price ?? base.minPrice ?? 0);
  return {
    ...base,
    id: data.id || base.id,
    slug: data.slug || base.slug,
    title: data.title || base.title,
    date: formatDate(data.eventDate, lang, data.eventTimezone || base.eventTimezone) || base.date,
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
    defaultViewX: data.defaultViewX ?? base.defaultViewX,
    defaultViewY: data.defaultViewY ?? base.defaultViewY,
    defaultViewZoom: data.defaultViewZoom ?? base.defaultViewZoom,
  };
}

function seatPrice(seat: ClientSeat, section: ClientVenueSection): number {
  try {
    const cfg = section?.seatsConfig ? JSON.parse(section.seatsConfig) : {};
    const key = section?.sectionType === 'table' ? `seat-${seat.seatNumber}` : `${seat.rowLabel}-${seat.seatNumber}`;
    if (cfg[key]?.price !== undefined) return Number(cfg[key].price);
  } catch {}
  return Number(section?.price || 0);
}

const MAX_PER_TX = 10;

export function EventDetailScreen({ event, onBack, onBuy, onSelectionCountChange, isLoggedIn, onRequestLogin, cartSyncToken = 0 }: Props) {
  const { t, lang } = useLanguage();
  const { width } = useWindowDimensions();
  const [detail, setDetail] = useState(event);
  const [sections, setSections] = useState<ClientVenueSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const scrollRef = useRef<any>(null);
  const scrollUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seat selection state (lives here, mirroring web behavior)
  const [selectedSeats, setSelectedSeats] = useState<ClientSeat[]>([]);
  const [gaQty, setGaQty] = useState(1);
  const [gaSectionId, setGaSectionId] = useState('');
  const [zonesOpen, setZonesOpen] = useState(false);
  const [locking, setLocking] = useState(false);
  const eventIdRef = useRef<string>('');

  useEffect(() => {
    const key = event.slug || event.id;
    if (!key) return;
    let mounted = true;
    setLoading(true);
    setMapLoading(true);
    apiGet<ApiEventDetail>(`/events/${key}`)
      .then((data) => {
        const next = mergeEvent(event, data, lang);
        if (mounted) setDetail(next);
        const eventId = data?.id || next.id;
        if (eventId) {
          getEventSeatMap(eventId)
            .then((map) => { if (mounted) { setSections(Array.isArray(map) ? map : []); setMapLoading(false); } })
            .catch(() => { if (mounted) { setSections([]); setMapLoading(false); } });
        } else {
          if (mounted) setMapLoading(false);
        }
      })
      .catch(() => { if (mounted) { setDetail(event); setMapLoading(false); } })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [event.id, event.slug, lang]);

  // Keep eventIdRef in sync so callbacks can read it without stale closure
  useEffect(() => { eventIdRef.current = detail.id || event.id; }, [detail.id, event.id]);

  // Restore cart from AsyncStorage on mount and whenever the global cart changes.
  useEffect(() => {
    const eid = event.id;
    if (!eid) return;
    AsyncStorage.getItem(`selectedSeats_${eid}`).then((raw) => {
      if (!raw) {
        setSelectedSeats([]);
        setGaQty(1);
        setGaSectionId('');
        return;
      }
      try {
        const parsed: any[] = JSON.parse(raw);
        const valid = parsed.filter((s) => !s.addedAt || (Date.now() - s.addedAt < 10 * 60 * 1000));
        if (valid.length > 0) {
          setSelectedSeats(valid);
        } else {
          setSelectedSeats([]);
          setGaQty(1);
          setGaSectionId('');
          AsyncStorage.removeItem(`selectedSeats_${eid}`);
        }
      } catch {}
    });
  }, [event.id, cartSyncToken]);

  // Persist cart to AsyncStorage on every selection change (same as web's localStorage)
  useEffect(() => {
    const eid = eventIdRef.current;
    if (!eid) return;
    if (selectedSeats.length === 0) {
      AsyncStorage.removeItem(`selectedSeats_${eid}`);
      AsyncStorage.removeItem('lp_active_cart_event');
      return;
    }
    const cartData = selectedSeats.map((s) => {
      const sec = sectionById[s.sectionId || ''];
      return {
        ...s,
        price: seatPrice(s, sec),
        sectionName: sec?.name || '',
        sectionType: sec?.sectionType || '',
        addedAt: Date.now(),
        eventTitle: detail.title,
        eventSlug: detail.slug,
        eventDate: (detail as any).eventDate,
        venueName: detail.venue || detail.venueName,
        currency: (detail as any).currency,
      };
    });
    AsyncStorage.setItem(`selectedSeats_${eid}`, JSON.stringify(cartData));
    AsyncStorage.setItem('lp_active_cart_event', eid);
  }, [selectedSeats, detail]);

  const seatedSections = useMemo(
    () => sections.filter((s) => (s.seats || []).length > 0 && s.sectionType !== 'standing'),
    [sections],
  );
  const gaSections = useMemo(
    () => sections.filter((s) => s.sectionType === 'standing').map((s) => {
      const seats = s.seats || [];
      const sold = seats.filter((x: any) => x.status === 'sold' || (x.status === 'locked' && !x.lockExpiresAt)).length;
      const capacity = Number(s.capacity) || seats.length;
      return { id: s.id, name: s.name || 'General', price: Number(s.price || 0), available: Math.max(0, capacity - sold) };
    }).filter((s) => s.available > 0),
    [sections],
  );

  const mode: 'seats' | 'ga' | 'none' = seatedSections.length > 0 ? 'seats' : gaSections.length > 0 ? 'ga' : 'none';

  useEffect(() => {
    if (mode === 'ga') {
      const first = gaSections[0];
      if (first && !gaSectionId) setGaSectionId(first.id);
    }
  }, [mode, gaSections, gaSectionId]);

  const gaSelected = gaSections.find((s) => s.id === gaSectionId) || gaSections[0];
  const gaMax = Math.min(gaSelected?.available ?? 1, MAX_PER_TX);

  const sectionById = useMemo(() => {
    const map: Record<string, ClientVenueSection> = {};
    sections.forEach((s) => (map[s.id] = s));
    return map;
  }, [sections]);

  const subtotal = mode === 'seats'
    ? selectedSeats.reduce((sum, seat) => sum + seatPrice(seat, sectionById[seat.sectionId || '']), 0)
    : (gaSelected?.price ?? 0) * gaQty;

  const serviceFee = subtotal > 0 ? Math.round(subtotal * 0.08 * 100) / 100 : 0;
  const processingFee = subtotal > 0 ? Math.round((subtotal + serviceFee) * 0.035 * 100) / 100 : 0;
  const total = subtotal + serviceFee + processingFee;

  const canBuy = mode === 'seats' ? selectedSeats.length > 0 : mode === 'ga' ? !!gaSelected : false;
  const selectionCount = mode === 'seats' ? selectedSeats.length : mode === 'ga' && gaSelected ? gaQty : 0;

  useEffect(() => { onSelectionCountChange?.(selectionCount); }, [selectionCount, onSelectionCountChange]);

  const toggleSeat = useCallback((seat: ClientSeat) => {
    if (!isLoggedIn) { onRequestLogin?.(); return; }
    setSelectedSeats((cur) => {
      const exists = cur.some((s) => s.id === seat.id);
      if (exists) return cur.filter((s) => s.id !== seat.id);
      if (cur.length >= MAX_PER_TX) return cur;
      return [...cur, seat];
    });
  }, [isLoggedIn, onRequestLogin]);

  const toggleSeats = useCallback((seats: ClientSeat[]) => {
    if (!isLoggedIn) { onRequestLogin?.(); return; }
    setSelectedSeats((cur) => {
      const anySelected = seats.some((s) => cur.some((c) => c.id === s.id));
      if (anySelected) {
        const removeIds = new Set(seats.map((s) => s.id));
        return cur.filter((c) => !removeIds.has(c.id));
      }
      const toAdd = seats.filter((s) => !cur.some((c) => c.id === s.id));
      return [...cur, ...toAdd.slice(0, MAX_PER_TX - cur.length)];
    });
  }, [isLoggedIn, onRequestLogin]);

  const imageSource = useMemo(() => {
    const img = detail.imageUrl || detail.bannerImageUrl;
    return img ? { uri: img } : fallbackImage;
  }, [detail.imageUrl, detail.bannerImageUrl]);
  const heroHeight = Math.round((width - 32) * 4 / 3);

  const description = detail.description?.trim() || t(
    'Vive una experiencia segura con compra rápida, tickets digitales y acceso por código QR.',
    'Enjoy a secure experience with fast checkout, digital tickets and QR access.',
  );

  const setMapScrollLock = useCallback((locked: boolean) => {
    if (scrollUnlockTimerRef.current) {
      clearTimeout(scrollUnlockTimerRef.current);
      scrollUnlockTimerRef.current = null;
    }
    if (locked) {
      scrollRef.current?.setNativeProps?.({ scrollEnabled: false });
      setScrollEnabled(false);
      return;
    }
    scrollUnlockTimerRef.current = setTimeout(() => {
      scrollRef.current?.setNativeProps?.({ scrollEnabled: true });
      setScrollEnabled(true);
    }, 120);
  }, []);

  useEffect(() => () => {
    if (scrollUnlockTimerRef.current) clearTimeout(scrollUnlockTimerRef.current);
  }, []);

  return (
    <ScrollView ref={scrollRef} style={st.screen} contentContainerStyle={st.content} showsVerticalScrollIndicator={false} scrollEnabled={scrollEnabled}>
      {/* Back + share row */}
      <View style={st.topRow}>
        <TouchableOpacity onPress={onBack} style={st.backButton}>
          <Ionicons name="arrow-back" size={16} color="rgba(226,232,240,0.8)" />
          <Text style={st.backText}>{t('Eventos', 'Events')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.shareBtn} onPress={() => Share.share({ title: detail.title, message: `${detail.title}\nhttps://lpticket.com/events/${detail.slug || detail.id}` })}>
          <Ionicons name="share-social-outline" size={18} color={colors.orange} />
        </TouchableOpacity>
      </View>
      <Text style={st.pageTitle}>{t('Detalle del evento', 'Event detail')}</Text>

      {/* Hero image */}
      <View style={[st.hero, { height: heroHeight }]}>
        <Image source={imageSource} style={st.heroImage} resizeMode="cover" />
        <View style={st.heroBadge}><Text style={st.heroBadgeText}>● {detail.tag}</Text></View>
      </View>

      {/* Event info */}
      <View style={st.panel}>
        <Text style={st.eyebrow}>{loading ? t('CARGANDO...', 'LOADING...') : detail.tag}</Text>
        <Text style={st.title}>{detail.title}</Text>
        <View style={st.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.orange} style={st.infoIcon} />
          <Text style={st.infoText}>{detail.date}</Text>
        </View>
        <View style={st.infoRow}>
          <Ionicons name="location-outline" size={16} color={colors.orange} style={st.infoIcon} />
          <View style={{ flex: 1 }}>
            <Text style={st.infoText}>{detail.venue}</Text>
            {!!detail.address && <Text style={st.address}>{detail.address}</Text>}
          </View>
        </View>
        <View style={st.divider} />
        <Text style={st.sectionTitle}>{t('Sobre este evento', 'About this event')}</Text>
        <Text style={st.description}>{description}</Text>
      </View>

      {/* Interactive seat map */}
      {mapLoading ? (
        <View style={st.mapLoading}>
          <ActivityIndicator color={colors.orange} />
          <Text style={st.mapLoadingText}>{t('Cargando mapa...', 'Loading map...')}</Text>
        </View>
      ) : mode === 'seats' ? (
        <View style={st.mapWrap}>
          <ClientVenueMap
            seatMap={sections}
            selectedSeats={selectedSeats}
            onToggleSeat={toggleSeat}
            onToggleSeats={toggleSeats}
            defaultViewX={(detail as any).defaultViewX}
            defaultViewY={(detail as any).defaultViewY}
            defaultViewZoom={(detail as any).defaultViewZoom}
            onScrollLock={setMapScrollLock}
          />
        </View>
      ) : mode === 'ga' ? (
        <View style={st.mapWrap}>
          {gaSections.map((s) => {
            const active = s.id === gaSelected?.id;
            return (
              <TouchableOpacity key={s.id} onPress={() => { setGaSectionId(s.id); setGaQty(1); }}
                style={[st.gaCard, active && st.gaCardActive]}>
                <View style={{ flex: 1 }}>
                  <Text style={st.gaLabel}>{t('ACCESO GENERAL', 'GENERAL ACCESS')}</Text>
                  <Text style={st.gaName}>{s.name}</Text>
                  <Text style={st.gaMeta}>{s.available} {t('disponibles', 'available')}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={st.gaPrice}>${s.price.toFixed(2)}</Text>
                  <Text style={st.gaPriceSub}>{t('por persona', 'per person')}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={st.qtyCard}>
            <Text style={st.qtyLabel}>{t('Cantidad', 'Quantity')}</Text>
            <View style={st.qtyRow}>
              <TouchableOpacity style={st.qtyBtn} onPress={() => setGaQty(Math.max(1, gaQty - 1))}>
                <Text style={st.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={st.qtyVal}>{gaQty}</Text>
              <TouchableOpacity style={st.qtyBtn} onPress={() => setGaQty(Math.min(gaMax, gaQty + 1))}>
                <Text style={st.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {/* Purchase summary card */}
      <View style={st.purchaseCard}>
        <Text style={st.purchaseTitle}>{t('Resumen de compra', 'Purchase Summary')}</Text>

        {/* Zones dropdown */}
        <TouchableOpacity style={st.zonesDropdown} onPress={() => setZonesOpen((v) => !v)} activeOpacity={0.82}>
          <Text style={st.zonesDropdownText}>{t('Ver precios y zonas', 'View Prices & Zones')}</Text>
          <Ionicons name={zonesOpen ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(226,232,240,0.70)" />
        </TouchableOpacity>
        {zonesOpen && (
          <View style={st.zonesBox}>
            {sections.filter((s) => s.price && Number(s.price) > 0).length === 0 ? (
              <Text style={st.zonesEmpty}>{t('Sin precios configurados', 'No prices configured')}</Text>
            ) : (
              sections.filter((s) => s.price && Number(s.price) > 0).map((s, i) => {
                const raw = s.name || s.label || '';
                const isTable = /^(mesa|table)\b/i.test(raw) || /^\d+$/.test(raw.trim());
                const display = isTable ? (/^(mesa|table)\b/i.test(raw) ? raw : `${t('Mesa', 'Table')} ${raw}`) : raw;
                const count = (s.seats?.length) || Number((s as any).capacity) || 0;
                return (
                  <View key={`${s.id}-${i}`} style={st.zoneRow}>
                    <View style={[st.zoneDot, { backgroundColor: s.color || '#5667FF' }]} />
                    <Text style={st.zoneName} numberOfLines={1}>{display}{count > 0 ? ` · ${count} ${t('sillas', 'seats')}` : ''}</Text>
                    <Text style={st.zonePrice}>${Number(s.price).toFixed(2)}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Selected seats list — tap to deselect */}
        {mode === 'seats' && selectedSeats.length > 0 && (
          <View style={st.seatsList}>
            <Text style={st.seatsLabel}>{t('Asientos seleccionados:', 'Selected seats:')} {t('(toca para quitar)', '(tap to remove)')}</Text>
            {selectedSeats.map((seat, i) => {
              const sec = sectionById[seat.sectionId || ''];
              const isTable = sec?.sectionType === 'table';
              const label = isTable
                ? `${t('TABLE', 'TABLE')} ${sec?.name} - ${t('CHAIR', 'CHAIR')} ${seat.seatNumber}`
                : `${sec?.name || ''} ${seat.rowLabel ? seat.rowLabel : ''}${seat.seatNumber ? `-${seat.seatNumber}` : ''}`.trim();
              return (
                <TouchableOpacity
                  key={`${seat.id}-${i}`}
                  style={st.seatRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (isTable) {
                      // Deselect all chairs of this table atomically
                      const tableSeats = selectedSeats.filter((s) => s.sectionId === seat.sectionId);
                      toggleSeats(tableSeats);
                    } else {
                      toggleSeat(seat);
                    }
                  }}
                >
                  <Ionicons name="close-circle" size={14} color="rgba(249,115,22,0.7)" style={{ flexShrink: 0 }} />
                  <Text style={st.seatRowLabel} numberOfLines={1}>{label.toUpperCase()}</Text>
                  <Text style={st.seatRowPrice}>${seatPrice(seat, sec).toFixed(2)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {mode === 'ga' && gaSelected && (
          <View style={st.seatsList}>
            <View style={st.seatRow}>
              <View style={st.seatDot} />
              <Text style={st.seatRowLabel} numberOfLines={1}>{gaSelected.name.toUpperCase()} × {gaQty}</Text>
              <Text style={st.seatRowPrice}>${(gaSelected.price * gaQty).toFixed(2)}</Text>
            </View>
          </View>
        )}

        {subtotal > 0 && (
          <>
            <View style={st.feeRow}>
              <Text style={st.feeLabel}>{t('Subtotal', 'Subtotal')}</Text>
              <Text style={st.feeValue}>${subtotal.toFixed(2)}</Text>
            </View>
            <View style={st.feeRow}>
              <Text style={st.feeLabel}>{t('Cargo por servicio', 'Service fee')}</Text>
              <Text style={st.feeValue}>${serviceFee.toFixed(2)}</Text>
            </View>
            <View style={st.feeRow}>
              <Text style={st.feeLabel}>{t('Cargo de procesamiento', 'Processing fee')}</Text>
              <Text style={st.feeValue}>${processingFee.toFixed(2)}</Text>
            </View>
            <View style={st.feeDivider} />
            <View style={st.totalRow}>
              <Text style={st.totalLabel}>{t('Total', 'Total')}</Text>
              <Text style={st.totalValue}>${total.toFixed(2)} USD</Text>
            </View>
          </>
        )}

        <TouchableOpacity
          style={[st.buyButton, (!canBuy || locking) && st.buyButtonDisabled]}
          onPress={async () => {
            if (!canBuy || locking) return;
            // Lock seats on server before going to checkout (same as web)
            if (mode === 'seats' && selectedSeats.length > 0) {
              setLocking(true);
              try {
                await lockSeats(selectedSeats.map((s) => s.id));
              } catch {
                // non-fatal: proceed anyway, checkout will catch conflicts
              } finally {
                setLocking(false);
              }
            }
            onBuy(selectedSeats, gaSelected ? { id: gaSelected.id, name: gaSelected.name, price: gaSelected.price } : undefined, gaSelected ? gaQty : undefined);
          }}
          activeOpacity={0.88}
          disabled={!canBuy}
        >
          <View pointerEvents="none" style={st.buyShine} />
          {locking
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={st.buyText}>
                {canBuy ? t('COMPRAR TICKETS', 'BUY TICKETS') : mode === 'none' ? t('SIN DISPONIBILIDAD', 'NO AVAILABILITY') : t('SELECCIONA TUS ASIENTOS', 'SELECT YOUR SEATS')}
              </Text>
          }
        </TouchableOpacity>

        <Text style={st.stripeNote}>{t('Pagos seguros procesados por Stripe', 'Secure payments processed by Stripe')}</Text>

        {([
          { icon: 'card-outline', title: t('Pagos seguros', 'Secure payments'), sub: t('Procesado por Stripe', 'Processed by Stripe') },
          { icon: 'shield-checkmark-outline', title: t('Tickets verificados', 'Verified tickets'), sub: t('Entrada digital protegida', 'Protected digital entry') },
          { icon: 'qr-code-outline', title: t('QR único', 'Unique QR'), sub: t('Validación rápida en puerta', 'Fast door validation') },
        ] as { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[]).map((item) => (
          <View key={item.title} style={st.trustRow}>
            <View style={st.trustIcon}><Ionicons name={item.icon} size={18} color={colors.orange} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.trustTitle}>{item.title}</Text>
              <Text style={st.trustSub}>{item.sub}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingTop: 10, paddingBottom: 130 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  backText: { color: 'rgba(226,232,240,0.85)', fontWeight: '700', fontSize: 14 },
  shareBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', lineHeight: 36, marginHorizontal: 16, marginBottom: 12 },
  hero: { alignSelf: 'stretch', borderRadius: 16, overflow: 'hidden', marginHorizontal: 16, marginBottom: 14, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(148,163,184,0.20)' },
  heroImage: { width: '100%', height: '100%' },
  heroBadge: { position: 'absolute', top: 12, left: 12, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'rgba(16,185,129,0.18)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.46)', shadowColor: '#10B981', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  heroBadgeText: { color: '#D1FAE5', fontSize: 12, fontWeight: '700', letterSpacing: 0 },
  panel: { marginHorizontal: 16, borderRadius: 16, padding: 18, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', marginBottom: 14 },
  eyebrow: { color: colors.orange, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '700', lineHeight: 31, marginBottom: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 },
  infoIcon: { marginTop: 2, flexShrink: 0 },
  infoText: { color: 'rgba(255,255,255,0.86)', fontSize: 14, lineHeight: 20, fontWeight: '600', flex: 1 },
  address: { color: 'rgba(203,213,225,0.68)', fontSize: 12, lineHeight: 18, marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.10)', marginVertical: 16 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  description: { color: 'rgba(203,213,225,0.78)', fontSize: 14, lineHeight: 21 },
  mapWrap: { marginHorizontal: 16, marginBottom: 14 },
  mapLoading: { marginHorizontal: 16, height: 80, alignItems: 'center', justifyContent: 'center', gap: 10, flexDirection: 'row', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', marginBottom: 14 },
  mapLoadingText: { color: 'rgba(203,213,225,0.55)', fontSize: 13 },
  gaCard: { marginBottom: 10, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.goldBorder, padding: 16, flexDirection: 'row', justifyContent: 'space-between', gap: 14, alignItems: 'center' },
  gaCardActive: { borderColor: colors.orange, borderWidth: 2, backgroundColor: 'rgba(249,115,22,0.06)' },
  gaLabel: { color: colors.orange, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  gaName: { color: colors.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 4 },
  gaMeta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  gaPrice: { color: colors.textPrimary, fontSize: 20, fontWeight: '900' },
  gaPriceSub: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  qtyCard: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.goldBorder, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyLabel: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(249,115,22,0.12)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { color: colors.orange, fontSize: 20, fontWeight: '900', lineHeight: 24 },
  qtyVal: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', minWidth: 28, textAlign: 'center' },
  purchaseCard: { marginHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(8,20,36,0.90)', padding: 18, gap: 10 },
  purchaseTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  seatsList: { gap: 8 },
  seatsLabel: { color: 'rgba(203,213,225,0.55)', fontSize: 11, fontWeight: '700', letterSpacing: 0.3, marginBottom: 2 },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seatDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, flexShrink: 0 },
  seatRowLabel: { flex: 1, color: 'rgba(226,232,240,0.85)', fontSize: 13, fontWeight: '700' },
  seatRowPrice: { color: '#F8FAFC', fontSize: 13, fontWeight: '800' },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  feeLabel: { color: 'rgba(203,213,225,0.65)', fontSize: 13, fontWeight: '500' },
  feeValue: { color: 'rgba(226,232,240,0.85)', fontSize: 13, fontWeight: '700' },
  feeDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  totalValue: { color: colors.orange, fontSize: 24, fontWeight: '900' },
  buyButton: { height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', shadowColor: colors.orange, shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  buyButtonDisabled: { opacity: 0.4 },
  buyShine: { position: 'absolute', top: 4, left: 14, right: 14, height: 1.5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.26)' },
  buyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },
  stripeNote: { color: 'rgba(226,232,240,0.38)', fontSize: 11, textAlign: 'center' },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  trustIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', backgroundColor: 'rgba(249,115,22,0.09)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  trustTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  trustSub: { color: 'rgba(203,213,225,0.55)', fontSize: 11, marginTop: 1 },
  zonesDropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 14, paddingVertical: 13 },
  zonesDropdownText: { color: 'rgba(226,232,240,0.85)', fontSize: 14, fontWeight: '600' },
  zonesBox: { borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 12, gap: 10 },
  zonesEmpty: { color: 'rgba(203,213,225,0.55)', fontSize: 13, fontWeight: '500' },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  zoneDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  zoneName: { flex: 1, color: 'rgba(226,232,240,0.80)', fontSize: 13, fontWeight: '600' },
  zonePrice: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
});
