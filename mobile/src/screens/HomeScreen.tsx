import { useEffect, useMemo, useState } from 'react';
import { Image, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientButton } from '../components/GradientButton';
import { getPublicEvents } from '../services/events';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileEvent } from '../types/event';
import { AppFooter } from '../components/AppFooter';

const fallbackEventImage = require('../../assets/demo-concert.png');

type Props = {
  onOpenEvent: (event: MobileEvent) => void;
};

function getHeroImageSource(event?: MobileEvent) {
  const imageUrl = event?.bannerImageUrl || event?.imageUrl;
  return imageUrl ? { uri: imageUrl } : fallbackEventImage;
}

function getPosterImageSource(event?: MobileEvent) {
  const imageUrl = event?.imageUrl || event?.bannerImageUrl;
  return imageUrl ? { uri: imageUrl } : fallbackEventImage;
}

function categoryEmoji(item: string) {
  const s = item.toLowerCase();
  if (/concert|concierto|music|música|musica|festival/.test(s)) return '🎵';
  if (/sport|deporte|game|partido/.test(s)) return '🏟️';
  if (/comed/.test(s)) return '🎤';
  if (/theat|teatro|arte|art|show/.test(s)) return '🎭';
  if (/network|negocio|business|vip|conf/.test(s)) return '🥂';
  return '🎟️';
}

function categoryDesc(item: string, t: (es: string, en: string) => string) {
  const s = item.toLowerCase();
  if (item === 'All') return t('Explora todo ahora.', 'Explore everything now.');
  if (/concert|music|música|musica|festival/.test(s)) return t('Música en vivo y shows.', 'Live music and shows.');
  if (/sport|deporte|partido/.test(s)) return t('Vive cada partido.', 'Feel every game.');
  if (/comed/.test(s)) return t('Risas y buen ambiente.', 'Laughs and good energy.');
  if (/theat|teatro|arte|art|show/.test(s)) return t('Escena, arte y cultura.', 'Stage, art, and culture.');
  if (/network|negocio|business|vip|conf/.test(s)) return t('Experiencias para conectar.', 'Experiences to connect.');
  return t('Eventos seleccionados.', 'Curated events.');
}

export function HomeScreen({ onOpenEvent }: Props) {
  const { t } = useLanguage();
  const [events, setEvents] = useState<MobileEvent[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'price'>('date');

  const trustItems = [
    { icon: '▣', title: t('Pagos seguros', 'Secure payments'), subtitle: t('Procesado por Stripe', 'Processed by Stripe') },
    { icon: '♢', title: t('Tickets verificados', 'Verified tickets'), subtitle: t('Entrada digital protegida', 'Protected digital entry') },
    { icon: '⌗', title: t('QR único', 'Unique QR'), subtitle: t('Validación rápida en puerta', 'Fast door validation') },
    { icon: '◎', title: t('Soporte disponible', 'Support available'), subtitle: t('Antes y después de la compra', 'Before and after purchase') },
  ];

  const heroEvents = useMemo(() => events.filter((event) => event.bannerImageUrl || event.imageUrl), [events]);
  const safeHeroLength = Math.max(heroEvents.length, 1);
  const heroEvent = heroEvents[heroIndex % safeHeroLength] || events[0];

  const categories = useMemo(() => {
    const tags = Array.from(new Set(events.map((e) => (e.tag || '').trim()).filter(Boolean)));
    return ['All', ...tags];
  }, [events]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    const p = place.trim().toLowerCase();
    const list = events.filter((e) => {
      const matchesQuery = !q || [e.title, e.venue, e.address, e.tag].some((v) => (v || '').toLowerCase().includes(q));
      const matchesPlace = !p || [e.venue, e.address].some((v) => (v || '').toLowerCase().includes(p));
      const matchesCategory = category === 'All' || (e.tag || '').toLowerCase() === category.toLowerCase();
      return matchesQuery && matchesPlace && matchesCategory;
    });
    return [...list].sort((a, b) => {
      if (sortBy === 'price') return (a.minPrice ?? 0) - (b.minPrice ?? 0);
      const ta = a.eventDate ? new Date(a.eventDate).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.eventDate ? new Date(b.eventDate).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  }, [events, query, place, category, sortBy]);

  useEffect(() => {
    let mounted = true;

    getPublicEvents()
      .then((items) => {
        if (mounted) setEvents(items);
      })
      .catch(() => {
        if (mounted) setEvents([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (heroEvents.length <= 1) return;

    const timer = setInterval(() => {
      changeHero((heroIndex + 1) % heroEvents.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [heroEvents.length, heroIndex]);

  const goPrevHero = () => {
    if (heroEvents.length <= 1) return;
    changeHero((heroIndex - 1 + heroEvents.length) % heroEvents.length);
  };

  const changeHero = (nextIndex: number) => {
    if (heroEvents.length <= 1) return;

    const normalizedIndex = ((nextIndex % heroEvents.length) + heroEvents.length) % heroEvents.length;
    if (normalizedIndex !== heroIndex) setHeroIndex(normalizedIndex);
  };

  const goNextHero = () => {
    if (heroEvents.length <= 1) return;
    changeHero((heroIndex + 1) % heroEvents.length);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View pointerEvents="none" style={styles.bgBaseLayer} />
      <View pointerEvents="none" style={styles.bgAccentOrange} />
      <View pointerEvents="none" style={styles.bgAccentBlue} />
      <View pointerEvents="none" style={styles.bgGridA} />
      <View pointerEvents="none" style={styles.bgGridB} />
      <View style={styles.heroWrap}>
        <Image source={getHeroImageSource(heroEvent)} style={styles.heroImage} resizeMode="cover" />
        <TouchableOpacity style={[styles.heroArrow, styles.heroLeft]} onPress={goPrevHero}><Text style={styles.heroArrowText}>‹</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.heroArrow, styles.heroRight]} onPress={goNextHero}><Text style={styles.heroArrowText}>›</Text></TouchableOpacity>
        {!!heroEvent?.age && (
          <View style={styles.heroAgeBadge}><Text style={styles.heroAgeText}>{heroEvent.age}</Text></View>
        )}
      </View>

      <View style={styles.searchPanel}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(21,31,45,0.94)', 'rgba(8,17,29,0.92)']}
          style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['transparent', 'rgba(255,107,0,0.78)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.searchAccentLine}
        />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('BUSCAR EVENTO', 'SEARCH EVENT')}</Text>
          <View style={styles.fieldRow}>
            <Ionicons name="search" size={18} color="#ff7a00" />
            <TextInput value={query} onChangeText={setQuery} placeholder={t('Conciertos, teatro, talleres...', 'Concerts, theater, workshops...')} placeholderTextColor="rgba(248,250,252,0.62)" style={styles.fieldInput} />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('LUGAR', 'PLACE')}</Text>
          <View style={styles.fieldRow}>
            <Ionicons name="location-outline" size={18} color="#ff7a00" />
            <TextInput value={place} onChangeText={setPlace} placeholder={t('Ciudad o venue', 'City or venue')} placeholderTextColor="rgba(248,250,252,0.62)" style={styles.fieldInput} />
          </View>
        </View>
        <GradientButton
          label={t('BUSCAR', 'SEARCH')}
          onPress={() => Keyboard.dismiss()}
          height={58}
          textStyle={styles.searchText}
        />

        <View style={styles.categoryRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
            {categories.map((item) => {
              const active = category === item;
              const label = item === 'All' ? t('Todos', 'All') : item;
              const match = item === 'All'
                ? events.find((e) => e.imageUrl || e.bannerImageUrl)
                : events.find((e) => (e.tag || '').toLowerCase() === item.toLowerCase() && (e.imageUrl || e.bannerImageUrl));
              const img = match?.imageUrl || match?.bannerImageUrl || '';
              return (
                <TouchableOpacity key={item} activeOpacity={0.85} onPress={() => setCategory(item)} style={[styles.catCard, active && styles.catCardActive]}>
                  {img ? <Image source={{ uri: img }} style={styles.catImage} resizeMode="cover" /> : null}
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(2,5,9,0.04)', 'rgba(2,5,9,0.42)', 'rgba(2,5,9,0.94)']}
                    locations={[0, 0.42, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  <View pointerEvents="none" style={styles.catGlow} />
                  <View style={styles.catContent}>
                    <Text style={styles.catIcon}>{item === 'All' ? '🎟️' : categoryEmoji(item)}</Text>
                    <Text style={styles.catTitle} numberOfLines={1}>{label}</Text>
                    <Text style={styles.catDesc} numberOfLines={2}>{categoryDesc(item, t)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        <GradientButton
          onPress={() => setSortBy((s) => (s === 'date' ? 'price' : 'date'))}
          height={58}
          style={styles.sortButton}
          textStyle={styles.sortText}
          label={`${t('ORDENAR POR', 'SORT BY')}: ${sortBy === 'date' ? t('FECHA', 'DATE') : t('PRECIO', 'PRICE')}`}
        />
      </View>

      <View style={styles.trustList}>
        {trustItems.map((item) => (
          <View key={item.title} style={styles.trustCard}>
            <View style={styles.trustIcon}><Text style={styles.trustIconText}>{item.icon}</Text></View>
            <View>
              <Text style={styles.trustTitle}>{item.title}</Text>
              <Text style={styles.trustSubtitle}>{item.subtitle}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.highlights}>
        <Text style={styles.eyebrow}>{t('DESTACADOS', 'HIGHLIGHTS')}</Text>
        <Text style={styles.eventsTitle}>{t('Eventos cerca de ti', 'Events near you')}</Text>
        <Text style={styles.eventsCount}>{filteredEvents.length} {t('eventos disponibles', 'available events')}</Text>
      </View>

      {filteredEvents.length === 0 && (
        <View style={styles.emptyEvents}>
          <Text style={styles.emptyEventsText}>
            {events.length === 0
              ? t('Cargando eventos...', 'Loading events...')
              : t('No hay eventos que coincidan con tu búsqueda.', 'No events match your search.')}
          </Text>
        </View>
      )}

      {filteredEvents.map((event) => (
        <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => onOpenEvent(event)}>
          <View style={styles.eventPoster}>
            <Image source={getPosterImageSource(event)} style={styles.eventPosterImage} resizeMode="cover" />
            <View style={styles.posterShade} />
            <View style={styles.privateBadge}><Text style={styles.privateBadgeText}>● {event.tag}</Text></View>
            <View style={styles.featuredBadge}><Text style={styles.featuredText}>{t('DESTACADO', 'FEATURED')}</Text></View>
          </View>
          <View style={styles.eventInfo}>
            <Text style={styles.eventName} numberOfLines={2}>{event.title}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={15} color="#F97316" />
              <Text style={styles.eventMeta} numberOfLines={1}>{event.date}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={15} color="#F97316" />
              <View style={styles.metaCol}>
                <Text style={styles.eventMeta} numberOfLines={1}>{event.venue}</Text>
                {!!event.address && <Text style={styles.eventAddress} numberOfLines={1}>{event.address}</Text>}
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.metaRow}>
              <Ionicons name="pricetag-outline" size={15} color="#F97316" />
              <Text style={styles.price}>{t('Desde', 'From')} {event.price}</Text>
            </View>
            <View style={styles.ctaRow}>
              <TouchableOpacity style={styles.shareButton}><Ionicons name="share-social-outline" size={20} color="#FFFFFF" /></TouchableOpacity>
              <GradientButton
                onPress={() => onOpenEvent(event)}
                height={56}
                style={styles.buyButton}
                textStyle={styles.buyText}
                label={t('COMPRAR TICKETS', 'BUY TICKETS')}
              />
            </View>
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.footerGap}>
        <AppFooter />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchPanelGlow: { position: 'absolute', top: 0, left: 46, right: 46, height: 1, borderRadius: 999, backgroundColor: 'rgba(249,115,22,0.16)', shadowColor: '#F97316', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 0 }, elevation: 1 },
  orangeButtonTop: { position: 'absolute', top: 4, left: 14, right: 14, height: 1.5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.26)', zIndex: 2 },
  orangeButtonBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%', backgroundColor: 'rgba(154,52,18,0.22)', zIndex: 1 },
  footerGap: { marginTop: 44 },
  screen: { flex: 1, backgroundColor: '#030B14' },
  bgBaseLayer: { position: 'absolute', left: 0, right: 0, top: 0, height: 1600, backgroundColor: '#030B14' },
  bgAccentOrange: { position: 'absolute', left: -140, top: -120, width: 380, height: 380, borderRadius: 190, backgroundColor: 'transparent' },
  bgAccentBlue: { position: 'absolute', right: -150, top: -80, width: 400, height: 400, borderRadius: 200, backgroundColor: 'transparent' },
  bgGridA: { position: 'absolute', left: 0, right: 0, top: 0, height: 1600, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.026)' },
  bgGridB: { position: 'absolute', left: '25%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.022)' },
  content: { paddingTop: 72, paddingBottom: 46, backgroundColor: '#030B14' },
  heroWrap: { marginHorizontal: 16, marginTop: 12, marginBottom: 0, height: 320, overflow: 'hidden', backgroundColor: '#081F33', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 18, shadowColor: '#000000', shadowOpacity: 0.30, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  heroImage: { width: '100%', height: '100%', backgroundColor: '#081F33' },
  heroArrow: { position: 'absolute', top: '50%', transform: [{ translateY: -22 }], width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  heroLeft: { left: 14 },
  heroRight: { right: 14 },
  heroArrowText: { color: 'rgba(255,255,255,0.90)', fontSize: 36, lineHeight: 36, fontWeight: '300' },
  heroAgeBadge: { position: 'absolute', top: 12, right: 12, minWidth: 34, height: 34, borderRadius: 17, paddingHorizontal: 7, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  heroAgeText: { color: '#0A375A', fontSize: 12, fontWeight: '900' },
  searchPanel: { marginHorizontal: 16, marginTop: -28, zIndex: 20, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(139,154,174,0.26)', padding: 16, gap: 12, overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.38, shadowRadius: 28, shadowOffset: { width: 0, height: 18 }, elevation: 10 },
  searchAccentLine: { position: 'absolute', top: 0, left: 38, right: 38, height: 2, borderRadius: 999 },
  field: { minHeight: 57, borderWidth: 1, borderColor: 'rgba(139,154,174,0.26)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', gap: 5 },
  fieldLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  fieldInput: { flex: 1, fontSize: 15, color: '#FFFFFF', fontWeight: '500', outlineStyle: 'none' as any, padding: 0 },
  searchText: { fontSize: 13, letterSpacing: 2.8 },
  categoryRow: { paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' },
  categoryScroll: { gap: 11, paddingRight: 8, paddingVertical: 3 },
  catCard: { width: 118, height: 118, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,107,0,0.34)', backgroundColor: '#030914' },
  catCardActive: { borderColor: 'rgba(255,107,0,0.72)' },
  catImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.72 },
  catOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2,5,9,0.22)' },
  catShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%', backgroundColor: 'rgba(2,5,9,0.62)' },
  catGlow: { position: 'absolute', top: -22, left: -22, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,107,0,0.30)' },
  catContent: { position: 'absolute', left: 11, right: 11, bottom: 11, gap: 3 },
  catIcon: { fontSize: 16, color: '#ff8a1c', marginBottom: 1 },
  catTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', lineHeight: 15 },
  catDesc: { color: 'rgba(255,255,255,0.74)', fontSize: 9.5, fontWeight: '700', lineHeight: 12 },
  emptyEvents: { marginHorizontal: 16, marginTop: 24, padding: 22, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  emptyEventsText: { color: 'rgba(226,232,240,0.72)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  category: { height: 42, minWidth: 94, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(246,198,95,0.14)', backgroundColor: 'rgba(255,255,255,0.055)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  categoryActive: { borderColor: 'rgba(249,115,22,0.65)', backgroundColor: 'rgba(249,115,22,0.18)' },
  categoryArrow: { minWidth: 34, width: 34 },
  categoryText: { color: '#E5E7EB', fontSize: 14, fontWeight: '900' },
  categoryTextActive: { color: '#FFFFFF', fontWeight: '900' },
  categoryDot: { position: 'absolute', right: 12, top: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, shadowColor: colors.orange, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  sortButton: { marginBottom: 8 },
  sortText: { fontSize: 12.5, letterSpacing: 2.2 },
  trustList: { paddingHorizontal: 16, marginTop: 34, gap: 14 },
  trustCard: { backgroundColor: 'rgba(255,255,255,0.020)', borderWidth: 1, borderColor: 'rgba(246,198,95,0.10)', borderRadius: 12, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 16 },
  trustIcon: { width: 46, height: 46, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.10)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.32)', alignItems: 'center', justifyContent: 'center' },
  trustIconText: { color: colors.orange, fontWeight: '400', fontSize: 19 },
  trustTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '500' },
  trustSubtitle: { color: 'rgba(203,213,225,0.76)', fontSize: 14, fontWeight: '400', marginTop: 2 },
  highlights: { paddingHorizontal: 16, marginTop: 46 },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3.2, fontWeight: '500', marginBottom: 12 },
  eventsTitle: { color: '#FFFFFF', fontSize: 32, lineHeight: 36, fontWeight: '700' },
  eventsCount: { color: 'rgba(203,213,225,0.72)', fontSize: 16, fontWeight: '400', marginTop: 12 },
  eventCard: { marginHorizontal: 16, marginTop: 28, backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(246,198,95,0.18)' },
  eventPoster: { width: '100%', aspectRatio: 3 / 4, position: 'relative', backgroundColor: 'rgba(255,255,255,0.012)' },
  eventPosterImage: { width: '100%', height: '100%' },
  posterShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,24,44,0.12)' },
  privateBadge: { position: 'absolute', top: 16, left: 14, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  privateBadgeText: { color: colors.navy, fontSize: 12, fontWeight: '500', letterSpacing: 1 },
  featuredBadge: { position: 'absolute', top: 16, right: 14, backgroundColor: colors.orange, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, shadowColor: colors.orange, shadowOpacity: 0.34, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  featuredText: { color: colors.white, fontSize: 12, fontWeight: '600', letterSpacing: 1.2 },
  plusBadge: { position: 'absolute', top: 76, right: 24, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#8B1E24', fontSize: 20, fontWeight: '800' },
  mockPosterText: { position: 'absolute', left: 18, right: 18, bottom: 34, alignItems: 'center' },
  mockVenue: { color: colors.white, fontSize: 34, fontWeight: '800', letterSpacing: 2.2 },
  mockEvent: { color: colors.white, fontSize: 22, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  mockLine: { color: colors.white, fontSize: 15, fontWeight: '800', marginTop: 18, letterSpacing: 2 },
  eventInfo: { padding: 18, backgroundColor: 'rgba(255,255,255,0.016)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' },
  eventName: { color: '#F8FAFC', fontSize: 21, fontWeight: '700', lineHeight: 25, marginBottom: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  metaCol: { flex: 1 },
  eventMeta: { color: '#F97316', fontSize: 15, fontWeight: '500' },
  eventAddress: { color: 'rgba(226,232,240,0.55)', fontSize: 13, fontWeight: '400', marginTop: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.22)', marginVertical: 20 },
  price: { color: '#F8FAFC', fontSize: 20, fontWeight: '600' },
  ctaRow: { flexDirection: 'row', gap: 14, marginTop: 22 },
  shareButton: { width: 56, height: 56, borderRadius: 8, backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(249,115,22,0.62)', alignItems: 'center', justifyContent: 'center' },
  shareText: { color: colors.white, fontSize: 26, fontWeight: '400' },
  buyButton: { flex: 1 },
  buyText: { fontSize: 12.5, letterSpacing: 2.4 },
});
