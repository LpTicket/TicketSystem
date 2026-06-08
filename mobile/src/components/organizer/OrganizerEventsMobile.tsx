import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';

type EventStatus = 'draft' | 'published';

type Props = {
  eventTitle: string;
  eventVenue: string;
  eventStatus: EventStatus;
  events?: OrganizerEventItem[];
  setEventStatus: (value: EventStatus) => void;
  goTo: (section: 'dashboard' | 'create' | 'details' | 'map' | 'attendees' | 'blocks') => void;
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

export function OrganizerEventsMobile({ eventTitle, eventVenue, eventStatus, events, setEventStatus, goTo }: Props) {
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
          <View style={styles.cardTop}>
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
          </View>

          <View style={styles.statsRow}>
            <MiniStat label={t('Vendidos', 'Sold')} value={String(item.sold)} />
            <MiniStat label={t('Capacidad', 'Capacity')} value={String(item.capacity)} />
            <MiniStat label={t('Ingresos', 'Revenue')} value={item.revenue} />
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, Math.round((item.sold / item.capacity) * 100))}%` }]} />
          </View>

          <View style={styles.actions}>
            <Action label={t('EDITAR', 'EDIT')} onPress={() => goTo('details')} />
            <Action label={t('MAPA', 'MAP')} muted onPress={() => goTo('map')} />
            <Action label={t('VENTAS', 'SALES')} muted onPress={() => goTo('attendees')} />
            <Action label={t('BLOQUEOS', 'ACCESS')} muted onPress={() => goTo('blocks')} />
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
    backgroundColor: colors.navy,
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#111827',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
  },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '900', marginBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', marginBottom: 8 },
  copy: { color: '#cbd5e1', fontSize: 14, lineHeight: 21, fontWeight: '400', marginBottom: 16 },
  createButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: { color: '#FFFFFF', fontSize: 13, letterSpacing: 1.6, fontWeight: '900' },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 16,
    shadowColor: '#111827',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  cardTop: { flexDirection: 'row', gap: 14, marginBottom: 16 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 19,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  eventMain: { flex: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 9 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  statusPublished: { backgroundColor: '#DCFCE7' },
  statusDraft: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 10, letterSpacing: 1.2, fontWeight: '900' },
  statusPublishedText: { color: '#15803d' },
  statusDraftText: { color: '#6B7280' },
  categoryBadge: { backgroundColor: '#fff7ed', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  categoryText: { color: colors.orange, fontSize: 10, letterSpacing: 1.2, fontWeight: '900' },
  eventTitle: { color: colors.navy, fontSize: 21, fontWeight: '900', lineHeight: 26, marginBottom: 5 },
  eventMeta: { color: '#6B7280', fontSize: 13, lineHeight: 19, fontWeight: '400' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  miniStat: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 17, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  miniValue: { color: colors.navy, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  miniLabel: { color: '#6B7280', fontSize: 11, fontWeight: '400', textAlign: 'center', marginTop: 3 },
  progressTrack: { height: 9, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden', marginBottom: 15 },
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
  actionMuted: { backgroundColor: '#F9FAFB' },
  actionText: { color: '#FFFFFF', fontSize: 11, letterSpacing: 1.3, fontWeight: '900' },
  actionTextMuted: { color: colors.navy },
  publishButton: {
    height: 46,
    borderRadius: 15,
    backgroundColor: '#0A375A',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  publishText: { color: '#FFFFFF', fontSize: 12, letterSpacing: 1.5, fontWeight: '900' },
});
