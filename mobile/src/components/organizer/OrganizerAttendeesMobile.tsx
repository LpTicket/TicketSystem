import { useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  sales?: any;
};

type BuyerGroup = {
  email: string;
  name: string;
  initials: string;
  tickets: Attendee[];
  scanned: number;
  spent: number;
};

function parseTotal(str: string): number {
  return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
}

function initials(name: string) {
  return name.split(' ').map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
}

export function OrganizerAttendeesMobile({ attendees, revenueLabel, onToggle, onResend, goTo, eventId, event, eventTitle, sales }: Props) {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [expandedBuyer, setExpandedBuyer] = useState<string | null>(null);
  const [detailBuyer, setDetailBuyer] = useState<BuyerGroup | null>(null);

  // Reminder state
  const [showReminder, setShowReminder] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(!!event?.autoReminderEnabled);
  const [autoDays, setAutoDays] = useState(String(event?.autoReminderDays || 0));
  const [autoMsg, setAutoMsg] = useState(event?.autoReminderMessage || '');
  const [sendMsg, setSendMsg] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  const scanned = attendees.filter((a) => a.status === 'SCANNED').length;
  const pending = attendees.length - scanned;

  const daysUntilEvent = (() => {
    if (!event?.eventDate) return 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const d = new Date(event.eventDate); d.setHours(0, 0, 0, 0);
    return Math.max(0, Math.ceil((d.getTime() - today.getTime()) / (1000 * 3600 * 24)));
  })();

  // Group attendees by email → buyers
  const buyers = useMemo<BuyerGroup[]>(() => {
    const map = new Map<string, BuyerGroup>();
    attendees.forEach((a) => {
      const key = a.email || a.name || a.id;
      if (!map.has(key)) {
        map.set(key, {
          email: a.email,
          name: a.name,
          initials: initials(a.name),
          tickets: [],
          scanned: 0,
          spent: 0,
        });
      }
      const g = map.get(key)!;
      g.tickets.push(a);
      if (a.status === 'SCANNED') g.scanned += 1;
      g.spent += parseTotal(a.total);
    });
    return Array.from(map.values());
  }, [attendees]);

  const filteredBuyers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        b.tickets.some((tk) => tk.code.toLowerCase().includes(q) || tk.ticket.toLowerCase().includes(q)),
    );
  }, [buyers, search]);

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

  const onExportAttendeesCsv = () => {
    const rows: (string | number)[][] = [
      [t('Nombre', 'Name'), 'Email', t('Ticket', 'Ticket'), t('Código', 'Code'), t('Estado', 'Status')],
      ...attendees.map((a) => [a.name, a.email, a.ticket, a.code, a.status]),
    ];
    exportCsv(`${(eventTitle || 'event').replace(/\s+/g, '-').toLowerCase()}-attendees.csv`, rows);
  };

  const onExportSalesCsv = () => {
    if (sales?.orders && Array.isArray(sales.orders)) {
      const rows: (string | number)[][] = [
        [t('Cliente', 'Client'), 'Email', t('Tickets', 'Tickets'), t('Total', 'Total'), t('Fecha', 'Date')],
        ...sales.orders.map((o: any) => {
          const u = o.user || {};
          const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || 'Guest';
          const date = o.paidAt ? new Date(o.paidAt).toLocaleDateString() : '';
          return [name, u.email || '', Number(o.ticketCount || 0), Number(o.subtotal ?? o.total ?? 0).toFixed(2), date];
        }),
      ];
      exportCsv(`${(eventTitle || 'event').replace(/\s+/g, '-').toLowerCase()}-sales.csv`, rows);
    } else {
      // Derive from buyer groups
      const rows: (string | number)[][] = [
        [t('Cliente', 'Client'), 'Email', t('Tickets', 'Tickets'), t('Total', 'Total')],
        ...buyers.map((b) => [b.name, b.email, b.tickets.length, b.spent.toFixed(2)]),
      ];
      exportCsv(`${(eventTitle || 'event').replace(/\s+/g, '-').toLowerCase()}-sales.csv`, rows);
    }
  };

  return (
    <View>
      <View style={styles.panel}>
        {/* Header row matching web */}
        <View style={styles.listHeader}>
          <Ionicons name="people-outline" size={18} color="#F97316" style={{ marginRight: 8 }} />
          <View>
            <Text style={styles.title}>{t('Lista de asistentes', 'Attendee List')}</Text>
            <Text style={styles.subtitle}>{buyers.length} {t('compradores', 'buyers')} · {attendees.length} {t('tickets', 'tickets')}</Text>
          </View>
        </View>

        {/* Action buttons row — web layout */}
        <View style={styles.actionRow}>
          <Button label={t('ENVIAR RECORDATORIO', 'Send Reminder')} onPress={() => setShowReminder(true)} icon="notifications-outline" />
          <Button label={t('EXPORTAR CSV', 'Export CSV')} muted onPress={onExportAttendeesCsv} icon="download-outline" />
        </View>
        <Button label={t('EXPORTAR VENTAS', 'Export Sales')} muted onPress={onExportSalesCsv} icon="download-outline" style={styles.exportSalesBtn} />

        {/* Functional search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color="rgba(148,163,184,0.65)" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('Buscar por nombre, email o código', 'Search by name, email or code')}
            placeholderTextColor="rgba(148,163,184,0.5)"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={15} color="rgba(148,163,184,0.55)" />
            </TouchableOpacity>
          )}
        </View>

        {attendees.length === 0 && (
          <Text style={styles.empty}>{t('Aún no hay asistentes para este evento.', 'No attendees for this event yet.')}</Text>
        )}

        {filteredBuyers.length === 0 && attendees.length > 0 && (
          <Text style={styles.empty}>{t('Ningún comprador coincide con la búsqueda.', 'No buyers match the search.')}</Text>
        )}

        {/* Buyer groups */}
        {filteredBuyers.map((buyer, index) => {
          const expanded = expandedBuyer === buyer.email;
          return (
            <View key={`${buyer.email || buyer.name || 'buyer'}-${index}`} style={styles.buyerCard}>
              {/* Buyer header row */}
              <TouchableOpacity
                style={styles.buyerTop}
                onPress={() => setExpandedBuyer(expanded ? null : buyer.email)}
                activeOpacity={0.8}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{buyer.initials}</Text>
                </View>

                <View style={styles.buyerMain}>
                  <Text style={styles.buyerName}>{buyer.name}</Text>
                  <Text style={styles.buyerEmail} numberOfLines={1}>{buyer.email}</Text>
                  <Text style={styles.buyerMeta}>
                    {buyer.tickets.length} {buyer.tickets.length === 1 ? t('ticket', 'ticket') : t('tickets', 'tickets')}
                    {' · '}
                    ${buyer.spent.toFixed(2)}
                    {' · '}
                    {buyer.scanned}/{buyer.tickets.length} {t('esc.', 'scn.')}
                  </Text>
                </View>

                <View style={styles.buyerRight}>
                  <View style={[styles.badge, buyer.scanned === buyer.tickets.length && buyer.tickets.length > 0 ? styles.badgeGreen : styles.badgeOrange]}>
                    <Text style={[styles.badgeText, buyer.scanned === buyer.tickets.length && buyer.tickets.length > 0 ? styles.badgeGreenText : styles.badgeOrangeText]}>
                      {buyer.scanned === buyer.tickets.length && buyer.tickets.length > 0 ? '✓' : `${buyer.scanned}/${buyer.tickets.length}`}
                    </Text>
                  </View>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(148,163,184,0.7)" style={{ marginTop: 4 }} />
                </View>
              </TouchableOpacity>

              {/* Expanded ticket list */}
              {expanded && (
                <View style={styles.ticketList}>
                  {buyer.tickets.map((tk, ticketIndex) => (
                    <View key={`${tk.id || tk.code || 'buyer-ticket'}-${ticketIndex}`} style={styles.ticketRow}>
                      <View style={styles.ticketInfo}>
                        <Text style={styles.ticketSeat}>{tk.ticket}</Text>
                        <Text style={styles.ticketCode}>{tk.code}</Text>
                      </View>
                      <View style={styles.ticketActions}>
                        <StatusBadge status={tk.status} />
                        <TouchableOpacity onPress={() => onToggle(tk.id)} style={styles.smallBtn}>
                          <Text style={styles.smallBtnText}>{tk.status === 'SCANNED' ? 'UNDO' : 'CHECK IN'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onResend?.(tk.id)} style={[styles.smallBtn, styles.smallBtnMuted]}>
                          <Ionicons name="send-outline" size={12} color="#F97316" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}

      </View>

      {/* Reminders modal */}
      <Modal visible={showReminder} transparent animationType="fade" onRequestClose={() => setShowReminder(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('Recordatorios', 'Reminders')}</Text>
              <TouchableOpacity onPress={() => setShowReminder(false)}>
                <Ionicons name="close" size={20} color="rgba(248,250,252,0.7)" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
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

              <View style={[styles.modalSection, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 14, marginTop: 14 }]}>
                <Text style={styles.modalLabel}>{t('Enviar ahora', 'Send now')}</Text>
                <Text style={styles.modalHint}>{t(`Faltan ${daysUntilEvent} días para el evento.`, `${daysUntilEvent} days until the event.`)}</Text>
                <TextInput value={sendMsg} onChangeText={setSendMsg} multiline placeholder={t('Mensaje personalizado (opcional)', 'Custom message (optional)')} style={[styles.modalInput, styles.modalTextArea]} placeholderTextColor="#9CA3AF" />
                <GradientButton label={sendingReminder ? t('ENVIANDO...', 'SENDING...') : t('ENVIAR RECORDATORIO', 'SEND REMINDER')} onPress={sendReminderNow} height={48} style={{ marginTop: 10 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const scanned = status === 'SCANNED';
  return (
    <View style={[styles.badge, scanned ? styles.badgeGreen : styles.badgeOrange]}>
      <Text style={[styles.badgeText, scanned ? styles.badgeGreenText : styles.badgeOrangeText]}>{status}</Text>
    </View>
  );
}

function Button({ label, muted, onPress, icon, style }: { label: string; muted?: boolean; onPress?: () => void; icon?: string; style?: any }) {
  if (!muted) {
    return (
      <GradientButton height={44} onPress={onPress} style={[styles.btn, style]}>
        {icon ? <Ionicons name={icon as any} size={14} color="#FFFFFF" style={{ marginRight: 6 }} /> : null}
        <Text style={styles.btnText}>{label}</Text>
      </GradientButton>
    );
  }
  return (
    <TouchableOpacity onPress={onPress} style={[styles.btn, styles.btnMuted, style]}>
      {icon ? <Ionicons name={icon as any} size={14} color="#F97316" style={{ marginRight: 6 }} /> : null}
      <Text style={[styles.btnText, styles.btnTextMuted]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 18, marginBottom: 16 },
  listHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  title: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  subtitle: { color: 'rgba(203,213,225,0.65)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  exportSalesBtn: { marginBottom: 14 },
  empty: { color: 'rgba(203,213,225,0.7)', fontSize: 13, textAlign: 'center', paddingVertical: 18 },

  // Search
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 9, height: 46, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 13, marginBottom: 14 },
  searchInput: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '500' },

  // Buyer card
  buyerCard: { backgroundColor: '#030B14', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 10, overflow: 'hidden' },
  buyerTop: { flexDirection: 'row', gap: 11, alignItems: 'center', padding: 13 },
  avatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  buyerMain: { flex: 1, minWidth: 0 },
  buyerName: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  buyerEmail: { color: 'rgba(226,232,240,0.6)', fontSize: 11, marginTop: 2 },
  buyerMeta: { color: '#CBD5E1', fontSize: 12, fontWeight: '600', marginTop: 4 },
  buyerRight: { alignItems: 'center', gap: 2 },

  // Ticket list (expanded)
  ticketList: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 13, paddingBottom: 10, paddingTop: 4 },
  ticketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  ticketInfo: { flex: 1 },
  ticketSeat: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  ticketCode: { color: 'rgba(226,232,240,0.55)', fontSize: 10, marginTop: 2 },
  ticketActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  smallBtn: { height: 30, paddingHorizontal: 8, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  smallBtnMuted: { backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)' },
  smallBtnText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },

  // Badges
  badge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4, borderWidth: 1 },
  badgeGreen: { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.34)' },
  badgeOrange: { backgroundColor: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.28)' },
  badgeText: { fontSize: 9, fontWeight: '800' },
  badgeGreenText: { color: '#4ADE80' },
  badgeOrangeText: { color: '#F97316' },

  // Bottom actions
  bottomActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  btn: { minHeight: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, flexGrow: 1 },
  btnMuted: { backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  btnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  btnTextMuted: { color: '#F8FAFC' },

  // Reminder modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2,8,15,0.78)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  modalCard: { width: '100%', maxWidth: 460, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0A1420', padding: 18 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  modalSection: { gap: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalLabel: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  modalHint: { color: 'rgba(226,232,240,0.6)', fontSize: 12, fontWeight: '600', marginBottom: 4 },
  modalFieldLabel: { color: 'rgba(203,213,225,0.8)', fontSize: 12, fontWeight: '700', marginTop: 4 },
  modalInput: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 12, backgroundColor: '#030B14', color: '#FFFFFF', fontSize: 14, paddingHorizontal: 12, paddingVertical: 11 },
  modalTextArea: { minHeight: 70, textAlignVertical: 'top' },
});
