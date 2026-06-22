import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { GradientButton } from '../GradientButton';
import { apiGet } from '../../services/api';

type EventStatus = 'draft' | 'published' | 'cancelled';

type EventSection = 'details' | 'map' | 'attendees' | 'blocks';
type FilterKey = 'all' | 'draft' | 'published' | 'cancelled';

type Props = {
  eventTitle: string;
  eventVenue: string;
  eventStatus: EventStatus;
  events?: OrganizerEventItem[];
  errorMessage?: string;
  setEventStatus: (value: EventStatus) => void;
  goTo: (section: 'dashboard' | 'create' | 'details' | 'map' | 'attendees' | 'blocks') => void;
  onOpen?: (event: OrganizerEventItem, section: EventSection) => void;
  onTogglePublish?: (event: OrganizerEventItem) => void;
};

type OrganizerEventItem = {
  id: string;
  title: string;
  venue: string;
  date: string;
  eventDate: string;
  time: string;
  category: string;
  capacity: number;
  sold: number;
  revenue: string;
  revenueAmount: number;
  orders: number;
  status: EventStatus;
  imageUrl: string;
};

function isPastEvent(value: string) {
  if (!value) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

export function OrganizerEventsMobile({ eventTitle, eventVenue, eventStatus, events, errorMessage, setEventStatus, goTo, onOpen, onTogglePublish }: Props) {
  const { t, lang } = useLanguage();
  const filterIndicatorX = useRef(new Animated.Value(0)).current;
  const filterIndicatorWidth = useRef(new Animated.Value(64)).current;
  const filterScrollRef = useRef<ScrollView>(null);
  const [filter, setFilter] = useState<FilterKey>('published');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);
  const [filterLayouts, setFilterLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const [filterViewportWidth, setFilterViewportWidth] = useState(0);

  const allEvents = events ?? [];

  const filteredEvents = allEvents
    .filter((e) => filter === 'all' || e.status === filter)
    .filter((e) => !search.trim() || e.title.toLowerCase().includes(search.trim().toLowerCase()));

  const exportCSV = async (id: string) => {
    if (Platform.OS !== 'web') {
      Alert.alert(
        t('Exportar CSV', 'Export CSV'),
        t('La descarga está disponible en la versión web de la app.', 'Download is available from the web version of the app.'),
      );
      return;
    }
    setExporting(id);
    try {
      const data = await apiGet<any[]>(`/orders/event/${id}/attendees`);
      const csv = [
        'Name,Email,Section,Row,Seat,Code',
        ...(Array.isArray(data) ? data : []).map((ticket: any) =>
          `${ticket.user?.firstName || ''} ${ticket.user?.lastName || ''},${ticket.user?.email || ''},${ticket.sectionName || ''},${ticket.rowLabel || ''},${ticket.seatNumber || ''},${ticket.ticketCode || ''}`,
        ),
      ].join('\n');
      // @ts-ignore – web only
      const blob = new Blob([csv], { type: 'text/csv' });
      // @ts-ignore – web only
      const a = document.createElement('a');
      // @ts-ignore – web only
      a.href = URL.createObjectURL(blob);
      a.download = `attendees-${id}.csv`;
      a.click();
    } catch {
      Alert.alert(t('Error', 'Error'), t('No se pudo exportar la lista.', 'Could not export the list.'));
    } finally {
      setExporting(null);
    }
  };

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('Todos', 'All') },
    { key: 'draft', label: t('Borrador', 'Draft') },
    { key: 'published', label: t('Publicado', 'Published') },
    { key: 'cancelled', label: t('Cancelado', 'Cancelled') },
  ];
  const activeFilterIndex = Math.max(0, FILTERS.findIndex((item) => item.key === filter));

  useEffect(() => {
    const layout = filterLayouts[filter];
    if (!layout) return;

    Animated.parallel([
      Animated.spring(filterIndicatorX, {
        toValue: layout.x,
        useNativeDriver: false,
        damping: 18,
        stiffness: 210,
        mass: 0.68,
      }),
      Animated.spring(filterIndicatorWidth, {
        toValue: layout.width,
        useNativeDriver: false,
        damping: 18,
        stiffness: 210,
        mass: 0.68,
      }),
    ]).start();

    if (filterViewportWidth > 0) {
      const targetX = Math.max(0, layout.x + layout.width / 2 - filterViewportWidth / 2);
      filterScrollRef.current?.scrollTo({ x: targetX, animated: true });
    }
  }, [filter, filterIndicatorWidth, filterIndicatorX, filterLayouts, filterViewportWidth]);

  const selectFilter = (key: FilterKey) => {
    setFilter(key);
    const layout = filterLayouts[key];
    if (layout && filterViewportWidth > 0) {
      const targetX = Math.max(0, layout.x + layout.width / 2 - filterViewportWidth / 2);
      filterScrollRef.current?.scrollTo({ x: targetX, animated: true });
    }
  };

  const stepFilter = (direction: -1 | 1) => {
    const nextIndex = Math.max(0, Math.min(FILTERS.length - 1, activeFilterIndex + direction));
    const next = FILTERS[nextIndex];
    if (next) selectFilter(next.key);
  };

  return (
    <View>
      {/* Amber notice */}
      <View style={styles.noticeBanner}>
        <Text style={styles.noticeEmoji}>🔔</Text>
        <View style={styles.noticeCopy}>
          <Text style={styles.noticeTitle}>{t('Recordatorio sobre publicación', 'Publication reminder')}</Text>
          <Text style={styles.noticeText}>
            {t(
              'Los eventos nuevos se guardan como borrador. El administrador debe aprobarlos antes de que sean visibles al público.',
              'New events are saved as drafts. The admin must approve them before they are visible to the public.',
            )}
          </Text>
        </View>
      </View>

      {/* Header card */}
      <View style={styles.topCard}>
        <Text style={styles.eyebrow}>{t('MIS EVENTOS', 'MY EVENTS')}</Text>
        <Text style={styles.title}>{t('Eventos del organizador', 'Organizer events')}</Text>
        <Text style={styles.copy}>{t('Administra publicaciones, ventas, mapas y accesos desde un solo lugar.', 'Manage publishing, sales, maps and access from one place.')}</Text>
        <GradientButton
          label={t('CREAR EVENTO', 'CREATE EVENT')}
          onPress={() => goTo('create')}
          height={50}
          style={styles.createButton}
          textStyle={styles.createText}
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterWrap}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterArrowBtn, activeFilterIndex <= 0 && styles.filterArrowBtnDisabled]}
            disabled={activeFilterIndex <= 0}
            onPress={() => stepFilter(-1)}
            activeOpacity={0.65}
          >
            <Ionicons
              name="chevron-back"
              size={18}
              color={activeFilterIndex <= 0 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.86)'}
            />
          </TouchableOpacity>

          <View style={styles.filterShell} onLayout={(event) => setFilterViewportWidth(event.nativeEvent.layout.width)}>
            <ScrollView
              ref={filterScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterScroller}
              contentContainerStyle={styles.filterContent}
              scrollEventThrottle={16}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.filterSlidingPill,
                  {
                    left: filterIndicatorX,
                    width: filterIndicatorWidth,
                  },
                ]}
              >
                <View style={styles.filterSlidingShine} />
              </Animated.View>
              {FILTERS.map((f, index) => {
                const activeFilter = filter === f.key;
                return (
                  <TouchableOpacity
                    key={`${f.key}-${index}`}
                    onPress={() => selectFilter(f.key)}
                    onLayout={(event) => {
                      const { x, width } = event.nativeEvent.layout;
                      setFilterLayouts((current) => ({ ...current, [f.key]: { x, width } }));
                    }}
                    style={styles.filterChip}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.filterChipText, activeFilter && styles.filterChipTextActive]} numberOfLines={1}>{f.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(3,11,20,0.96)', 'rgba(3,11,20,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.filterFade, styles.filterFadeLeft]}
            />
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(3,11,20,0)', 'rgba(3,11,20,0.96)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.filterFade, styles.filterFadeRight]}
            />
          </View>

          <TouchableOpacity
            style={[styles.filterArrowBtn, activeFilterIndex >= FILTERS.length - 1 && styles.filterArrowBtnDisabled]}
            disabled={activeFilterIndex >= FILTERS.length - 1}
            onPress={() => stepFilter(1)}
            activeOpacity={0.65}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={activeFilterIndex >= FILTERS.length - 1 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.86)'}
            />
          </TouchableOpacity>
        </View>
        <View pointerEvents="none" style={styles.filterDots}>
          {FILTERS.map((f, index) => (
            <View key={`${f.key}-dot-${index}`} style={[styles.filterDot, activeFilterIndex === index && styles.filterDotActive]} />
          ))}
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={15} color="rgba(148,163,184,0.65)" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('Buscar eventos...', 'Search events...')}
          placeholderTextColor="rgba(148,163,184,0.5)"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={15} color="rgba(148,163,184,0.55)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Empty state */}
      {filteredEvents.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {errorMessage || (allEvents.length === 0 ? t('Aún no tienes eventos', 'No events yet') : t('Ningún evento coincide', 'No events match'))}
          </Text>
          <Text style={styles.emptyCopy}>
            {errorMessage
              ? t('Revisa tu sesión e intenta entrar de nuevo.', 'Check your session and try signing in again.')
              : allEvents.length === 0
              ? t('Crea tu primer evento para gestionarlo aquí.', 'Create your first event to manage it here.')
              : t('Prueba con otro filtro o término de búsqueda.', 'Try a different filter or search term.')}
          </Text>
        </View>
      )}

      {/* Event cards */}
      {filteredEvents.map((item, index) => {
        const past = isPastEvent(item.eventDate);
        const soldPct = item.capacity > 0 ? Math.min(100, Math.round((item.sold / item.capacity) * 100)) : 0;
        return (
          <View key={`${item.id || item.title || 'organizer-event'}-${index}`} style={[styles.eventCard, past && styles.eventCardPast]}>
            {/* Header: image + info */}
            <TouchableOpacity activeOpacity={0.85} onPress={() => (onOpen ? onOpen(item, 'details') : goTo('details'))} style={styles.cardTop}>
              <View style={styles.flyerWrap}>
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.flyer} resizeMode="cover" />
                ) : (
                  <View style={styles.flyerFallback}>
                    <Text style={styles.flyerFallbackText}>EVENT</Text>
                  </View>
                )}
              </View>

              <View style={styles.eventMain}>
                <View style={styles.badgeRow}>
                  <ScheduleBadge past={past} />
                  <StatusBadge status={item.status} />
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.category}</Text>
                  </View>
                </View>
                <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.eventMeta} numberOfLines={1}>{item.date}</Text>
                <Text style={styles.eventMeta} numberOfLines={1}>{item.venue}</Text>
              </View>
            </TouchableOpacity>

            {/* Stats */}
            <View style={styles.statsRow}>
              <MiniStat label={t('Vendidos', 'Sold')} value={String(item.sold)} />
              <MiniStat label={t('Capacidad', 'Capacity')} value={String(item.capacity)} />
              <MiniStat label={t('Ingresos', 'Revenue')} value={item.revenue} />
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${soldPct}%` as `${number}%` }]} />
            </View>

            {/* Actions: Edit + Download */}
            <View style={styles.actions}>
              <GradientButton
                height={43}
                style={styles.editBtn}
                onPress={() => (onOpen ? onOpen(item, 'details') : goTo('details'))}
              >
                <Ionicons name="pencil-outline" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.editBtnText}>{t('EDITAR EVENTO', 'EDIT EVENT')}</Text>
              </GradientButton>

              <TouchableOpacity
                style={[styles.downloadBtn, exporting === item.id && { opacity: 0.5 }]}
                onPress={() => exportCSV(item.id)}
                disabled={exporting === item.id}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={exporting === item.id ? 'hourglass-outline' : 'download-outline'}
                  size={19}
                  color="#F97316"
                />
              </TouchableOpacity>
            </View>

            {/* Publish / Draft toggle — hidden for cancelled events */}
            {item.status !== 'cancelled' && (
              <TouchableOpacity
                style={styles.publishButton}
                onPress={() => onTogglePublish ? onTogglePublish(item) : setEventStatus(item.status === 'published' ? 'draft' : 'published')}
              >
                <Text style={styles.publishText}>
                  {item.status === 'published' ? t('MOVER A BORRADOR', 'MOVE TO DRAFT') : t('PUBLICAR EVENTO', 'PUBLISH EVENT')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

function StatusBadge({ status }: { status: EventStatus }) {
  const cfg =
    status === 'published' ? { bg: styles.statusPublished, text: styles.statusPublishedText, label: 'PUBLICADO' } :
    status === 'cancelled' ? { bg: styles.statusCancelled, text: styles.statusCancelledText, label: 'CANCELADO' } :
    { bg: styles.statusDraft, text: styles.statusDraftText, label: 'BORRADOR' };
  return (
    <View style={[styles.statusBadge, cfg.bg]}>
      <Text style={[styles.statusText, cfg.text]}>{cfg.label}</Text>
    </View>
  );
}

function ScheduleBadge({ past }: { past: boolean }) {
  return (
    <View style={[styles.statusBadge, past ? styles.schedulePast : styles.scheduleActive]}>
      <Text style={[styles.statusText, past ? styles.schedulePastText : styles.scheduleActiveText]}>
        {past ? 'PASADO' : 'ACTIVO'}
      </Text>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Notice banner
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.28)',
    padding: 14,
    marginBottom: 14,
  },
  noticeEmoji: { fontSize: 18, marginTop: 1 },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: 'rgba(252,211,77,0.9)', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  noticeText: { color: 'rgba(252,211,77,0.65)', fontSize: 12, lineHeight: 17, fontWeight: '500' },

  // Header card
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '600', textAlign: 'center' },
  emptyCopy: { color: 'rgba(226,232,240,0.66)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  topCard: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '600', marginBottom: 8 },
  title: { color: '#F8FAFC', fontSize: 26, fontWeight: '600', marginBottom: 8 },
  copy: { color: 'rgba(226,232,240,0.64)', fontSize: 14, lineHeight: 21, fontWeight: '400', marginBottom: 16 },
  createButton: { borderRadius: 16 },
  createText: { color: '#FFFFFF', fontSize: 13, letterSpacing: 0, fontWeight: '600' },

  // Filter chips
  filterWrap: { marginBottom: 10 },
  filterRow: { height: 46, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 1 },
  filterArrowBtn: { width: 22, height: 40, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  filterArrowBtnDisabled: { opacity: 0.55 },
  filterShell: { flex: 1, height: 42, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(3,11,20,0.86)', overflow: 'hidden' },
  filterScroller: { flex: 1 },
  filterContent: { minHeight: 40, paddingHorizontal: 4, gap: 4, flexDirection: 'row', alignItems: 'center' },
  filterFade: { position: 'absolute', top: 1, bottom: 1, width: 34, zIndex: 3 },
  filterFadeLeft: { left: 1 },
  filterFadeRight: { right: 1 },
  filterSlidingPill: { position: 'absolute', top: 4, height: 32, borderRadius: 12, backgroundColor: 'rgba(249,115,22,0.16)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.55)', overflow: 'hidden' },
  filterSlidingShine: { position: 'absolute', top: 2, left: 10, right: 10, height: 1, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.32)' },
  filterDots: { height: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 2, marginBottom: 8 },
  filterDot: { width: 4, height: 4, borderRadius: 999, backgroundColor: 'rgba(226,232,240,0.24)' },
  filterDotActive: { width: 14, backgroundColor: 'rgba(249,115,22,0.72)' },
  filterChip: {
    height: 32,
    borderRadius: 12,
    paddingHorizontal: 13,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  filterChipActive: {},
  filterChipText: { color: 'rgba(226,232,240,0.62)', fontSize: 12, fontWeight: '600', maxWidth: 112 },
  filterChipTextActive: { color: '#FFFFFF' },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#030B14',
    paddingHorizontal: 13,
    marginBottom: 14,
  },
  searchInput: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '500' },

  // Event card
  eventCard: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 11,
    marginBottom: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 9 },
  },
  eventCardPast: { opacity: 0.62 },
  cardTop: { flexDirection: 'row', gap: 11, marginBottom: 11, alignItems: 'center' },
  flyerWrap: {
    width: 76,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  flyer: { width: '100%', height: '100%' },
  flyerFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.08)' },
  flyerFallbackText: { color: colors.orange, fontSize: 9, fontWeight: '600' },
  eventMain: { flex: 1, minWidth: 0 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 7 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1 },
  statusPublished: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.34)' },
  statusDraft: { backgroundColor: '#030B14', borderColor: 'rgba(255,255,255,0.14)' },
  statusCancelled: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.34)' },
  statusCancelledText: { color: '#FCA5A5' },
  scheduleActive: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.30)' },
  schedulePast: { backgroundColor: 'rgba(148,163,184,0.10)', borderColor: 'rgba(148,163,184,0.24)' },
  statusText: { fontSize: 9, letterSpacing: 0, fontWeight: '600' },
  statusPublishedText: { color: '#4ADE80' },
  statusDraftText: { color: '#CBD5E1' },
  scheduleActiveText: { color: '#FCA5A5' },
  schedulePastText: { color: 'rgba(203,213,225,0.72)' },
  categoryBadge: { backgroundColor: '#030B14', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(249,115,22,0.26)', paddingHorizontal: 8, paddingVertical: 5 },
  categoryText: { color: colors.orange, fontSize: 9, fontWeight: '600' },
  eventTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '600', lineHeight: 21, marginBottom: 5 },
  eventMeta: { color: 'rgba(226,232,240,0.62)', fontSize: 12, lineHeight: 17, fontWeight: '400' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  miniStat: { flex: 1, backgroundColor: '#030B14', borderRadius: 11, paddingVertical: 9, paddingHorizontal: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  miniValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  miniLabel: { color: 'rgba(226,232,240,0.58)', fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 2 },
  progressTrack: { height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: colors.orange },

  // Actions row
  actions: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  editBtn: { flex: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  editBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', letterSpacing: 0 },
  downloadBtn: {
    width: 43,
    height: 43,
    borderRadius: 12,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Publish toggle
  publishButton: {
    height: 36,
    borderRadius: 10,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishText: { color: colors.orange, fontSize: 11, fontWeight: '600' },
});
