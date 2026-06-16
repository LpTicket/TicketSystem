import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { GradientButton } from '../GradientButton';

type EventStatus = 'draft' | 'published';

type EventSection = 'details' | 'map' | 'attendees' | 'blocks';
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
  const eventDate = new Date(value);
  if (Number.isNaN(eventDate.getTime())) return false;
  return eventDate.getTime() < Date.now();
}


export function OrganizerEventsMobile({ eventTitle, eventVenue, eventStatus, events, errorMessage, setEventStatus, goTo, onOpen, onTogglePublish }: Props) {
  const { t } = useLanguage();
  const visibleEvents = events ?? [];

  return (
    <View>
      <View style={styles.topCard}>
        <View>
          <Text style={styles.eyebrow}>{t('MIS EVENTOS', 'MY EVENTS')}</Text>
          <Text style={styles.title}>{t('Eventos del organizador', 'Organizer events')}</Text>
          <Text style={styles.copy}>{t('Administra publicaciones, ventas, mapas y accesos desde un solo lugar.', 'Manage publishing, sales, maps and access from one place.')}</Text>
        </View>

        <GradientButton
          label={t('CREAR EVENTO', 'CREATE EVENT')}
          onPress={() => goTo('create')}
          height={50}
          style={styles.createButton}
          textStyle={styles.createText}
        />
      </View>

      {visibleEvents.length === 0 && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>{errorMessage || t('Aún no tienes eventos', 'No events yet')}</Text>
          <Text style={styles.emptyCopy}>
            {errorMessage
              ? t('Revisa tu sesión e intenta entrar de nuevo.', 'Check your session and try signing in again.')
              : t('Crea tu primer evento para gestionarlo aquí.', 'Create your first event to manage it here.')}
          </Text>
        </View>
      )}

      {visibleEvents.map((item) => (
        <View key={item.id} style={styles.eventCard}>
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
                <ScheduleBadge past={isPastEvent(item.eventDate)} />
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

          <TouchableOpacity
            style={styles.publishButton}
            onPress={() => onTogglePublish ? onTogglePublish(item) : setEventStatus(item.status === 'published' ? 'draft' : 'published')}
          >
            <Text style={styles.publishText}>{item.status === 'published' ? 'MOVE TO DRAFT' : 'PUBLISH EVENT'}</Text>
          </TouchableOpacity>
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

function Action({ label, muted, onPress }: { label: string; muted?: boolean; onPress?: () => void }) {
  if (!muted) {
    return <GradientButton label={label} onPress={onPress} height={43} style={styles.action} textStyle={styles.actionText} />;
  }

  return (
    <TouchableOpacity onPress={onPress} style={[styles.action, styles.actionMuted]}>
      <Text style={[styles.actionText, styles.actionTextMuted]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700', textAlign: 'center' },
  emptyCopy: { color: 'rgba(226,232,240,0.66)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
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
  flyerFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.08)',
  },
  flyerFallbackText: { color: colors.orange, fontSize: 9, fontWeight: '700', letterSpacing: 0 },
  eventMain: { flex: 1, minWidth: 0 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 7 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1 },
  statusPublished: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.34)' },
  statusDraft: { backgroundColor: '#030B14', borderColor: 'rgba(255,255,255,0.14)' },
  scheduleActive: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.30)' },
  schedulePast: { backgroundColor: 'rgba(148,163,184,0.10)', borderColor: 'rgba(148,163,184,0.24)' },
  statusText: { fontSize: 9, letterSpacing: 0, fontWeight: '700' },
  statusPublishedText: { color: '#4ADE80' },
  statusDraftText: { color: '#CBD5E1' },
  scheduleActiveText: { color: '#FCA5A5' },
  schedulePastText: { color: 'rgba(203,213,225,0.72)' },
  categoryBadge: { backgroundColor: '#030B14', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(249,115,22,0.26)', paddingHorizontal: 8, paddingVertical: 5 },
  categoryText: { color: colors.orange, fontSize: 9, letterSpacing: 0, fontWeight: '700' },
  eventTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '700', lineHeight: 21, marginBottom: 5 },
  eventMeta: { color: 'rgba(226,232,240,0.62)', fontSize: 12, lineHeight: 17, fontWeight: '400' },
  statsRow: { flexDirection: 'row', gap: 7, marginBottom: 10 },
  miniStat: { flex: 1, backgroundColor: '#030B14', borderRadius: 11, paddingVertical: 9, paddingHorizontal: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  miniValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  miniLabel: { color: 'rgba(226,232,240,0.58)', fontSize: 10, fontWeight: '500', textAlign: 'center', marginTop: 2 },
  progressTrack: { height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', backgroundColor: colors.orange },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  action: {
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: colors.orange,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  actionMuted: { backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  actionText: { color: '#FFFFFF', fontSize: 10, letterSpacing: 0, fontWeight: '700' },
  actionTextMuted: { color: '#F8FAFC' },
  publishButton: {
    height: 36,
    borderRadius: 10,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  publishText: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '700' },
});
