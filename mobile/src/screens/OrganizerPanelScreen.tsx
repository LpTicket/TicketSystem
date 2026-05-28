import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { mockEvents } from '../data/mockEvents';
import { VenueMapEditor } from '../components/organizer/VenueMapEditor';

type Section = 'dashboard' | 'events' | 'create' | 'details' | 'map' | 'attendees' | 'blocks' | 'rewards' | 'scan';

const sections: { id: Section; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'events', label: 'Mis eventos' },
  { id: 'create', label: 'Crear evento' },
  { id: 'details', label: 'Detalles' },
  { id: 'map', label: 'Mapa visual' },
  { id: 'attendees', label: 'Asistentes' },
  { id: 'blocks', label: 'Bloqueos' },
  { id: 'rewards', label: 'Recompensas' },
  { id: 'scan', label: 'Scan' },
];

export function OrganizerPanelScreen() {
  const [active, setActive] = useState<Section>('dashboard');
  const [eventTitle, setEventTitle] = useState('Noche de (des)amor');
  const [eventVenue, setEventVenue] = useState('Ambriza');
  const [eventStatus, setEventStatus] = useState<'draft' | 'published'>('published');
  const [accessItems, setAccessItems] = useState([
    { id: '1', title: 'Mesa 8', type: 'Reserva', status: 'ACTIVE' },
    { id: '2', title: 'VIP Familia', type: 'Invitacion', status: 'ACTIVE' },
    { id: '3', title: 'PRIVATE-21', type: 'Codigo privado', status: 'PAUSED' },
  ]);
  const [attendees, setAttendees] = useState([
    { id: '1', name: 'Sundin Galue', ticket: 'General admission', status: 'PAID' },
    { id: '2', name: 'Fidel Genre', ticket: 'Mesa 8', status: 'SCANNED' },
    { id: '3', name: 'Maria Lopez', ticket: 'VIP', status: 'PAID' },
  ]);

  const event = mockEvents[0];

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
            <TouchableOpacity key={item.id} onPress={() => setActive(item.id)} style={[styles.tab, active === item.id && styles.tabActive]}>
              <Text style={[styles.tabText, active === item.id && styles.tabTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>ORGANIZADOR</Text>
        <Text style={styles.title}>{titleFor(active)}</Text>
        <Text style={styles.subtitle}>{subtitleFor(active)}</Text>

        {active === 'dashboard' && (
          <>
            <View style={styles.metricsGrid}>
              <Metric label="Ventas" value="$1,240" />
              <Metric label="Tickets" value="62" />
              <Metric label="Asistentes" value="58" />
              <Metric label="Balance" value="$320" />
            </View>

            <PanelCard title="Evento activo" eyebrow="LIVE EVENT" copy="Resumen del evento principal publicado.">
              <Text style={styles.eventName}>{eventTitle}</Text>
              <Text style={styles.copy}>{event.date} · {eventVenue}</Text>
              <View style={styles.progressTrack}>
                <View style={styles.progressFill} />
              </View>
              <Text style={styles.copy}>62 vendidos de 262 capacidad</Text>

              <View style={styles.actionGrid}>
                <ActionButton label="Mis eventos" onPress={() => setActive('events')} />
                <ActionButton label="Mapa visual" onPress={() => setActive('map')} />
                <ActionButton label="Asistentes" onPress={() => setActive('attendees')} />
              </View>
            </PanelCard>
          </>
        )}

        {active === 'events' && (
          <View style={styles.eventCard}>
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>EV</Text>
              </View>
              <View style={styles.cardMain}>
                <Text style={styles.cardTitle}>{eventTitle}</Text>
                <Text style={styles.cardSub}>{event.date} · {eventVenue}</Text>
              </View>
            </View>

            <View style={styles.statusRow}>
              <StatusPill label={eventStatus === 'published' ? 'PUBLICADO' : 'BORRADOR'} tone={eventStatus === 'published' ? 'green' : 'gray'} />
              <StatusPill label="262 CAP." tone="orange" />
            </View>

            <View style={styles.actionGrid}>
              <ActionButton label="Editar" onPress={() => setActive('details')} />
              <ActionButton label="Mapa" onPress={() => setActive('map')} />
              <ActionButton label="Ventas" onPress={() => setActive('attendees')} />
              <ActionButton label={eventStatus === 'published' ? 'Pasar a borrador' : 'Publicar'} muted onPress={() => setEventStatus(eventStatus === 'published' ? 'draft' : 'published')} />
            </View>
          </View>
        )}

        {active === 'create' && (
          <PanelCard title="Crear evento" eyebrow="NEW EVENT" copy="Configura la base de un nuevo evento antes de publicarlo.">
            <FieldLabel label="Titulo del evento" />
            <TextInput value={eventTitle} onChangeText={setEventTitle} style={styles.input} />

            <FieldLabel label="Lugar" />
            <TextInput value={eventVenue} onChangeText={setEventVenue} style={styles.input} />

            <View style={styles.formActions}>
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>SAVE DRAFT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setActive('details')}>
                <Text style={styles.secondaryButtonText}>CONTINUE SETUP</Text>
              </TouchableOpacity>
            </View>
          </PanelCard>
        )}

        {active === 'details' && (
          <PanelCard title="Detalles e imagenes" eyebrow="EVENT DETAILS" copy="Edita informacion publica, imagenes, categoria y estado.">
            <FieldLabel label="Titulo" />
            <TextInput value={eventTitle} onChangeText={setEventTitle} style={styles.input} />

            <FieldLabel label="Venue" />
            <TextInput value={eventVenue} onChangeText={setEventVenue} style={styles.input} />

            <FieldLabel label="Estado" />
            <View style={styles.segmentGroup}>
              <TouchableOpacity onPress={() => setEventStatus('published')} style={[styles.segment, eventStatus === 'published' && styles.segmentActiveOrange]}>
                <Text style={[styles.segmentText, eventStatus === 'published' && styles.segmentTextActive]}>Published</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEventStatus('draft')} style={[styles.segment, eventStatus === 'draft' && styles.segmentActive]}>
                <Text style={[styles.segmentText, eventStatus === 'draft' && styles.segmentTextActive]}>Draft</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={() => setActive('events')}>
              <Text style={styles.primaryButtonText}>SAVE EVENT</Text>
            </TouchableOpacity>
          </PanelCard>
        )}
        {active === 'map' && <VenueMapEditor />}

        {active === 'attendees' && (
          <>
            <View style={styles.metricsGrid}>
              <Metric label="Compradores" value="48" />
              <Metric label="Escaneados" value="18" />
              <Metric label="Pendientes" value="44" />
              <Metric label="Ingresos" value="$1.2k" />
            </View>
            <PanelCard title="Asistentes y ventas" eyebrow="ATTENDEES" copy="Compradores, tickets, estado de acceso y acciones rapidas.">
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>⌕</Text>
                <Text style={styles.searchText}>Buscar asistente o ticket</Text>
              </View>

              {attendees.map((item) => (
                <Attendee
                  key={item.id}
                  name={item.name}
                  ticket={item.ticket}
                  status={item.status}
                  onToggle={() => toggleAttendeeStatus(item.id)}
                />
              ))}
            </PanelCard>
          </>
        )}

        {active === 'blocks' && (
          <>
            <View style={styles.metricsGrid}>
              <Metric label="Reservas" value="4" />
              <Metric label="Invitados" value="18" />
              <Metric label="Codigos" value="3" />
              <Metric label="VIP" value="12" />
            </View>

            <PanelCard title="Bloqueos e invitaciones" eyebrow="ACCESS CONTROL" copy="Gestiona reservas, invitaciones, codigos privados y lista VIP.">
              {accessItems.map((item) => (
                <AccessControlCard
                  key={item.id}
                  title={item.title}
                  type={item.type}
                  status={item.status}
                  onToggle={() => toggleAccessItem(item.id)}
                />
              ))}

              <View style={styles.actionGrid}>
                <ActionButton label="Ver mapa" onPress={() => setActive('map')} />
                <ActionButton label="Asistentes" onPress={() => setActive('attendees')} />
              </View>
            </PanelCard>
          </>
        )}

        {active === 'rewards' && (
          <PanelCard title="Recompensas" eyebrow="REWARDS" copy="Balance, codigos especiales y pagos del organizador.">
            <AccessItem title="Balance actual" value="$320" />
            <AccessItem title="Codigos generando" value="2" />
            <AccessItem title="Pagado historico" value="$540" />

            <View style={styles.actionGrid}>
              <ActionButton label="Ver ventas" onPress={() => setActive('attendees')} />
              <ActionButton label="Mis eventos" onPress={() => setActive('events')} />
            </View>
          </PanelCard>
        )}

        {active === 'scan' && (
          <PanelCard title="Scan de tickets" eyebrow="DOOR ACCESS" copy="Valida QR y controla el acceso en puerta.">
            <View style={styles.scanBox}>
              <Text style={styles.scanIcon}>#</Text>
              <Text style={styles.scanTitle}>Ready to scan</Text>
              <Text style={styles.copy}>El scanner real se conectara a la camara y al QR del ticket.</Text>
            </View>

            <View style={styles.actionGrid}>
              <ActionButton label="Ver asistentes" onPress={() => setActive('attendees')} />
              <ActionButton label="Mis eventos" onPress={() => setActive('events')} />
            </View>
          </PanelCard>
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

function titleFor(section: Section) {
  const names: Record<Section, string> = {
    dashboard: 'Panel de organizador',
    events: 'Mis eventos',
    create: 'Crear evento',
    details: 'Detalles',
    map: 'Mapa visual',
    attendees: 'Asistentes y ventas',
    blocks: 'Bloqueos',
    rewards: 'Recompensas',
    scan: 'Scan',
  };
  return names[section];
}

function subtitleFor(section: Section) {
  const copy: Record<Section, string> = {
    dashboard: 'Ventas, tickets, asistentes y balance.',
    events: 'Administra tus eventos publicados y borradores.',
    create: 'Crea un evento nuevo desde el movil.',
    details: 'Edita informacion publica e imagenes.',
    map: 'Mesas, sillas, areas, barras y precios.',
    attendees: 'Compradores, tickets y acceso.',
    blocks: 'Reservas, invitaciones y lista VIP.',
    rewards: 'Comisiones, codigos y pagos.',
    scan: 'Validacion de QR en puerta.',
  };
  return copy[section];
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f5f7fa' },
  tabsShell: { height: 86, backgroundColor: '#f5f7fa', justifyContent: 'center', overflow: 'hidden' },
  tabsScroller: { height: 86, flexGrow: 0, flexShrink: 0, backgroundColor: '#f5f7fa' },
  tabs: { height: 86, paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tab: { height: 40, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'center' },
  tabActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabText: { color: '#64748b', fontSize: 13, fontWeight: '800' },
  tabTextActive: { color: '#ffffff' },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 140 },
  eyebrow: { color: colors.orange, fontSize: 13, letterSpacing: 4, fontWeight: '900', marginBottom: 8 },
  title: { color: colors.navy, fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#64748b', fontSize: 16, lineHeight: 23, fontWeight: '600', marginBottom: 18 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metric: { width: '48%', backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', padding: 16 },
  metricValue: { color: colors.orange, fontSize: 24, fontWeight: '900', marginBottom: 4 },
  metricLabel: { color: '#64748b', fontSize: 13, fontWeight: '800' },
  panelCard: { backgroundColor: '#ffffff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', padding: 20, marginBottom: 16, shadowColor: '#0f172a', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  formEyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '900', marginBottom: 8 },
  panelTitle: { color: colors.navy, fontSize: 26, fontWeight: '900', marginBottom: 8 },
  eventName: { color: colors.navy, fontSize: 22, fontWeight: '900', marginBottom: 6 },
  copy: { color: '#64748b', fontSize: 15, lineHeight: 22, fontWeight: '600', marginBottom: 14 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: '#e2e8f0', marginVertical: 14, overflow: 'hidden' },
  progressFill: { width: '24%', height: '100%', backgroundColor: colors.orange },
  eventCard: { backgroundColor: '#ffffff', borderRadius: 26, borderWidth: 1, borderColor: '#e2e8f0', padding: 18, marginBottom: 14 },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  cardMain: { flex: 1 },
  cardTitle: { color: colors.navy, fontSize: 20, fontWeight: '900', marginBottom: 4 },
  cardSub: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  statusPill: { height: 32, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  statusGreen: { backgroundColor: '#dcfce7' },
  statusOrange: { backgroundColor: '#ffedd5' },
  statusGray: { backgroundColor: '#eef2f7' },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  statusTextGreen: { color: '#15803d' },
  statusTextOrange: { color: colors.orange },
  statusTextGray: { color: '#64748b' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  actionButton: { height: 44, borderRadius: 14, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  actionButtonMuted: { backgroundColor: '#eef4f8' },
  actionButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  actionButtonTextMuted: { color: colors.navy },
  fieldLabel: { color: '#64748b', fontSize: 13, fontWeight: '900', marginBottom: 8 },
  input: { height: 58, borderRadius: 17, borderWidth: 1, borderColor: '#dbe3ec', backgroundColor: '#fbfdff', paddingHorizontal: 16, color: colors.navy, fontSize: 16, fontWeight: '800', marginBottom: 16 },
  segmentGroup: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  segment: { flex: 1, height: 48, borderRadius: 15, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  segmentActiveOrange: { backgroundColor: colors.orange, borderColor: colors.orange },
  segmentText: { color: '#64748b', fontSize: 13, fontWeight: '900' },
  segmentTextActive: { color: '#ffffff' },
  formActions: { marginTop: 4, gap: 10 },
  primaryButton: { height: 56, borderRadius: 16, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#ffffff', fontSize: 13, letterSpacing: 1.8, fontWeight: '900' },
  secondaryButton: { height: 54, borderRadius: 16, backgroundColor: '#eef4f8', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.navy, fontSize: 13, letterSpacing: 1.4, fontWeight: '900' },
  mapPreview: { height: 230, backgroundColor: '#f8fafc', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 8, marginBottom: 16, position: 'relative', overflow: 'hidden' },
  stage: { position: 'absolute', top: 24, left: 30, right: 30, height: 38, borderRadius: 10, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' },
  stageText: { color: '#ffffff', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  table: { position: 'absolute', top: 92, left: 38, width: 92, height: 70, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 2, borderColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  tableTwo: { left: undefined, right: 38, borderColor: '#6366f1' },
  tableText: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  bar: { position: 'absolute', left: 70, right: 70, bottom: 26, height: 42, borderRadius: 12, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  listCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, backgroundColor: '#f8fafc', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, marginTop: 10 },
  listTitle: { color: colors.navy, fontSize: 16, fontWeight: '900' },
  listSub: { color: '#64748b', fontSize: 13, fontWeight: '600', marginTop: 3 },
  listValue: { color: colors.orange, fontSize: 20, fontWeight: '900' },
  scanBox: { backgroundColor: colors.navy, borderRadius: 24, padding: 22, alignItems: 'center' },
  scanIcon: { color: colors.orange, fontSize: 42, fontWeight: '900', marginBottom: 8 },
  scanTitle: { color: '#ffffff', fontSize: 24, fontWeight: '900', marginBottom: 6 },
searchBox: {
    height: 54,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#dbe3ec',
    backgroundColor: '#fbfdff',
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  searchIcon: {
    color: colors.navy,
    fontSize: 22,
    fontWeight: '900',
  },
  searchText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '700',
  },
  attendeeCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#ffffff',
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
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  attendeeSecondary: {
    width: 98,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#eef4f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeSecondaryText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
accessCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  attendeeSecondaryWide: {
    height: 44,
    borderRadius: 14,
    backgroundColor: '#eef4f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
