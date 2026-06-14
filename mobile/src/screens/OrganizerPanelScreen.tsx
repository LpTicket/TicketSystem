import { useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { VenueMapEditor } from '../components/organizer/VenueMapEditor';
import { useLanguage } from '../i18n/LanguageContext';
import { OrganizerDashboardMobile, OrganizerCreateEventMobile, OrganizerDetailsMobile } from '../components/organizer/OrganizerEventForms';
import { OrganizerEventsMobile } from '../components/organizer/OrganizerEventsMobile';
import { OrganizerAttendeesMobile } from '../components/organizer/OrganizerAttendeesMobile';
import { OrganizerAccessMobile } from '../components/organizer/OrganizerAccessMobile';
import { OrganizerRewardsMobile } from '../components/organizer/OrganizerRewardsMobile';
import { apiGet } from '../services/api';

export type Section = 'dashboard' | 'events' | 'create' | 'details' | 'map' | 'attendees' | 'blocks' | 'rewards' | 'scan';


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

// Global sections (always available) vs event sections (only after picking an event).
const GLOBAL_SECTIONS: Section[] = ['dashboard', 'events', 'create'];
const EVENT_SECTIONS: Section[] = ['details', 'map', 'attendees', 'blocks', 'rewards'];
const isEventSection = (s: Section) => EVENT_SECTIONS.includes(s);

type PanelProps = { section?: Section; onSectionChange?: (s: Section) => void };

export function OrganizerPanelScreen({ section, onSectionChange }: PanelProps = {}) {
  const { t } = useLanguage();
  const organizerIndicatorX = useRef(new Animated.Value(0)).current;
  const organizerIndicatorWidth = useRef(new Animated.Value(118)).current;
  const [internalSection, setInternalSection] = useState<Section>('dashboard');
  const active = section ?? internalSection;
  const setActive = (s: Section) => { setInternalSection(s); onSectionChange?.(s); };
  const [tabLayouts, setTabLayouts] = useState<Partial<Record<Section, { x: number; width: number }>>>({});
  const [tabsViewportWidth, setTabsViewportWidth] = useState(0);
  const [tabsContentWidth, setTabsContentWidth] = useState(0);
  const [tabsScrollX, setTabsScrollX] = useState(0);
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
  // The event the organizer is currently managing (null = global view).
  const [selectedEvent, setSelectedEvent] = useState<ReturnType<typeof toOrganizerEvent> | null>(null);

  // Open a specific event in one of its sections.
  const openEvent = (ev: ReturnType<typeof toOrganizerEvent>, toSection: Section) => {
    setSelectedEvent(ev);
    setEventTitle(ev.title);
    setEventVenue(ev.venue);
    setEventStatus(ev.status);
    setActive(toSection);
  };

  const backToEvents = () => {
    setSelectedEvent(null);
    setActive('events');
  };

  const visibleSections = selectedEvent ? EVENT_SECTIONS : GLOBAL_SECTIONS;

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

    return () => {
      mounted = false;
    };
  }, []);

  const [attendees, setAttendees] = useState<MobileAttendee[]>([]);

  // Load attendees for the event currently being managed.
  const selectedEventId = selectedEvent?.id;
  useEffect(() => {
    if (!selectedEventId) { setAttendees([]); return; }
    let mounted = true;

    apiGet<any>(`/orders/event/${selectedEventId}/attendees`)
      .then((data) => {
        if (mounted) setAttendees(listFrom(data).map(toAttendee));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [selectedEventId]);

  // Leaving an event section (e.g. via the bottom bar) returns to the global view.
  useEffect(() => {
    if (!isEventSection(active) && selectedEvent) setSelectedEvent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

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

  const activeSectionIndex = Math.max(0, visibleSections.indexOf(active));
  const showLeftFade = tabsScrollX > 8;
  const showRightFade = tabsViewportWidth > 0 && tabsContentWidth > tabsViewportWidth && tabsScrollX + tabsViewportWidth < tabsContentWidth - 8;

  useEffect(() => {
    const activeLayout = tabLayouts[active];
    const fallbackX = 6 + activeSectionIndex * 130;
    const nextX = activeLayout?.x ?? fallbackX;
    const nextWidth = activeLayout?.width ?? 118;

    Animated.parallel([
      Animated.spring(organizerIndicatorX, {
        toValue: nextX,
        useNativeDriver: false,
        damping: 17,
        stiffness: 190,
        mass: 0.72,
      }),
      Animated.spring(organizerIndicatorWidth, {
        toValue: nextWidth,
        useNativeDriver: false,
        damping: 15,
        stiffness: 150,
        mass: 0.8,
      }),
    ]).start();
  }, [active, activeSectionIndex, organizerIndicatorWidth, organizerIndicatorX, tabLayouts]);

  const toggleAccessItem = (id: string) => {
    setAccessItems((current) => current.map((item) => item.id === id ? { ...item, status: item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' } : item));
  };

  const toggleAttendeeStatus = (id: string) => {
    setAttendees((current) => current.map((item) => item.id === id ? { ...item, status: item.status === 'SCANNED' ? 'PAID' : 'SCANNED' } : item));
  };

  return (
    <View style={styles.root}>
      {/* Section tabs only in event view — global sections live in the bottom bar. */}
      {selectedEvent && (
      <View style={styles.tabsShell}>
        <View style={styles.tabsViewport}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroller}
            contentContainerStyle={styles.tabs}
            onLayout={(event) => setTabsViewportWidth(event.nativeEvent.layout.width)}
            onContentSizeChange={(width) => setTabsContentWidth(width)}
            onScroll={(event) => setTabsScrollX(event.nativeEvent.contentOffset.x)}
            scrollEventThrottle={16}
          >
            <Animated.View
              style={[
                styles.organizerSlidingPill,
                {
                  left: organizerIndicatorX,
                  width: organizerIndicatorWidth,
                },
              ]}
            />
            {visibleSections.map((item) => (
              <OrganizerTab
                key={item}
                label={sectionLabel(item, t)}
                active={active === item}
                onPress={() => setActive(item)}
                onLayout={(x, width) => setTabLayouts((current) => ({ ...current, [item]: { x, width } }))}
              />
            ))}
          </ScrollView>

          {showLeftFade && (
            <LinearGradient
              pointerEvents="none"
              colors={['#030B14', 'rgba(3,11,20,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.tabsFade, styles.tabsFadeLeft]}
            />
          )}

          {showRightFade && (
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(3,11,20,0)', '#030B14']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.tabsFade, styles.tabsFadeRight]}
            />
          )}

        </View>
        <View pointerEvents="none" style={styles.tabsDots}>
          {visibleSections.map((item) => (
            <View key={item} style={[styles.tabsDot, active === item && styles.tabsDotActive]} />
          ))}
        </View>
      </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, !selectedEvent && { paddingTop: 44 }]}>
        {selectedEvent ? (
          <TouchableOpacity style={styles.eventBackChip} onPress={backToEvents}>
            <Text style={styles.eventBackArrow}>‹</Text>
            <Text style={styles.eventBackText} numberOfLines={1}>{selectedEvent.title}</Text>
          </TouchableOpacity>
        ) : null}
        <Text style={styles.eyebrow}>{selectedEvent ? t('EVENTO', 'EVENT') : t('ORGANIZADOR', 'ORGANIZER')}</Text>
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
            onOpen={(ev, toSection) => openEvent(ev, toSection)}
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
          <OrganizerRewardsMobile goTo={setActive} />
        )}

      </ScrollView>
    </View>
  );
}

function OrganizerTab({ label, active, onPress, onLayout }: { label: string; active: boolean; onPress: () => void; onLayout: (x: number, width: number) => void }) {
  const arrival = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(arrival, {
      toValue: active ? 1 : 0,
      friction: 7,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [active, arrival]);

  const animatedStyle = {
    transform: [
      {
        scale: arrival.interpolate({
          inputRange: [0, 1],
          outputRange: [0.96, 1],
        }),
      },
      {
        translateY: arrival.interpolate({
          inputRange: [0, 1],
          outputRange: [2, 0],
        }),
      },
    ],
  };

  return (
    <Animated.View
      onLayout={(event) => onLayout(event.nativeEvent.layout.x, event.nativeEvent.layout.width)}
      style={[styles.tabMotion, active && animatedStyle]}
    >
      <TouchableOpacity activeOpacity={0.86} onPress={onPress} style={styles.tab}>
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
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
          <Text style={styles.attendeeSecondaryText}>Resend</Text>
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
  root: { flex: 1, backgroundColor: 'transparent' },
  tabsShell: { height: 94, marginTop: 44, backgroundColor: 'transparent', justifyContent: 'center', overflow: 'visible' },
  tabsViewport: { height: 62, marginHorizontal: 16, borderRadius: 20, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  tabsScroller: { height: 62, flexGrow: 0, flexShrink: 0, backgroundColor: 'transparent' },
  tabs: { height: 60, paddingLeft: 6, paddingRight: 46, gap: 6, alignItems: 'center', backgroundColor: 'transparent', position: 'relative' },
  organizerSlidingPill: { position: 'absolute', top: 7, height: 46, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)', zIndex: 0, overflow: 'hidden', shadowColor: '#FFFFFF', shadowOpacity: 0.16, shadowRadius: 13, shadowOffset: { width: 0, height: 6 } },
  tabMotion: { height: 46, justifyContent: 'center', zIndex: 1 },
  tab: { height: 46, minWidth: 124, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  tabActive: {},
  tabText: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },
  tabsFade: { position: 'absolute', top: 1, bottom: 1, width: 42, zIndex: 3 },
  tabsFadeLeft: { left: 0 },
  tabsFadeRight: { right: 0 },
  tabsDots: { height: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 5 },
  tabsDot: { width: 4, height: 4, borderRadius: 999, backgroundColor: 'rgba(226,232,240,0.24)' },
  tabsDotActive: { width: 14, backgroundColor: 'rgba(249,115,22,0.72)' },
  content: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 140 },
  eventBackChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  eventBackArrow: { color: colors.orange, fontSize: 18, fontWeight: '900', marginTop: -2 },
  eventBackText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', maxWidth: 240 },
  eyebrow: { color: colors.orange, fontSize: 13, letterSpacing: 0, fontWeight: '700', marginBottom: 8 },
  title: { color: '#F8FAFC', fontSize: 32, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#CBD5E1', fontSize: 16, lineHeight: 23, fontWeight: '400', marginBottom: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metric: { width: '48%', backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14 },
  metricValue: { color: colors.orange, fontSize: 24, fontWeight: '700', marginBottom: 4 },
  metricLabel: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  panelCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 18, marginBottom: 16, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  formEyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '700', marginBottom: 8 },
  panelTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '700', marginBottom: 8 },
  eventName: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 6 },
  copy: { color: '#CBD5E1', fontSize: 15, lineHeight: 22, fontWeight: '400', marginBottom: 14 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 14, overflow: 'hidden' },
  progressFill: { width: '24%', height: '100%', backgroundColor: colors.orange },
  eventCard: { backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.goldBorder, padding: 18, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cardMain: { flex: 1 },
  cardTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 4 },
  cardSub: { color: colors.textFaint, fontSize: 14, fontWeight: '400' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statusPill: { height: 32, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  statusGreen: { backgroundColor: '#DCFCE7' },
  statusOrange: { backgroundColor: '#FFF7ED' },
  statusGray: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0 },
  statusTextGreen: { color: '#15803d' },
  statusTextOrange: { color: colors.orange },
  statusTextGray: { color: colors.textFaint },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  actionButton: { height: 44, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  actionButtonMuted: { backgroundColor: colors.cardSoft },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  actionButtonTextMuted: { color: colors.textPrimary },
  fieldLabel: { color: colors.textFaint, fontSize: 13, fontWeight: '400', marginBottom: 8 },
  input: { height: 58, borderRadius: 17, borderWidth: 1, borderColor: colors.goldBorder, backgroundColor: colors.card, paddingHorizontal: 16, color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 16 },
  segmentGroup: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  segment: { flex: 1, height: 48, borderRadius: 15, backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.goldBorder, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  segmentActiveOrange: { backgroundColor: colors.orange, borderColor: colors.orange },
  segmentText: { color: colors.textFaint, fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: '#FFFFFF' },
  formActions: { marginTop: 4, gap: 10 },
  primaryButton: { height: 56, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '700' },
  secondaryButton: { height: 54, borderRadius: 16, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#F8FAFC', fontSize: 13, letterSpacing: 0, fontWeight: '700' },
  mapPreview: { height: 230, backgroundColor: colors.cardSoft, borderRadius: 20, borderWidth: 1, borderColor: colors.goldBorder, marginTop: 8, marginBottom: 16, position: 'relative', overflow: 'hidden' },
  stage: { position: 'absolute', top: 24, left: 30, right: 30, height: 38, borderRadius: 10, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  stageText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0 },
  table: { position: 'absolute', top: 92, left: 38, width: 92, height: 70, borderRadius: 14, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  tableTwo: { left: undefined, right: 38, borderColor: '#6366f1' },
  tableText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  bar: { position: 'absolute', left: 70, right: 70, bottom: 26, height: 42, borderRadius: 12, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  listCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.cardSoft, borderRadius: 16, borderWidth: 1, borderColor: colors.goldBorder, padding: 14, marginTop: 10 },
  listTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  listSub: { color: colors.textFaint, fontSize: 13, fontWeight: '400', marginTop: 3 },
  listValue: { color: colors.orange, fontSize: 20, fontWeight: '700' },
  scanBox: { backgroundColor: colors.navy, borderRadius: 24, padding: 22, alignItems: 'center' },
  scanIcon: { color: colors.orange, fontSize: 42, fontWeight: '700', marginBottom: 8 },
  scanTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 6 },
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
    letterSpacing: 0,
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
    fontWeight: '700',
    letterSpacing: 0,
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
    fontWeight: '700',
  },
  attendeeSecondaryWide: {
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
