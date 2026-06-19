import { useMemo, useEffect, useRef, useState } from 'react';
import { Alert, Image, PanResponder, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { apiDelete, apiPatch, apiPost, apiUploadImage, getImageUrl } from '../../services/api';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { GradientButton } from '../GradientButton';

type EventStatus = 'draft' | 'published' | 'cancelled';

type SharedProps = {
  eventTitle: string;
  setEventTitle: (value: string) => void;
  eventVenue: string;
  setEventVenue: (value: string) => void;
  eventStatus: EventStatus;
  setEventStatus: (value: EventStatus) => void;
  goTo: (section: 'events' | 'create' | 'details' | 'map' | 'attendees') => void;
  selectedEventId?: string;
  onEventCreated?: (event: any) => void;
  event?: any;
};

type DashboardMetrics = { revenue: string; ticketsSold: string; activeEvents: string; orders: string; netEstimated: string };
type DashboardSummary = { capacity: number; sold: number; scanned: number; soldPct: number; pending: number };
type DashboardEvent = {
  id: string;
  title: string;
  venue: string;
  date: string;
  status: EventStatus;
  sold: number;
  capacity: number;
  revenue: string;
  imageUrl: string;
  minPrice?: number;
};

type SalesByDayItem = { date: string; orders: number; tickets: number; revenue: number };

type DashboardProps = Pick<SharedProps, 'eventTitle' | 'eventVenue' | 'eventStatus' | 'goTo'> & {
  eventDateLabel?: string;
  metrics: DashboardMetrics;
  summary: DashboardSummary;
  events?: DashboardEvent[];
  salesByDay?: SalesByDayItem[];
  onOpenEvent?: (eventId: string) => void;
};

function formatDayLabel(dateStr: string, lang: string) {
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString(
      lang === 'es' ? 'es-MX' : 'en-US',
      { month: 'short', day: 'numeric' },
    );
  } catch { return dateStr; }
}

export function OrganizerDashboardMobile({ eventTitle, eventVenue, eventStatus, eventDateLabel, metrics, summary, events = [], salesByDay = [], onOpenEvent, goTo }: DashboardProps) {
  const { t, lang } = useLanguage();
  const hasEvents = events.length > 0;

  const accessTotal = summary.scanned + summary.pending;
  const accessPct = accessTotal > 0 ? Math.round((summary.scanned / accessTotal) * 100) : 0;
  const maxRevenue = Math.max(...salesByDay.map((d) => d.revenue), 1);

  return (
    <View>
      {/* 4 KPI cards */}
      <View style={styles.metricsGrid}>
        <Metric label={t('Ingresos brutos', 'Gross revenue')} value={metrics.revenue} tone="orange" />
        <Metric label={t('Tickets vendidos', 'Tickets sold')} value={metrics.ticketsSold} tone="navy" />
        <Metric label={t('Eventos activos', 'Active events')} value={metrics.activeEvents} tone="green" />
        <Metric label={t('Ordenes', 'Orders')} value={metrics.orders} tone="slate" />
      </View>

      {/* Net estimated */}
      <View style={styles.netCard}>
        <View style={styles.netCardLeft}>
          <Text style={styles.netEyebrow}>{t('NETO ESTIMADO', 'ESTIMATED NET')}</Text>
          <Text style={styles.netValue}>{metrics.netEstimated}</Text>
          <Text style={styles.netCopy}>{t('Ventas menos comisión estimada de pago.', 'Ticket sales minus estimated processing fee.')}</Text>
        </View>
        <Ionicons name="trending-up-outline" size={28} color="#8DE7B1" style={{ opacity: 0.6 }} />
      </View>

      {/* Hero panel: overall capacity/sold summary */}
      <View style={styles.heroPanel}>
        <View pointerEvents="none" style={styles.heroPanelGlass} />
        <View style={styles.heroTop}>
          <View style={styles.heroTitleBlock}>
            <Text style={styles.eyebrow}>{t('PANEL ORGANIZADOR', 'ORGANIZER PANEL')}</Text>
            <Text style={styles.heroTitle}>{hasEvents ? t('Tus eventos', 'Your events') : eventTitle}</Text>
            <Text style={styles.heroSub}>
              {hasEvents
                ? t('Datos reales de tus eventos publicados y borradores.', 'Live data from your published events and drafts.')
                : [eventDateLabel, eventVenue].filter(Boolean).join(' · ')}
            </Text>
          </View>
          {!hasEvents && (
            <StatusBadge label={eventStatus === 'published' ? t('PUBLICADO', 'PUBLISHED') : t('BORRADOR', 'DRAFT')} active={eventStatus === 'published'} />
          )}
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${summary.soldPct}%` as `${number}%` }]} />
        </View>

        <View style={styles.summaryRow}>
          <Summary label={t('Capacidad', 'Capacity')} value={String(summary.capacity)} />
          <Summary label={t('Vendidos', 'Sold')} value={String(summary.sold)} />
          <Summary label={t('Escaneados', 'Scanned')} value={String(summary.scanned)} />
        </View>

        {/* Recent events list */}
        {hasEvents && (
          <View style={styles.dashboardEvents}>
            {events.slice(0, 5).map((item, index) => {
              const pct = item.capacity > 0 ? Math.min(100, Math.round((item.sold / item.capacity) * 100)) : 0;
              return (
                <TouchableOpacity
                  key={`${item.id || item.title || 'dashboard-event'}-${index}`}
                  style={styles.dashboardEventCard}
                  activeOpacity={onOpenEvent ? 0.75 : 1}
                  onPress={onOpenEvent ? () => onOpenEvent(item.id) : undefined}
                >
                  <View style={styles.dashboardEventTop}>
                    <View style={styles.dashboardFlyerWrap}>
                      {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.dashboardFlyer} resizeMode="cover" />
                      ) : (
                        <View style={styles.dashboardFlyerFallback}>
                          <Text style={styles.dashboardFlyerFallbackText}>EVENT</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.dashboardEventTitleBlock}>
                      <Text style={styles.dashboardEventTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.dashboardEventMeta} numberOfLines={1}>{[item.date, item.venue].filter(Boolean).join(' · ')}</Text>
                      {item.minPrice ? (
                        <Text style={styles.dashboardEventPrice}>{t('desde', 'from')} ${item.minPrice}</Text>
                      ) : null}
                    </View>
                    <View style={styles.dashboardEventRight}>
                      <View style={[styles.eventPill, item.status === 'published' ? styles.eventPillActive : styles.eventPillDraft]}>
                        <Text style={[styles.eventPillText, item.status === 'published' ? styles.eventPillActiveText : styles.eventPillDraftText]}>
                          {item.status === 'published' ? t('PUB', 'PUB') : t('BDRDR', 'DRAFT')}
                        </Text>
                      </View>
                      {onOpenEvent && <Ionicons name="chevron-forward" size={14} color="rgba(249,115,22,0.6)" style={{ marginTop: 6 }} />}
                    </View>
                  </View>
                  <View style={styles.dashboardEventStats}>
                    <Text style={styles.dashboardEventStat}>{item.sold} {t('vendidos', 'sold')}</Text>
                    <Text style={styles.dashboardEventStat}>{item.revenue}</Text>
                    <Text style={styles.dashboardEventStat}>{pct}%</Text>
                  </View>
                  <View style={styles.dashboardEventTrack}>
                    <View style={[styles.dashboardEventFill, { width: `${pct}%` as `${number}%` }]} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <GradientButton label={t('+ CREAR EVENTO', '+ CREATE EVENT')} onPress={() => goTo('create')} height={50} style={styles.createBtn} textStyle={styles.createBtnText} />
      </View>

      {/* Sales by day chart */}
      <View style={styles.card}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.eyebrow}>{t('VENTAS POR DÍA', 'SALES BY DAY')}</Text>
            <Text style={styles.chartSub}>{t('Últimos 14 días · todos tus eventos', 'Last 14 days · all your events')}</Text>
          </View>
          <Ionicons name="bar-chart-outline" size={20} color="#F97316" />
        </View>
        {salesByDay.length === 0 ? (
          <Text style={styles.emptyText}>{t('Aún no hay ventas en este periodo.', 'No sales in this period yet.')}</Text>
        ) : (
          salesByDay.map((day, index) => {
            const barPct = Math.max(4, (day.revenue / maxRevenue) * 100);
            return (
              <View key={`${day.date}-${index}`} style={styles.dayRow}>
                <View style={styles.dayTop}>
                  <Text style={styles.dayLabel}>{formatDayLabel(day.date, lang)}</Text>
                  <Text style={styles.dayRevenue}>${day.revenue.toFixed(2)}</Text>
                </View>
                <View style={styles.dayTrack}>
                  <View style={[styles.dayFill, { width: `${barPct}%` as `${number}%` }]} />
                </View>
                <Text style={styles.dayMeta}>{day.orders} {t('órdenes', 'orders')} · {day.tickets} tickets</Text>
              </View>
            );
          })
        )}
      </View>

      {/* Access control */}
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t('CONTROL DE ACCESO', 'ACCESS CONTROL')}</Text>
        <Text style={styles.cardTitle}>{t('Tickets escaneados vs pendientes', 'Scanned vs pending tickets')}</Text>
        <View style={styles.accessRow}>
          <Text style={styles.accessPct}>{accessPct}%</Text>
          <Text style={styles.accessCount}>{summary.scanned} / {accessTotal} {t('ingresados', 'checked in')}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFillGreen, { width: `${accessPct}%` as `${number}%` }]} />
        </View>
        <View style={styles.accessBoxes}>
          <View style={styles.accessScannedBox}>
            <Text style={styles.accessScannedVal}>{summary.scanned}</Text>
            <Text style={styles.accessScannedLbl}>{t('INGRESADOS', 'SCANNED')}</Text>
          </View>
          <View style={styles.accessPendingBox}>
            <Text style={styles.accessPendingVal}>{summary.pending}</Text>
            <Text style={styles.accessPendingLbl}>{t('PENDIENTES', 'PENDING')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function OrganizerCreateEventMobile({ eventTitle, setEventTitle, eventVenue, setEventVenue, goTo, onEventCreated }: SharedProps) {
  const { t } = useLanguage();
  const [description, setDescription] = useState('Drink, sing, dance. Evento privado con compra segura y acceso digital.');
  const [category, setCategory] = useState('Private Event');
  const [address, setAddress] = useState('23501 Cinco Ranch Blvd, Katy, TX 77494');
  const [eventDate, setEventDate] = useState('2026-06-25');
  const [eventTime, setEventTime] = useState('19:00');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [maxTickets, setMaxTickets] = useState('8');
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | undefined>();

  const saveDraft = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await apiPost<any>('/events', {
        title: eventTitle,
        description,
        category,
        eventDate: `${eventDate}T${eventTime}:00`,
        timezone: timezone || 'America/Chicago',
        venueName: eventVenue,
        venueAddress: address,
        maxTicketsPerPerson: Number(maxTickets) || 1,
      });
      onEventCreated?.(result);
      // Keep the user on the form so they can now upload images for the
      // freshly-created event (image endpoints require an existing id).
      setCreatedId(result?.id);
      Alert.alert(
        t('Borrador guardado', 'Draft saved'),
        t('Ahora puedes subir la miniatura y el banner.', 'You can now upload the thumbnail and banner.'),
      );
    } catch (err: any) {
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo crear el evento', 'Could not create event'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View>
      <View style={styles.stepCard}>
        <Text style={styles.eyebrow}>{t('PASO 1', 'STEP 1')}</Text>
        <Text style={styles.cardTitle}>{t('Detalles del evento', 'Event details')}</Text>
        <Text style={styles.copy}>{t('Configura la información principal antes de crear secciones, precios y mapa visual.', 'Set the main information before creating sections, prices and the visual map.')}</Text>

        <Field label={t('Titulo del evento', 'Event title')} value={eventTitle} onChangeText={setEventTitle} />
        <Field label={t('Descripcion', 'Description')} value={description} onChangeText={setDescription} multiline />
        <Field label={t('Categoria', 'Category')} value={category} onChangeText={setCategory} />

        <View style={styles.twoCol}>
          <Field label={t('Fecha', 'Date')} value={eventDate} onChangeText={setEventDate} compact placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          <Field label={t('Hora', 'Time')} value={eventTime} onChangeText={setEventTime} compact placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
        </View>

        <Field label={t('Zona horaria', 'Timezone')} value={timezone} onChangeText={setTimezone} placeholder="America/Chicago" autoCapitalize="none" />
        <Field label={t('Lugar', 'Venue')} value={eventVenue} onChangeText={setEventVenue} />
        <Field label={t('Direccion', 'Address')} value={address} onChangeText={setAddress} multiline />
        <Field label={t('Max. entradas por persona/transaccion', 'Max tickets per person/transaction')} value={maxTickets} onChangeText={setMaxTickets} keyboardType="number-pad" />

        <View style={styles.mediaGrid}>
          <MediaBox title={t('Imagen miniatura', 'Thumbnail image')} copy={t('Foto principal para tarjetas de evento', 'Main image for event cards')} eventId={createdId} kind="thumbnail" />
          <MediaBox title={t('Imagen banner', 'Banner image')} copy={t('Banner superior del evento', 'Top event banner')} eventId={createdId} kind="banner" />
        </View>

        <View style={styles.actionGrid}>
          <PremiumButton label={saving ? t('GUARDANDO...', 'SAVING...') : t('GUARDAR BORRADOR', 'SAVE DRAFT')} onPress={saveDraft} />
          <PremiumButton label={t('CONTINUAR A MAPA', 'CONTINUE TO MAP')} onPress={() => goTo('map')} muted />
        </View>
      </View>
    </View>
  );
}

export function OrganizerDetailsMobile({ eventTitle, setEventTitle, eventVenue, setEventVenue, eventStatus, setEventStatus, goTo, selectedEventId, event }: SharedProps) {
  const { t } = useLanguage();
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [address, setAddress] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [maxTickets, setMaxTickets] = useState('10');
  const [focalY, setFocalY] = useState(50); // 0 = top, 50 = center, 100 = bottom
  const [saving, setSaving] = useState(false);

  // Populate from the real event (mirrors the web editor's loadEvent).
  useEffect(() => {
    if (!event) return;
    setDescription(event.description || '');
    setCategory(event.pendingCategory || event.category || '');
    setAddress(event.venueAddress || '');
    setMaxTickets(String(event.maxTicketsPerTransaction || 10));
    const bp = event.bannerPosition;
    if (typeof bp === 'number') setFocalY(Math.max(0, Math.min(100, bp)));
    else if (bp === 'top') setFocalY(0);
    else if (bp === 'bottom') setFocalY(100);
    else setFocalY(50);
    setTimezone(event.eventTimezone || 'America/Chicago');
    if (event.eventDate) {
      const d = new Date(event.eventDate);
      if (!Number.isNaN(d.getTime())) {
        setEventDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
        setEventTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      }
    }
  }, [event]);

  const saveEvent = async () => {
    if (saving || !selectedEventId) return;
    setSaving(true);
    try {
      await apiPatch(`/events/${selectedEventId}`, {
        title: eventTitle,
        description,
        category,
        eventDate: `${eventDate}T${eventTime}:00`,
        eventTimezone: timezone || 'America/Chicago',
        venueName: eventVenue,
        venueAddress: address,
        hasSeatMap: true,
        bannerPosition: focalY <= 20 ? 'top' : focalY >= 80 ? 'bottom' : 'center',
        bannerPositionY: focalY,
        maxTicketsPerTransaction: Number(maxTickets) || 10,
      });
      goTo('events');
    } catch (err: any) {
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo guardar el evento', 'Could not save event'));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (newStatus: EventStatus) => {
    const prevStatus = eventStatus;
    setEventStatus(newStatus);
    if (!selectedEventId) return;
    try {
      if (newStatus === 'published') {
        await apiPost(`/events/${selectedEventId}/publish`, {});
      } else {
        await apiPatch(`/events/${selectedEventId}`, { status: 'draft' });
      }
    } catch (err: any) {
      setEventStatus(prevStatus);
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo cambiar el estado', 'Could not change status'));
    }
  };

  return (
    <View>
      <View style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>{t('Detalles e imágenes', 'Details and images')}</Text>
        <Text style={styles.noticeCopy}>{t('Esta pantalla replica el bloque de la web para editar información pública, categoría, lugar, fecha, límites e imágenes.', 'This screen mirrors the website block for editing public information, category, venue, date, limits and images.')}</Text>
      </View>

      <View style={styles.stepCard}>
        <Text style={styles.eyebrow}>{t('INFORMACIÓN PÚBLICA', 'PUBLIC INFO')}</Text>
        <Text style={styles.cardTitle}>{t('Información pública', 'Public information')}</Text>

        <Field label={t('Título', 'Title')} value={eventTitle} onChangeText={setEventTitle} />
        <Field label={t('Descripcion', 'Description')} value={description} onChangeText={setDescription} multiline />
        <Field label={t('Categoria', 'Category')} value={category} onChangeText={setCategory} />

        <View style={styles.twoCol}>
          <Field label={t('Fecha', 'Date')} value={eventDate} onChangeText={setEventDate} compact placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
          <Field label={t('Hora', 'Time')} value={eventTime} onChangeText={setEventTime} compact placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
        </View>

        <Field label={t('Zona horaria', 'Timezone')} value={timezone} onChangeText={setTimezone} placeholder="America/Chicago" autoCapitalize="none" />
        <Field label={t('Lugar', 'Venue')} value={eventVenue} onChangeText={setEventVenue} />
        <Field label={t('Direccion', 'Address')} value={address} onChangeText={setAddress} multiline />
        <Field label={t('Máx. entradas por transacción', 'Max tickets per transaction')} value={maxTickets} onChangeText={setMaxTickets} keyboardType="number-pad" />


        <Text style={styles.fieldLabel}>{t('Estado', 'Status')}</Text>
        <View style={styles.segmentGroup}>
          <TouchableOpacity onPress={() => changeStatus('published')} style={[styles.segment, eventStatus === 'published' && styles.segmentActive]}>
            <Text style={[styles.segmentText, eventStatus === 'published' && styles.segmentTextActive]}>{t('Publicado', 'Published')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => changeStatus('draft')} style={[styles.segment, eventStatus === 'draft' && styles.segmentActive]}>
            <Text style={[styles.segmentText, eventStatus === 'draft' && styles.segmentTextActive]}>{t('Borrador', 'Draft')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t('IMÁGENES', 'MEDIA')}</Text>
        <Text style={styles.cardTitle}>{t('Imágenes del evento', 'Event images')}</Text>
        <View style={styles.mediaGrid}>
          <MediaBox title={t('Miniatura', 'Thumbnail')} copy={t('Imagen que aparece en listados y tarjetas', 'Image shown in listings and cards')} eventId={selectedEventId} kind="thumbnail" initialUrl={event?.imageUrl} canDelete />
          <MediaBox title={t('Banner', 'Banner')} copy={t('Imagen grande del detalle y home', 'Large image for details and home')} eventId={selectedEventId} kind="banner" initialUrl={event?.bannerImageUrl} canDelete />
        </View>

        <View style={styles.focalHeader}>
          <Text style={styles.fieldLabel}>{t('ALINEACIÓN FOCAL / VERTICAL', 'FOCAL / VERTICAL ALIGNMENT')}</Text>
          <Text style={styles.focalPct}>{focalY}%</Text>
        </View>
        <View style={styles.segmentGroup}>
          {([{ label: t('Arriba', 'Top'), val: 0 }, { label: t('Centro', 'Center'), val: 50 }, { label: t('Abajo', 'Bottom'), val: 100 }] as const).map(({ label, val }) => (
            <TouchableOpacity key={val} onPress={() => setFocalY(val)} style={[styles.segment, focalY === val && styles.segmentActive]}>
              <Text style={[styles.segmentText, focalY === val && styles.segmentTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <BannerSlider value={focalY} onChange={setFocalY} />
        <View style={styles.focalLabels}>
          <Text style={styles.focalTickLabel}>TOP</Text>
          <Text style={styles.focalTickLabel}>CENTER</Text>
          <Text style={styles.focalTickLabel}>BOTTOM</Text>
        </View>
      </View>

      <View style={styles.actionGrid}>
        <PremiumButton label={saving ? t('GUARDANDO...', 'SAVING...') : t('GUARDAR EVENTO', 'SAVE EVENT')} onPress={saveEvent} />
        <PremiumButton label={t('EDITAR MAPA', 'EDIT MAP')} onPress={() => goTo('map')} muted />
      </View>
    </View>
  );
}

function BannerSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackWidthRef = useRef(1);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const pct = Math.max(0, Math.min(100, Math.round((evt.nativeEvent.locationX / trackWidthRef.current) * 100)));
          onChange(pct);
        },
        onPanResponderMove: (evt) => {
          const pct = Math.max(0, Math.min(100, Math.round((evt.nativeEvent.locationX / trackWidthRef.current) * 100)));
          onChange(pct);
        },
      }),
    [onChange],
  );

  const thumbPct = Math.max(0, Math.min(100, value));
  return (
    <View
      onLayout={(e) => { trackWidthRef.current = e.nativeEvent.layout.width; }}
      {...panResponder.panHandlers}
      style={styles.sliderTrack}
    >
      <View style={[styles.sliderFill, { width: `${thumbPct}%` as `${number}%` }]} />
      <View style={[styles.sliderThumb, { left: `${thumbPct}%` as `${number}%`, transform: [{ translateX: -10 }] }]} />
    </View>
  );
}

function Field({ label, compact, multiline, style: _style, ...inputProps }: any) {
  return (
    <View style={[styles.field, compact && styles.fieldCompact]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        editable={true}
        placeholderTextColor="#9CA3AF"
        style={[styles.input, multiline && styles.textArea]}
      />
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'orange' | 'navy' | 'green' | 'slate' }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, tone === 'navy' && styles.metricNavy, tone === 'green' && styles.metricGreen, tone === 'slate' && styles.metricSlate]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Activity({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.activity}>
      <View style={styles.activityDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.activityTitle}>{title}</Text>
        <Text style={styles.activityCopy}>{copy}</Text>
      </View>
    </View>
  );
}

function MediaBox({ title, copy, eventId, kind, initialUrl, canDelete }: { title: string; copy: string; eventId?: string; kind: 'thumbnail' | 'banner'; initialUrl?: string; canDelete?: boolean }) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<string>(initialUrl ? getImageUrl(initialUrl) : '');
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Keep preview in sync when the event loads/changes.
  useEffect(() => { setPreview(initialUrl ? getImageUrl(initialUrl) : ''); }, [initialUrl]);

  const removeImage = async () => {
    if (!eventId || !preview) return;
    setDeleting(true);
    try {
      await apiDelete(kind === 'banner' ? `/events/${eventId}/image/banner` : `/events/${eventId}/image`);
      setPreview('');
    } catch (err: any) {
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo eliminar la imagen', 'Could not delete the image'));
    } finally {
      setDeleting(false);
    }
  };

  const pickAndUpload = async () => {
    if (!eventId) {
      Alert.alert(t('Guarda primero', 'Save first'), t('Guarda el borrador del evento antes de subir imágenes.', 'Save the event draft before uploading images.'));
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('Permiso necesario', 'Permission needed'), t('Concede acceso a tus fotos para subir una imagen.', 'Grant photo access to upload an image.'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      const path = kind === 'banner' ? `/events/${eventId}/image/banner` : `/events/${eventId}/image`;
      const updated = await apiUploadImage<any>(path, { uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType });
      const nextUrl = kind === 'banner' ? updated?.bannerImageUrl : updated?.imageUrl;
      setPreview(nextUrl ? getImageUrl(nextUrl) : asset.uri);
    } catch (err: any) {
      Alert.alert(t('Error', 'Error'), err?.message || t('No se pudo subir la imagen', 'Could not upload the image'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.mediaBox}>
      {preview ? (
        <Image source={{ uri: preview }} style={styles.mediaPreview} resizeMode="cover" />
      ) : (
        <View style={styles.mediaIcon}>
          <Text style={styles.mediaIconText}>Img</Text>
        </View>
      )}
      <Text style={styles.mediaTitle}>{title}</Text>
      <Text style={styles.mediaCopy}>{copy}</Text>
      <TouchableOpacity style={styles.mediaButton} onPress={pickAndUpload} disabled={uploading}>
        <Text style={styles.mediaButtonText}>
          {uploading ? t('SUBIENDO...', 'UPLOADING...') : preview ? t('CAMBIAR', 'CHANGE') : t('SELECCIONAR', 'SELECT')}
        </Text>
      </TouchableOpacity>
      {canDelete && !!preview && (
        <TouchableOpacity style={styles.mediaDeleteButton} onPress={removeImage} disabled={deleting}>
          <Text style={styles.mediaDeleteText}>{deleting ? t('ELIMINANDO...', 'DELETING...') : t('ELIMINAR', 'DELETE')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PremiumButton({ label, muted, onPress }: { label: string; muted?: boolean; onPress?: () => void }) {
  if (!muted) {
    return <GradientButton label={label} onPress={onPress} height={52} style={styles.button} textStyle={styles.buttonText} />;
  }

  return (
    <TouchableOpacity onPress={onPress} style={[styles.button, styles.buttonMuted]}>
      <Text style={[styles.buttonText, styles.buttonTextMuted]}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.statusBadge, active ? styles.statusActive : styles.statusDraft]}>
      <Text style={[styles.statusBadgeText, active ? styles.statusActiveText : styles.statusDraftText]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metric: { width: '48%', minHeight: 78, backgroundColor: '#030B14', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 12, justifyContent: 'center' },
  metricValue: { color: colors.orange, fontSize: 22, fontWeight: '700', marginBottom: 3 },
  metricNavy: { color: '#F8FAFC' },
  metricGreen: { color: '#8DE7B1' },
  metricSlate: { color: '#CBD5E1' },
  metricLabel: { color: '#9CA3AF', fontSize: 11, fontWeight: '700', lineHeight: 15 },
  heroPanel: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 16, marginBottom: 16, overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.22, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  heroPanelGlass: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', marginBottom: 18, position: 'relative' },
  heroTitleBlock: { flex: 1, paddingRight: 128 },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '700', marginBottom: 8 },
  heroTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '700', lineHeight: 28 },
  heroSub: { color: '#9CA3AF', fontSize: 13, fontWeight: '700', marginTop: 5 },
  statusBadge: { position: 'absolute', top: 0, right: 0, minWidth: 112, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statusActive: { backgroundColor: 'rgba(141,231,177,0.12)', borderColor: 'rgba(141,231,177,0.35)' },
  statusDraft: { backgroundColor: '#030B14', borderColor: 'rgba(255,255,255,0.14)' },
  statusBadgeText: { fontSize: 9, letterSpacing: 0, fontWeight: '700' },
  statusActiveText: { color: '#15803d' },
  statusDraftText: { color: '#CBD5E1' },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', marginBottom: 14 },
  progressFill: { width: '24%', height: '100%', backgroundColor: colors.orange },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summary: { flex: 1, minHeight: 62, backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 10, justifyContent: 'center' },
  summaryValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  summaryLabel: { color: '#CBD5E1', fontSize: 10.5, fontWeight: '700', textAlign: 'center', marginTop: 3 },
  dashboardEvents: { gap: 10, marginBottom: 14 },
  dashboardEventCard: { backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 12 },
  dashboardEventTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  dashboardFlyerWrap: { width: 54, height: 64, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  dashboardFlyer: { width: '100%', height: '100%' },
  dashboardFlyerFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,122,24,0.10)' },
  dashboardFlyerFallbackText: { color: colors.orange, fontSize: 8.5, fontWeight: '700' },
  dashboardEventTitleBlock: { flex: 1 },
  dashboardEventTitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 20, fontWeight: '700' },
  dashboardEventMeta: { color: '#9CA3AF', fontSize: 11.5, fontWeight: '700', marginTop: 4 },
  dashboardEventStats: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  dashboardEventStat: { color: '#CBD5E1', fontSize: 11.5, fontWeight: '700' },
  dashboardEventPrice: { color: '#F97316', fontSize: 11, fontWeight: '700', marginTop: 3 },
  dashboardEventRight: { alignItems: 'flex-end', gap: 2 },
  dashboardEventTrack: { height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  dashboardEventFill: { height: '100%', backgroundColor: colors.orange },
  eventPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  eventPillActive: { backgroundColor: 'rgba(255,90,69,0.12)', borderColor: 'rgba(255,90,69,0.35)' },
  eventPillDraft: { backgroundColor: 'rgba(148,163,184,0.10)', borderColor: 'rgba(148,163,184,0.28)' },
  eventPillText: { fontSize: 8.5, letterSpacing: 0, fontWeight: '700' },
  eventPillActiveText: { color: '#ff5a45' },
  eventPillDraftText: { color: '#CBD5E1' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6, marginBottom: 14 },
  button: { width: '48%', height: 52, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  buttonMuted: { backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  buttonText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '700', textAlign: 'center' },
  buttonTextMuted: { color: '#F8FAFC' },
  card: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 16, marginBottom: 16 },
  stepCard: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 18, marginBottom: 16, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  cardTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '700', marginBottom: 8 },
  copy: { color: colors.textFaint, fontSize: 15, lineHeight: 22, fontWeight: '400', marginBottom: 16 },
  activity: { flexDirection: 'row', gap: 12, backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 13, marginTop: 10 },
  activityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange, marginTop: 5 },
  activityTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  activityCopy: { color: colors.textFaint, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  field: { marginBottom: 14 },
  fieldCompact: { flex: 1 },
  fieldLabel: { color: colors.textFaint, fontSize: 12, letterSpacing: 0, fontWeight: '400', marginBottom: 8 },
  input: { minHeight: 56, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 16, color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  textArea: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: 12 },
  mediaGrid: { gap: 12, marginBottom: 14 },
  mediaBox: { backgroundColor: '#030B14', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 16 },
  mediaIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  mediaPreview: { width: '100%', height: 120, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', marginBottom: 12, backgroundColor: '#030B14' },
  mediaIconText: { color: colors.orange, fontSize: 11, fontWeight: '700' },
  mediaTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  mediaCopy: { color: colors.textFaint, fontSize: 13, fontWeight: '700', lineHeight: 18, marginBottom: 12 },
  mediaButton: { height: 42, borderRadius: 13, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  mediaDeleteButton: { height: 38, borderRadius: 12, marginTop: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,90,69,0.3)', backgroundColor: 'rgba(255,90,69,0.08)' },
  mediaDeleteText: { color: '#ff5a45', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  mediaButtonText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '700' },
  noticeCard: { backgroundColor: '#030B14', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 16, marginBottom: 14 },
  noticeTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 5 },
  noticeCopy: { color: colors.textFaint, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  segmentGroup: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  segment: { flex: 1, height: 48, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.018)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#030B14', borderColor: 'rgba(255,255,255,0.14)' },
  segmentText: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: '#FFFFFF' },

  // Focal / Banner slider
  focalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  focalPct: { color: '#F97316', fontSize: 12, fontWeight: '800' },
  sliderTrack: { height: 20, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', marginBottom: 6, justifyContent: 'center', position: 'relative' },
  sliderFill: { height: '100%', borderRadius: 999, backgroundColor: '#F97316', position: 'absolute', left: 0, top: 0 },
  sliderThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#F97316', position: 'absolute', top: 0, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  focalLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  focalTickLabel: { color: 'rgba(148,163,184,0.6)', fontSize: 9, fontWeight: '700' },

  // Net estimated card
  netCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(141,231,177,0.06)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(141,231,177,0.22)', padding: 14, marginBottom: 14 },
  netCardLeft: { flex: 1 },
  netEyebrow: { color: '#8DE7B1', fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  netValue: { color: '#8DE7B1', fontSize: 26, fontWeight: '800', marginBottom: 3 },
  netCopy: { color: 'rgba(141,231,177,0.55)', fontSize: 12, fontWeight: '600', lineHeight: 17 },

  // Create event button inside hero panel
  createBtn: { marginTop: 4 },
  createBtnText: { fontSize: 13, letterSpacing: 0 },

  // Sales by day chart
  chartHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  chartSub: { color: '#9CA3AF', fontSize: 11, fontWeight: '600', marginTop: 3 },
  emptyText: { color: 'rgba(148,163,184,0.6)', fontSize: 13, fontWeight: '600', textAlign: 'center', paddingVertical: 16 },
  dayRow: { marginBottom: 10 },
  dayTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  dayLabel: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  dayRevenue: { color: '#F97316', fontSize: 12, fontWeight: '800' },
  dayTrack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 4 },
  dayFill: { height: '100%', borderRadius: 999, backgroundColor: '#F97316' },
  dayMeta: { color: '#6B7280', fontSize: 10, fontWeight: '600' },

  // Access control section
  accessRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 10 },
  accessPct: { color: '#8DE7B1', fontSize: 36, fontWeight: '800', lineHeight: 40 },
  accessCount: { color: 'rgba(148,163,184,0.6)', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  progressFillGreen: { height: '100%', backgroundColor: '#22C55E' },
  accessBoxes: { flexDirection: 'row', gap: 10, marginTop: 14 },
  accessScannedBox: { flex: 1, backgroundColor: 'rgba(34,197,94,0.10)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', padding: 12, alignItems: 'center' },
  accessScannedVal: { color: '#8DE7B1', fontSize: 24, fontWeight: '800' },
  accessScannedLbl: { color: 'rgba(141,231,177,0.65)', fontSize: 9, fontWeight: '800', letterSpacing: 0.6, marginTop: 3 },
  accessPendingBox: { flex: 1, backgroundColor: 'rgba(249,115,22,0.10)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(249,115,22,0.25)', padding: 12, alignItems: 'center' },
  accessPendingVal: { color: '#F97316', fontSize: 24, fontWeight: '800' },
  accessPendingLbl: { color: 'rgba(249,115,22,0.65)', fontSize: 9, fontWeight: '800', letterSpacing: 0.6, marginTop: 3 },
});
