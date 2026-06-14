import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';

type EventStatus = 'draft' | 'published';

type EventSection = 'details' | 'map' | 'attendees' | 'blocks';
type Props = {
  eventTitle: string;
  eventVenue: string;
  eventStatus: EventStatus;
  events?: OrganizerEventItem[];
  setEventStatus: (value: EventStatus) => void;
  goTo: (section: 'dashboard' | 'create' | 'details' | 'map' | 'attendees' | 'blocks') => void;
  onOpen?: (event: OrganizerEventItem, section: EventSection) => void;
};

type OrganizerEventItem = {
  id: string;
  title: string;
  venue: string;
  date: string;
  time: string;
  category: string;
  capacity: number;
  sold: number;
  revenue: string;
  status: EventStatus;
};

const demoEvents: OrganizerEventItem[] = [
  {
    id: '1',
    title: 'Noche de (des)amor',
    venue: 'Ambriza',
    date: '25 Jun 2026',
    time: '07:00 PM',
    category: 'Private Event',
    capacity: 262,
    sold: 62,
    revenue: '$1,240.00',
    status: 'published',
  },
  {
    id: '2',
    title: 'Sunset Lounge Experience',
    venue: 'Miami, FL',
    date: '12 Jul 2026',
    time: '08:30 PM',
    category: 'Concert',
    capacity: 180,
    sold: 38,
    revenue: '$1,330.00',
    status: 'draft' as EventStatus,
  },
];

export function OrganizerEventsMobile({ eventTitle, eventVenue, eventStatus, events, setEventStatus, goTo, onOpen }: Props) {
  const { t } = useLanguage();
  const sourceEvents = events?.length ? events : demoEvents;
  const visibleEvents = sourceEvents.map((item) =>
    item.id === '1'
      ? { ...item, title: eventTitle, venue: eventVenue, status: eventStatus }
      : item
  );

  return (
    <View>
      <View style={styles.topCard}>
        <View>
          <Text style={styles.eyebrow}>{t('MIS EVENTOS', 'MY EVENTS')}</Text>
          <Text style={styles.title}>{t('Eventos del organizador', 'Organizer events')}</Text>
          <Text style={styles.copy}>{t('Administra publicaciones, ventas, mapas y accesos desde un solo lugar.', 'Manage publishing, sales, maps and access from one place.')}</Text>
        </View>

        <TouchableOpacity style={styles.createButton} onPress={() => goTo('create')}>
          <Text style={styles.createText}>{t('CREAR EVENTO', 'CREATE EVENT')}</Text>
        </TouchableOpacity>
      </View>

      {visibleEvents.map((item) => (
        <View key={item.id} style={styles.eventCard}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => (onOpen ? onOpen(item, 'details') : goTo('details'))} style={styles.cardTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.title.slice(0, 2).toUpperCase()}</Text>
            </View>

            <View style={styles.eventMain}>
              <View style={styles.badgeRow}>
                <StatusBadge status={item.status} />
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{item.category}</Text>
                </View>
              </View>

              <Text style={styles.eventTitle}>{item.title}</Text>
              <Text style={styles.eventMeta}>{item.date} · {item.time}</Text>
              <Text style={styles.eventMeta}>{item.venue}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.statsRow}>
            <MiniStat label={t('Vendidos', 'Sold')} value={String(item.sold)} />
            <MiniStat label={t('Capacidad', 'Capacity')} value={String(item.capacity)} />
            <MiniStat label={t('Ingresos', 'Revenue')} value={item.revenue} />
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, Math.round((item.sold / item.capacity) * 100))}%` }]} />
          </View>

          <View style={styles.actions}>
            <Action label={t('EDITAR', 'EDIT')} onPress={() => (onOpen ? onOpen(item, 'details') : goTo('details'))} />
            <Action label={t('MAPA', 'MAP')} muted onPress={() => (onOpen ? onOpen(item, 'map') : goTo('map'))} />
            <Action label={t('VENTAS', 'SALES')} muted onPress={() => (onOpen ? onOpen(item, 'attendees') : goTo('attendees'))} />
            <Action label={t('BLOQUEOS', 'ACCESS')} muted onPress={() => (onOpen ? onOpen(item, 'blocks') : goTo('blocks'))} />
          </View>

          {item.id === '1' && (
            <TouchableOpacity
              style={styles.publishButton}
              onPress={() => setEventStatus(item.status === 'published' ? 'draft' : 'published')}
            >
              <Text style={styles.publishText}>{item.status === 'published' ? 'MOVE TO DRAFT' : 'PUBLISH EVENT'}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

function StatusBadge({ status }: { status: EventStatus }) {
  const published = status === 'published';
  return (
    <View style={[styles.statusBadge, published ? styles.statusPublished : styles.statusDraft]}>
      <Text style={[styles.statusText, published ? styles.statusPublishedText : styles.statusDraftText]}>
        {published ? 'PUBLICADO' : 'BORRADOR'}
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

function Action({ label, muted, onPress }: { label: string; muted?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.action, muted && styles.actionMuted]}>
      <Text style={[styles.actionText, muted && styles.actionTextMuted]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  topCard: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '700', marginBottom: 8 },
  title: { color: '#F8FAFC', fontSize: 26, fontWeight: '700', marginBottom: 8 },
  copy: { color: 'rgba(226,232,240,0.64)', fontSize: 14, lineHeight: 21, fontWeight: '400', marginBottom: 16 },
  createButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: { color: '#FFFFFF', fontSize: 13, letterSpacing: 0, fontWeight: '700' },
  eventCard: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  cardTop: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 19,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#F8FAFC', fontSize: 17, fontWeight: '700' },
  eventMain: { flex: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 9 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1 },
  statusPublished: { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.36)' },
  statusDraft: { backgroundColor: '#030B14', borderColor: 'rgba(255,255,255,0.14)' },
  statusText: { fontSize: 10, letterSpacing: 0, fontWeight: '700' },
  statusPublishedText: { color: colors.orange },
  statusDraftText: { color: '#CBD5E1' },
  categoryBadge: { backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 7 },
  categoryText: { color: colors.orange, fontSize: 10, letterSpacing: 0, fontWeight: '700' },
  eventTitle: { color: '#F8FAFC', fontSize: 21, fontWeight: '700', lineHeight: 26, marginBottom: 5 },
  eventMeta: { color: 'rgba(226,232,240,0.64)', fontSize: 13, lineHeight: 19, fontWeight: '400' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  miniStat: { flex: 1, backgroundColor: '#030B14', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  miniValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  miniLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 11, fontWeight: '400', textAlign: 'center', marginTop: 3 },
  progressTrack: { height: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: 15 },
  progressFill: { height: '100%', backgroundColor: colors.orange },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  action: {
    minHeight: 43,
    borderRadius: 14,
    backgroundColor: colors.orange,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  actionMuted: { backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  actionText: { color: '#FFFFFF', fontSize: 11, letterSpacing: 0, fontWeight: '700' },
  actionTextMuted: { color: '#F8FAFC' },
  publishButton: {
    height: 46,
    borderRadius: 15,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  publishText: { color: colors.orange, fontSize: 14, letterSpacing: 0, fontWeight: '700' },
});
