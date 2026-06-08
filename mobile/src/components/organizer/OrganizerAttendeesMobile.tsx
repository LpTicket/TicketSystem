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
  onToggle: (id: string) => void;
  goTo: (section: 'events' | 'map' | 'blocks' | 'scan') => void;
};

export function OrganizerAttendeesMobile({ attendees, onToggle, goTo }: Props) {
  const { t } = useLanguage();
  const scanned = attendees.filter((item) => item.status === 'SCANNED').length;
  const pending = attendees.length - scanned;

  return (
    <View>
      <View style={styles.metricsGrid}>
        <Metric label={t('Compradores', 'Buyers')} value={String(attendees.length)} />
        <Metric label={t('Escaneados', 'Scanned')} value={String(scanned)} />
        <Metric label={t('Pendientes', 'Pending')} value={String(pending)} />
        <Metric label={t('Ingresos', 'Revenue')} value="$1.2k" />
      </View>

      <View style={styles.panel}>
        <Text style={styles.eyebrow}>{t('ASISTENTES', 'ATTENDEES')}</Text>
        <Text style={styles.title}>{t('Asistentes y ventas', 'Attendees and sales')}</Text>
        <Text style={styles.copy}>{t('Compradores, tickets, estado de acceso, codigo QR y acciones rapidas.', 'Buyers, tickets, access status, QR code and quick actions.')}</Text>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <Text style={styles.searchText}>{t('Buscar por nombre, email o codigo', 'Search by name, email or code')}</Text>
        </View>

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
              <TouchableOpacity style={styles.secondaryAction}>
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
  metric: { width: '48%', backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.goldBorder, padding: 16 },
  metricValue: { color: colors.orange, fontSize: 25, fontWeight: '900', marginBottom: 4 },
  metricLabel: { color: colors.textFaint, fontSize: 12, fontWeight: '900' },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#111827',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '900', marginBottom: 8 },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '900', marginBottom: 8 },
  copy: { color: colors.textFaint, fontSize: 14, lineHeight: 21, fontWeight: '400', marginBottom: 16 },
  searchBox: {
    height: 54,
    borderRadius: 17,
    backgroundColor: colors.cardSoft,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 15,
    marginBottom: 14,
  },
  searchIcon: { color: colors.textPrimary, fontSize: 22, fontWeight: '900' },
  searchText: { color: '#9CA3AF', fontSize: 14, fontWeight: '800' },
  attendeeCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    padding: 15,
    marginBottom: 12,
  },
  attendeeTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  avatar: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  attendeeMain: { flex: 1 },
  name: { color: colors.textPrimary, fontSize: 17, fontWeight: '900', marginBottom: 3 },
  email: { color: colors.textFaint, fontSize: 12, fontWeight: '400', marginBottom: 4 },
  ticket: { color: '#111827', fontSize: 13, fontWeight: '800' },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 7 },
  statusGreen: { backgroundColor: '#DCFCE7' },
  statusOrange: { backgroundColor: '#FFF7ED' },
  statusText: { fontSize: 9, letterSpacing: 1, fontWeight: '900' },
  statusTextGreen: { color: '#15803d' },
  statusTextOrange: { color: colors.orange },
  codeRow: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    padding: 12,
    marginBottom: 12,
  },
  codeLabel: { color: '#9CA3AF', fontSize: 10, letterSpacing: 1.3, fontWeight: '900', marginBottom: 4 },
  codeValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10 },
  primaryAction: { flex: 1, height: 44, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 11, letterSpacing: 1.3, fontWeight: '900' },
  secondaryAction: { width: 104, height: 44, borderRadius: 14, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.textPrimary, fontSize: 11, letterSpacing: 1.3, fontWeight: '900' },
  bottomActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  button: { minHeight: 46, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, flexGrow: 1 },
  buttonMuted: { backgroundColor: '#F9FAFB' },
  buttonText: { color: '#FFFFFF', fontSize: 12, letterSpacing: 1.3, fontWeight: '900' },
  buttonTextMuted: { color: colors.textPrimary },
});
