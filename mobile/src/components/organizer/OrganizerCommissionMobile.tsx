import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiGet, apiPatch } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';

type Order = {
  id: string;
  buyer?: { firstName?: string; lastName?: string; email?: string };
  ticketCount?: number;
  total?: number;
  commissionGenerated?: number;
};

type EventCode = {
  id: string;
  code: string;
  commissionFixed?: number;
  owner?: { firstName?: string; lastName?: string; email?: string };
  ticketCount?: number;
  totalGenerated?: number;
  orders?: Order[];
};

type Props = {
  eventId?: string;
  eventStatus?: 'draft' | 'published' | 'cancelled';
  sections: any[];
  initialCommission?: number;
  pendingCommission?: number | null;
};

export function OrganizerCommissionMobile({
  eventId,
  eventStatus,
  sections,
  initialCommission = 0,
  pendingCommission = null,
}: Props) {
  const { t, lang } = useLanguage();
  const es = lang === 'es';
  const [mode, setMode] = useState<'fixed' | 'percent'>('fixed');
  const [value, setValue] = useState(Number(initialCommission || 0).toFixed(2));
  const [saving, setSaving] = useState(false);
  const [codes, setCodes] = useState<EventCode[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({});
  const [codeSaving, setCodeSaving] = useState<string | null>(null);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const ticketSections = sections.filter(
    (s) => s.sectionType !== 'stage' && s.sectionType !== 'decor',
  );

  const loadCodes = () => {
    if (!eventId) { setLoadingCodes(false); return; }
    apiGet<EventCode[]>(`/special-codes/by-event/${eventId}`)
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setCodes(list);
        const inputs: Record<string, string> = {};
        list.forEach((c) => { inputs[c.id] = Number(c.commissionFixed || 0).toFixed(2); });
        setCodeInputs(inputs);
      })
      .catch(() => setCodes([]))
      .finally(() => setLoadingCodes(false));
  };
  useEffect(loadCodes, [eventId]);

  const calcEarning = (price: number) => {
    const v = parseFloat(value) || 0;
    return mode === 'percent' ? price * (v / 100) : v;
  };

  const handleSave = async () => {
    if (!eventId) return;
    const v = parseFloat(value);
    if (isNaN(v) || v < 0) return;
    const amount =
      mode === 'percent'
        ? ticketSections.length > 0
          ? (ticketSections.reduce((sum, s) => sum + Number(s.price || 0), 0) / ticketSections.length) * (v / 100)
          : 0
        : v;
    setSaving(true);
    try {
      await apiPatch(`/events/${eventId}/creator-commission`, { amount: Math.round(amount * 100) / 100 });
      Alert.alert(
        es ? 'Listo' : 'Done',
        eventStatus === 'published'
          ? es ? 'Solicitud enviada al admin.' : 'Request sent to admin for approval.'
          : es ? 'Recompensa guardada.' : 'Reward saved.',
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
      await apiPatch(`/special-codes/by-event/${eventId}/${code.id}/reward`, {
        commissionFixed: Math.round(amount * 100) / 100,
      });
      Alert.alert(es ? 'Listo' : 'Done', es ? 'Recompensa actualizada.' : 'Reward updated.');
      loadCodes();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Error');
    } finally {
      setCodeSaving(null);
    }
  };

  const activeReward = Number(initialCommission || 0);

  return (
    <View style={styles.wrap}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerIcon}>
          <Ionicons name="cash-outline" size={22} color="#F97316" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{es ? 'Recompensas para Creadores' : 'Creator Rewards'}</Text>
          <Text style={styles.headerCopy}>
            {es
              ? 'El admin crea los códigos y asigna creadores. Cada venta con el código de un creador acumula su recompensa. Los pagos los realiza el administrador.'
              : "The admin creates codes and assigns creators to your event. Every time someone buys a ticket using a creator's code, their reward accumulates. Payments are handled directly by the administrator."}
          </Text>
        </View>
      </View>

      {/* EVENT BASE REWARD */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardEyebrow}>{es ? 'RECOMPENSA BASE DEL EVENTO' : 'EVENT BASE REWARD'}</Text>
            <Text style={styles.cardSub}>{es ? 'Se aplica a creadores sin monto propio.' : 'Applies to creators without their own rate.'}</Text>
          </View>
        </View>

        {/* Status badges */}
        {activeReward > 0 && pendingCommission == null && (
          <View style={styles.statusBadge}>
            <View style={styles.statusDotGreen} />
            <Text style={styles.statusBadgeText}>
              {es ? 'Activa:' : 'Active:'}{' '}
              <Text style={{ fontWeight: '600' }}>${activeReward.toFixed(2)}</Text>
              {' '}{es ? 'por entrada' : 'per ticket'}
            </Text>
          </View>
        )}
        {pendingCommission != null && (
          <View style={[styles.statusBadge, styles.statusBadgeAmber]}>
            <View style={[styles.statusDotGreen, { backgroundColor: '#F59E0B' }]} />
            <Text style={[styles.statusBadgeText, { color: '#92400E' }]}>
              {es ? 'Pendiente:' : 'Pending:'}{' '}
              <Text style={{ fontWeight: '600' }}>${Number(pendingCommission).toFixed(2)}</Text>
              {' '}{es ? 'por entrada' : 'per ticket'}
            </Text>
          </View>
        )}

        {/* Inline: mode toggle + input + button */}
        <View style={styles.rewardRow}>
          <View style={styles.modeToggle}>
            <TouchableOpacity
              onPress={() => setMode('fixed')}
              style={[styles.modeBtn, mode === 'fixed' && styles.modeBtnActive]}
            >
              <Text style={[styles.modeBtnText, mode === 'fixed' && styles.modeBtnTextActive]}>
                $ {es ? 'Fijo' : 'Fixed'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode('percent')}
              style={[styles.modeBtn, mode === 'percent' && styles.modeBtnActive]}
            >
              <Text style={[styles.modeBtnText, mode === 'percent' && styles.modeBtnTextActive]}>%</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputPrefix}>{mode === 'fixed' ? '$' : '%'}</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              style={styles.rewardInput}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.requestBtn, saving && { opacity: 0.6 }]}
          >
            <Text style={styles.requestBtnText}>
              {saving
                ? '...'
                : eventStatus === 'published'
                ? es ? 'Solicitar' : 'Request'
                : es ? 'Guardar' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section preview */}
        {ticketSections.length > 0 && parseFloat(value) > 0 && (
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>{es ? 'VISTA PREVIA POR SECCIÓN' : 'PREVIEW PER SECTION'}</Text>
            {ticketSections.map((s) => {
              const earning = calcEarning(Number(s.price || 0));
              const pct = Number(s.price) > 0 ? (earning / Number(s.price)) * 100 : 0;
              return (
                <View key={String(s.id)} style={styles.previewRow}>
                  <View style={[styles.previewDot, { backgroundColor: s.color || '#F97316' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.previewPrice}>{es ? 'Precio:' : 'Price:'} ${Number(s.price || 0).toFixed(2)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.previewEarning}>${earning.toFixed(2)}</Text>
                    <Text style={styles.previewPct}>{pct.toFixed(1)}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* CREATORS ON THIS EVENT */}
      <View style={styles.card}>
        <View style={styles.creatorsHeader}>
          <Text style={styles.cardEyebrow}>{es ? 'CREADORES EN ESTE EVENTO' : 'CREATORS ON THIS EVENT'}</Text>
          <Text style={styles.createdByAdmin}>{es ? 'Creados por admin' : 'Created by admin'}</Text>
        </View>

        {loadingCodes ? (
          <Text style={styles.empty}>{es ? 'Cargando...' : 'Loading...'}</Text>
        ) : codes.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.empty}>{es ? 'No hay códigos asignados a este evento todavía.' : 'No codes assigned to this event yet.'}</Text>
            <Text style={styles.emptySub}>{es ? 'El administrador puede crear códigos desde el panel de admin.' : 'The administrator can create codes from the admin panel.'}</Text>
          </View>
        ) : (
          codes.map((code, index) => {
            const ownerName = code.owner
              ? `${code.owner.firstName || ''} ${code.owner.lastName || ''}`.trim() || (es ? 'Sin asignar' : 'Unassigned')
              : es ? 'Sin asignar' : 'Unassigned';
            const initial = (code.owner?.firstName?.[0] || '?').toUpperCase();
            const isExpanded = expandedCode === code.id;
            const ownRate = Number(code.commissionFixed || 0) > 0;

            return (
              <View key={`${code.id || code.code || 'commission-code'}-${index}`} style={styles.codeCard}>
                {/* Creator info row */}
                <View style={styles.codeTop}>
                  <View style={styles.codeAvatar}>
                    <Text style={styles.codeAvatarText}>{initial}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.codeName}>{ownerName}</Text>
                    <Text style={styles.codeText}>{code.code}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.codeRate}>${Number(codeInputs[code.id] ?? code.commissionFixed ?? 0).toFixed(2)}</Text>
                    <Text style={styles.codeRateLabel}>{ownRate ? (es ? 'monto propio' : 'own rate') : (es ? 'usa base evento' : 'uses event base')}</Text>
                  </View>
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>{es ? 'ENTRADAS VENDIDAS' : 'TICKETS SOLD'}</Text>
                    <Text style={styles.statValue}>{Number(code.ticketCount || 0)}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>{es ? 'RECOMPENSA GENERADA' : 'REWARD GENERATED'}</Text>
                    <Text style={[styles.statValue, { color: '#34D399' }]}>${Number(code.totalGenerated || 0).toFixed(2)}</Text>
                  </View>
                </View>

                {/* Expandable buyers */}
                {(code.orders || []).length > 0 && (
                  <>
                    <TouchableOpacity
                      onPress={() => setExpandedCode(isExpanded ? null : code.id)}
                      style={styles.expandBtn}
                    >
                      <Text style={styles.expandBtnText}>
                        {es ? 'Ver compradores' : 'View buyers'} ({code.orders?.length || 0})
                      </Text>
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={13} color="rgba(203,213,225,0.6)" />
                    </TouchableOpacity>
                    {isExpanded && (
                      <View style={styles.buyerList}>
                        {(code.orders || []).map((order, orderIndex) => {
                          const buyerName = order.buyer
                            ? `${order.buyer.firstName || ''} ${order.buyer.lastName || ''}`.trim()
                            : es ? 'Comprador' : 'Buyer';
                          return (
                            <View key={`${order.id || order.buyer?.email || 'commission-order'}-${orderIndex}`} style={styles.buyerRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.buyerName} numberOfLines={1}>{buyerName}</Text>
                                <Text style={styles.buyerEmail} numberOfLines={1}>{order.buyer?.email || '-'}</Text>
                              </View>
                              <View style={styles.buyerStats}>
                                <View style={{ alignItems: 'center' }}>
                                  <Text style={styles.buyerStatLabel}>{es ? 'ENT' : 'TKT'}</Text>
                                  <Text style={styles.buyerStatValue}>{order.ticketCount || 0}</Text>
                                </View>
                                <View style={{ alignItems: 'center' }}>
                                  <Text style={styles.buyerStatLabel}>{es ? 'TOTAL' : 'TOTAL'}</Text>
                                  <Text style={styles.buyerStatValue}>${Number(order.total || 0).toFixed(2)}</Text>
                                </View>
                                <View style={{ alignItems: 'center' }}>
                                  <Text style={styles.buyerStatLabel}>{es ? 'REC' : 'RWD'}</Text>
                                  <Text style={[styles.buyerStatValue, { color: '#34D399' }]}>${Number(order.commissionGenerated || 0).toFixed(2)}</Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}

                {/* Per-code reward input */}
                <View style={styles.codeInputRow}>
                  <View style={styles.codeInputWrap}>
                    <Text style={styles.codeInputPrefix}>$</Text>
                    <TextInput
                      value={codeInputs[code.id] ?? '0'}
                      onChangeText={(v) => setCodeInputs((cur) => ({ ...cur, [code.id]: v }))}
                      keyboardType="decimal-pad"
                      style={styles.codeInput}
                      placeholder="0.00"
                      placeholderTextColor="rgba(148,163,184,0.5)"
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => handleSaveCodeReward(code)}
                    disabled={codeSaving === code.id}
                    style={[styles.codeSaveBtn, codeSaving === code.id && { opacity: 0.6 }]}
                  >
                    <Text style={styles.codeSaveBtnText}>{codeSaving === code.id ? '...' : (es ? 'Guardar' : 'Save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const colors = {
  orange: '#F97316',
  text: '#F8FAFC',
  muted: 'rgba(203,213,225,0.65)',
  border: 'rgba(255,255,255,0.14)',
  cardBg: 'rgba(255,255,255,0.018)',
  darkBg: '#030B14',
};

const styles = StyleSheet.create({
  wrap: { gap: 12 },

  headerCard: {
    flexDirection: 'row', gap: 12, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)',
    backgroundColor: 'rgba(249,115,22,0.06)', padding: 16,
  },
  headerIcon: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.14)',
  },
  headerTitle: { color: colors.text, fontSize: 15, fontWeight: '600' },
  headerCopy: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },

  card: {
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.cardBg, overflow: 'hidden',
  },
  cardHeader: {
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 16, paddingVertical: 12,
  },
  cardEyebrow: { color: colors.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.9, textTransform: 'uppercase' },
  cardSub: { color: 'rgba(148,163,184,0.65)', fontSize: 11, marginTop: 2 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 12,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)',
    backgroundColor: 'rgba(52,211,153,0.08)', paddingHorizontal: 12, paddingVertical: 8,
  },
  statusBadgeAmber: { borderColor: 'rgba(245,158,11,0.25)', backgroundColor: 'rgba(245,158,11,0.08)' },
  statusDotGreen: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34D399' },
  statusBadgeText: { color: '#065F46', fontSize: 12, fontWeight: '600', flex: 1 },

  rewardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  modeToggle: {
    flexDirection: 'row', borderRadius: 10, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  modeBtn: { paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.darkBg },
  modeBtnActive: { backgroundColor: '#F8FAFC' },
  modeBtnText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  modeBtnTextActive: { color: '#030B14' },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.darkBg, paddingHorizontal: 10,
  },
  inputPrefix: { color: colors.orange, fontSize: 14, fontWeight: '600', marginRight: 4 },
  rewardInput: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600', paddingVertical: 8 },
  requestBtn: {
    height: 38, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center',
  },
  requestBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  previewBox: {
    marginHorizontal: 16, marginBottom: 14,
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.darkBg, overflow: 'hidden',
  },
  previewTitle: {
    color: colors.muted, fontSize: 9, fontWeight: '600', letterSpacing: 0.8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  previewDot: { width: 10, height: 10, borderRadius: 5 },
  previewName: { color: colors.text, fontSize: 12, fontWeight: '600' },
  previewPrice: { color: colors.muted, fontSize: 10 },
  previewEarning: { color: '#34D399', fontSize: 13, fontWeight: '600' },
  previewPct: { color: colors.muted, fontSize: 10 },

  creatorsHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)', paddingHorizontal: 16, paddingVertical: 12,
  },
  createdByAdmin: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  emptyBlock: { padding: 24, alignItems: 'center', gap: 6 },
  empty: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  emptySub: { color: 'rgba(148,163,184,0.45)', fontSize: 11, textAlign: 'center' },

  codeCard: {
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 14, paddingVertical: 14, gap: 10,
  },
  codeTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  codeAvatar: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  codeAvatarText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  codeName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  codeText: { color: colors.muted, fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
  codeRate: { color: '#34D399', fontSize: 15, fontWeight: '600' },
  codeRateLabel: { color: colors.muted, fontSize: 10, marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12, paddingVertical: 10, gap: 4,
  },
  statLabel: { color: colors.muted, fontSize: 9, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  statValue: { color: colors.text, fontSize: 15, fontWeight: '600' },

  expandBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 8, gap: 6,
  },
  expandBtnText: { color: colors.muted, fontSize: 12, fontWeight: '600' },

  buyerList: {
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  buyerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  buyerName: { color: colors.text, fontSize: 12, fontWeight: '600' },
  buyerEmail: { color: colors.muted, fontSize: 10, marginTop: 2 },
  buyerStats: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  buyerStatLabel: { color: colors.muted, fontSize: 8, fontWeight: '600', letterSpacing: 0.5 },
  buyerStatValue: { color: colors.text, fontSize: 12, fontWeight: '600' },

  codeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.darkBg, paddingHorizontal: 10,
  },
  codeInputPrefix: { color: colors.orange, fontSize: 13, fontWeight: '600', marginRight: 4 },
  codeInput: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '600', paddingVertical: 9 },
  codeSaveBtn: {
    height: 40, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center',
  },
  codeSaveBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
