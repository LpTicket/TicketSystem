import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { VenueMapEditor } from '../components/organizer/VenueMapEditor';
import { useLanguage } from '../i18n/LanguageContext';
import { OrganizerDashboardMobile, OrganizerCreateEventMobile, OrganizerDetailsMobile } from '../components/organizer/OrganizerEventForms';
import { OrganizerEventsMobile } from '../components/organizer/OrganizerEventsMobile';
import { OrganizerAttendeesMobile } from '../components/organizer/OrganizerAttendeesMobile';
import { OrganizerAccessMobile } from '../components/organizer/OrganizerAccessMobile';
import { OrganizerRewardsMobile } from '../components/organizer/OrganizerRewardsMobile';
import { apiGet } from '../services/api';

type Section = 'dashboard' | 'events' | 'create' | 'details' | 'map' | 'attendees' | 'blocks' | 'rewards' | 'scan';


type OrganizerApiEvent = {
  id?: string;
  title?: string;
  venueName?: string;
  venueAddress?: string;
  eventDate?: string;
  category?: string;
  categoryName?: string;
  status?: string;
  capacity?: number;
  totalCapacity?: number;
  soldTickets?: number;
  ticketsSold?: number;
  totalRevenue?: number;
  revenue?: number;
};

type OrganizerStats = {
  totalRevenue?: number;
  totalTickets?: number;
  activeEvents?: number;
  totalOrders?: number;
  scannedTickets?: number;
  pendingTickets?: number;
};

type MobileAttendee = {
  id: string;
  name: string;
  email: string;
  ticket: string;
  code: string;
  status: string;
  total: string;
};

function toAttendee(ticket: any, index: number): MobileAttendee {
  const u = ticket?.user || {};
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Invitado';
  const seat = [ticket?.sectionName, ticket?.rowLabel, ticket?.seatNumber].filter(Boolean).join(' · ');
  return {
    id: String(ticket?.id || index),
    name,
    email: u.email || '',
    ticket: seat || 'General',
    code: ticket?.ticketCode || '',
    status: ticket?.status === 'used' ? 'SCANNED' : 'PAID',
    total: money(ticket?.price || 0),
  };
}

function listFrom(payload: any) {
  if (Array.isArray(payload)) return payload;
  return payload?.data || payload?.events || payload?.items || [];
}

function money(value: any) {
  const amount = Number(value || 0);
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatEventDate(value?: string) {
  if (!value) return 'Date coming soon';
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  } catch {
    return value;
  }
}

function toOrganizerEvent(event: OrganizerApiEvent, index: number) {
  const capacity = Number(event.capacity || event.totalCapacity || 0);
  const sold = Number(event.soldTickets || event.ticketsSold || 0);
  return {
    id: String(event.id || index),
    title: event.title || 'Evento',
    venue: event.venueName || event.venueAddress || 'Venue',
    date: formatEventDate(event.eventDate),
    time: '',
    category: event.categoryName || event.category || 'Event',
    capacity,
    sold,
    revenue: money(event.totalRevenue || event.revenue || 0),
    status: event.status === 'published' ? 'published' as const : 'draft' as const,
  };
}

const sections: Section[] = [
  'dashboard',
  'events',
  'create',
  'details',
  'map',
  'attendees',
  'blocks',
  'rewards',
];

export function OrganizerPanelScreen() {
  const { t } = useLanguage();
  const [active, setActive] = useState<Section>('dashboard');
  const [eventTitle, setEventTitle] = useState('Noche de (des)amor');
  const [eventVenue, setEventVenue] = useState('Ambriza');
  const [eventStatus, setEventStatus] = useState<'draft' | 'published'>('published');
  const [accessItems, setAccessItems] = useState([
    { id: '1', title: 'Mesa 8', type: 'Reserva', status: 'ACTIVE' },
    { id: '2', title: 'VIP Familia', type: 'Invitacion', status: 'ACTIVE' },
    { id: '3', title: 'PRIVATE-21', type: 'Codigo privado', status: 'PAUSED' },
  ]);
  const [organizerEvents, setOrganizerEvents] = useState<ReturnType<typeof toOrganizerEvent>[]>([]);
  const [organizerStats, setOrganizerStats] = useState<OrganizerStats>({});
  const [rewardStats, setRewardStats] = useState({ balance: 0, totalPaid: 0, totalEarned: 0, activeCodes: 0 });

  useEffect(() => {
    let mounted = true;

    apiGet<any>('/events/mine/list')
      .then((data) => {
        if (!mounted) return;
        const items = listFrom(data).map(toOrganizerEvent);
        setOrganizerEvents(items);

        const first = items[0];
        if (first) {
          setEventTitle(first.title);
          setEventVenue(first.venue);
          setEventStatus(first.status);
        }
      })
      .catch(() => {});

    apiGet<OrganizerStats>('/orders/organizer/stats')
      .then((data) => {
        if (mounted) setOrganizerStats(data || {});
      })
      .catch(() => {});

    Promise.allSettled([
      apiGet<any>('/special-codes/me'),
      apiGet<any>('/special-codes/my-payouts'),
    ]).then(([meRes, payoutsRes]) => {
      if (!mounted) return;

      const activeCodes = meRes.status === 'fulfilled'
        ? listFrom(meRes.value).filter((c: any) => c.isActive !== false).length
        : 0;

      let balance = 0;
      let totalPaid = 0;
      let totalEarned = 0;
      if (payoutsRes.status === 'fulfilled') {
        for (const entry of listFrom(payoutsRes.value)) {
          balance += Number(entry.balance || 0);
          totalPaid += Number(entry.totalPaid || 0);
          totalEarned += Number(entry.totalEarned || 0);
        }
      }

      const round2 = (v: number) => Math.round(v * 100) / 100;
      setRewardStats({ balance: round2(balance), totalPaid: round2(totalPaid), totalEarned: round2(totalEarned), activeCodes });
    });

    return () => {
      mounted = false;
    };
  }, []);

  const [attendees, setAttendees] = useState<MobileAttendee[]>([]);

  const firstEventId = organizerEvents[0]?.id;

  useEffect(() => {
    if (!firstEventId) return;
    let mounted = true;

    apiGet<any>(`/orders/event/${firstEventId}/attendees`)
      .then((data) => {
        if (mounted) setAttendees(listFrom(data).map(toAttendee));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [firstEventId]);

  const firstEvent = organizerEvents[0];
  const activeEvents = organizerEvents.filter((e) => e.status === 'published').length;
  const capacity = firstEvent?.capacity ?? 0;
  const sold = firstEvent?.sold ?? Number(organizerStats.totalTickets ?? 0);
  const scanned = Number(organizerStats.scannedTickets ?? 0);
  const soldPct = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;

  const dashMetrics = {
    revenue: money(organizerStats.totalRevenue),
    ticketsSold: String(organizerStats.totalTickets ?? sold),
    activeEvents: String(activeEvents),
    orders: String(organizerStats.totalOrders ?? 0),
  };

  const toggleAccessItem = (id: string) => {
    setAccessItems((current) => current.map((item) => item.id === id ? { ...item, status: item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } : item));
  };

  const toggleAttendeeStatus = (id: string) => {
    setAttendees((current) => current.map((item) => item.id === id ? { ...item, status: item.status === 'SCANNED' ? 'PAID' : 'SCANNED' } : item));
  };

  return (
    <View style={styles.root}>
      <View style={styles.tabsShell}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroller} contentContainerStyle={styles.tabs}>
          {sections.map((item) => (
            <TouchableOpacity key={item} onPress={() => setActive(item)} style={[styles.tab, active === item && styles.tabActive]}>
              <Text style={[styles.tabText, active === item && styles.tabTextActive]}>{sectionLabel(item, t)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>{t('ORGANIZADOR', 'ORGANIZER')}</Text>
        <Text style={styles.title}>{titleFor(active, t)}</Text>
        <Text style={styles.subtitle}>{subtitleFor(active, t)}</Text>

        {active === 'dashboard' && (
          <OrganizerDashboardMobile
            eventTitle={eventTitle}
            eventVenue={eventVenue}
            eventStatus={eventStatus}
            eventDateLabel={firstEvent?.date}
            metrics={dashMetrics}
            summary={{ capacity, sold, scanned, soldPct }}
            goTo={setActive}
          />
        )}

        {active === 'events' && (
          <OrganizerEventsMobile
            eventTitle={eventTitle}
            eventVenue={eventVenue}
            eventStatus={eventStatus}
            events={organizerEvents}
            setEventStatus={setEventStatus}
            goTo={setActive}
          />
        )}

        {active === 'create' && (
          <OrganizerCreateEventMobile
            eventTitle={eventTitle}
            setEventTitle={setEventTitle}
            eventVenue={eventVenue}
            setEventVenue={setEventVenue}
            eventStatus={eventStatus}
            setEventStatus={setEventStatus}
            goTo={setActive}
          />
        )}

        {active === 'details' && (
          <OrganizerDetailsMobile
            eventTitle={eventTitle}
            setEventTitle={setEventTitle}
            eventVenue={eventVenue}
            setEventVenue={setEventVenue}
            eventStatus={eventStatus}
            setEventStatus={setEventStatus}
            goTo={setActive}
          />
        )}

        {active === 'map' && <VenueMapEditor />}

        {active === 'attendees' && (
          <OrganizerAttendeesMobile
            attendees={attendees}
            revenueLabel={money(organizerStats.totalRevenue)}
            onToggle={toggleAttendeeStatus}
            goTo={setActive}
          />
        )}

        {active === 'blocks' && (
          <OrganizerAccessMobile
            items={accessItems}
            onToggle={toggleAccessItem}
            goTo={setActive}
          />
        )}

        {active === 'rewards' && (
          <OrganizerRewardsMobile goTo={setActive} stats={rewardStats} />
        )}

      </ScrollView>
    </View>
  );
}

function PanelCard({ title, eyebrow, copy, children }: { title: string; eyebrow?: string; copy?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.panelCard}>
      {eyebrow && <Text style={styles.formEyebrow}>{eyebrow}</Text>}
      <Text style={styles.panelTitle}>{title}</Text>
      {copy && <Text style={styles.copy}>{copy}</Text>}
      {children}
    </View>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'green' | 'orange' | 'gray' }) {
  return (
    <View style={[styles.statusPill, tone === 'green' ? styles.statusGreen : tone === 'orange' ? styles.statusOrange : styles.statusGray]}>
      <Text style={[styles.statusText, tone === 'green' ? styles.statusTextGreen : tone === 'orange' ? styles.statusTextOrange : styles.statusTextGray]}>{label}</Text>
    </View>
  );
}

function ActionButton({ label, muted, onPress }: { label: string; muted?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.actionButton, muted && styles.actionButtonMuted]}>
      <Text style={[styles.actionButtonText, muted && styles.actionButtonTextMuted]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Attendee({ name, ticket, status, onToggle }: { name: string; ticket: string; status: string; onToggle?: () => void }) {
  return (
    <View style={styles.attendeeCard}>
      <View style={styles.attendeeTop}>
        <View style={styles.attendeeAvatar}>
          <Text style={styles.attendeeAvatarText}>{name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text>
        </View>
        <View style={styles.attendeeCopy}>
          <Text style={styles.listTitle}>{name}</Text>
          <Text style={styles.listSub}>{ticket}</Text>
        </View>
        <StatusPill label={status} tone={status === 'SCANNED' ? 'green' : 'orange'} />
      </View>

      <View style={styles.attendeeActions}>
        <TouchableOpacity onPress={onToggle} style={styles.attendeePrimary}>
          <Text style={styles.attendeePrimaryText}>{status === 'SCANNED' ? 'UNDO SCAN' : 'CHECK IN'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.attendeeSecondary}>
          <Text style={styles.attendeeSecondaryText}>RESEND</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AccessControlCard({ title, type, status, onToggle }: { title: string; type: string; status: string; onToggle: () => void }) {
  return (
    <View style={styles.accessCard}>
      <View style={styles.accessTop}>
        <View style={styles.accessIcon}>
          <Text style={styles.accessIconText}>{type.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.attendeeCopy}>
          <Text style={styles.listTitle}>{title}</Text>
          <Text style={styles.listSub}>{type}</Text>
        </View>
        <StatusPill label={status} tone={status === 'ACTIVE' ? 'green' : 'gray'} />
      </View>

      <TouchableOpacity onPress={onToggle} style={status === 'ACTIVE' ? styles.attendeeSecondaryWide : styles.attendeePrimary}>
        <Text style={status === 'ACTIVE' ? styles.attendeeSecondaryText : styles.attendeePrimaryText}>{status === 'ACTIVE' ? 'PAUSE ACCESS' : 'ACTIVATE'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function AccessItem({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.listCard}>
      <Text style={styles.listTitle}>{title}</Text>
      <Text style={styles.listValue}>{value}</Text>
    </View>
  );
}

function sectionLabel(section: Section, t: (es: string, en: string) => string) {
  const names: Record<Section, string> = {
    dashboard: t('Dashboard', 'Dashboard'),
    events: t('Mis eventos', 'My events'),
    create: t('Crear evento', 'Create event'),
    details: t('Detalles', 'Details'),
    map: t('Mapa visual', 'Visual map'),
    attendees: t('Asistentes', 'Attendees'),
    blocks: t('Bloqueos', 'Access'),
    rewards: t('Recompensas', 'Rewards'),
    scan: t('Escanear', 'Scan'),
  };
  return names[section];
}

function titleFor(section: Section, t: (es: string, en: string) => string) {
  const names: Record<Section, string> = {
    dashboard: t('Panel de organizador', 'Organizer dashboard'),
    events: t('Mis eventos', 'My events'),
    create: t('Crear evento', 'Create event'),
    details: t('Detalles', 'Details'),
    map: t('Mapa visual', 'Visual map'),
    attendees: t('Asistentes y ventas', 'Attendees and sales'),
    blocks: t('Bloqueos e invitaciones', 'Access and invitations'),
    rewards: t('Recompensas', 'Rewards'),
    scan: t('Escanear tickets', 'Scan tickets'),
  };
  return names[section];
}

function subtitleFor(section: Section, t: (es: string, en: string) => string) {
  const copy: Record<Section, string> = {
    dashboard: t('Ventas, tickets, asistentes y balance.', 'Sales, tickets, attendees and balance.'),
    events: t('Administra tus eventos publicados y borradores.', 'Manage your published events and drafts.'),
    create: t('Crea un evento nuevo desde el movil.', 'Create a new event from mobile.'),
    details: t('Edita informacion publica e imagenes.', 'Edit public information and images.'),
    map: t('Mesas, sillas, areas, barras y precios.', 'Tables, seats, areas, bars and prices.'),
    attendees: t('Compradores, tickets y acceso.', 'Buyers, tickets and access.'),
    blocks: t('Reservas, invitaciones y lista VIP.', 'Reservations, invitations and VIP list.'),
    rewards: t('Comisiones, codigos y pagos.', 'Commissions, codes and payouts.'),
    scan: t('Valida tickets en la puerta.', 'Validate tickets at the door.'),
  };
  return copy[section];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.darkBg },
  tabsShell: { height: 82, marginTop: 44, backgroundColor: colors.darkBg, justifyContent: 'center', overflow: 'hidden' },
  tabsScroller: { height: 82, flexGrow: 0, flexShrink: 0, backgroundColor: colors.darkBg },
  tabs: { height: 82, paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tab: { height: 40, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(8,31,51,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.orange, borderColor: colors.orange },
  tabText: { color: '#CBD5E1', fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: '#FFFFFF' },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 140 },
  eyebrow: { color: colors.orange, fontSize: 13, letterSpacing: 4, fontWeight: '900', marginBottom: 8 },
  title: { color: '#F8FAFC', fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#CBD5E1', fontSize: 16, lineHeight: 23, fontWeight: '400', marginBottom: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metric: { width: '48%', backgroundColor: 'rgba(8,31,51,0.82)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 16 },
  metricValue: { color: colors.orange, fontSize: 24, fontWeight: '900', marginBottom: 4 },
  metricLabel: { color: '#CBD5E1', fontSize: 13, fontWeight: '800' },
  panelCard: { backgroundColor: 'rgba(8,31,51,0.82)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 20, marginBottom: 16, shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  formEyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '900', marginBottom: 8 },
  panelTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '900', marginBottom: 8 },
  eventName: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', marginBottom: 6 },
  copy: { color: '#CBD5E1', fontSize: 15, lineHeight: 22, fontWeight: '400', marginBottom: 14 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 14, overflow: 'hidden' },
  progressFill: { width: '24%', height: '100%', backgroundColor: colors.orange },
  eventCard: { backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.goldBorder, padding: 18, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  cardMain: { flex: 1 },
  cardTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '900', marginBottom: 4 },
  cardSub: { color: colors.textFaint, fontSize: 14, fontWeight: '400' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statusPill: { height: 32, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  statusGreen: { backgroundColor: '#DCFCE7' },
  statusOrange: { backgroundColor: '#FFF7ED' },
  statusGray: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statusTextGreen: { color: '#15803d' },
  statusTextOrange: { color: colors.orange },
  statusTextGray: { color: colors.textFaint },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  actionButton: { height: 44, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  actionButtonMuted: { backgroundColor: colors.cardSoft },
  actionButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  actionButtonTextMuted: { color: colors.textPrimary },
  fieldLabel: { color: colors.textFaint, fontSize: 13, fontWeight: '400', marginBottom: 8 },
  input: { height: 58, borderRadius: 17, borderWidth: 1, borderColor: colors.goldBorder, backgroundColor: colors.card, paddingHorizontal: 16, color: colors.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 16 },
  segmentGroup: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  segment: { flex: 1, height: 48, borderRadius: 15, backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.goldBorder, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  segmentActiveOrange: { backgroundColor: colors.orange, borderColor: colors.orange },
  segmentText: { color: colors.textFaint, fontSize: 13, fontWeight: '900' },
  segmentTextActive: { color: '#FFFFFF' },
  formActions: { marginTop: 4, gap: 10 },
  primaryButton: { height: 56, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, letterSpacing: 1.8, fontWeight: '900' },
  secondaryButton: { height: 54, borderRadius: 16, backgroundColor: colors.cardSoft, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.textPrimary, fontSize: 13, letterSpacing: 1.4, fontWeight: '900' },
  mapPreview: { height: 230, backgroundColor: colors.cardSoft, borderRadius: 20, borderWidth: 1, borderColor: colors.goldBorder, marginTop: 8, marginBottom: 16, position: 'relative', overflow: 'hidden' },
  stage: { position: 'absolute', top: 24, left: 30, right: 30, height: 38, borderRadius: 10, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  stageText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  table: { position: 'absolute', top: 92, left: 38, width: 92, height: 70, borderRadius: 14, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  tableTwo: { left: undefined, right: 38, borderColor: '#6366f1' },
  tableText: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
  bar: { position: 'absolute', left: 70, right: 70, bottom: 26, height: 42, borderRadius: 12, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  listCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.cardSoft, borderRadius: 16, borderWidth: 1, borderColor: colors.goldBorder, padding: 14, marginTop: 10 },
  listTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '900' },
  listSub: { color: colors.textFaint, fontSize: 13, fontWeight: '400', marginTop: 3 },
  listValue: { color: colors.orange, fontSize: 20, fontWeight: '900' },
  scanBox: { backgroundColor: colors.navy, borderRadius: 24, padding: 22, alignItems: 'center' },
  scanIcon: { color: colors.orange, fontSize: 42, fontWeight: '900', marginBottom: 8 },
  scanTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginBottom: 6 },
searchBox: {
    height: 54,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.card,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchIcon: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
  },
  searchText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '700',
  },
  attendeeCard: {
    backgroundColor: colors.cardSoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    padding: 14,
    marginTop: 10,
  },
  attendeeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  attendeeAvatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  attendeeCopy: { flex: 1 },
  attendeeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  attendeePrimary: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeePrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  attendeeSecondary: {
    width: 98,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeSecondaryText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
accessCard: {
    backgroundColor: colors.cardSoft,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    padding: 14,
    marginTop: 10,
  },
  accessTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  accessIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessIconText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  attendeeSecondaryWide: {
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
