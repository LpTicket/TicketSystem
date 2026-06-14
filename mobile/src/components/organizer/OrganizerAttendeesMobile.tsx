import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';

type Attendee = {
  id: string;
  name: string;
  email: string;
  ticket: string;
  code: string;
  status: string;
  total: string;
};

type Props = {
  attendees: Attendee[];
  revenueLabel?: string;
  onToggle: (id: string) => void;
  onResend?: (id: string) => void;
  goTo: (section: 'events' | 'map' | 'blocks' | 'scan') => void;
};

export function OrganizerAttendeesMobile({ attendees, revenueLabel, onToggle, onResend, goTo }: Props) {
  const { t } = useLanguage();
  const scanned = attendees.filter((item) => item.status === 'SCANNED').length;
  const pending = attendees.length - scanned;

  return (
    <View>
      <View style={styles.metricsGrid}>
        <Metric label={t('Compradores', 'Buyers')} value={String(attendees.length)} />
        <Metric label={t('Escaneados', 'Scanned')} value={String(scanned)} />
        <Metric label={t('Pendientes', 'Pending')} value={String(pending)} />
        <Metric label={t('Ingresos', 'Revenue')} value={revenueLabel || '—'} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.eyebrow}>{t('ASISTENTES', 'ATTENDEES')}</Text>
        <Text style={styles.title}>{t('Asistentes y ventas', 'Attendees and sales')}</Text>
        <Text style={styles.copy}>{t('Compradores, tickets, estado de acceso, codigo QR y acciones rapidas.', 'Buyers, tickets, access status, QR code and quick actions.')}</Text>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <Text style={styles.searchText}>{t('Buscar por nombre, email o codigo', 'Search by name, email or code')}</Text>
        </View>

        {attendees.length === 0 && (
          <View style={styles.codeRow}>
            <Text style={styles.searchText}>{t('Aún no hay asistentes para este evento.', 'No attendees for this event yet.')}</Text>
          </View>
        )}

        {attendees.map((item) => (
          <View key={item.id} style={styles.attendeeCard}>
            <View style={styles.attendeeTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</Text>
              </View>

              <View style={styles.attendeeMain}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.email}>{item.email}</Text>
                <Text style={styles.ticket}>{item.ticket} · {item.total}</Text>
              </View>

              <Status status={item.status} />
            </View>

            <View style={styles.codeRow}>
              <Text style={styles.codeLabel}>{t('Codigo de ticket', 'Ticket code')}</Text>
              <Text style={styles.codeValue}>{item.code}</Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity onPress={() => onToggle(item.id)} style={styles.primaryAction}>
                <Text style={styles.primaryText}>{item.status === 'SCANNED' ? 'UNDO SCAN' : 'CHECK IN'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onResend?.(item.id)} style={styles.secondaryAction}>
                <Text style={styles.secondaryText}>{t('REENVIAR', 'RESEND')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.bottomActions}>
          <Button label={t('SCAN QR', 'SCAN QR')} onPress={() => goTo('scan')} />
          <Button label={t('MAPA', 'MAP')} muted onPress={() => goTo('map')} />
          <Button label={t('BLOQUEOS', 'ACCESS')} muted onPress={() => goTo('blocks')} />
        </View>
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Status({ status }: { status: string }) {
  const scanned = status === 'SCANNED';
  return (
    <View style={[styles.status, scanned ? styles.statusGreen : styles.statusOrange]}>
      <Text style={[styles.statusText, scanned ? styles.statusTextGreen : styles.statusTextOrange]}>{status}</Text>
    </View>
  );
}

function Button({ label, muted, onPress }: { label: string; muted?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.button, muted && styles.buttonMuted]}>
      <Text style={[styles.buttonText, muted && styles.buttonTextMuted]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metric: { width: '48%', backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 16 },
  metricValue: { color: colors.orange, fontSize: 25, fontWeight: '700', marginBottom: 4 },
  metricLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '700' },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '700', marginBottom: 8 },
  title: { color: '#F8FAFC', fontSize: 26, fontWeight: '700', marginBottom: 8 },
  copy: { color: 'rgba(226,232,240,0.64)', fontSize: 14, lineHeight: 21, fontWeight: '400', marginBottom: 16 },
  searchBox: {
    height: 54,
    borderRadius: 17,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    marginBottom: 14,
  },
  searchIcon: { color: '#F8FAFC', fontSize: 22, fontWeight: '700' },
  searchText: { color: 'rgba(226,232,240,0.64)', fontSize: 14, fontWeight: '700' },
  attendeeCard: {
    backgroundColor: '#030B14',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 15,
    marginBottom: 12,
  },
  attendeeTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  avatar: { width: 52, height: 52, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  attendeeMain: { flex: 1 },
  name: { color: '#F8FAFC', fontSize: 17, fontWeight: '700', marginBottom: 3 },
  email: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '400', marginBottom: 4 },
  ticket: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1 },
  statusGreen: { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.36)' },
  statusOrange: { backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'rgba(255,255,255,0.14)' },
  statusText: { fontSize: 9, letterSpacing: 0, fontWeight: '700' },
  statusTextGreen: { color: colors.orange },
  statusTextOrange: { color: '#CBD5E1' },
  codeRow: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 12,
    marginBottom: 12,
  },
  codeLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 10, letterSpacing: 0, fontWeight: '700', marginBottom: 4 },
  codeValue: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  primaryAction: { flex: 1, height: 44, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '700' },
  secondaryAction: { width: 104, height: 44, borderRadius: 14, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#F8FAFC', fontSize: 11, letterSpacing: 0, fontWeight: '700' },
  bottomActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  button: { minHeight: 46, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, flexGrow: 1 },
  buttonMuted: { backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  buttonText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '700' },
  buttonTextMuted: { color: '#F8FAFC' },
});
