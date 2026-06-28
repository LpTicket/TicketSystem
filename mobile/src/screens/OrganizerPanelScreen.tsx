/**
 * OrganizerPanelScreen (mobile)
 * EN: The organizer hub and per-event editor. Global sections: Dashboard, My
 *     events, Create. Per-event tabs mirror the web editor 1:1 — Analytics,
 *     Details & Media, Overview, Attendees, Venue Map, Blocks & Invitations,
 *     Commission. Also used by admins to manage another organizer's event.
 * ES: El centro del organizador y el editor por evento. Secciones globales:
 *     Dashboard, Mis eventos, Crear. Las pestañas por evento replican el editor
 *     web 1:1 — Analytics, Detalles e Imágenes, Resumen, Asistentes, Mapa Visual,
 *     Bloqueos e Invitaciones, Comisión. También lo usan los admins para
 *     gestionar el evento de otro organizador.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Alert, Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { VenueMapEditor } from '../components/organizer/VenueMapEditor';
import { useLanguage } from '../i18n/LanguageContext';
import { OrganizerDashboardMobile, OrganizerCreateEventMobile, OrganizerDetailsMobile } from '../components/organizer/OrganizerEventForms';
import { OrganizerEventsMobile } from '../components/organizer/OrganizerEventsMobile';
import { OrganizerAttendeesMobile } from '../components/organizer/OrganizerAttendeesMobile';
import { OrganizerAccessMobile } from '../components/organizer/OrganizerAccessMobile';
import { OrganizerRewardsMobile } from '../components/organizer/OrganizerRewardsMobile';
import { OrganizerAnalyticsMobile } from '../components/organizer/OrganizerAnalyticsMobile';
import { OrganizerOverviewMobile } from '../components/organizer/OrganizerOverviewMobile';
import { OrganizerCommissionMobile } from '../components/organizer/OrganizerCommissionMobile';
import { OrganizerBlocksMobile } from '../components/organizer/OrganizerBlocksMobile';
import { apiGet, apiPatch, apiPost, getImageUrl } from '../services/api';

export type Section = 'dashboard' | 'events' | 'create' | 'analytics' | 'details' | 'overview' | 'attendees' | 'map' | 'blocks' | 'commission' | 'rewards' | 'scan';


type OrganizerApiEvent = {
  id?: string;
  title?: string;
  venueName?: string;
  venueAddress?: string;
  eventDate?: string;
  eventTimezone?: string;
  category?: string;
  categoryName?: string;
  status?: string;
  capacity?: number;
  totalCapacity?: number;
  soldTickets?: number;
  ticketsSold?: number;
  totalRevenue?: number;
  creatorCommission?: number;
  pendingCreatorCommission?: number | null;
  revenue?: number;
  totalOrders?: number;
  imageUrl?: string | null;
  bannerImageUrl?: string | null;
  minPrice?: number;
  sections?: any[];
  seatMap?: any[];
  seatmap?: any[];
};

type OrganizerStats = {
  totalRevenue?: number;
  totalTickets?: number;
  activeEvents?: number;
  totalOrders?: number;
  scannedTickets?: number;
  pendingTickets?: number;
  netEstimated?: number;
  salesByDay?: { date: string; orders: number; tickets: number; revenue: number }[];
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

function formatEventDate(value?: string, timeZone?: string) {
  if (!value) return 'Date coming soon';
  try {
    return new Intl.DateTimeFormat('en-US', { ...(timeZone ? { timeZone } : {}), month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  } catch {
    return value;
  }
}

function sectionsFrom(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  return payload?.sections || payload?.data || [];
}

function capacityFromSections(sections: any[]) {
  return sections.reduce((sum, section) => {
    const type = String(section?.sectionType || '').toLowerCase();
    if (type === 'stage' || type === 'decor') return sum;
    if (type === 'standing') return sum + (Number(section.capacity) || 0);
    const realSeats = Array.isArray(section?.seats) ? section.seats.length : 0;
    if (realSeats > 0) return sum + realSeats;
    return sum + Number(section?.rows || 0) * Number(section?.seatsPerRow || 0);
  }, 0);
}

function toOrganizerEvent(event: OrganizerApiEvent, index: number): {
  id: string; title: string; venue: string; date: string; eventDate: string; time: string;
  category: string; capacity: number; sold: number; revenue: string; revenueAmount: number; orders: number;
  status: 'draft' | 'published' | 'cancelled'; imageUrl: string; minPrice?: number;
  creatorCommission?: number; pendingCreatorCommission?: number | null;
} {
  const mapCapacity = capacityFromSections(sectionsFrom(event.sections || event.seatMap || event.seatmap));
  const capacity = Number(event.capacity || event.totalCapacity || mapCapacity || 0);
  const sold = Number(event.soldTickets || event.ticketsSold || 0);
  const revenueAmount = Number(event.totalRevenue || event.revenue || 0);
  return {
    id: String(event.id || index),
    title: event.title || 'Evento',
    venue: event.venueName || event.venueAddress || 'Venue',
    date: formatEventDate(event.eventDate, event.eventTimezone),
    eventDate: event.eventDate || '',
    time: '',
    category: event.categoryName || event.category || 'Event',
    capacity,
    sold,
    revenue: money(revenueAmount),
    revenueAmount,
    orders: Number(event.totalOrders || 0),
    status: (['published', 'draft', 'cancelled'].includes(event.status || '') ? event.status : 'draft') as 'draft' | 'published' | 'cancelled',
    imageUrl: getImageUrl(event.imageUrl || event.bannerImageUrl),
    minPrice: event.minPrice ? Number(event.minPrice) : undefined,
    creatorCommission: Number(event.creatorCommission || 0),
    pendingCreatorCommission: event.pendingCreatorCommission ?? null,
  };
}
type OrganizerMobileEvent = ReturnType<typeof toOrganizerEvent>;

// Global sections (always available) vs event sections (only after picking an event).
const GLOBAL_SECTIONS: Section[] = ['dashboard', 'events', 'create'];
const EVENT_SECTIONS: Section[] = ['analytics', 'details', 'overview', 'attendees', 'map', 'blocks', 'commission', 'rewards'];
const isEventSection = (s: Section) => EVENT_SECTIONS.includes(s);

type PanelProps = { section?: Section; onSectionChange?: (s: Section) => void; adminEvent?: any; onAdminBack?: () => void; refreshKey?: number; scrollToTopSignal?: number };

export function OrganizerPanelScreen({ section, onSectionChange, adminEvent, onAdminBack, refreshKey = 0, scrollToTopSignal = 0 }: PanelProps = {}) {
  const { t } = useLanguage();
  const organizerIndicatorX = useRef(new Animated.Value(0)).current;
  const organizerIndicatorWidth = useRef(new Animated.Value(118)).current;
  const tabsScrollRef = useRef<ScrollView>(null);
  const panelScrollRef = useRef<ScrollView>(null);
  const [internalSection, setInternalSection] = useState<Section>(adminEvent ? 'details' : 'dashboard');
  const active = section ?? internalSection;
  const setActive = (s: Section) => { setInternalSection(s); onSectionChange?.(s); };
  const [tabLayouts, setTabLayouts] = useState<Partial<Record<Section, { x: number; width: number }>>>({});
  const [tabsViewportWidth, setTabsViewportWidth] = useState(0);
  const [tabsContentWidth, setTabsContentWidth] = useState(0);
  const [tabsScrollX, setTabsScrollX] = useState(0);

  useEffect(() => {
    if (!scrollToTopSignal) return;
    panelScrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [scrollToTopSignal]);

  // Seed state from adminEvent if provided (admin viewing an organizer's event)
  const [eventTitle, setEventTitle] = useState(adminEvent?.title || 'Noche de (des)amor');
  const [eventVenue, setEventVenue] = useState(adminEvent?.venueName || adminEvent?.venue || 'Ambriza');
  const [eventStatus, setEventStatus] = useState<'draft' | 'published' | 'cancelled'>(adminEvent?.status === 'draft' ? 'draft' : adminEvent?.status === 'cancelled' ? 'cancelled' : 'published');
  const [accessItems, setAccessItems] = useState<{ id: string; title: string; type: string; status: string }[]>([]);
  const [organizerEvents, setOrganizerEvents] = useState<OrganizerMobileEvent[]>([]);
  const [organizerEventsError, setOrganizerEventsError] = useState('');
  const [rawEventsById, setRawEventsById] = useState<Record<string, any>>({});
  const [organizerStats, setOrganizerStats] = useState<OrganizerStats>({});
  // The event the organizer is currently managing (null = global view).
  const [selectedEvent, setSelectedEvent] = useState<OrganizerMobileEvent | null>(
    adminEvent ? toOrganizerEvent(adminEvent, 0) : null
  );
  const [rewardStats, setRewardStats] = useState<{ balance: number; activeCodes: number; totalPaid: number; pending: number } | null>(null);

  // Open a specific event in one of its sections.
  const openEvent = (ev: OrganizerMobileEvent, toSection: Section) => {
    setSelectedEvent(ev);
    setEventTitle(ev.title);
    setEventVenue(ev.venue);
    setEventStatus(ev.status);
    setActive(toSection);
  };

  const backToEvents = () => {
    if (adminEvent && onAdminBack) { onAdminBack(); return; }
    setSelectedEvent(null);
    setActive('events');
  };

  // In admin mode: always show event sections; otherwise depend on selectedEvent
  const visibleSections = (selectedEvent || adminEvent) ? EVENT_SECTIONS : GLOBAL_SECTIONS;

  const reloadOrganizerSummary = useCallback(async () => {
    try {
      const data = await apiGet<any>('/events/mine/list');
      const raw = listFrom(data);

      const byId: Record<string, any> = {};
      raw.forEach((e: any) => { if (e?.id) byId[String(e.id)] = e; });
      setRawEventsById(byId);
      const items: OrganizerMobileEvent[] = raw.map(toOrganizerEvent);
      setOrganizerEvents(items);
      setOrganizerEventsError('');

      const missingCapacity = items.filter((item) => item.capacity <= 0 && item.id);
      if (missingCapacity.length > 0) {
        Promise.all(
          missingCapacity.map(async (item) => {
            try {
              const seatmap = await apiGet<any>(`/events/${item.id}/seatmap`);
              return { id: item.id, capacity: capacityFromSections(sectionsFrom(seatmap)) };
            } catch {
              try {
                const sections = await apiGet<any>(`/events/${item.id}/sections`);
                return { id: item.id, capacity: capacityFromSections(sectionsFrom(sections)) };
              } catch {
                return { id: item.id, capacity: 0 };
              }
            }
          }),
        ).then((capacities: { id: string; capacity: number }[]) => {
          const byId = capacities.reduce<Record<string, number>>((acc, item: { id: string; capacity: number }) => {
            if (item.capacity > 0) acc[item.id] = item.capacity;
            return acc;
          }, {});
          if (Object.keys(byId).length === 0) return;
          setOrganizerEvents((prev) => prev.map((event) => (
            byId[event.id] ? { ...event, capacity: byId[event.id] } : event
          )));
        });
      }

      const first = items[0];
      if (first && !selectedEvent && !adminEvent) {
        setEventTitle(first.title);
        setEventVenue(first.venue);
        setEventStatus(first.status);
      }
    } catch {
      setOrganizerEventsError(t('No se pudieron cargar los eventos.', 'Could not load events.'));
    }

    try {
      const data = await apiGet<OrganizerStats>('/orders/organizer/stats');
      setOrganizerStats(data || {});
    } catch {}
  }, [adminEvent, selectedEvent, t]);

  useEffect(() => {
    reloadOrganizerSummary();
  }, [reloadOrganizerSummary]);

  const [attendees, setAttendees] = useState<MobileAttendee[]>([]);
  // Raw attendee rows (status 'used'/'active'/'cancelled', sectionName, seats)
  // kept for Analytics and Blocks which need the real backend fields.
  const [attendeesRaw, setAttendeesRaw] = useState<any[]>([]);

  // Load attendees for the event currently being managed.
  const selectedEventId = selectedEvent?.id ?? (adminEvent ? String(adminEvent.id) : undefined);
  useEffect(() => {
    if (!selectedEventId) { setAttendees([]); setAttendeesRaw([]); return; }
    let mounted = true;

    apiGet<any>(`/orders/event/${selectedEventId}/attendees`)
      .then((data) => {
        if (!mounted) return;
        const list = listFrom(data);
        setAttendeesRaw(list);
        setAttendees(list.map(toAttendee));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [selectedEventId]);

  // Load access items (special codes) for the selected event.
  useEffect(() => {
    if (!selectedEventId) { setAccessItems([]); return; }
    apiGet<any[]>(`/special-codes/by-event/${selectedEventId}`)
      .then((data) => {
        const items = (Array.isArray(data) ? data : []).map((code: any) => ({
          id: String(code.id),
          title: code.code,
          type: code.type || 'Codigo especial',
          status: code.isActive ? 'ACTIVE' : 'PAUSED',
        }));
        setAccessItems(items);
      })
      .catch(() => {});
  }, [selectedEventId]);

  // Full event detail — use the raw data already fetched by getOrganizerEvents
  // (which returns every entity field). The backend has no GET /events/:id route
  // that accepts a UUID; the public route matches slugs, not UUIDs.
  // For admin-injected events (adminEvent prop) we may not have rawEventsById,
  // so fall back to a PATCH-safe fetch via the slug if available.
  const [fullEventData, setFullEventData] = useState<any | null>(null);
  const [fullEventLoading, setFullEventLoading] = useState(false);
  useEffect(() => {
    if (!selectedEventId) { setFullEventData(null); return; }

    // Use cached raw data from the organizer list (has all entity fields).
    const cached = rawEventsById[selectedEventId] ?? adminEvent ?? null;
    if (cached?.id) {
      setFullEventData(cached);
      if (cached.title) setEventTitle(cached.title);
      if (cached.venueName) setEventVenue(cached.venueName);
      if (cached.status && ['draft', 'published', 'cancelled'].includes(cached.status)) setEventStatus(cached.status as any);
      return;
    }

    // Fallback: try fetching by slug (only works if adminEvent has slug field).
    const slug = adminEvent?.slug;
    if (!slug) { setFullEventData(null); return; }

    let mounted = true;
    setFullEventLoading(true);
    apiGet<any>(`/events/${slug}`)
      .then((data) => {
        if (!mounted || !data?.id) return;
        setFullEventData(data);
        if (data.title) setEventTitle(data.title);
        if (data.venueName) setEventVenue(data.venueName);
        if (data.status && ['draft', 'published', 'cancelled'].includes(data.status)) setEventStatus(data.status as any);
      })
      .catch(() => {})
      .finally(() => { if (mounted) setFullEventLoading(false); });
    return () => { mounted = false; };
  }, [selectedEventId, rawEventsById, adminEvent]);

  // Load sales + sections (seatmap) for the selected event — feeds Analytics,
  // Overview and Blocks (mirror of the web editor's loadEvent).
  const [eventSales, setEventSales] = useState<any | null>(null);
  const [eventSections, setEventSections] = useState<any[]>([]);
  const reloadEventData = useCallback(async () => {
    if (!selectedEventId) { setEventSales(null); setEventSections([]); return; }
    try {
      const sales = await apiGet<any>(`/orders/event/${selectedEventId}/sales`);
      setEventSales(sales || null);
    } catch { setEventSales(null); }
    try {
      const secs = await apiGet<any[]>(`/events/${selectedEventId}/seatmap`);
      setEventSections(Array.isArray(secs) ? secs : []);
    } catch {
      try {
        const secs = await apiGet<any[]>(`/events/${selectedEventId}/sections`);
        setEventSections(Array.isArray(secs) ? secs : []);
      } catch { setEventSections([]); }
    }
  }, [selectedEventId]);
  useEffect(() => { reloadEventData(); }, [reloadEventData]);

  useEffect(() => {
    if (!refreshKey) return;
    reloadOrganizerSummary();
    reloadEventData();
  }, [refreshKey, reloadOrganizerSummary, reloadEventData]);

  useEffect(() => {
    if (active === 'dashboard' || active === 'analytics' || active === 'attendees' || active === 'events') {
      reloadOrganizerSummary();
      reloadEventData();
    }
  }, [active, reloadOrganizerSummary, reloadEventData]);

  // Load event reward stats every time this event's rewards section is opened.
  useEffect(() => {
    if (active !== 'rewards') return;
    if (!selectedEventId) { setRewardStats(null); return; }
    apiGet<any>(`/special-codes/by-event/${selectedEventId}/payout-summary`)
      .then((data) => {
        setRewardStats({
          balance: Number(data?.balance || 0),
          activeCodes: Number(data?.activeCodes || 0),
          totalPaid: Number(data?.totalPaid || 0),
          pending: Number(data?.pending ?? data?.balance ?? 0),
        });
      })
      .catch(() => setRewardStats(null));
  }, [active, selectedEventId]);

  // Leaving an event section (e.g. via the bottom bar) returns to the global view.
  useEffect(() => {
    if (!isEventSection(active) && selectedEvent) setSelectedEvent(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    panelScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [active, selectedEventId]);

  const firstEvent = organizerEvents[0];
  const activeEvents = organizerEvents.filter((e) => e.status === 'published').length;
  const visibleTotals = organizerEvents.reduce((totals, event) => ({
    capacity: totals.capacity + Number(event.capacity || 0),
    sold: totals.sold + Number(event.sold || 0),
    revenue: totals.revenue + Number(event.revenueAmount || 0),
    orders: totals.orders + Number(event.orders || 0),
  }), { capacity: 0, sold: 0, revenue: 0, orders: 0 });
  const statsHaveLiveData = Boolean(
    Number(organizerStats.totalRevenue || 0) ||
    Number(organizerStats.totalTickets || 0) ||
    Number(organizerStats.totalOrders || 0)
  );
  const capacity = visibleTotals.capacity || firstEvent?.capacity || 0;
  const sold = statsHaveLiveData ? Number(organizerStats.totalTickets ?? visibleTotals.sold) : visibleTotals.sold;
  const scanned = Number(organizerStats.scannedTickets ?? 0);
  const soldPct = capacity > 0 ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;

  const dashMetrics = {
    revenue: money(statsHaveLiveData ? organizerStats.totalRevenue : visibleTotals.revenue),
    ticketsSold: String(statsHaveLiveData ? Number(organizerStats.totalTickets || 0) : visibleTotals.sold),
    activeEvents: String(activeEvents),
    orders: String(statsHaveLiveData ? Number(organizerStats.totalOrders || 0) : visibleTotals.orders),
    netEstimated: money(Number(organizerStats.netEstimated || 0)),
  };
  const pending = Number(organizerStats.pendingTickets ?? 0);
  const selectedEventRevenue = eventSales?.totalRevenue ?? selectedEvent?.revenueAmount ?? 0;

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

    // Scroll the tab bar so the active tab is centred in view.
    if (activeLayout && tabsScrollRef.current) {
      const scrollTarget = Math.max(0, activeLayout.x - tabsViewportWidth / 2 + activeLayout.width / 2);
      tabsScrollRef.current.scrollTo({ x: scrollTarget, animated: true });
    }
  }, [active, activeSectionIndex, organizerIndicatorWidth, organizerIndicatorX, tabLayouts, tabsViewportWidth]);

  const handleTogglePublish = async (event: ReturnType<typeof toOrganizerEvent>) => {
    const newStatus: 'draft' | 'published' = event.status === 'published' ? 'draft' : 'published';
    try {
      if (newStatus === 'published') {
        await apiPost(`/events/${event.id}/publish`, {});
      } else {
        await apiPatch(`/events/${event.id}`, { status: 'draft' });
      }
      setOrganizerEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, status: newStatus } : e));
      if (selectedEvent?.id === event.id) setEventStatus(newStatus);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not change event status');
    }
  };

  const handleEventCreated = (newEventData: any) => {
    const newEvent = toOrganizerEvent(newEventData, organizerEvents.length);
    setOrganizerEvents((prev) => [newEvent, ...prev]);
  };

  const toggleAccessItem = async (id: string) => {
    const item = accessItems.find((a) => a.id === id);
    if (!item) return;
    const nextActive = item.status !== 'ACTIVE';
    // Optimistic flip, revert if the request fails.
    setAccessItems((current) => current.map((a) => a.id === id ? { ...a, status: nextActive ? 'ACTIVE' : 'PAUSED' } : a));
    try {
      await apiPatch(`/special-codes/${id}`, { isActive: nextActive });
    } catch (err: any) {
      setAccessItems((current) => current.map((a) => a.id === id ? { ...a, status: nextActive ? 'PAUSED' : 'ACTIVE' } : a));
      Alert.alert('Error', err?.message || t('No se pudo actualizar el acceso', 'Could not update access'));
    }
  };

  const toggleAttendeeStatus = async (id: string) => {
    const attendee = attendees.find((a) => a.id === id);
    if (!attendee) return;
    if (attendee.status === 'SCANNED') {
      setAttendees((current) => current.map((item) => item.id === id ? { ...item, status: 'PAID' } : item));
      return;
    }
    try {
      await apiPost(`/orders/ticket/${attendee.code}/validate`, {});
      setAttendees((current) => current.map((item) => item.id === id ? { ...item, status: 'SCANNED' } : item));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not check in attendee');
    }
  };

  const handleResendAttendee = async (id: string) => {
    const attendee = attendees.find((a) => a.id === id);
    if (!attendee?.code) return;
    try {
      await apiPost(`/orders/ticket/${attendee.code}/resend-email`, {});
      Alert.alert(t('Enviado', 'Sent'), t('Ticket reenviado al comprador.', 'Ticket resent to buyer.'));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not resend ticket');
    }
  };

  return (
    <View style={styles.root}>
      {/* Section tabs only in event view — global sections live in the bottom bar. */}
      {selectedEvent && (
      <View style={styles.tabsShell}>
        <View style={styles.tabsRow}>
          {/* Left arrow */}
          <TouchableOpacity
            style={styles.tabArrowBtn}
            onPress={() => {
              const idx = EVENT_SECTIONS.indexOf(active);
              if (idx > 0) setActive(EVENT_SECTIONS[idx - 1]);
            }}
            disabled={EVENT_SECTIONS.indexOf(active) <= 0}
            activeOpacity={0.6}
          >
            <Ionicons
              name="chevron-back"
              size={19}
              color={EVENT_SECTIONS.indexOf(active) <= 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)'}
            />
          </TouchableOpacity>

          <View style={styles.tabsViewport}>
            <ScrollView
              ref={tabsScrollRef}
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

          {/* Right arrow */}
          <TouchableOpacity
            style={styles.tabArrowBtn}
            onPress={() => {
              const idx = EVENT_SECTIONS.indexOf(active);
              if (idx < EVENT_SECTIONS.length - 1) setActive(EVENT_SECTIONS[idx + 1]);
            }}
            disabled={EVENT_SECTIONS.indexOf(active) >= EVENT_SECTIONS.length - 1}
            activeOpacity={0.6}
          >
            <Ionicons
              name="chevron-forward"
              size={19}
              color={EVENT_SECTIONS.indexOf(active) >= EVENT_SECTIONS.length - 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.85)'}
            />
          </TouchableOpacity>
        </View>

        <View pointerEvents="none" style={styles.tabsDots}>
          {visibleSections.map((item) => (
            <View key={item} style={[styles.tabsDot, active === item && styles.tabsDotActive]} />
          ))}
        </View>
      </View>
      )}

      <ScrollView ref={panelScrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, !selectedEvent && { paddingTop: 44 }]}>
        {selectedEvent ? (
          <TouchableOpacity style={styles.eventBackChip} onPress={backToEvents}>
            <Text style={styles.eventBackArrow}>‹</Text>
            <Text style={styles.eventBackText} numberOfLines={1}>{selectedEvent.title}</Text>
          </TouchableOpacity>
        ) : null}
        {active !== 'events' && (
          <>
            <Text style={styles.eyebrow}>{selectedEvent ? t('EVENTO', 'EVENT') : t('ORGANIZADOR', 'ORGANIZER')}</Text>
            <Text style={styles.title}>{titleFor(active, t)}</Text>
            <Text style={styles.subtitle}>{subtitleFor(active, t)}</Text>
          </>
        )}

        {active === 'dashboard' && (
          <OrganizerDashboardMobile
            eventTitle={eventTitle}
            eventVenue={eventVenue}
            eventStatus={eventStatus}
            eventDateLabel={firstEvent?.date}
            metrics={dashMetrics}
            summary={{ capacity, sold, scanned, soldPct, pending }}
            events={organizerEvents}
            salesByDay={organizerStats.salesByDay ?? []}
            onOpenEvent={(id) => {
              const ev = organizerEvents.find((e) => e.id === id);
              if (ev) openEvent(ev, 'analytics');
            }}
            goTo={setActive}
          />
        )}

        {active === 'events' && (
          <OrganizerEventsMobile
            eventTitle={eventTitle}
            eventVenue={eventVenue}
            eventStatus={eventStatus}
            events={organizerEvents}
            errorMessage={organizerEventsError}
            setEventStatus={setEventStatus}
            goTo={setActive}
            onOpen={(ev, toSection) => openEvent(ev, toSection)}
            onTogglePublish={handleTogglePublish}
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
            onEventCreated={handleEventCreated}
          />
        )}

        {active === 'details' && (
          fullEventLoading
            ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 }}><ActivityIndicator color={colors.orange} size="large" /></View>
            : <OrganizerDetailsMobile
                key={fullEventData?.id ?? 'details'}
                eventTitle={eventTitle}
                setEventTitle={setEventTitle}
                eventVenue={eventVenue}
                setEventVenue={setEventVenue}
                eventStatus={eventStatus}
                setEventStatus={setEventStatus}
                goTo={setActive}
                selectedEventId={selectedEventId}
                event={fullEventData}
              />
        )}

        {active === 'analytics' && (
          <OrganizerAnalyticsMobile
            sales={eventSales}
            attendees={attendeesRaw}
            sections={eventSections}
            eventTitle={selectedEvent?.title ?? adminEvent?.title}
          />
        )}

        {active === 'overview' && <OrganizerOverviewMobile sections={eventSections} />}

        {active === 'map' && <VenueMapEditor eventId={selectedEventId} />}

        {active === 'attendees' && (
          <OrganizerAttendeesMobile
            attendees={attendees}
            revenueLabel={money(selectedEventRevenue)}
            onToggle={toggleAttendeeStatus}
            onResend={handleResendAttendee}
            goTo={setActive}
            eventId={selectedEventId}
            event={fullEventData}
            eventTitle={selectedEvent?.title ?? adminEvent?.title}
            sales={eventSales}
          />
        )}

        {active === 'blocks' && (
          <OrganizerBlocksMobile
            eventId={selectedEventId}
            sections={eventSections}
            onReload={reloadEventData}
          />
        )}

        {active === 'commission' && (
          <OrganizerCommissionMobile
            eventId={selectedEventId}
            eventStatus={eventStatus}
            sections={eventSections}
            initialCommission={selectedEvent?.creatorCommission ?? (adminEvent ? Number(adminEvent.creatorCommission || 0) : undefined)}
            pendingCommission={selectedEvent?.pendingCreatorCommission ?? adminEvent?.pendingCreatorCommission}
          />
        )}

        {active === 'rewards' && (
          <OrganizerRewardsMobile
            goTo={setActive}
            stats={rewardStats ?? undefined}
          />
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
    analytics: t('Analytics', 'Analytics'),
    details: t('Detalles', 'Details & Media'),
    overview: t('Secciones', 'Sections'),
    map: t('Mapa visual', 'Venue Map'),
    attendees: t('Asistentes', 'Attendees & Sales'),
    blocks: t('Bloqueos', 'Blocks'),
    commission: t('Comisión', 'Commission'),
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
    analytics: t('Analytics del evento', 'Event analytics'),
    details: t('Detalles e imágenes', 'Details and media'),
    overview: t('Resumen de secciones', 'Sections overview'),
    map: t('Mapa visual', 'Visual map'),
    attendees: t('Asistentes y ventas', 'Attendees and sales'),
    blocks: t('Bloqueos e invitaciones', 'Blocks and invitations'),
    commission: t('Comisión del creador', 'Creator commission'),
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
    analytics: t('Ventas, acceso y rendimiento por sección.', 'Sales, access and section performance.'),
    details: t('Edita informacion publica e imagenes.', 'Edit public information and images.'),
    overview: t('Secciones, capacidad y precios del evento.', 'Event sections, capacity and prices.'),
    map: t('Mesas, sillas, areas, barras y precios.', 'Tables, seats, areas, bars and prices.'),
    attendees: t('Compradores, tickets y acceso.', 'Buyers, tickets and access.'),
    blocks: t('Bloquea asientos e invita gratis.', 'Block seats and send free invites.'),
    commission: t('Define la comisión por entrada.', 'Set the per-ticket commission.'),
    rewards: t('Comisiones, codigos y pagos.', 'Commissions, codes and payouts.'),
    scan: t('Valida tickets en la puerta.', 'Validate tickets at the door.'),
  };
  return copy[section];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  tabsShell: { height: 78, marginTop: 10, backgroundColor: 'transparent', overflow: 'visible' },
  tabsRow: { height: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 2 },
  tabArrowBtn: { width: 32, height: 62, alignItems: 'center', justifyContent: 'center' },
  tabsViewport: { flex: 1, height: 62, borderRadius: 20, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  tabsScroller: { height: 62, flexGrow: 0, flexShrink: 0, backgroundColor: 'transparent' },
  tabs: { height: 60, paddingLeft: 6, paddingRight: 46, gap: 6, alignItems: 'center', backgroundColor: 'transparent', position: 'relative' },
  organizerSlidingPill: { position: 'absolute', top: 7, height: 46, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.055)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.26)', zIndex: 0, overflow: 'hidden', shadowColor: '#FFFFFF', shadowOpacity: 0.16, shadowRadius: 13, shadowOffset: { width: 0, height: 6 } },
  tabMotion: { height: 46, justifyContent: 'center', zIndex: 1 },
  tab: { height: 46, minWidth: 124, paddingHorizontal: 16, borderRadius: 14, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  tabActive: {},
  tabText: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
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
  eventBackArrow: { color: colors.orange, fontSize: 18, fontWeight: '600', marginTop: -2 },
  eventBackText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', maxWidth: 240 },
  eyebrow: { color: colors.orange, fontSize: 13, letterSpacing: 0, fontWeight: '600', marginBottom: 8 },
  title: { color: '#F8FAFC', fontSize: 32, fontWeight: '600', marginBottom: 8 },
  subtitle: { color: '#CBD5E1', fontSize: 16, lineHeight: 23, fontWeight: '400', marginBottom: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metric: { width: '48%', backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 14 },
  metricValue: { color: colors.orange, fontSize: 24, fontWeight: '600', marginBottom: 4 },
  metricLabel: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  panelCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 18, marginBottom: 16, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  formEyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '600', marginBottom: 8 },
  panelTitle: { color: '#F8FAFC', fontSize: 26, fontWeight: '600', marginBottom: 8 },
  eventName: { color: colors.textPrimary, fontSize: 22, fontWeight: '600', marginBottom: 6 },
  copy: { color: '#CBD5E1', fontSize: 15, lineHeight: 22, fontWeight: '400', marginBottom: 14 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 14, overflow: 'hidden' },
  progressFill: { width: '24%', height: '100%', backgroundColor: colors.orange },
  eventCard: { backgroundColor: colors.card, borderRadius: 24, borderWidth: 1, borderColor: colors.goldBorder, padding: 18, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  cardMain: { flex: 1 },
  cardTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '600', marginBottom: 4 },
  cardSub: { color: colors.textFaint, fontSize: 14, fontWeight: '400' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statusPill: { height: 32, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  statusGreen: { backgroundColor: '#DCFCE7' },
  statusOrange: { backgroundColor: '#FFF7ED' },
  statusGray: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: 10, fontWeight: '600', letterSpacing: 0 },
  statusTextGreen: { color: '#15803d' },
  statusTextOrange: { color: colors.orange },
  statusTextGray: { color: colors.textFaint },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  actionButton: { height: 44, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  actionButtonMuted: { backgroundColor: colors.cardSoft },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  actionButtonTextMuted: { color: colors.textPrimary },
  fieldLabel: { color: colors.textFaint, fontSize: 13, fontWeight: '400', marginBottom: 8 },
  input: { height: 58, borderRadius: 17, borderWidth: 1, borderColor: colors.goldBorder, backgroundColor: colors.card, paddingHorizontal: 16, color: colors.textPrimary, fontSize: 16, fontWeight: '600', marginBottom: 16 },
  segmentGroup: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  segment: { flex: 1, height: 48, borderRadius: 15, backgroundColor: colors.cardSoft, borderWidth: 1, borderColor: colors.goldBorder, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  segmentActiveOrange: { backgroundColor: colors.orange, borderColor: colors.orange },
  segmentText: { color: colors.textFaint, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: '#FFFFFF' },
  formActions: { marginTop: 4, gap: 10 },
  primaryButton: { height: 56, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '600' },
  secondaryButton: { height: 54, borderRadius: 16, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#F8FAFC', fontSize: 13, letterSpacing: 0, fontWeight: '600' },
  mapPreview: { height: 230, backgroundColor: colors.cardSoft, borderRadius: 20, borderWidth: 1, borderColor: colors.goldBorder, marginTop: 8, marginBottom: 16, position: 'relative', overflow: 'hidden' },
  stage: { position: 'absolute', top: 24, left: 30, right: 30, height: 38, borderRadius: 10, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  stageText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', letterSpacing: 0 },
  table: { position: 'absolute', top: 92, left: 38, width: 92, height: 70, borderRadius: 14, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  tableTwo: { left: undefined, right: 38, borderColor: '#6366f1' },
  tableText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  bar: { position: 'absolute', left: 70, right: 70, bottom: 26, height: 42, borderRadius: 12, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  listCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: colors.cardSoft, borderRadius: 16, borderWidth: 1, borderColor: colors.goldBorder, padding: 14, marginTop: 10 },
  listTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  listSub: { color: colors.textFaint, fontSize: 13, fontWeight: '400', marginTop: 3 },
  listValue: { color: colors.orange, fontSize: 20, fontWeight: '600' },
  scanBox: { backgroundColor: colors.navy, borderRadius: 24, padding: 22, alignItems: 'center' },
  scanIcon: { color: colors.orange, fontSize: 42, fontWeight: '600', marginBottom: 8 },
  scanTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '600', marginBottom: 6 },
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
    fontWeight: '600',
  },
  searchText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
  },
  attendeeSecondaryWide: {
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.cardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
