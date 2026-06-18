import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiGet } from '../../services/api';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';

type SpecialCode = {
  id: string;
  code: string;
  ownerUserId: string;
  eventId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  event?: { title: string } | null;
};

type CodeSale = {
  id: string;
  specialCode: string;
  total: number;
  ticketCount: number;
  createdAt: string;
  event?: { title: string; currency?: string } | null;
};

type PayoutSummary = {
  eventId: string;
  eventTitle: string;
  totalTickets: number;
  totalEarned: number;
  totalPaid: number;
  balance: number;
  codes: { code: string; commissionFixed: number }[];
};

export function MySpecialCodesMobile() {
  const { t, lang } = useLanguage();
  const [codes, setCodes] = useState<SpecialCode[]>([]);
  const [sales, setSales] = useState<CodeSale[]>([]);
  const [payouts, setPayouts] = useState<PayoutSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [c, s, p] = await Promise.all([
          apiGet<SpecialCode[]>('/special-codes/me').catch(() => []),
          apiGet<CodeSale[]>('/special-codes/my-sales').catch(() => []),
          apiGet<PayoutSummary[]>('/special-codes/my-payouts').catch(() => []),
        ]);
        setCodes(Array.isArray(c) ? c : []);
        setSales(Array.isArray(s) ? s : []);
        setPayouts(Array.isArray(p) ? p : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const stats = useMemo(() => {
    return {
      total: codes.length,
      active: codes.filter((item) => item.isActive).length,
      eventCodes: codes.filter((item) => Boolean(item.eventId)).length,
      totalEarned: payouts.reduce((sum, item) => sum + Number(item.totalEarned || 0), 0),
      totalPaid: payouts.reduce((sum, item) => sum + Number(item.totalPaid || 0), 0),
      balance: payouts.reduce((sum, item) => sum + Number(item.balance || 0), 0),
      totalSales: sales.length,
      totalSalesVolume: sales.reduce((sum, item) => sum + Number(item.total || 0), 0),
    };
  }, [codes, payouts, sales]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.orange} />
      </View>
    );
  }

  if (codes.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.emptyWrap}>
          <Ionicons name="sparkles-outline" size={48} color="rgba(255,255,255,0.2)" />
          <Text style={styles.emptyTitle}>{t('Aún no tienes códigos', 'No codes assigned yet')}</Text>
          <Text style={styles.emptyText}>{t('Cuando un administrador te asigne un código de promoción, aparecerá aquí.', 'When an admin assigns you a promo code, it will appear here.')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t('RESUMEN DE CÓDIGOS', 'CODES OVERVIEW')}</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>{t('Total', 'Total')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.active}</Text>
            <Text style={styles.statLabel}>{t('Activos', 'Active')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>${stats.totalEarned.toFixed(2)}</Text>
            <Text style={styles.statLabel}>{t('Ganado', 'Earned')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: colors.orange }]}>${stats.balance.toFixed(2)}</Text>
            <Text style={styles.statLabel}>{t('Saldo', 'Balance')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t('MIS CÓDIGOS', 'MY CODES')}</Text>
        {codes.map((c, index) => (
          <View key={`${c.id || c.code || 'code'}-${index}`} style={styles.row}>
            <View>
              <Text style={styles.codeText}>{c.code}</Text>
              <Text style={styles.codeEvent}>{c.event?.title || t('Todos los eventos', 'All events')}</Text>
            </View>
            <View style={[styles.statusPill, c.isActive ? styles.statusActive : styles.statusInactive]}>
              <Text style={[styles.statusPillText, c.isActive ? styles.statusActiveText : styles.statusInactiveText]}>
                {c.isActive ? t('ACTIVO', 'ACTIVE') : t('INACTIVO', 'INACTIVE')}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {payouts.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('MIS RECOMPENSAS POR EVENTO', 'MY REWARDS BY EVENT')}</Text>
          {payouts.map((p, i) => (
            <View key={p.eventId + i} style={styles.payoutRow}>
              <Text style={styles.payoutEvent}>{p.eventTitle}</Text>
              <View style={styles.payoutStats}>
                <View style={styles.payoutStat}>
                  <Text style={styles.payoutStatLabel}>{t('Tickets', 'Tickets')}</Text>
                  <Text style={styles.payoutStatValue}>{p.totalTickets}</Text>
                </View>
                <View style={styles.payoutStat}>
                  <Text style={styles.payoutStatLabel}>{t('Ganado', 'Earned')}</Text>
                  <Text style={styles.payoutStatValue}>${Number(p.totalEarned).toFixed(2)}</Text>
                </View>
                <View style={styles.payoutStat}>
                  <Text style={styles.payoutStatLabel}>{t('Saldo', 'Balance')}</Text>
                  <Text style={[styles.payoutStatValue, { color: colors.orange }]}>${Number(p.balance).toFixed(2)}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {sales.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('VENTAS GENERADAS', 'GENERATED SALES')}</Text>
          <Text style={styles.salesSub}>{stats.totalSales} {t('ventas', 'sales')} · {t('Total generado', 'Total volume')}: ${stats.totalSalesVolume.toFixed(2)}</Text>
          
          {sales.slice(0, 5).map((s, index) => (
            <View key={`${s.id || s.specialCode || 'sale'}-${index}`} style={styles.saleRow}>
              <View>
                <Text style={styles.saleCode}>{s.specialCode}</Text>
                <Text style={styles.saleEvent} numberOfLines={1}>{s.event?.title}</Text>
              </View>
              <View style={styles.saleRight}>
                <Text style={styles.saleTotal}>${Number(s.total).toFixed(2)}</Text>
                <Text style={styles.saleTickets}>{s.ticketCount} {t('tickets', 'tickets')}</Text>
              </View>
            </View>
          ))}
          {sales.length > 5 && (
            <Text style={styles.moreText}>{t('Y', 'And')} {sales.length - 5} {t('más...', 'more...')}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  loadingWrap: { padding: 40, alignItems: 'center' },
  card: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 18,
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  cardLabel: { color: colors.orange, fontSize: 11, letterSpacing: 0, fontWeight: '700', marginBottom: 12 },
  emptyWrap: { paddingVertical: 24, alignItems: 'center' },
  emptyTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  emptyText: { color: 'rgba(226,232,240,0.64)', fontSize: 13, textAlign: 'center', lineHeight: 19 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: {
    width: '48%',
    backgroundColor: '#030B14',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 14,
  },
  statValue: { color: '#F8FAFC', fontSize: 20, fontWeight: '900', marginBottom: 2 },
  statLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  codeText: { color: colors.orange, fontSize: 18, fontWeight: '900', fontFamily: 'monospace' },
  codeEvent: { color: 'rgba(226,232,240,0.64)', fontSize: 12, marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusActive: { backgroundColor: 'rgba(34,197,94,0.15)' },
  statusInactive: { backgroundColor: 'rgba(255,255,255,0.05)' },
  statusPillText: { fontSize: 10, fontWeight: '800' },
  statusActiveText: { color: '#4ade80' },
  statusInactiveText: { color: 'rgba(255,255,255,0.5)' },
  payoutRow: {
    backgroundColor: '#030B14',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 14,
    marginBottom: 10,
  },
  payoutEvent: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginBottom: 10 },
  payoutStats: { flexDirection: 'row', justifyContent: 'space-between' },
  payoutStat: { flex: 1 },
  payoutStatLabel: { color: 'rgba(226,232,240,0.64)', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  payoutStatValue: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  salesSub: { color: 'rgba(226,232,240,0.64)', fontSize: 12, marginBottom: 12 },
  saleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  saleCode: { color: colors.orange, fontSize: 13, fontWeight: '800', fontFamily: 'monospace' },
  saleEvent: { color: 'rgba(226,232,240,0.64)', fontSize: 11, marginTop: 2, maxWidth: 200 },
  saleRight: { alignItems: 'flex-end' },
  saleTotal: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  saleTickets: { color: 'rgba(226,232,240,0.64)', fontSize: 11, marginTop: 2 },
  moreText: { color: 'rgba(226,232,240,0.64)', fontSize: 12, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
});
