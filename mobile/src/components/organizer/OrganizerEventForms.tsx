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

export function OrganizerDashboardMobile({ eventTitle, eventVenue, eventStatus, goTo }: Pick<SharedProps, 'eventTitle' | 'eventVenue' | 'eventStatus' | 'goTo'>) {
  const { t } = useLanguage();
  return (
    <View>
      <View style={styles.metricsGrid}>
        <Metric label={t('Ingresos brutos', 'Gross revenue')} value="$1,240.00" tone="orange" />
        <Metric label={t('Tickets vendidos', 'Tickets sold')} value="62" tone="navy" />
        <Metric label={t('Eventos activos', 'Active events')} value="1" tone="green" />
        <Metric label={t('Ordenes', 'Orders')} value="29" tone="slate" />
      </View>

      <View style={styles.heroPanel}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.eyebrow}>{t('EVENTO ACTIVO', 'LIVE EVENT')}</Text>
            <Text style={styles.heroTitle}>{eventTitle}</Text>
            <Text style={styles.heroSub}>25 Jun 2026, 19:00 · {eventVenue}</Text>
          </View>
          <StatusBadge label={eventStatus === 'published' ? t('PUBLICADO', 'PUBLISHED') : t('BORRADOR', 'DRAFT')} active={eventStatus === 'published'} />
        </View>

        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>

        <View style={styles.summaryRow}>
          <Summary label={t('Capacidad', 'Capacity')} value="262" />
          <Summary label={t('Vendidos', 'Sold')} value="62" />
          <Summary label={t('Escaneados', 'Scanned')} value="18" />
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
        <Text style={styles.mediaIconText}>IMG</Text>
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
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metric: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E5E7EB', padding: 16 },
  metricValue: { color: colors.orange, fontSize: 25, fontWeight: '900', marginBottom: 4 },
  metricNavy: { color: colors.navy },
  metricGreen: { color: '#16a34a' },
  metricSlate: { color: '#6B7280' },
  metricLabel: { color: '#6B7280', fontSize: 12, fontWeight: '900', lineHeight: 17 },
  heroPanel: { backgroundColor: colors.navy, borderRadius: 28, padding: 20, marginBottom: 16, shadowColor: '#111827', shadowOpacity: 0.14, shadowRadius: 20, shadowOffset: { width: 0, height: 12 } },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', marginBottom: 18 },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '900', marginBottom: 8 },
  heroTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', lineHeight: 29 },
  heroSub: { color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginTop: 5 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusDraft: { backgroundColor: '#F3F4F6' },
  statusBadgeText: { fontSize: 10, letterSpacing: 1.3, fontWeight: '900' },
  statusActiveText: { color: '#15803d' },
  statusDraftText: { color: '#6B7280' },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', marginBottom: 16 },
  progressFill: { width: '24%', height: '100%', backgroundColor: colors.orange },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summary: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 12 },
  summaryValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  summaryLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 3 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6, marginBottom: 14 },
  button: { minHeight: 48, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flexGrow: 1 },
  buttonMuted: { backgroundColor: '#F9FAFB' },
  buttonText: { color: '#FFFFFF', fontSize: 12, letterSpacing: 1.4, fontWeight: '900' },
  buttonTextMuted: { color: colors.navy },
  card: { backgroundColor: '#FFFFFF', borderRadius: 26, borderWidth: 1, borderColor: '#E5E7EB', padding: 18, marginBottom: 16 },
  stepCard: { backgroundColor: '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: '#E5E7EB', padding: 20, marginBottom: 16, shadowColor: '#111827', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  cardTitle: { color: colors.navy, fontSize: 26, fontWeight: '900', marginBottom: 8 },
  copy: { color: '#6B7280', fontSize: 15, lineHeight: 22, fontWeight: '700', marginBottom: 16 },
  activity: { flexDirection: 'row', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  activityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange, marginTop: 5 },
  activityTitle: { color: colors.navy, fontSize: 15, fontWeight: '900', marginBottom: 3 },
  activityCopy: { color: '#6B7280', fontSize: 13, fontWeight: '700', lineHeight: 18 },
  field: { marginBottom: 14 },
  fieldCompact: { flex: 1 },
  fieldLabel: { color: '#6B7280', fontSize: 12, letterSpacing: 1.4, fontWeight: '900', textTransform: 'uppercase', marginBottom: 8 },
  input: { minHeight: 56, borderRadius: 17, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', paddingHorizontal: 16, color: colors.navy, fontSize: 16, fontWeight: '800' },
  textArea: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
  twoCol: { flexDirection: 'row', gap: 12 },
  mediaGrid: { gap: 12, marginBottom: 14 },
  mediaBox: { backgroundColor: '#F8FAFC', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', padding: 16 },
  mediaIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#fff7ed', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  mediaIconText: { color: colors.orange, fontSize: 11, fontWeight: '900' },
  mediaTitle: { color: colors.navy, fontSize: 17, fontWeight: '900', marginBottom: 4 },
  mediaCopy: { color: '#6B7280', fontSize: 13, fontWeight: '700', lineHeight: 18, marginBottom: 12 },
  mediaButton: { height: 42, borderRadius: 13, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  mediaButtonText: { color: '#FFFFFF', fontSize: 11, letterSpacing: 1.4, fontWeight: '900' },
  noticeCard: { backgroundColor: '#fff7ed', borderRadius: 22, borderWidth: 1, borderColor: '#FED7AA', padding: 16, marginBottom: 14 },
  noticeTitle: { color: colors.navy, fontSize: 18, fontWeight: '900', marginBottom: 5 },
  noticeCopy: { color: '#6B7280', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  segmentGroup: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  segment: { flex: 1, height: 48, borderRadius: 15, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  segmentText: { color: '#6B7280', fontSize: 12, fontWeight: '900' },
  segmentTextActive: { color: '#FFFFFF' },
});
