import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { apiDelete, apiPatch, apiPost, apiUploadImage, getImageUrl } from '../../services/api';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { GradientButton } from '../GradientButton';

type EventStatus = 'draft' | 'published';

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

type DashboardMetrics = { revenue: string; ticketsSold: string; activeEvents: string; orders: string };
type DashboardSummary = { capacity: number; sold: number; scanned: number; soldPct: number };
type DashboardEvent = {
  id: string;
  title: string;
  venue: string;
  date: string;
  status: EventStatus;
  sold: number;
  capacity: number;
  revenue: string;
};

type DashboardProps = Pick<SharedProps, 'eventTitle' | 'eventVenue' | 'eventStatus' | 'goTo'> & {
  eventDateLabel?: string;
  metrics: DashboardMetrics;
  summary: DashboardSummary;
  events?: DashboardEvent[];
};

export function OrganizerDashboardMobile({ eventTitle, eventVenue, eventStatus, eventDateLabel, metrics, summary, events = [], goTo }: DashboardProps) {
  const { t } = useLanguage();
  const hasEvents = events.length > 0;

  return (
    <View>
      <View style={styles.metricsGrid}>
        <Metric label={t('Ingresos brutos', 'Gross revenue')} value={metrics.revenue} tone="orange" />
        <Metric label={t('Tickets vendidos', 'Tickets sold')} value={metrics.ticketsSold} tone="navy" />
        <Metric label={t('Eventos activos', 'Active events')} value={metrics.activeEvents} tone="green" />
        <Metric label={t('Ordenes', 'Orders')} value={metrics.orders} tone="slate" />
      </View>

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

        {hasEvents ? (
          <View style={styles.dashboardEvents}>
            {events.slice(0, 5).map((item) => {
              const pct = item.capacity > 0 ? Math.min(100, Math.round((item.sold / item.capacity) * 100)) : 0;
              return (
                <View key={item.id} style={styles.dashboardEventCard}>
                  <View style={styles.dashboardEventTop}>
                    <View style={styles.dashboardEventTitleBlock}>
                      <Text style={styles.dashboardEventTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={styles.dashboardEventMeta} numberOfLines={1}>{[item.date, item.venue].filter(Boolean).join(' · ')}</Text>
                    </View>
                    <View style={[styles.eventPill, item.status === 'published' ? styles.eventPillActive : styles.eventPillDraft]}>
                      <Text style={[styles.eventPillText, item.status === 'published' ? styles.eventPillActiveText : styles.eventPillDraftText]}>
                        {item.status === 'published' ? t('PUBLICADO', 'PUBLISHED') : t('BORRADOR', 'DRAFT')}
                      </Text>
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
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.actionGrid}>
          <PremiumButton label={t('MIS EVENTOS', 'MY EVENTS')} onPress={() => goTo('events')} />
          <PremiumButton label={t('DETALLES', 'DETAILS')} onPress={() => goTo('details')} muted />
          <PremiumButton label={t('MAPA VISUAL', 'VISUAL MAP')} onPress={() => goTo('map')} muted />
          <PremiumButton label={t('ASISTENTES', 'ATTENDEES')} onPress={() => goTo('attendees')} muted />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t('ACTIVIDAD RECIENTE', 'RECENT ACTIVITY')}</Text>
        <Text style={styles.cardTitle}>{t('Actividad reciente', 'Recent activity')}</Text>
        <Activity title={t('Nueva orden recibida', 'New order received')} copy={t('Mesa 8 · 2 tickets · $200.00', 'Table 8 · 2 tickets · $200.00')} />
        <Activity title={t('Ticket escaneado', 'Ticket scanned')} copy={t('Entrada validada en puerta · General admission', 'Door entry validated · General admission')} />
        <Activity title={t('Mapa actualizado', 'Map updated')} copy={t('Cambios guardados en el diseño del venue', 'Venue design changes saved')} />
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
          <Field label={t('Fecha', 'Date')} value={eventDate} onChangeText={setEventDate} compact />
          <Field label={t('Hora', 'Time')} value={eventTime} onChangeText={setEventTime} compact />
        </View>

        <Field label={t('Zona horaria', 'Timezone')} value={timezone} onChangeText={setTimezone} />
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
  const [bannerPosition, setBannerPosition] = useState<'center' | 'top' | 'bottom'>('center');
  const [saving, setSaving] = useState(false);

  // Populate from the real event (mirrors the web editor's loadEvent).
  useEffect(() => {
    if (!event) return;
    setDescription(event.description || '');
    setCategory(event.pendingCategory || event.category || '');
    setAddress(event.venueAddress || '');
    setMaxTickets(String(event.maxTicketsPerTransaction || 10));
    setBannerPosition((event.bannerPosition as any) || 'center');
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
        bannerPosition,
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
          <Field label={t('Fecha', 'Date')} value={eventDate} onChangeText={setEventDate} compact />
          <Field label={t('Hora', 'Time')} value={eventTime} onChangeText={setEventTime} compact />
        </View>

        <Field label={t('Zona horaria', 'Timezone')} value={timezone} onChangeText={setTimezone} />
        <Field label={t('Lugar', 'Venue')} value={eventVenue} onChangeText={setEventVenue} />
        <Field label={t('Direccion', 'Address')} value={address} onChangeText={setAddress} multiline />
        <Field label={t('Máx. entradas por transacción', 'Max tickets per transaction')} value={maxTickets} onChangeText={setMaxTickets} keyboardType="number-pad" />

        <Text style={styles.fieldLabel}>{t('Posición del banner', 'Banner position')}</Text>
        <View style={styles.segmentGroup}>
          {(['center', 'top', 'bottom'] as const).map((pos) => (
            <TouchableOpacity key={pos} onPress={() => setBannerPosition(pos)} style={[styles.segment, bannerPosition === pos && styles.segmentActive]}>
              <Text style={[styles.segmentText, bannerPosition === pos && styles.segmentTextActive]}>
                {pos === 'center' ? t('Centro', 'Center') : pos === 'top' ? t('Arriba', 'Top') : t('Abajo', 'Bottom')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
      </View>

      <View style={styles.actionGrid}>
        <PremiumButton label={saving ? t('GUARDANDO...', 'SAVING...') : t('GUARDAR EVENTO', 'SAVE EVENT')} onPress={saveEvent} />
        <PremiumButton label={t('EDITAR MAPA', 'EDIT MAP')} onPress={() => goTo('map')} muted />
      </View>
    </View>
  );
}

function Field(props: any) {
  return (
    <View style={[styles.field, props.compact && styles.fieldCompact]}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        {...props}
        placeholderTextColor="#9CA3AF"
        style={[styles.input, props.multiline && styles.textArea]}
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
  dashboardEventTitleBlock: { flex: 1 },
  dashboardEventTitle: { color: '#FFFFFF', fontSize: 16, lineHeight: 20, fontWeight: '700' },
  dashboardEventMeta: { color: '#9CA3AF', fontSize: 11.5, fontWeight: '700', marginTop: 4 },
  dashboardEventStats: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  dashboardEventStat: { color: '#CBD5E1', fontSize: 11.5, fontWeight: '700' },
  dashboardEventTrack: { height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  dashboardEventFill: { height: '100%', backgroundColor: colors.orange },
  eventPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
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
  segmentGroup: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  segment: { flex: 1, height: 48, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.018)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#030B14', borderColor: 'rgba(255,255,255,0.14)' },
  segmentText: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: '#FFFFFF' },
});
