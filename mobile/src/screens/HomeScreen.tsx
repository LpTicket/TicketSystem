import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { mockEvents } from '../data/mockEvents';
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

const trustItems = [
  { icon: '▣', title: 'Secure payments', subtitle: 'Processed by Stripe' },
  { icon: '♢', title: 'Verified tickets', subtitle: 'Protected digital entry' },
  { icon: '⌗', title: 'Unique QR', subtitle: 'Fast door validation' },
  { icon: '◎', title: 'Support available', subtitle: 'Before and after purchase' },
];

export function HomeScreen({ onOpenEvent }: Props) {
  const { t } = useLanguage();
  const [events, setEvents] = useState<MobileEvent[]>(mockEvents);
  const [heroIndex, setHeroIndex] = useState(0);
  const [nextHeroIndex, setNextHeroIndex] = useState(0);
  const heroEvents = useMemo(() => events.filter((event) => event.bannerImageUrl || event.imageUrl), [events]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const safeHeroLength = Math.max(heroEvents.length, 1);
  const heroEvent = heroEvents[heroIndex % safeHeroLength] || events[0];
  const nextHeroEvent = heroEvents[nextHeroIndex % safeHeroLength] || heroEvent;

  useEffect(() => {
    let mounted = true;

    getPublicEvents()
      .then((items) => {
        if (mounted && items.length > 0) setEvents(items);
      })
      .catch(() => {
        if (mounted) setEvents(mockEvents);
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
    setNextHeroIndex(nextIndex);
    fadeAnim.setValue(0);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 720,
      useNativeDriver: true,
    }).start(() => {
      setHeroIndex(nextIndex);
      fadeAnim.setValue(0);
    });
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
        <Image source={getHeroImageSource(heroEvent)} style={styles.heroImage} resizeMode="contain" />

        <Animated.Image source={getHeroImageSource(nextHeroEvent)} style={[styles.heroImage, styles.heroImageOverlay, { opacity: fadeAnim }]} resizeMode="contain" />
        <View style={styles.heroOverlay} />
        <TouchableOpacity style={[styles.heroArrow, styles.heroLeft]} onPress={goPrevHero}><Text style={styles.heroArrowText}>‹</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.heroArrow, styles.heroRight]} onPress={goNextHero}><Text style={styles.heroArrowText}>›</Text></TouchableOpacity>
        <View style={styles.heroDots}>
          {heroEvents.map((event, index) => (
            <View key={event.id} style={[styles.heroDot, index === heroIndex % heroEvents.length && styles.heroDotActive]} />
          ))}
        </View>
      </View>

      <View style={styles.searchPanel}>
        <View pointerEvents="none" style={styles.searchPanelGlow} />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('BUSCAR EVENTO', 'SEARCH EVENT')}</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>⌕</Text>
            <TextInput placeholder={t('Conciertos, teatro, talleres...', 'Concerts, theater, workshops...')} placeholderTextColor="#8B95A3" style={styles.fieldInput} />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('LUGAR', 'PLACE')}</Text>
          <View style={styles.fieldRow}>
            <Text style={styles.fieldIcon}>⌖</Text>
            <TextInput placeholder={t('Ciudad o venue', 'City or venue')} placeholderTextColor="#8B95A3" style={styles.fieldInput} />
          </View>
        </View>
        <TouchableOpacity style={styles.searchButton}>
          <View pointerEvents="none" style={styles.orangeButtonTop} />
          <View pointerEvents="none" style={styles.orangeButtonBottom} />
          <Text style={styles.searchText}>{t('BUSCAR', 'SEARCH')}</Text>
        </TouchableOpacity>

        <View style={styles.categoryRow}>
          {['‹', 'All', 'Concert', 'Private', '›'].map((item, index) => (
            <TouchableOpacity key={item} style={[styles.category, item === 'All' && styles.categoryActive, (index === 0 || index === 4) && styles.categoryArrow]}>
              <Text style={[styles.categoryText, item === 'All' && styles.categoryTextActive]}>{item}</Text>
              {item === 'All' && <View style={styles.categoryDot} />}
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.sortButton}>
          <View pointerEvents="none" style={styles.orangeButtonTop} />
          <View pointerEvents="none" style={styles.orangeButtonBottom} />
          <Text style={styles.sortText}>{t('ORDENAR POR', 'SORT BY')} ▼</Text>
        </TouchableOpacity>
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
        <Text style={styles.eventsCount}>{events.length} available events</Text>
      </View>

      {events.map((event) => (
        <TouchableOpacity key={event.id} style={styles.eventCard} onPress={() => onOpenEvent(event)}>
          <View style={styles.eventPoster}>
            <Image source={getPosterImageSource(event)} style={styles.eventPosterImage} resizeMode="contain" />
            <View style={styles.posterShade} />
            <View style={styles.privateBadge}><Text style={styles.privateBadgeText}>● {event.tag}</Text></View>
            <View style={styles.featuredBadge}><Text style={styles.featuredText}>{t('DESTACADO', 'FEATURED')}</Text></View>
          </View>
          <View style={styles.eventInfo}>
            <Text style={styles.eventName}>{event.title}</Text>
            <Text style={styles.eventMeta}>▣ {event.date}</Text>
            <Text style={styles.eventMeta}>⌖ {event.venue}</Text>
            <Text style={styles.eventAddress}>{event.address}</Text>
            <View style={styles.divider} />
            <Text style={styles.price}>◇ From {event.price}</Text>
            <View style={styles.ctaRow}>
              <TouchableOpacity style={styles.shareButton}><Text style={styles.shareText}>⌯</Text></TouchableOpacity>
              <TouchableOpacity style={styles.buyButton} onPress={() => onOpenEvent(event)}>
                <View pointerEvents="none" style={styles.orangeButtonTop} />
                <View pointerEvents="none" style={styles.orangeButtonBottom} />
                <Text style={styles.buyText}>{t('COMPRAR TICKETS', 'BUY TICKETS')}</Text>
              </TouchableOpacity>
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
  heroWrap: { marginHorizontal: 16, marginTop: 12, marginBottom: 0, height: 205, overflow: 'hidden', backgroundColor: '#081F33', borderWidth: 1, borderColor: 'rgba(246,198,95,0.14)', borderRadius: 14, shadowColor: '#000000', shadowOpacity: 0.24, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  heroImage: { width: '100%', height: '100%', backgroundColor: '#081F33' },
  heroImageOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  heroOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,24,44,0.42)' },
  heroArrow: { position: 'absolute', top: '50%', transform: [{ translateY: -22 }], width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.025)', alignItems: 'center', justifyContent: 'center' },
  heroLeft: { left: 14 },
  heroRight: { right: 14 },
  heroArrowText: { color: 'rgba(255,255,255,0.90)', fontSize: 36, lineHeight: 36, fontWeight: '300' },
  heroDots: { position: 'absolute', left: 0, right: 0, bottom: 16, flexDirection: 'row', justifyContent: 'center', gap: 7 },
  heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.42)' },
  heroDotActive: { width: 22, backgroundColor: '#F97316' },
  searchPanel: { marginHorizontal: 16, marginTop: 15, backgroundColor: 'rgba(255,255,255,0.025)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.18)', borderTopColor: 'rgba(249,115,22,0.18)', padding: 16, paddingTop: 18, paddingBottom: 26, gap: 12, overflow: 'hidden' },
  field: { minHeight: 58, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.020)' },
  fieldLabel: { color: 'rgba(255,255,255,0.86)', fontSize: 10, fontWeight: '900', letterSpacing: 0, marginBottom: 8 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fieldIcon: { color: '#F97316', fontSize: 22, fontWeight: '400' },
  fieldInput: { flex: 1, fontSize: 16, color: 'rgba(255,255,255,0.78)', fontWeight: '400', outlineStyle: 'none' as any },
  searchButton: { height: 58, borderRadius: 8, position: 'relative', overflow: 'hidden', backgroundColor: '#F97316', borderWidth: 0, alignItems: 'center', justifyContent: 'center', shadowColor: '#F97316', shadowOpacity: 0.20, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  searchText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 4.2, zIndex: 3 },
  categoryRow: { paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)', flexDirection: 'row', gap: 8 },
  category: { height: 42, minWidth: 94, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(246,198,95,0.14)', backgroundColor: 'rgba(255,255,255,0.055)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  categoryActive: { borderColor: 'rgba(249,115,22,0.65)', backgroundColor: 'rgba(249,115,22,0.18)' },
  categoryArrow: { minWidth: 34, width: 34 },
  categoryText: { color: '#E5E7EB', fontSize: 14, fontWeight: '900' },
  categoryTextActive: { color: '#FFFFFF', fontWeight: '900' },
  categoryDot: { position: 'absolute', right: 12, top: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, shadowColor: colors.orange, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  sortButton: { height: 58, borderRadius: 8, marginBottom: 8, position: 'relative', overflow: 'hidden', backgroundColor: '#F97316', borderWidth: 0, alignItems: 'center', justifyContent: 'center', shadowColor: '#F97316', shadowOpacity: 0.20, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  sortText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', letterSpacing: 3.8, zIndex: 3 },
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
  eventPoster: { width: '100%', aspectRatio: 4 / 5, position: 'relative', backgroundColor: 'rgba(255,255,255,0.012)' },
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
  eventName: { color: '#F8FAFC', fontSize: 21, fontWeight: '600', marginBottom: 22 },
  eventMeta: { color: '#F97316', fontSize: 16, fontWeight: '400', marginTop: 8 },
  eventAddress: { color: 'rgba(226,232,240,0.58)', fontSize: 15, fontWeight: '400', marginTop: 3, paddingLeft: 22 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.22)', marginVertical: 20 },
  price: { color: '#F8FAFC', fontSize: 20, fontWeight: '600' },
  ctaRow: { flexDirection: 'row', gap: 14, marginTop: 22 },
  shareButton: { width: 56, height: 56, borderRadius: 8, backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(249,115,22,0.62)', alignItems: 'center', justifyContent: 'center' },
  shareText: { color: colors.white, fontSize: 26, fontWeight: '400' },
  buyButton: { flex: 1, height: 56, borderRadius: 8, position: 'relative', overflow: 'hidden', backgroundColor: '#F97316', borderWidth: 0, alignItems: 'center', justifyContent: 'center', shadowColor: '#F97316', shadowOpacity: 0.20, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  buyText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 4.0, zIndex: 3 },
});
