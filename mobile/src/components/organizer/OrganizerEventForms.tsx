import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';

type EventStatus = 'draft' | 'published';

type SharedProps = {
  eventTitle: string;
  setEventTitle: (value: string) => void;
  eventVenue: string;
  setEventVenue: (value: string) => void;
  eventStatus: EventStatus;
  setEventStatus: (value: EventStatus) => void;
  goTo: (section: 'events' | 'create' | 'details' | 'map' | 'attendees') => void;
};

type DashboardMetrics = { revenue: string; ticketsSold: string; activeEvents: string; orders: string };
type DashboardSummary = { capacity: number; sold: number; scanned: number; soldPct: number };

type DashboardProps = Pick<SharedProps, 'eventTitle' | 'eventVenue' | 'eventStatus' | 'goTo'> & {
  eventDateLabel?: string;
  metrics: DashboardMetrics;
  summary: DashboardSummary;
};

export function OrganizerDashboardMobile({ eventTitle, eventVenue, eventStatus, eventDateLabel, metrics, summary, goTo }: DashboardProps) {
  const { t } = useLanguage();
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
            <Text style={styles.eyebrow}>{t('EVENTO ACTIVO', 'LIVE EVENT')}</Text>
            <Text style={styles.heroTitle}>{eventTitle}</Text>
            <Text style={styles.heroSub}>{[eventDateLabel, eventVenue].filter(Boolean).join(' · ')}</Text>
          </View>
          <StatusBadge label={eventStatus === 'published' ? t('PUBLICADO', 'PUBLISHED') : t('BORRADOR', 'DRAFT')} active={eventStatus === 'published'} />
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${summary.soldPct}%` as `${number}%` }]} />
        </View>

        <View style={styles.summaryRow}>
          <Summary label={t('Capacidad', 'Capacity')} value={String(summary.capacity)} />
          <Summary label={t('Vendidos', 'Sold')} value={String(summary.sold)} />
          <Summary label={t('Escaneados', 'Scanned')} value={String(summary.scanned)} />
        </View>

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

export function OrganizerCreateEventMobile({ eventTitle, setEventTitle, eventVenue, setEventVenue, goTo }: SharedProps) {
  const { t } = useLanguage();
  const [description, setDescription] = useState('Drink, sing, dance. Evento privado con compra segura y acceso digital.');
  const [category, setCategory] = useState('Private Event');
  const [address, setAddress] = useState('23501 Cinco Ranch Blvd, Katy, TX 77494');
  const [eventDate, setEventDate] = useState('2026-06-25');
  const [eventTime, setEventTime] = useState('19:00');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [maxTickets, setMaxTickets] = useState('8');

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
          <MediaBox title={t('Imagen miniatura', 'Thumbnail image')} copy={t('Foto principal para tarjetas de evento', 'Main image for event cards')} />
          <MediaBox title={t('Imagen banner', 'Banner image')} copy={t('Banner superior del evento', 'Top event banner')} />
        </View>

        <View style={styles.actionGrid}>
          <PremiumButton label={t('GUARDAR BORRADOR', 'SAVE DRAFT')} onPress={() => goTo('events')} />
          <PremiumButton label={t('CONTINUAR A MAPA', 'CONTINUE TO MAP')} onPress={() => goTo('map')} muted />
        </View>
      </View>
    </View>
  );
}

export function OrganizerDetailsMobile({ eventTitle, setEventTitle, eventVenue, setEventVenue, eventStatus, setEventStatus, goTo }: SharedProps) {
  const { t } = useLanguage();
  const [description, setDescription] = useState('Evento privado con musica, cena, tickets digitales y acceso con QR.');
  const [category, setCategory] = useState('Private Event');
  const [address, setAddress] = useState('23501 Cinco Ranch Blvd, Katy, TX 77494');
  const [eventDate, setEventDate] = useState('2026-06-25');
  const [eventTime, setEventTime] = useState('19:00');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [maxTickets, setMaxTickets] = useState('8');

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
        <Field label={t('Límite de venta', 'Sale limit')} value={maxTickets} onChangeText={setMaxTickets} keyboardType="number-pad" />

        <Text style={styles.fieldLabel}>{t('Estado', 'Status')}</Text>
        <View style={styles.segmentGroup}>
          <TouchableOpacity onPress={() => setEventStatus('published')} style={[styles.segment, eventStatus === 'published' && styles.segmentActive]}>
            <Text style={[styles.segmentText, eventStatus === 'published' && styles.segmentTextActive]}>{t('Publicado', 'Published')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setEventStatus('draft')} style={[styles.segment, eventStatus === 'draft' && styles.segmentActive]}>
            <Text style={[styles.segmentText, eventStatus === 'draft' && styles.segmentTextActive]}>{t('Borrador', 'Draft')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t('IMÁGENES', 'MEDIA')}</Text>
        <Text style={styles.cardTitle}>{t('Imágenes del evento', 'Event images')}</Text>
        <View style={styles.mediaGrid}>
          <MediaBox title={t('Miniatura', 'Thumbnail')} copy={t('Imagen que aparece en listados y tarjetas', 'Image shown in listings and cards')} />
          <MediaBox title={t('Banner', 'Banner')} copy={t('Imagen grande del detalle y home', 'Large image for details and home')} />
        </View>
      </View>

      <View style={styles.actionGrid}>
        <PremiumButton label={t('GUARDAR EVENTO', 'SAVE EVENT')} onPress={() => goTo('events')} />
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

function MediaBox({ title, copy }: { title: string; copy: string }) {
  const { t } = useLanguage();
  return (
    <View style={styles.mediaBox}>
      <View style={styles.mediaIcon}>
        <Text style={styles.mediaIconText}>Img</Text>
      </View>
      <Text style={styles.mediaTitle}>{title}</Text>
      <Text style={styles.mediaCopy}>{copy}</Text>
      <TouchableOpacity style={styles.mediaButton}>
        <Text style={styles.mediaButtonText}>{t('SELECCIONAR', 'SELECT')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function PremiumButton({ label, muted, onPress }: { label: string; muted?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.button, muted && styles.buttonMuted]}>
      <Text style={[styles.buttonText, muted && styles.buttonTextMuted]}>{label}</Text>
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
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6, marginBottom: 14 },
  button: { width: '48%', height: 52, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
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
  mediaIconText: { color: colors.orange, fontSize: 11, fontWeight: '700' },
  mediaTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  mediaCopy: { color: colors.textFaint, fontSize: 13, fontWeight: '700', lineHeight: 18, marginBottom: 12 },
  mediaButton: { height: 42, borderRadius: 13, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
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
