import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiPost } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { GradientButton } from '../GradientButton';

type Props = {
  eventId?: string;
  sections: any[];
  onReload?: () => void | Promise<void>;
};

export function OrganizerBlocksMobile({
  eventId,
  sections,
  onReload,
}: Props) {
  const { t, lang } = useLanguage();
  const es = lang === 'es';
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const section = useMemo(() => sections.find((s) => String(s.id) === selectedSectionId), [sections, selectedSectionId]);
  const seats: any[] = section?.seats || [];

  const sectionTitle = (s: any) =>
    String(s.sectionType).toLowerCase() === 'table'
      ? `${es ? 'Mesa' : 'Table'} ${s.name}`
      : s.name;

  const toggleSeat = (seat: any) => {
    if (seat.status === 'sold' && !selectedSeats.includes(seat.id)) return;
    setSelectedSeats((prev) =>
      prev.includes(seat.id) ? prev.filter((id) => id !== seat.id) : [...prev, seat.id],
    );
  };

  const toggleBlock = async () => {
    if (!selectedSeats.length || busy) return;
    setBusy(true);
    try {
      for (const seatId of selectedSeats) {
        await apiPost(`/orders/seats/${seatId}/toggle-block`, {});
      }
      Alert.alert(t('Listo', 'Done'), t('Estado de bloqueo actualizado.', 'Block status updated.'));
      setSelectedSeats([]);
      await onReload?.();
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('Error al actualizar', 'Error updating'));
    } finally {
      setBusy(false);
    }
  };

  const sendInvites = async () => {
    if (!eventId || !selectedSeats.length || busy) return;
    if (!name.trim() || !email.trim()) {
      Alert.alert(t('Datos faltantes', 'Missing info'), t('Ingresa nombre y correo.', 'Enter name and email.'));
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/orders/event/${eventId}/free-tickets`, {
        seatIds: selectedSeats,
        name: name.trim(),
        email: email.trim(),
      });
      Alert.alert(t('Enviado', 'Sent'), t('Cortesías emitidas y enviadas.', 'Free tickets issued and sent.'));
      setName('');
      setEmail('');
      setSelectedSeats([]);
      await onReload?.();
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('Error al emitir', 'Error issuing'));
    } finally {
      setBusy(false);
    }
  };

  // Sections that already have blocked seats
  const blockedSections = useMemo(
    () =>
      sections
        .map((s) => ({
          section: s,
          blockedSeats: (s.seats || []).filter((seat: any) => seat.status === 'locked' && !seat.lockExpiresAt),
        }))
        .filter((item) => item.blockedSeats.length > 0),
    [sections],
  );

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{es ? 'Bloqueos e Invitaciones Gratis' : 'Blocks & Free Invitations'}</Text>
        <Text style={styles.subtitle}>
          {es
            ? 'Bloquea mesas/sillas o envía cortesías gratis'
            : 'Block seats or tables, or send free complimentary tickets'}
        </Text>
      </View>

      {/* Section dropdown */}
      <View>
        <TouchableOpacity
          onPress={() => setDropdownOpen((v) => !v)}
          style={styles.dropdown}
          activeOpacity={0.8}
        >
          <Text style={[styles.dropdownText, !selectedSectionId && styles.dropdownPlaceholder]}>
            {section ? `${sectionTitle(section)} ($${Number(section.price || 0).toFixed(2)})` : (es ? 'Selecciona una sección...' : 'Select a section...')}
          </Text>
          <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(203,213,225,0.6)" />
        </TouchableOpacity>
        {dropdownOpen && (
          <View style={styles.dropdownList}>
            {sections.length === 0 ? (
              <Text style={styles.dropdownEmpty}>{es ? 'No hay secciones.' : 'No sections.'}</Text>
            ) : (
              sections.map((s) => (
                <TouchableOpacity
                  key={String(s.id)}
                  onPress={() => {
                    setSelectedSectionId(String(s.id));
                    setSelectedSeats([]);
                    setDropdownOpen(false);
                  }}
                  style={[styles.dropdownItem, String(s.id) === selectedSectionId && styles.dropdownItemActive]}
                >
                  <Text style={[styles.dropdownItemText, String(s.id) === selectedSectionId && styles.dropdownItemTextActive]}>
                    {sectionTitle(s)}
                  </Text>
                  <Text style={styles.dropdownItemPrice}>${Number(s.price || 0).toFixed(2)}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </View>

      {/* Blocked sections summary */}
      {blockedSections.length > 0 && (
        <View style={styles.blockedCard}>
          <Text style={styles.blockedEyebrow}>{es ? 'SECCIONES BLOQUEADAS' : 'BLOCKED SECTIONS'}</Text>
          <Text style={styles.blockedSub}>
            {es
              ? 'Toca una sección para administrarla directamente.'
              : 'Tap a section to manage it directly.'}
          </Text>
          <View style={styles.blockedGrid}>
            {blockedSections.map(({ section: s, blockedSeats }, index) => (
              <TouchableOpacity
                key={`${String(s.id || sectionTitle(s))}-${index}`}
                onPress={() => {
                  setSelectedSectionId(String(s.id));
                  setSelectedSeats(blockedSeats.map((seat: any) => seat.id));
                }}
                style={[styles.blockedChip, String(s.id) === selectedSectionId && styles.blockedChipActive]}
              >
                <View style={styles.blockedChipRow}>
                  <Text style={styles.blockedChipName} numberOfLines={1}>{sectionTitle(s)}</Text>
                  <View style={styles.blockedBadge}>
                    <Text style={styles.blockedBadgeText}>{blockedSeats.length}</Text>
                  </View>
                </View>
                <Text style={styles.blockedChipSub}>
                  {blockedSeats.length} {es ? 'bloqueados' : 'blocked seats'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Canvas / empty */}
      {!section ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {es ? 'Selecciona una sección para ver la distribución y comenzar' : 'Select a section to view layout and begin'}
          </Text>
        </View>
      ) : seats.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {es ? 'Esta sección no tiene asientos individuales.' : 'This section has no individual seats.'}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          {/* Toolbar */}
          <View style={styles.seatToolbar}>
            <Text style={styles.seatCount}>
              {selectedSeats.length} {es ? 'seleccionados' : 'selected'}
            </Text>
            <View style={styles.toolbarBtns}>
              <TouchableOpacity
                onPress={() => setSelectedSeats(seats.filter((s) => s.status !== 'sold').map((s) => s.id))}
                style={styles.toolBtn}
              >
                <Text style={styles.toolBtnText}>{es ? 'Todos' : 'All'}</Text>
              </TouchableOpacity>
              {selectedSeats.length > 0 && (
                <TouchableOpacity onPress={() => setSelectedSeats([])} style={[styles.toolBtn, styles.toolBtnDanger]}>
                  <Text style={[styles.toolBtnText, { color: '#f87171' }]}>{es ? 'Limpiar' : 'Clear'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Seat grid */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.seatGrid}>
              {seats.map((seat, index) => {
                const isBlocked = seat.status === 'locked' && !seat.lockExpiresAt;
                const isSold = seat.status === 'sold';
                const isSelected = selectedSeats.includes(seat.id);
                return (
                  <TouchableOpacity
                    key={`${seat.id || seat.ticketCode || 'seat'}-${index}`}
                    disabled={isSold && !isSelected}
                    onPress={() => toggleSeat(seat)}
                    style={[
                      styles.seat,
                      isBlocked && styles.seatBlocked,
                      isSold && styles.seatSold,
                      isSelected && styles.seatSelected,
                    ]}
                  >
                    <Text style={[styles.seatRow, isSelected && styles.seatTextSel]}>{seat.rowLabel}</Text>
                    <Text style={[styles.seatNum, isSelected && styles.seatTextSel]}>{seat.seatNumber}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Legend */}
          <View style={styles.legend}>
            <LegendDot color="#030B14" border="rgba(255,255,255,0.14)" label={es ? 'Disponible' : 'Available'} />
            <LegendDot color="rgba(245,158,11,0.18)" border="rgba(245,158,11,0.5)" label={es ? 'Bloqueado' : 'Blocked'} />
            <LegendDot color="rgba(255,255,255,0.06)" border="rgba(255,255,255,0.1)" label={es ? 'Vendido' : 'Sold'} />
            <LegendDot color="#F97316" border="#F97316" label={es ? 'Seleccionado' : 'Selected'} />
          </View>

          {/* Actions */}
          {selectedSeats.length > 0 && (
            <View style={styles.actions}>
              {/* Block/Unblock */}
              <View style={styles.actionBlock}>
                <Text style={styles.actionTitle}>{es ? 'Bloquear / Desbloquear' : 'Block / Unblock'}</Text>
                <Text style={styles.actionCopy}>
                  {es
                    ? 'Bloquea estos asientos para que no salgan a la venta general.'
                    : 'Permanently blocks these seats from general public sales.'}
                </Text>
                <TouchableOpacity onPress={toggleBlock} disabled={busy} style={[styles.blockBtn, busy && { opacity: 0.6 }]}>
                  <Ionicons name="ban-outline" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
                  <Text style={styles.blockBtnText}>{es ? 'ALTERNAR BLOQUEO' : 'TOGGLE BLOCK'}</Text>
                </TouchableOpacity>
              </View>

              {/* Free invitations */}
              <View style={styles.actionBlock}>
                <Text style={styles.actionTitle}>{es ? 'Invitación de cortesía' : 'Send Complimentary Tickets'}</Text>
                <Text style={styles.actionCopy}>
                  {es
                    ? 'Emite entradas a costo cero y envíalas por correo a un invitado.'
                    : 'Issue tickets at zero cost and send them via email to a guest.'}
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={es ? 'Nombre completo del invitado' : 'Guest Full Name'}
                  placeholderTextColor="rgba(148,163,184,0.6)"
                  style={styles.input}
                />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={es ? 'Correo electrónico' : 'Email Address'}
                  placeholderTextColor="rgba(148,163,184,0.6)"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
                <GradientButton
                  label={busy ? (es ? 'ENVIANDO...' : 'SENDING...') : (es ? 'EMITIR Y ENVIAR GRATIS' : 'Issue & Send Free Tickets')}
                  onPress={sendInvites}
                  height={48}
                  style={{ marginTop: 4 }}
                />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function LegendDot({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color, borderColor: border }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const colors = { orange: '#F97316', text: '#F8FAFC', muted: 'rgba(203,213,225,0.65)', border: 'rgba(255,255,255,0.14)' };

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  header: { gap: 4 },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  scannerAccessCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.035)', padding: 14 },
  scannerAccessHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  scannerAccessEyebrow: { color: colors.orange, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  scannerAccessTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  scannerEmpty: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderStyle: 'dashed', backgroundColor: '#030B14', padding: 18, alignItems: 'center' },
  scannerEmptyText: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  scannerRequestRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderRadius: 16, backgroundColor: '#030B14', padding: 10, marginTop: 8 },
  scannerAvatar: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(249,115,22,0.18)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', alignItems: 'center', justifyContent: 'center' },
  scannerAvatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  scannerRequestMain: { flex: 1, minWidth: 0 },
  scannerRequestName: { color: colors.text, fontSize: 13, fontWeight: '800' },
  scannerRequestEmail: { color: colors.muted, fontSize: 11, marginTop: 2 },
  scannerStatus: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3, marginTop: 6 },
  scannerStatusApproved: { backgroundColor: 'rgba(16,185,129,0.80)' },
  scannerStatusPending: { backgroundColor: 'rgba(249,115,22,0.82)' },
  scannerStatusRejected: { backgroundColor: 'rgba(239,68,68,0.78)' },
  scannerStatusText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  scannerActions: { flexDirection: 'row', gap: 7 },
  scannerApproveBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  scannerRejectBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  scannerRevokeBtn: { minHeight: 36, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.32)', backgroundColor: 'rgba(239,68,68,0.10)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 9 },
  scannerRevokeText: { color: '#FCA5A5', fontSize: 9, fontWeight: '900' },

  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: 14, paddingVertical: 13,
  },
  dropdownText: { color: colors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  dropdownPlaceholder: { color: colors.muted },
  dropdownList: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    backgroundColor: '#0a1628', marginTop: 4, overflow: 'hidden',
  },
  dropdownEmpty: { color: colors.muted, fontSize: 13, padding: 14, textAlign: 'center' },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  dropdownItemActive: { backgroundColor: 'rgba(249,115,22,0.1)' },
  dropdownItemText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  dropdownItemTextActive: { color: colors.orange },
  dropdownItemPrice: { color: colors.muted, fontSize: 12, fontWeight: '600' },

  blockedCard: {
    borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(3,11,20,0.72)', padding: 14, gap: 10,
    shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  blockedEyebrow: { color: colors.orange, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  blockedSub: { color: 'rgba(148,163,184,0.8)', fontSize: 12 },
  blockedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  blockedChip: {
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.11)',
    backgroundColor: 'rgba(255,255,255,0.035)', padding: 12, minWidth: '45%', flex: 1,
  },
  blockedChipActive: { borderColor: colors.orange, backgroundColor: 'rgba(249,115,22,0.12)' },
  blockedChipRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  blockedChipName: { color: '#F1F5F9', fontSize: 13, fontWeight: '800', flex: 1 },
  blockedBadge: { borderRadius: 20, backgroundColor: 'rgba(249,115,22,0.18)', paddingHorizontal: 8, paddingVertical: 3 },
  blockedBadgeText: { color: colors.orange, fontSize: 11, fontWeight: '800' },
  blockedChipSub: { color: 'rgba(148,163,184,0.8)', fontSize: 11, marginTop: 4 },

  emptyState: {
    borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.018)', padding: 40, alignItems: 'center',
  },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: 'center' },

  card: {
    borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.018)', padding: 14, gap: 12,
  },
  seatToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seatCount: { color: colors.text, fontSize: 13, fontWeight: '800' },
  toolbarBtns: { flexDirection: 'row', gap: 8 },
  toolBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: '#030B14',
  },
  toolBtnDanger: { borderColor: 'rgba(248,113,113,0.3)' },
  toolBtnText: { color: colors.text, fontSize: 12, fontWeight: '700' },

  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  seat: {
    width: 42, height: 42, borderRadius: 10, borderWidth: 1,
    borderColor: colors.border, backgroundColor: '#030B14',
    alignItems: 'center', justifyContent: 'center',
  },
  seatBlocked: { backgroundColor: 'rgba(245,158,11,0.18)', borderColor: 'rgba(245,158,11,0.5)' },
  seatSold: { backgroundColor: 'rgba(255,255,255,0.04)', opacity: 0.45 },
  seatSelected: { backgroundColor: colors.orange, borderColor: colors.orange },
  seatRow: { color: colors.muted, fontSize: 8, fontWeight: '700' },
  seatNum: { color: colors.text, fontSize: 12, fontWeight: '800' },
  seatTextSel: { color: '#fff' },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 13, height: 13, borderRadius: 4, borderWidth: 1 },
  legendText: { color: colors.muted, fontSize: 11, fontWeight: '600' },

  actions: { gap: 10 },
  actionBlock: {
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#030B14', padding: 14, gap: 8,
  },
  actionTitle: { color: colors.text, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionCopy: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  blockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 44, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.5)', backgroundColor: 'rgba(245,158,11,0.12)',
  },
  blockBtnText: { color: '#F59E0B', fontSize: 12, fontWeight: '800' },
  input: {
    height: 42, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, color: colors.text, backgroundColor: 'rgba(255,255,255,0.04)', fontSize: 13,
  },
});
