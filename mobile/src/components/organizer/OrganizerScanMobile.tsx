import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';

type Props = {
  goTo: (section: 'attendees' | 'events' | 'blocks') => void;
};

export function OrganizerScanMobile({ goTo }: Props) {
  const { t } = useLanguage();

  return (
    <View>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>{t('ACCESO EN PUERTA', 'DOOR ACCESS')}</Text>
        <Text style={styles.title}>{t('Scan de tickets', 'Ticket scan')}</Text>
        <Text style={styles.copy}>
          {t(
            'Valida QR, controla acceso en puerta y revisa el estado de cada ticket.',
            'Validate QR codes, control door access and review each ticket status.'
          )}
        </Text>

        <View style={styles.scanFrame}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />

          <View style={styles.scanIcon}>
            <Text style={styles.scanIconText}>#</Text>
          </View>
          <Text style={styles.scanTitle}>{t('Listo para escanear', 'Ready to scan')}</Text>
          <Text style={styles.scanCopy}>
            {t(
              'El scanner real se conectara a la camara y al QR del ticket.',
              'The real scanner will connect to the camera and ticket QR.'
            )}
          </Text>
        </View>

        <View style={styles.statusGrid}>
          <StatusBox label={t('Validos hoy', 'Valid today')} value="62" />
          <StatusBox label={t('Escaneados', 'Scanned')} value="18" />
          <StatusBox label={t('Pendientes', 'Pending')} value="44" />
          <StatusBox label={t('Alertas', 'Alerts')} value="0" />
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{t('Modo organizador', 'Organizer mode')}</Text>
          <Text style={styles.noticeCopy}>
            {t(
              'Solo organizadores y administradores pueden usar el scanner de acceso.',
              'Only organizers and admins can use the access scanner.'
            )}
          </Text>
        </View>

        <View style={styles.actions}>
          <Button label={t('VER ASISTENTES', 'VIEW ATTENDEES')} onPress={() => goTo('attendees')} />
          <Button label={t('MIS EVENTOS', 'MY EVENTS')} muted onPress={() => goTo('events')} />
          <Button label={t('BLOQUEOS', 'ACCESS')} muted onPress={() => goTo('blocks')} />
        </View>
      </View>
    </View>
  );
}

function StatusBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusBox}>
      <Text style={styles.statusValue}>{value}</Text>
      <Text style={styles.statusLabel}>{label}</Text>
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
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 16,
    shadowColor: '#111827',
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '900', marginBottom: 8 },
  title: { color: colors.navy, fontSize: 26, fontWeight: '900', marginBottom: 8 },
  copy: { color: '#6B7280', fontSize: 14, lineHeight: 21, fontWeight: '700', marginBottom: 16 },
  scanFrame: {
    minHeight: 260,
    borderRadius: 26,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    marginBottom: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  cornerTopLeft: { position: 'absolute', top: 18, left: 18, width: 44, height: 44, borderTopWidth: 4, borderLeftWidth: 4, borderColor: colors.orange, borderTopLeftRadius: 12 },
  cornerTopRight: { position: 'absolute', top: 18, right: 18, width: 44, height: 44, borderTopWidth: 4, borderRightWidth: 4, borderColor: colors.orange, borderTopRightRadius: 12 },
  cornerBottomLeft: { position: 'absolute', bottom: 18, left: 18, width: 44, height: 44, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: colors.orange, borderBottomLeftRadius: 12 },
  cornerBottomRight: { position: 'absolute', bottom: 18, right: 18, width: 44, height: 44, borderBottomWidth: 4, borderRightWidth: 4, borderColor: colors.orange, borderBottomRightRadius: 12 },
  scanIcon: { width: 86, height: 86, borderRadius: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  scanIconText: { color: colors.navy, fontSize: 38, fontWeight: '900' },
  scanTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginBottom: 8, textAlign: 'center' },
  scanCopy: { color: '#cbd5e1', fontSize: 14, fontWeight: '700', textAlign: 'center', lineHeight: 21 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statusBox: { width: '48%', backgroundColor: '#F8FAFC', borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', padding: 14 },
  statusValue: { color: colors.orange, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  statusLabel: { color: '#6B7280', fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  notice: { backgroundColor: '#fff7ed', borderRadius: 20, borderWidth: 1, borderColor: '#FED7AA', padding: 15, marginBottom: 14 },
  noticeTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', marginBottom: 5 },
  noticeCopy: { color: '#6B7280', fontSize: 13, lineHeight: 19, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  button: { minHeight: 46, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, flexGrow: 1 },
  buttonMuted: { backgroundColor: '#F9FAFB' },
  buttonText: { color: '#FFFFFF', fontSize: 12, letterSpacing: 1.3, fontWeight: '900' },
  buttonTextMuted: { color: colors.navy },
});
