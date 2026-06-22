import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { GradientButton } from '../GradientButton';

type AccessItem = {
  id: string;
  title: string;
  type: string;
  status: string;
};

type Props = {
  items: AccessItem[];
  onToggle: (id: string) => void;
  goTo: (section: 'map' | 'attendees' | 'scan') => void;
};

export function OrganizerAccessMobile({ items, onToggle, goTo }: Props) {
  const { t } = useLanguage();
  const active = items.filter((item) => item.status === 'ACTIVE').length;
  const paused = items.length - active;

  return (
    <View>
      <View style={styles.metricsGrid}>
        <Metric label={t('Reservas', 'Reservations')} value="4" />
        <Metric label={t('Invitados', 'Guests')} value="18" />
        <Metric label={t('Activos', 'Active')} value={String(active)} />
        <Metric label={t('Pausados', 'Paused')} value={String(paused)} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.eyebrow}>{t('CONTROL DE ACCESO', 'ACCESS CONTROL')}</Text>
        <Text style={styles.title}>{t('Bloqueos e invitaciones', 'Access and invitations')}</Text>
        <Text style={styles.copy}>{t('Gestiona reservas de mesas, invitaciones privadas, codigos especiales y lista VIP.', 'Manage table reservations, private invitations, special codes and VIP list.')}</Text>

        <QuickAction title={t('Reservar mesa', 'Reserve table')} copy={t('Bloquea una mesa o silla desde el mapa visual.', 'Block a table or seat from the visual map.')} action={t('ABRIR MAPA', 'OPEN MAP')} onPress={() => goTo('map')} />
        <QuickAction title={t('Enviar invitacion', 'Send invitation')} copy={t('Genera tickets de cortesia para invitados especiales.', 'Generate complimentary tickets for special guests.')} action={t('LISTA INVITADOS', 'GUEST LIST')} onPress={() => goTo('attendees')} />
        <QuickAction title={t('Validar acceso', 'Validate access')} copy={t('Usa el scan para confirmar QR en puerta.', 'Use scan to confirm QR at the door.')} action={t('SCAN', 'SCAN')} onPress={() => goTo('scan')} />

        <Text style={styles.sectionTitle}>{t('Accesos activos', 'Active access')}</Text>

        {items.map((item, index) => (
          <View key={`${item.id || item.type || 'access'}-${index}`} style={styles.accessCard}>
            <View style={styles.accessTop}>
              <View style={styles.iconBox}>
                <Text style={styles.iconText}>{item.type.slice(0, 2).toUpperCase()}</Text>
              </View>

              <View style={styles.accessMain}>
                <Text style={styles.accessTitle}>{item.title}</Text>
                <Text style={styles.accessType}>{item.type}</Text>
              </View>

              <Status status={item.status} />
            </View>

            <View style={styles.actions}>
              {item.status === 'ACTIVE' ? (
                <TouchableOpacity onPress={() => onToggle(item.id)} style={styles.pauseButton}>
                  <Text style={styles.pauseText}>PAUSE ACCESS</Text>
                </TouchableOpacity>
              ) : (
                <GradientButton label="ACTIVATE" onPress={() => onToggle(item.id)} height={44} style={styles.activateButton} textStyle={styles.activateText} />
              )}

              <TouchableOpacity style={styles.secondaryButton} onPress={() => goTo('map')}>
                <Text style={styles.secondaryText}>{t('VER MAPA', 'VIEW MAP')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
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

function QuickAction({ title, copy, action, onPress }: { title: string; copy: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.quickCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickCopy}>{copy}</Text>
      </View>
      <TouchableOpacity style={styles.quickButton} onPress={onPress}>
        <Text style={styles.quickButtonText}>{action}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Status({ status }: { status: string }) {
  const isActive = status === 'ACTIVE';
  return (
    <View style={[styles.status, isActive ? styles.statusActive : styles.statusPaused]}>
      <Text style={[styles.statusText, isActive ? styles.statusActiveText : styles.statusPausedText]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metric: { width: '48%', backgroundColor: '#030B14', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 16 },
  metricValue: { color: colors.orange, fontSize: 25, fontWeight: '600', marginBottom: 4 },
  metricLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 12, fontWeight: '600' },
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
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 0, fontWeight: '600', marginBottom: 8 },
  title: { color: '#F8FAFC', fontSize: 26, fontWeight: '600', marginBottom: 8 },
  copy: { color: 'rgba(226,232,240,0.64)', fontSize: 14, lineHeight: 21, fontWeight: '400', marginBottom: 16 },
  quickCard: {
    backgroundColor: '#030B14',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 15,
    marginBottom: 11,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  quickTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  quickCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  quickButton: { height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  quickButtonText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '600' },
  sectionTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '600', marginTop: 10, marginBottom: 12 },
  accessCard: {
    backgroundColor: '#030B14',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 15,
    marginBottom: 12,
  },
  accessTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
  iconBox: { width: 52, height: 52, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },
  accessMain: { flex: 1 },
  accessTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '600', marginBottom: 4 },
  accessType: { color: 'rgba(226,232,240,0.64)', fontSize: 13, fontWeight: '600' },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 7, borderWidth: 1 },
  statusActive: { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: 'rgba(249,115,22,0.36)' },
  statusPaused: { backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'rgba(255,255,255,0.14)' },
  statusText: { fontSize: 9, letterSpacing: 0, fontWeight: '600' },
  statusActiveText: { color: colors.orange },
  statusPausedText: { color: '#CBD5E1' },
  actions: { flexDirection: 'row', gap: 10 },
  activateButton: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  activateText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '600' },
  pauseButton: { flex: 1, height: 44, borderRadius: 14, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  pauseText: { color: colors.orange, fontSize: 14, letterSpacing: 0, fontWeight: '600' },
  secondaryButton: { width: 104, height: 44, borderRadius: 14, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#F8FAFC', fontSize: 11, letterSpacing: 0, fontWeight: '600' },
});
