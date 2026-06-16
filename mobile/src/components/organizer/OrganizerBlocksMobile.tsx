import { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiPost } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { GradientButton } from '../GradientButton';

type Props = {
  eventId?: string;
  sections: any[];
  onReload?: () => void | Promise<void>;
};

export function OrganizerBlocksMobile({ eventId, sections, onReload }: Props) {
  const { t, lang } = useLanguage();
  const es = lang === 'es';
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const section = useMemo(() => sections.find((s) => String(s.id) === selectedSectionId), [sections, selectedSectionId]);
  const seats: any[] = section?.seats || [];

  const sectionTitle = (s: any) => (String(s.sectionType).toLowerCase() === 'table' ? `${es ? 'Mesa' : 'Table'} ${s.name}` : s.name);

  const toggleSeat = (seat: any) => {
    const isSold = seat.status === 'sold';
    if (isSold && !selectedSeats.includes(seat.id)) return;
    setSelectedSeats((prev) => (prev.includes(seat.id) ? prev.filter((id) => id !== seat.id) : [...prev, seat.id]));
  };

  const selectAll = () => setSelectedSeats(seats.filter((s) => s.status !== 'sold').map((s) => s.id));

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
      Alert.alert('Error', err?.message || t('Error al actualizar bloqueos', 'Error updating blocks'));
    } finally {
      setBusy(false);
    }
  };

  const sendInvites = async () => {
    if (!eventId || !selectedSeats.length || busy) return;
    if (!name.trim() || !email.trim()) {
      Alert.alert(t('Datos faltantes', 'Missing info'), t('Ingresa nombre y correo del invitado.', 'Enter the guest name and email.'));
      return;
    }
    setBusy(true);
    try {
      await apiPost(`/orders/event/${eventId}/free-tickets`, { seatIds: selectedSeats, name: name.trim(), email: email.trim() });
      Alert.alert(t('Enviado', 'Sent'), t('Cortesías emitidas y enviadas.', 'Complimentary tickets issued and sent.'));
      setName(''); setEmail(''); setSelectedSeats([]);
      await onReload?.();
    } catch (err: any) {
      Alert.alert('Error', err?.message || t('Error al emitir cortesías', 'Error issuing free tickets'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerCard}>
        <Text style={styles.eyebrow}>{es ? 'BLOQUEOS E INVITACIONES' : 'BLOCKS & INVITATIONS'}</Text>
        <Text style={styles.headerTitle}>{es ? 'Gestión de asientos' : 'Seat management'}</Text>
        <Text style={styles.headerCopy}>{es ? 'Selecciona una sección para bloquear asientos o enviar cortesías gratis.' : 'Select a section to block seats or send free complimentary tickets.'}</Text>
      </View>

      {/* Section selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionRow}>
        {sections.map((s) => {
          const active = String(s.id) === selectedSectionId;
          return (
            <TouchableOpacity key={String(s.id)} onPress={() => { setSelectedSectionId(String(s.id)); setSelectedSeats([]); }} style={[styles.sectionChip, active && styles.sectionChipActive]}>
              <Text style={[styles.sectionChipText, active && styles.sectionChipTextActive]}>{sectionTitle(s)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {!section ? (
        <View style={styles.empty}><Text style={styles.emptyText}>{es ? 'Selecciona una sección para ver la distribución.' : 'Select a section to view the layout.'}</Text></View>
      ) : seats.length === 0 ? (
        <View style={styles.empty}><Text style={styles.emptyText}>{es ? 'Esta sección no tiene asientos individuales.' : 'This section has no individual seats.'}</Text></View>
      ) : (
        <View style={styles.card}>
          <View style={styles.seatToolbar}>
            <Text style={styles.seatCount}>{selectedSeats.length} {es ? 'seleccionados' : 'selected'}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={selectAll} style={styles.toolBtn}><Text style={styles.toolBtnText}>{es ? 'Todos' : 'All'}</Text></TouchableOpacity>
              {selectedSeats.length > 0 && (
                <TouchableOpacity onPress={() => setSelectedSeats([])} style={[styles.toolBtn, styles.toolBtnDanger]}><Text style={[styles.toolBtnText, { color: '#ff5a45' }]}>{es ? 'Limpiar' : 'Clear'}</Text></TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.seatGrid}>
            {seats.map((seat) => {
              const isBlocked = seat.status === 'locked' && !seat.lockExpiresAt;
              const isSold = seat.status === 'sold';
              const isSelected = selectedSeats.includes(seat.id);
              return (
                <TouchableOpacity
                  key={seat.id}
                  disabled={isSold && !isSelected}
                  onPress={() => toggleSeat(seat)}
                  style={[styles.seat, isBlocked && styles.seatBlocked, isSold && styles.seatSold, isSelected && styles.seatSelected]}
                >
                  <Text style={[styles.seatRow, isSelected && styles.seatTextSelected]}>{seat.rowLabel}</Text>
                  <Text style={[styles.seatNum, isSelected && styles.seatTextSelected]}>{seat.seatNumber}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.legend}>
            <Legend color="#030B14" border="rgba(255,255,255,0.14)" label={es ? 'Disponible' : 'Available'} />
            <Legend color="rgba(245,158,11,0.18)" border="rgba(245,158,11,0.5)" label={es ? 'Bloqueado' : 'Blocked'} />
            <Legend color="rgba(255,255,255,0.06)" border="rgba(255,255,255,0.14)" label={es ? 'Vendido' : 'Sold'} />
            <Legend color="#F97316" border="#F97316" label={es ? 'Seleccionado' : 'Selected'} />
          </View>

          {selectedSeats.length > 0 && (
            <View style={styles.actions}>
              <View style={styles.actionBlock}>
                <Text style={styles.actionTitle}>{es ? 'Bloquear / Desbloquear' : 'Block / Unblock'}</Text>
                <Text style={styles.actionCopy}>{es ? 'Bloquea estos asientos para que no salgan a la venta general.' : 'Block these seats from general public sales.'}</Text>
                <TouchableOpacity onPress={toggleBlock} disabled={busy} style={[styles.blockBtn, busy && { opacity: 0.6 }]}>
                  <Text style={styles.blockBtnText}>{es ? 'ALTERNAR BLOQUEO' : 'TOGGLE BLOCK'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionBlock}>
                <Text style={styles.actionTitle}>{es ? 'Invitación de cortesía (gratis)' : 'Complimentary ticket (free)'}</Text>
                <TextInput value={name} onChangeText={setName} placeholder={es ? 'Nombre completo del invitado' : 'Guest full name'} placeholderTextColor="#9CA3AF" style={styles.input} />
                <TextInput value={email} onChangeText={setEmail} placeholder={es ? 'Correo electrónico' : 'Email address'} placeholderTextColor="#9CA3AF" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
                <GradientButton label={busy ? (es ? 'ENVIANDO...' : 'SENDING...') : (es ? 'EMITIR Y ENVIAR GRATIS' : 'ISSUE & SEND FREE')} onPress={sendInvites} height={48} style={{ marginTop: 8 }} />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Legend({ color, border, label }: { color: string; border: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color, borderColor: border }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  headerCard: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 16 },
  eyebrow: { color: '#F97316', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  headerTitle: { color: '#F8FAFC', fontSize: 20, fontWeight: '700', marginTop: 4 },
  headerCopy: { color: 'rgba(226,232,240,0.66)', fontSize: 13, marginTop: 4 },
  sectionRow: { gap: 8, paddingVertical: 2 },
  sectionChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14' },
  sectionChipActive: { borderColor: 'rgba(249,115,22,0.5)', backgroundColor: 'rgba(249,115,22,0.12)' },
  sectionChipText: { color: 'rgba(226,232,240,0.8)', fontSize: 13, fontWeight: '700' },
  sectionChipTextActive: { color: '#F97316' },
  card: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 16 },
  seatToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  seatCount: { color: '#F8FAFC', fontSize: 13, fontWeight: '800' },
  toolBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14' },
  toolBtnDanger: { borderColor: 'rgba(255,90,69,0.3)' },
  toolBtnText: { color: '#F8FAFC', fontSize: 12, fontWeight: '700' },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  seat: { width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center' },
  seatBlocked: { backgroundColor: 'rgba(245,158,11,0.18)', borderColor: 'rgba(245,158,11,0.5)' },
  seatSold: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.14)', opacity: 0.5 },
  seatSelected: { backgroundColor: '#F97316', borderColor: '#F97316' },
  seatRow: { color: 'rgba(203,213,225,0.7)', fontSize: 8, fontWeight: '700' },
  seatNum: { color: '#F8FAFC', fontSize: 12, fontWeight: '800' },
  seatTextSelected: { color: '#FFFFFF' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 5, borderWidth: 1 },
  legendText: { color: 'rgba(226,232,240,0.7)', fontSize: 11, fontWeight: '600' },
  actions: { marginTop: 16, gap: 12 },
  actionBlock: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#030B14', padding: 14, gap: 8 },
  actionTitle: { color: '#F8FAFC', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionCopy: { color: 'rgba(226,232,240,0.6)', fontSize: 12, lineHeight: 17 },
  blockBtn: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.5)', backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  blockBtnText: { color: '#F59E0B', fontSize: 13, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 12, backgroundColor: '#0A1420', color: '#FFFFFF', fontSize: 14, paddingHorizontal: 12, paddingVertical: 11 },
  empty: { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.02)', padding: 22, alignItems: 'center' },
  emptyText: { color: 'rgba(203,213,225,0.7)', fontSize: 13, textAlign: 'center' },
});
