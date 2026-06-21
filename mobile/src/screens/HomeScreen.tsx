import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Keyboard, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Polygon } from 'react-native-svg';
import { EventCardSkeleton } from '../components/Skeleton';
import { GradientButton } from '../components/GradientButton';
import { getPublicEvents } from '../services/events';
import { apiGet, getImageUrl } from '../services/api';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileEvent } from '../types/event';
import { AppFooter } from '../components/AppFooter';

const fallbackHeroLogo = require('../../assets/logo-header.png');
const fallbackEventImage = require('../../assets/demo-concert.png');
const CATEGORY_CARD_WIDTH = 85;
const CATEGORY_CARD_GAP = 11;
const HERO_PROGRESS_STEP = 15;
const HERO_PROGRESS_ACTIVE_WIDTH = 16;
const HERO_PROGRESS_DOT_WIDTH = 7;

type Props = {
  onOpenEvent: (event: MobileEvent) => void;
};

type ApiCategory = {
  id?: string;
  slug?: string;
  labelEs?: string;
  labelEn?: string;
  subtitleEs?: string | null;
  subtitleEn?: string | null;
  imageData?: string | null;
  imageUrl?: string | null;
  isActive?: boolean;
};

type HomeCategory = {
  id: string;
  slug: string;
  label: string;
  subtitle: string;
  imageUrl: string;
};

function getHeroImageSource(event?: MobileEvent) {
  const imageUrl = event?.bannerImageUrl || event?.imageUrl;
  return imageUrl ? { uri: imageUrl } : fallbackHeroLogo;
}

function getHeroImageUrl(event?: MobileEvent) {
  return event?.bannerImageUrl || event?.imageUrl || '';
}

function getPosterImageSource(event?: MobileEvent) {
  const imageUrl = event?.imageUrl || event?.bannerImageUrl;
  return imageUrl ? { uri: imageUrl } : fallbackEventImage;
}

function SharePointIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Polygon points="8,11 17,6 18,8 9,13" fill="#FFFFFF" />
      <Polygon points="8,13 18,17 17,19 7,15" fill="#FFFFFF" />
      <Circle cx={7} cy={13} r={2.4} fill="#030B14" stroke="#FFFFFF" strokeWidth={1.8} />
      <Circle cx={18} cy={7} r={2.4} fill="#030B14" stroke="#FFFFFF" strokeWidth={1.8} />
      <Circle cx={18} cy={18} r={2.4} fill="#030B14" stroke="#FFFFFF" strokeWidth={1.8} />
    </Svg>
  );
}

function categoryDesc(item: string, t: (es: string, en: string) => string) {
  const s = item.toLowerCase();
  if (item === 'All') return t('Explora todo ahora.', 'Explore everything now.');
  if (/concert|concierto|music|música|musica|festival/.test(s)) return t('Música en vivo y shows.', 'Live music and shows.');
  if (/sport|deporte|partido/.test(s)) return t('Vive cada partido.', 'Feel every game.');
  if (/comed/.test(s)) return t('Risas y buen ambiente.', 'Laughs and good energy.');
  if (/theat|teatro|arte|art|show/.test(s)) return t('Escena, arte y cultura.', 'Stage, art, and culture.');
  if (/infantil|kids/.test(s)) return t('Planes para toda la familia.', 'Family-friendly plans.');
  if (/network|negocio|business|vip|conf|conferencia/.test(s)) return t('Experiencias para conectar.', 'Experiences to connect.');
  return t('Eventos seleccionados.', 'Curated events.');
}

function normalizeCategory(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function eventMatchesCategory(event: MobileEvent, categorySlug: string) {
  const selected = normalizeCategory(categorySlug);
  return [event.category, event.categoryName, event.tag].some((value) => normalizeCategory(value) === selected);
}

export function HomeScreen({ onOpenEvent }: Props) {
  const { lang, t } = useLanguage();
  const { width } = useWindowDimensions();
  const [events, setEvents] = useState<MobileEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [realCategories, setRealCategories] = useState<ApiCategory[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [previousHeroIndex, setPreviousHeroIndex] = useState<number | null>(null);
  const [heroTransitionReady, setHeroTransitionReady] = useState(false);
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState('');
  const [category, setCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'date' | 'price'>('date');
  const [sortOpen, setSortOpen] = useState(false);
  const [shiningCategory, setShiningCategory] = useState('All');
  const categoryShine = useRef(new Animated.Value(0)).current;
  const categoryImageScale = useRef(new Animated.Value(1.12)).current;
  const categoryFrameX = useRef(new Animated.Value(0)).current;
  const heroFade = useRef(new Animated.Value(1)).current;
  const heroProgressX = useRef(new Animated.Value(0)).current;
  const eventSearchPlaceholder = t('Conciertos, teatro, talleres...', 'Concerts, theater, workshops...') || (lang === 'es' ? 'Conciertos, teatro, talleres...' : 'Concerts, theater, workshops...');
  const placeSearchPlaceholder = t('Ciudad o venue', 'City or venue') || (lang === 'es' ? 'Ciudad o venue' : 'City or venue');

  const trustItems: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }[] = [
    { icon: 'card-outline', title: t('Pagos seguros', 'Secure payments'), subtitle: t('Procesado por Stripe.', 'Processed by Stripe') },
    { icon: 'shield-checkmark-outline', title: t('Tickets verificados', 'Verified tickets'), subtitle: t('Entrada digital protegida.', 'Protected digital entry') },
    { icon: 'qr-code-outline', title: t('QR único', 'Unique QR'), subtitle: t('Validación rápida en puerta.', 'Fast door validation') },
    { icon: 'help-buoy-outline', title: t('Soporte disponible', 'Support available'), subtitle: t('Antes y después de tu compra.', 'Before and after purchase') },
  ];

  const heroEvents = useMemo(() => events.filter((event) => event.bannerImageUrl || event.imageUrl), [events]);
  const safeHeroLength = Math.max(heroEvents.length, 1);
  const heroEvent = heroEvents[heroIndex % safeHeroLength] || events[0];
  const previousHeroEvent = previousHeroIndex !== null ? heroEvents[previousHeroIndex % safeHeroLength] || events[0] : undefined;
  const heroHeight = Math.max(120, Math.round((width - 32) / 2.63));
  const heroProgressTrackWidth = HERO_PROGRESS_ACTIVE_WIDTH + (safeHeroLength - 1) * HERO_PROGRESS_STEP;
  const heroProgressWidth = Math.max(78, heroProgressTrackWidth + 16);

  const categories = useMemo<HomeCategory[]>(() => {
    const allCategory = realCategories.find((item) => item.slug === 'todos' || item.slug === 'todas');
    const activeCategories = realCategories.filter((item) => item.slug && item.slug !== 'todos' && item.slug !== 'todas' && item.isActive !== false);
    const liveCategories = activeCategories.map((item) => ({
      id: item.id || item.slug || item.labelEs || item.labelEn || 'category',
      slug: item.slug || item.labelEs || item.labelEn || 'category',
      label: lang === 'es' ? item.labelEs || item.labelEn || item.slug || '' : item.labelEn || item.labelEs || item.slug || '',
      subtitle: lang === 'es'
        ? item.subtitleEs || item.subtitleEn || categoryDesc(item.slug || item.labelEs || '', t)
        : item.subtitleEn || item.subtitleEs || categoryDesc(item.slug || item.labelEn || '', t),
      imageUrl: getImageUrl(item.imageUrl || item.imageData || ''),
    }));

    return [
      {
        id: 'all',
        slug: 'All',
        label: t('Todos', 'All'),
        subtitle: categoryDesc('All', t),
        imageUrl: getImageUrl(allCategory?.imageUrl || allCategory?.imageData || ''),
      },
      ...liveCategories,
    ];
  }, [lang, realCategories, t]);
  const categoryShineX = categoryShine.interpolate({
    inputRange: [0, 1],
    outputRange: [-50, 50],
  });
  const categoryShineOpacity = categoryShine.interpolate({
    inputRange: [0, 0.08, 1],
    outputRange: [0, 1, 1],
  });
  const activeCategoryIndex = Math.max(0, categories.findIndex((item) => item.slug === category));

  useEffect(() => {
    Animated.spring(categoryFrameX, {
      toValue: activeCategoryIndex * (CATEGORY_CARD_WIDTH + CATEGORY_CARD_GAP),
      damping: 18,
      stiffness: 170,
      mass: 0.72,
      useNativeDriver: true,
    }).start();
  }, [activeCategoryIndex, categoryFrameX]);

  useEffect(() => {
    Animated.spring(heroProgressX, {
      toValue: (heroIndex % safeHeroLength) * HERO_PROGRESS_STEP,
      damping: 20,
      stiffness: 130,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [heroIndex, heroProgressX, safeHeroLength]);

  const playCategoryShine = (item: string) => {
    categoryShine.stopAnimation();
    categoryImageScale.stopAnimation();
    setShiningCategory(item);
    categoryShine.setValue(0);
    categoryImageScale.setValue(1.02);
    Animated.timing(categoryShine, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    Animated.timing(categoryImageScale, {
      toValue: 1.12,
      duration: 360,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleCategoryPress = (item: HomeCategory) => {
    setCategory(item.slug);
    playCategoryShine(item.slug);
  };

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    const p = place.trim().toLowerCase();
    const list = events.filter((e) => {
      const matchesQuery = !q || [e.title, e.venue, e.address, e.tag, e.categoryName, e.category].some((v) => (v || '').toLowerCase().includes(q));
      const matchesPlace = !p || [e.venue, e.address].some((v) => (v || '').toLowerCase().includes(p));
      const matchesCategory = category === 'All' || eventMatchesCategory(e, category);
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
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    apiGet<ApiCategory[]>('/categories')
      .then((categoryItems) => {
        if (mounted) setRealCategories(Array.isArray(categoryItems) ? categoryItems : []);
      })
      .catch(() => {
        if (mounted) setRealCategories([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (category === 'All') return;
    if (!categories.some((item) => item.slug === category)) setCategory('All');
  }, [categories, category]);

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
    if (normalizedIndex === heroIndex) return;
    const nextEvent = heroEvents[normalizedIndex];
    const nextImageUrl = getHeroImageUrl(nextEvent);

    const startTransition = () => {
      heroFade.stopAnimation();
      setPreviousHeroIndex(heroIndex);
      setHeroTransitionReady(false);
      heroFade.setValue(0);
      setHeroIndex(normalizedIndex);
    };

    if (nextImageUrl) {
      Image.prefetch(nextImageUrl)
        .catch(() => false)
        .finally(startTransition);
    } else {
      startTransition();
    }
  };

  const finishHeroImageLoad = () => {
    if (previousHeroIndex === null || heroTransitionReady) return;

    setHeroTransitionReady(true);
    Animated.timing(heroFade, {
      toValue: 1,
      duration: 950,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPreviousHeroIndex(null);
    });
  };

  const goNextHero = () => {
    if (heroEvents.length <= 1) return;
    changeHero((heroIndex + 1) % heroEvents.length);
  };

  const trustSection = (
    <View style={styles.trustStrip}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(17,26,39,0.88)', 'rgba(7,14,23,0.94)']}
        style={StyleSheet.absoluteFill}
      />
      {trustItems.map((item, index) => (
        <View key={`${item.title}-${index}`} style={styles.trustRow}>
          <View style={styles.trustIcon}>
            <Ionicons name={item.icon} size={17} color="#ff7a00" />
          </View>
          <View style={styles.trustCopy}>
            <Text style={styles.trustTitle}>{item.title}</Text>
            <Text style={styles.trustSubtitle}>{item.subtitle}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.root}>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View pointerEvents="none" style={styles.bgBaseLayer} />
      <View pointerEvents="none" style={styles.bgAccentOrange} />
      <View pointerEvents="none" style={styles.bgAccentBlue} />
      <View pointerEvents="none" style={styles.bgGridA} />
      <View pointerEvents="none" style={styles.bgGridB} />
      <View style={[styles.heroWrap, { height: heroHeight }]}>
        {previousHeroEvent && (
          <Image source={getHeroImageSource(previousHeroEvent)} style={[styles.heroImage, !getHeroImageUrl(previousHeroEvent) && styles.heroFallbackLogo]} resizeMode="contain" />
        )}
        <Animated.Image
          source={getHeroImageSource(heroEvent)}
          style={[styles.heroImage, !getHeroImageUrl(heroEvent) && styles.heroFallbackLogo, previousHeroEvent && styles.heroImageLayer, { opacity: previousHeroEvent ? heroFade : 1 }]}
          resizeMode="contain"
          onLoad={finishHeroImageLoad}
          onError={finishHeroImageLoad}
        />
      </View>

      <View style={styles.heroControls}>
        <TouchableOpacity style={styles.heroControlButton} onPress={goPrevHero}>
          <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={[styles.heroProgressRail, { width: heroProgressWidth }]}>
          <View style={[styles.heroProgressTrack, { width: heroProgressTrackWidth }]}>
            <Animated.View pointerEvents="none" style={[styles.heroProgressNodeActive, { transform: [{ translateX: heroProgressX }] }]} />
            {Array.from({ length: safeHeroLength }).map((_, index) => (
              <TouchableOpacity
                key={index}
                activeOpacity={0.8}
                onPress={() => changeHero(index)}
                style={[styles.heroProgressNode, { left: index * HERO_PROGRESS_STEP + (HERO_PROGRESS_ACTIVE_WIDTH - HERO_PROGRESS_DOT_WIDTH) / 2 }]}
              />
            ))}
          </View>
        </View>
        <TouchableOpacity style={styles.heroControlButton} onPress={goNextHero}>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchPanel}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.018)', 'rgba(255,255,255,0.018)']}
          style={[StyleSheet.absoluteFill, { borderRadius: 16 }]}
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
            <TextInput key={`home-query-${lang}`} value={query} onChangeText={setQuery} placeholder={eventSearchPlaceholder} placeholderTextColor="rgba(248,250,252,0.62)" style={styles.fieldInput} />
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('LUGAR', 'PLACE')}</Text>
          <View style={styles.fieldRow}>
            <Ionicons name="location-outline" size={18} color="#ff7a00" />
            <TextInput key={`home-place-${lang}`} value={place} onChangeText={setPlace} placeholder={placeSearchPlaceholder} placeholderTextColor="rgba(248,250,252,0.62)" style={styles.fieldInput} />
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
            {categories.map((item, index) => {
              const active = category === item.slug;
              const match = item.slug === 'All'
                ? undefined
                : events.find((e) => eventMatchesCategory(e, item.slug) && (e.imageUrl || e.bannerImageUrl));
              const img = item.imageUrl || match?.imageUrl || match?.bannerImageUrl || '';
              return (
                <TouchableOpacity key={`${item.id || item.slug || item.label || 'category'}-${index}`} activeOpacity={0.85} onPress={() => handleCategoryPress(item)} style={[styles.catCard, active && styles.catCardActive]}>
                  <Animated.Image
                    source={img ? { uri: img } : fallbackEventImage}
                    style={[styles.catImage, active && styles.catImageActive, active && { transform: [{ scale: categoryImageScale }] }]}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(3,11,20,0.10)', 'rgba(3,11,20,0.42)', 'rgba(3,11,20,0.96)']}
                    locations={[0, 0.42, 1]}
                    style={StyleSheet.absoluteFill}
                  />
                  {shiningCategory === item.slug && (
                    <Animated.View
                      pointerEvents="none"
                      style={[
                        styles.catShine,
                        {
                          opacity: categoryShineOpacity,
                          transform: [{ translateX: categoryShineX }],
                        },
                      ]}
                    >
                      <LinearGradient
                        colors={['rgba(255,255,255,0)', 'rgba(255,236,181,0.18)', 'rgba(255,255,255,0)']}
                        locations={[0, 0.44, 0.58]}
                        start={{ x: 0, y: 0.16 }}
                        end={{ x: 1, y: 0.84 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </Animated.View>
                  )}
                  <View style={styles.catContent}>
                    <Text style={styles.catTitle} numberOfLines={2}>{item.label}</Text>
                    <Text style={styles.catDesc} numberOfLines={1}>{item.subtitle || categoryDesc(item.slug, t)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            <Animated.View
              pointerEvents="none"
              style={[styles.catSelectionFrame, { transform: [{ translateX: categoryFrameX }] }]}
            />
          </ScrollView>
        </View>
        <GradientButton
          onPress={() => setSortOpen((open) => !open)}
          height={58}
          style={styles.sortButton}
          textStyle={styles.sortText}
          label={`${t('ORDENAR POR', 'SORT BY')}  ▼`}
        />
        {sortOpen && (
          <View style={styles.sortMenu}>
            <View style={styles.sortMenuHeader}>
              <Text style={styles.sortMenuHeaderText}>{t('ORDENAR POR', 'SORT BY')}</Text>
            </View>
            <TouchableOpacity
              onPress={() => { setSortBy('date'); setSortOpen(false); }}
              style={[styles.sortOption, sortBy === 'date' && styles.sortOptionActive]}
            >
              <Text style={[styles.sortOptionText, sortBy === 'date' && styles.sortOptionTextActive]}>📅 {t('Fecha', 'Date')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setSortBy('price'); setSortOpen(false); }}
              style={[styles.sortOption, sortBy === 'price' && styles.sortOptionActive]}
            >
              <Text style={[styles.sortOptionText, sortBy === 'price' && styles.sortOptionTextActive]}>💰 {t('Precio', 'Price')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.highlights}>
        <Text style={styles.eyebrow}>{t('DESTACADOS', 'HIGHLIGHTS')}</Text>
        <Text style={styles.eventsTitle}>{t('Eventos cerca de ti', 'Events near you')}</Text>
        <Text style={styles.eventsCount}>{filteredEvents.length} {t('eventos disponibles', 'available events')}</Text>
      </View>

      {loading && events.length === 0 ? (
        <>
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </>
      ) : filteredEvents.length === 0 ? (
        <View style={styles.emptyEvents}>
          <Text style={styles.emptyEventsText}>
            {t('No hay eventos que coincidan con tu búsqueda.', 'No events match your search.')}
          </Text>
        </View>
      ) : null}

      {!loading && filteredEvents.map((event, index) => (
        <TouchableOpacity key={`${event.id || event.slug || event.title || 'event'}-${index}`} style={styles.eventCard} onPress={() => onOpenEvent(event)}>
          <View style={styles.eventPoster}>
            <Image source={getPosterImageSource(event)} style={styles.eventPosterImage} resizeMode="cover" />
            <View style={styles.posterShade} />
            <View style={styles.privateBadge}><Text style={styles.privateBadgeText}>● {event.tag}</Text></View>
            <View style={styles.featuredBadge}>
              <LinearGradient
                colors={['#ff8a18', '#f46c00', '#c93f00']}
                locations={[0, 0.46, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={styles.featuredShine}>
                <LinearGradient
                  colors={['rgba(255,235,205,0)', 'rgba(255,235,205,0.85)', 'rgba(255,235,205,0)']}
                  locations={[0, 0.5, 1]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <Text style={styles.featuredText}>{t('DESTACADO', 'FEATURED')}</Text>
            </View>
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
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => Share.share({
                  title: event.title,
                  message: `${event.title} — ${event.date}\n${event.venue}\n\nhttps://lpticket.com/events/${event.slug || event.id}`,
                })}
              >
                <SharePointIcon />
              </TouchableOpacity>
              <GradientButton
                onPress={() => onOpenEvent(event)}
                height={56}
                style={styles.buyButton}
                textStyle={styles.buyText}
                label={t('VER EVENTO', 'VIEW EVENT')}
              />
            </View>
          </View>
        </TouchableOpacity>
      ))}

      {trustSection}

      <View style={styles.footerGap}>
        <AppFooter />
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  searchPanelGlow: { position: 'absolute', top: 0, left: 46, right: 46, height: 1, borderRadius: 999, backgroundColor: 'rgba(249,115,22,0.16)', shadowColor: '#F97316', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 0 }, elevation: 1 },
  orangeButtonTop: { position: 'absolute', top: 4, left: 14, right: 14, height: 1.5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.26)', zIndex: 2 },
  orangeButtonBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '48%', backgroundColor: 'rgba(154,52,18,0.22)', zIndex: 1 },
  footerGap: { marginTop: 44 },
  root: { flex: 1 },
  screen: { flex: 1, backgroundColor: 'transparent' },
  bgBaseLayer: { position: 'absolute', left: 0, right: 0, top: 0, height: 1600, backgroundColor: 'transparent' },
  bgAccentOrange: { position: 'absolute', left: -140, top: -120, width: 380, height: 380, borderRadius: 190, backgroundColor: 'transparent' },
  bgAccentBlue: { position: 'absolute', right: -150, top: -80, width: 400, height: 400, borderRadius: 200, backgroundColor: 'transparent' },
  bgGridA: { position: 'absolute', left: 0, right: 0, top: 0, height: 1600, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.026)' },
  bgGridB: { position: 'absolute', left: '25%', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.022)' },
  content: { paddingTop: 10, paddingBottom: 46, backgroundColor: 'transparent' },
  heroWrap: { alignSelf: 'stretch', marginHorizontal: 16, marginTop: 0, marginBottom: 10, overflow: 'hidden', backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.30, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  heroImage: { width: '100%', height: '100%', backgroundColor: 'transparent' },
  heroFallbackLogo: { transform: [{ scale: 0.88 }] },
  heroImageLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  heroControls: { alignSelf: 'center', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(3,11,20,0.82)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 8, marginBottom: 12, shadowColor: '#000000', shadowOpacity: 0.24, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  heroControlButton: { width: 30, height: 30, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(249,115,22,0.38)', backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  heroProgressRail: { minWidth: 78, height: 30, borderRadius: 999, paddingHorizontal: 8, backgroundColor: 'rgba(255,255,255,0.045)', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' },
  heroProgressTrack: { height: 30, position: 'relative' },
  heroProgressNode: { position: 'absolute', top: 11.5, width: HERO_PROGRESS_DOT_WIDTH, height: HERO_PROGRESS_DOT_WIDTH, borderRadius: 999, backgroundColor: 'rgba(226,232,240,0.32)', zIndex: 1 },
  heroProgressNodeActive: { position: 'absolute', left: 0, top: 11.5, width: HERO_PROGRESS_ACTIVE_WIDTH, height: 7, borderRadius: 999, backgroundColor: '#F97316', shadowColor: '#F97316', shadowOpacity: 0.55, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, zIndex: 2 },
  heroAgeBadge: { position: 'absolute', top: 12, right: 12, minWidth: 34, height: 34, borderRadius: 17, paddingHorizontal: 7, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  heroAgeText: { color: '#0A375A', fontSize: 12, fontWeight: '900' },
  searchPanel: { marginHorizontal: 16, marginTop: 0, zIndex: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 16, gap: 12, overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  searchAccentLine: { position: 'absolute', top: 0, left: 38, right: 38, height: 2, borderRadius: 999 },
  field: { minHeight: 57, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#030B14', justifyContent: 'center', gap: 5 },
  fieldLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  fieldInput: { flex: 1, fontSize: 12, color: '#FFFFFF', fontWeight: '500', outlineStyle: 'none' as any, padding: 0 },
  searchText: { fontSize: 14, letterSpacing: 0 },
  categoryRow: { paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' },
  categoryScroll: { gap: CATEGORY_CARD_GAP, paddingRight: 18, paddingTop: 6, paddingBottom: 10, position: 'relative' },
  catCard: { width: CATEGORY_CARD_WIDTH, height: CATEGORY_CARD_WIDTH, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,107,0,0.34)', backgroundColor: '#030914', justifyContent: 'flex-end', padding: 0, shadowColor: '#000000', shadowOpacity: 0.32, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 5 },
  catCardActive: { borderColor: 'rgba(255,107,0,0.34)', shadowColor: '#FF6B00', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 0 }, elevation: 10 },
  catSelectionFrame: { position: 'absolute', left: 0, top: 6, width: CATEGORY_CARD_WIDTH, height: CATEGORY_CARD_WIDTH, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,107,0,0.86)', backgroundColor: 'transparent', shadowColor: '#FF6B00', shadowOpacity: 0.34, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 20, zIndex: 30 },
  catImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', opacity: 0.72 },
  catImageActive: { opacity: 0.9 },
  catShine: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 4 },
  catContent: { position: 'absolute', left: 8, right: 8, bottom: 8, gap: 3, zIndex: 5 },
  catTitle: { color: '#FFFFFF', fontSize: 8.5, fontWeight: '900', lineHeight: 10.5, minHeight: 21 },
  catDesc: { color: 'rgba(255,255,255,0.76)', fontSize: 9, fontWeight: '700', lineHeight: 11 },
  emptyEvents: { marginHorizontal: 16, marginTop: 24, padding: 22, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  emptyEventsText: { color: 'rgba(226,232,240,0.72)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  category: { height: 42, minWidth: 94, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(246,198,95,0.14)', backgroundColor: 'rgba(255,255,255,0.055)', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  categoryActive: { borderColor: 'rgba(249,115,22,0.65)', backgroundColor: 'rgba(249,115,22,0.18)' },
  categoryArrow: { minWidth: 34, width: 34 },
  categoryText: { color: '#E5E7EB', fontSize: 14, fontWeight: '900' },
  categoryTextActive: { color: '#FFFFFF', fontWeight: '900' },
  categoryDot: { position: 'absolute', right: 12, top: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange, shadowColor: colors.orange, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  sortButton: { marginBottom: 8 },
  sortText: { fontSize: 14, letterSpacing: 0 },
  trustStrip: { marginHorizontal: 16, marginTop: 18, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  trustRow: { width: '48.8%', minHeight: 82, paddingHorizontal: 10, paddingVertical: 11, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center', gap: 7 },
  trustRowDivider: { borderTopWidth: 0, borderTopColor: 'transparent' },
  trustIcon: { width: 34, height: 34, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,122,0,0.48)', backgroundColor: 'rgba(255,122,0,0.09)', alignItems: 'center', justifyContent: 'center', shadowColor: '#ff7a00', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  trustCopy: { width: '100%', gap: 2, alignItems: 'center' },
  trustTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', lineHeight: 14, textAlign: 'center' },
  trustSubtitle: { color: 'rgba(248,250,252,0.62)', fontSize: 10, fontWeight: '400', lineHeight: 12, textAlign: 'center' },
  sortMenu: { borderRadius: 16, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', marginTop: 2 },
  sortMenuHeader: { paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)' },
  sortMenuHeaderText: { color: 'rgba(203,213,225,0.9)', fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  sortOption: { paddingHorizontal: 16, paddingVertical: 13 },
  sortOptionActive: { backgroundColor: 'rgba(249,115,22,0.16)' },
  sortOptionText: { color: 'rgba(226,232,240,0.92)', fontSize: 13, fontWeight: '700' },
  sortOptionTextActive: { color: '#F97316' },
  highlights: { marginHorizontal: 16, marginTop: 46, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 16 },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '700', marginBottom: 12 },
  eventsTitle: { color: '#FFFFFF', fontSize: 32, lineHeight: 36, fontWeight: '700' },
  eventsCount: { color: 'rgba(203,213,225,0.72)', fontSize: 16, fontWeight: '400', marginTop: 12 },
  eventCard: { marginHorizontal: 16, marginTop: 18, backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  eventPoster: { width: '100%', aspectRatio: 3 / 4, position: 'relative', backgroundColor: 'rgba(255,255,255,0.012)' },
  eventPosterImage: { width: '100%', height: '100%' },
  posterShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5,24,44,0.12)' },
  privateBadge: { position: 'absolute', top: 16, left: 14, backgroundColor: 'rgba(16,185,129,0.18)', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(16,185,129,0.46)', paddingHorizontal: 12, paddingVertical: 8, shadowColor: '#10B981', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  privateBadgeText: { color: '#D1FAE5', fontSize: 12, fontWeight: '700', letterSpacing: 0 },
  featuredBadge: { position: 'absolute', top: 16, right: 14, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,151,45,0.62)', shadowColor: '#ff6800', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  featuredShine: { position: 'absolute', left: 10, right: 10, top: 5, height: 1 },
  featuredText: { color: colors.white, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textShadowColor: 'rgba(0,0,0,0.24)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  plusBadge: { position: 'absolute', top: 76, right: 24, width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#8B1E24', fontSize: 20, fontWeight: '800' },
  mockPosterText: { position: 'absolute', left: 18, right: 18, bottom: 34, alignItems: 'center' },
  mockVenue: { color: colors.white, fontSize: 34, fontWeight: '800', letterSpacing: 2.2 },
  mockEvent: { color: colors.white, fontSize: 22, fontWeight: '800', marginTop: 10, textAlign: 'center' },
  mockLine: { color: colors.white, fontSize: 15, fontWeight: '800', marginTop: 18, letterSpacing: 2 },
  eventInfo: { padding: 18, backgroundColor: '#030B14', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.14)' },
  eventName: { color: '#F8FAFC', fontSize: 21, fontWeight: '700', lineHeight: 25, marginBottom: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  metaCol: { flex: 1 },
  eventMeta: { color: '#F97316', fontSize: 15, fontWeight: '500' },
  eventAddress: { color: 'rgba(226,232,240,0.55)', fontSize: 13, fontWeight: '400', marginTop: 1 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.14)', marginVertical: 20 },
  price: { color: '#F8FAFC', fontSize: 20, fontWeight: '600' },
  ctaRow: { flexDirection: 'row', gap: 14, marginTop: 22 },
  shareButton: { width: 56, height: 56, borderRadius: 8, backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(249,115,22,0.62)', alignItems: 'center', justifyContent: 'center' },
  shareText: { color: colors.white, fontSize: 26, fontWeight: '400' },
  buyButton: { flex: 1 },
  buyText: { fontSize: 14, letterSpacing: 0 },
});
