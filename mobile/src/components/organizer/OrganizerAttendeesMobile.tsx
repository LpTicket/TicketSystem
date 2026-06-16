import { useEffect, useState } from 'react';
import { Alert, Modal, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { GradientButton } from '../GradientButton';
import { apiPost, apiPut } from '../../services/api';
import { exportCsv } from '../../utils/csv';

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
  eventId?: string;
  event?: any;
  eventTitle?: string;
};

export function OrganizerAttendeesMobile({ attendees, revenueLabel, onToggle, onResend, goTo, eventId, event, eventTitle }: Props) {
  const { t } = useLanguage();
  const scanned = attendees.filter((item) => item.status === 'SCANNED').length;
  const pending = attendees.length - scanned;

  // Reminder settings (mirror of the web editor's reminder modal).
  const [showReminder, setShowReminder] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoDays, setAutoDays] = useState('0');
  const [autoMsg, setAutoMsg] = useState('');
  const [sendMsg, setSendMsg] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    if (!event) return;
    setAutoEnabled(!!event.autoReminderEnabled);
    setAutoDays(String(event.autoReminderDays || 0));
    setAutoMsg(event.autoReminderMessage || '');
  }, [event]);

  const daysUntilEvent = (() => {
    if (!event?.eventDate) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(event.eventDate); d.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((d.getTime() - today.getTime()) / (1000 * 3600 * 24)));
  })();

  const saveReminderSettings = async () => {
    if (!eventId) return;
    setSavingSettings(true);
    try {
      await apiPut(`/orders/event/${eventId}/reminder-settings`, {
        autoReminderEnabled: autoEnabled,
        autoReminderDays: Number(autoDays) || 0,
        autoReminderMessage: autoMsg.trim() || undefined,
      });
      Alert.alert(t('Listo', 'Done'), t('Configuración de recordatorios guardada.', 'Reminder settings saved.'));
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('Error al guardar recordatorios', 'Error saving reminders'));
    } finally {
      setSavingSettings(false);
    }
  };

  const sendReminderNow = async () => {
    if (!eventId) return;
    setSendingReminder(true);
    try {
      const res = await apiPost<any>(`/orders/event/${eventId}/send-reminder`, {
        daysUntilEvent,
        customMessage: sendMsg.trim() || undefined,
      });
      Alert.alert(t('Enviado', 'Sent'), t(`Recordatorios enviados a ${res?.sent ?? 0} asistentes.`, `Reminders sent to ${res?.sent ?? 0} attendees.`));
      setShowReminder(false);
      setSendMsg('');
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('Error al enviar recordatorios', 'Error sending reminders'));
    } finally {
      setSendingReminder(false);
    }
  };

  const onExportCsv = () => {
    const rows: (string | number)[][] = [
      [t('Nombre', 'Name'), 'Email', t('Ticket', 'Ticket'), t('Código', 'Code'), t('Estado', 'Status')],
      ...attendees.map((a) => [a.name, a.email, a.ticket, a.code, a.status]),
    ];
    exportCsv(`${(eventTitle || 'event').replace(/\s+/g, '-').toLowerCase()}-attendees.csv`, rows);
  };

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
          <Button label={t('RECORDATORIOS', 'REMINDERS')} onPress={() => setShowReminder(true)} />
          <Button label={t('EXPORTAR CSV', 'EXPORT CSV')} muted onPress={onExportCsv} />
          <Button label={t('SCAN QR', 'SCAN QR')} muted onPress={() => goTo('scan')} />
          <Button label={t('MAPA', 'MAP')} muted onPress={() => goTo('map')} />
          <Button label={t('BLOQUEOS', 'BLOCKS')} muted onPress={() => goTo('blocks')} />
        </View>
      </View>

      <Modal visible={showReminder} transparent animationType="fade" onRequestClose={() => setShowReminder(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('Recordatorios', 'Reminders')}</Text>
              <TouchableOpacity onPress={() => setShowReminder(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>

            <View style={styles.modalSection}>
              <View style={styles.switchRow}>
                <Text style={styles.modalLabel}>{t('Recordatorio automático', 'Automatic reminder')}</Text>
                <Switch value={autoEnabled} onValueChange={setAutoEnabled} trackColor={{ true: colors.orange, false: '#334155' }} thumbColor="#fff" />
              </View>
              <Text style={styles.modalFieldLabel}>{t('Días antes del evento', 'Days before the event')}</Text>
              <TextInput value={autoDays} onChangeText={setAutoDays} keyboardType="number-pad" style={styles.modalInput} placeholderTextColor="#9CA3AF" />
              <Text style={styles.modalFieldLabel}>{t('Mensaje (opcional)', 'Message (optional)')}</Text>
              <TextInput value={autoMsg} onChangeText={setAutoMsg} multiline style={[styles.modalInput, styles.modalTextArea]} placeholderTextColor="#9CA3AF" />
              <GradientButton label={savingSettings ? t('GUARDANDO...', 'SAVING...') : t('GUARDAR AJUSTES', 'SAVE SETTINGS')} onPress={saveReminderSettings} height={48} style={{ marginTop: 10 }} />
            </View>

            <View style={[styles.modalSection, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 14 }]}>
              <Text style={styles.modalLabel}>{t('Enviar ahora', 'Send now')}</Text>
              <Text style={styles.modalHint}>{t(`Faltan ${daysUntilEvent} días para el evento.`, `${daysUntilEvent} days until the event.`)}</Text>
              <TextInput value={sendMsg} onChangeText={setSendMsg} multiline placeholder={t('Mensaje personalizado (opcional)', 'Custom message (optional)')} style={[styles.modalInput, styles.modalTextArea]} placeholderTextColor="#9CA3AF" />
              <GradientButton label={sendingReminder ? t('ENVIANDO...', 'SENDING...') : t('ENVIAR RECORDATORIO', 'SEND REMINDER')} onPress={sendReminderNow} height={48} style={{ marginTop: 10 }} />
            </View>
          </View>
        </View>
      </Modal>
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
  if (!muted) {
    return <GradientButton label={label} onPress={onPress} height={46} style={styles.button} textStyle={styles.buttonText} />;
  }

  return (
    <TouchableOpacity onPress={onPress} style={[styles.button, styles.buttonMuted]}>
      <Text style={[styles.buttonText, styles.buttonTextMuted]}>{label}</Text>
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
  button: { minHeight: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, flexGrow: 1 },
  buttonMuted: { backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  buttonText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '700' },
  buttonTextMuted: { color: '#F8FAFC' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2,8,15,0.78)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 460, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0A1420', padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  modalClose: { color: 'rgba(248,250,252,0.7)', fontSize: 18, fontWeight: '700' },
  modalSection: { gap: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalLabel: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  modalHint: { color: 'rgba(226,232,240,0.6)', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  modalFieldLabel: { color: 'rgba(203,213,225,0.8)', fontSize: 12, fontWeight: '700', marginTop: 4 },
  modalInput: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 12, backgroundColor: '#030B14', color: '#FFFFFF', fontSize: 14, paddingHorizontal: 12, paddingVertical: 11 },
  modalTextArea: { minHeight: 70, textAlignVertical: 'top' },
});
