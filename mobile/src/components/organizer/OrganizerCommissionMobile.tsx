import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPatch } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { GradientButton } from '../GradientButton';

type Props = {
  eventId?: string;
  eventStatus?: 'draft' | 'published';
  sections: any[];
  initialCommission?: number;
  pendingCommission?: number | null;
};

type EventCode = { id: string; code: string; commissionFixed?: number };

export function OrganizerCommissionMobile({ eventId, eventStatus, sections, initialCommission = 0, pendingCommission = null }: Props) {
  const { t, lang } = useLanguage();
  const es = lang === 'es';
  const [mode, setMode] = useState<'fixed' | 'percent'>('fixed');
  const [value, setValue] = useState(Number(initialCommission || 0).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [codes, setCodes] = useState<EventCode[]>([]);
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [codeSaving, setCodeSaving] = useState<string | null>(null);

  const ticketSections = sections.filter((s) => s.sectionType !== 'stage' && s.sectionType !== 'decor');

  const loadCodes = () => {
    if (!eventId) return;
    apiGet<EventCode[]>(`/special-codes/by-event/${eventId}`)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setCodes(list);
        const inputs: Record<string, string> = {};
        list.forEach((c) => { inputs[c.id] = Number(c.commissionFixed || 0).toFixed(2); });
        setCodeInputs(inputs);
      })
      .catch(() => setCodes([]));
  };
  useEffect(loadCodes, [eventId]);

  const calcEarning = (ticketPrice: number) => {
    const v = parseFloat(value) || 0;
    return mode === 'percent' ? ticketPrice * (v / 100) : v;
  };

  const handleSave = async () => {
    if (!eventId) return;
    const v = parseFloat(value);
    if (isNaN(v) || v < 0) return;
    const amount = mode === 'percent'
      ? (ticketSections.length > 0 ? (ticketSections.reduce((sum, s) => sum + Number(s.price || 0), 0) / ticketSections.length) * (v / 100) : 0)
      : v;
    setSaving(true);
    try {
      await apiPatch(`/events/${eventId}/creator-commission`, { amount: Math.round(amount * 100) / 100 });
      Alert.alert(
        es ? 'Listo' : 'Done',
        eventStatus === 'published'
          ? (es ? 'Solicitud enviada al admin para aprobación.' : 'Request sent to admin for approval.')
          : (es ? 'Recompensa guardada.' : 'Reward saved.'),
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCodeReward = async (code: EventCode) => {
    if (!eventId) return;
    const amount = parseFloat(codeInputs[code.id] ?? '0');
    if (isNaN(amount) || amount < 0) return;
    setCodeSaving(code.id);
    try {
      await apiPatch(`/special-codes/by-event/${eventId}/${code.id}/reward`, { commissionFixed: Math.round(amount * 100) / 100 });
      Alert.alert(es ? 'Listo' : 'Done', es ? 'Recompensa actualizada.' : 'Reward updated.');
      loadCodes();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error');
    } finally {
      setCodeSaving(null);
    }
  };

  const sampleSections = ticketSections.slice(0, 3);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerCard}>
        <View style={styles.headerIcon}><Ionicons name="cash-outline" size={20} color="#F97316" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{es ? 'Recompensas para creadores' : 'Creator rewards'}</Text>
          <Text style={styles.headerCopy}>
            {es
              ? 'Define cuánto gana un creador por cada entrada vendida con su código. Los pagos los realiza el administrador.'
              : 'Set how much a creator earns per ticket sold with their code. Payouts are handled by the admin.'}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>{es ? 'COMISIÓN BASE' : 'BASE COMMISSION'}</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity onPress={() => setMode('fixed')} style={[styles.modeBtn, mode === 'fixed' && styles.modeBtnActive]}>
            <Text style={[styles.modeText, mode === 'fixed' && styles.modeTextActive]}>{es ? 'Monto fijo ($)' : 'Fixed ($)'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('percent')} style={[styles.modeBtn, mode === 'percent' && styles.modeBtnActive]}>
            <Text style={[styles.modeText, mode === 'percent' && styles.modeTextActive]}>{es ? 'Porcentaje (%)' : 'Percent (%)'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>{mode === 'percent' ? (es ? 'Porcentaje por entrada' : 'Percent per ticket') : (es ? 'Monto por entrada' : 'Amount per ticket')}</Text>
        <View style={styles.inputRow}>
          <Text style={styles.inputPrefix}>{mode === 'percent' ? '%' : '$'}</Text>
          <TextInput value={value} onChangeText={setValue} keyboardType="decimal-pad" style={styles.input} placeholderTextColor="#9CA3AF" />
        </View>

        {sampleSections.length > 0 && (
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>{es ? 'Ganancia estimada por sección' : 'Estimated earning per section'}</Text>
            {sampleSections.map((s) => (
              <View key={String(s.id)} style={styles.previewRow}>
                <Text style={styles.previewK}>{String(s.name)} · ${Number(s.price || 0).toFixed(2)}</Text>
                <Text style={styles.previewV}>${calcEarning(Number(s.price || 0)).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <Text style={styles.statusLabel}>{es ? 'Activa' : 'Active'}</Text>
            <Text style={styles.statusValue}>${Number(initialCommission || 0).toFixed(2)}</Text>
          </View>
          {pendingCommission != null && (
            <View style={[styles.statusPill, styles.statusPending]}>
              <Text style={styles.statusLabel}>{es ? 'Pendiente' : 'Pending'}</Text>
              <Text style={styles.statusValue}>${Number(pendingCommission).toFixed(2)}</Text>
            </View>
          )}
        </View>

        <GradientButton label={saving ? (es ? 'GUARDANDO...' : 'SAVING...') : (es ? 'GUARDAR COMISIÓN' : 'SAVE COMMISSION')} onPress={handleSave} height={52} style={{ marginTop: 14 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.eyebrow}>{es ? 'RECOMPENSA POR CÓDIGO' : 'PER-CODE REWARD'}</Text>
        {codes.length === 0 ? (
          <Text style={styles.empty}>{es ? 'No hay códigos asignados a este evento todavía.' : 'No codes assigned to this event yet.'}</Text>
        ) : (
          codes.map((code) => (
            <View key={code.id} style={styles.codeRow}>
              <Text style={styles.codeName} numberOfLines={1}>{code.code}</Text>
              <View style={styles.codeInputRow}>
                <Text style={styles.inputPrefix}>$</Text>
                <TextInput
                  value={codeInputs[code.id] ?? '0.00'}
                  onChangeText={(v) => setCodeInputs((cur) => ({ ...cur, [code.id]: v }))}
                  keyboardType="decimal-pad"
                  style={styles.codeInput}
                />
              </View>
              <TouchableOpacity onPress={() => handleSaveCodeReward(code)} disabled={codeSaving === code.id} style={[styles.codeSave, codeSaving === code.id && { opacity: 0.6 }]}>
                <Ionicons name="checkmark" size={18} color="#F97316" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  headerCard: { flexDirection: 'row', gap: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', backgroundColor: 'rgba(249,115,22,0.06)', padding: 16 },
  headerIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(249,115,22,0.12)' },
  headerTitle: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  headerCopy: { color: 'rgba(226,232,240,0.66)', fontSize: 12, lineHeight: 18, marginTop: 4 },
  card: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.018)', padding: 16 },
  eyebrow: { color: '#F97316', fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 12 },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  modeBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', justifyContent: 'center' },
  modeBtnActive: { borderColor: 'rgba(249,115,22,0.5)', backgroundColor: 'rgba(249,115,22,0.12)' },
  modeText: { color: 'rgba(226,232,240,0.7)', fontSize: 13, fontWeight: '700' },
  modeTextActive: { color: '#F97316' },
  fieldLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 12, backgroundColor: '#030B14', paddingHorizontal: 12 },
  inputPrefix: { color: '#F97316', fontSize: 15, fontWeight: '800', marginRight: 8 },
  input: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '600', paddingVertical: 12 },
  previewBox: { marginTop: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: '#030B14', padding: 12 },
  previewTitle: { color: 'rgba(203,213,225,0.7)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  previewK: { color: 'rgba(248,250,252,0.8)', fontSize: 13, flex: 1, marginRight: 8 },
  previewV: { color: '#F97316', fontSize: 13, fontWeight: '800' },
  statusRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statusPill: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', padding: 12 },
  statusPending: { borderColor: 'rgba(249,115,22,0.4)' },
  statusLabel: { color: 'rgba(203,213,225,0.7)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statusValue: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', marginTop: 4 },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  codeName: { flex: 1, color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  codeInputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 10, backgroundColor: '#030B14', paddingHorizontal: 10, width: 110 },
  codeInput: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '600', paddingVertical: 9 },
  codeSave: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(249,115,22,0.4)', backgroundColor: 'rgba(249,115,22,0.1)', alignItems: 'center', justifyContent: 'center' },
  empty: { color: 'rgba(203,213,225,0.7)', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
});
