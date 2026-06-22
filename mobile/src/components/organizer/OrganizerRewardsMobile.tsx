import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';
import { GradientButton } from '../GradientButton';

type RewardStats = {
  balance?: number;
  activeCodes?: number;
  totalPaid?: number;
  pending?: number;
};

type Props = {
  goTo: (section: 'attendees' | 'events' | 'details') => void;
  stats?: RewardStats;
};

export function OrganizerRewardsMobile({ goTo, stats }: Props) {
  const { t } = useLanguage();

  return (
    <View>
      <View style={styles.metricsGrid}>
        <Metric label={t('Balance actual', 'Current balance')} value={stats?.balance != null ? `$${Number(stats.balance).toFixed(2)}` : '$0.00'} />
        <Metric label={t('Codigos activos', 'Active codes')} value={String(stats?.activeCodes ?? 0)} />
        <Metric label={t('Pagado historico', 'Total paid')} value={stats?.totalPaid != null ? `$${Number(stats.totalPaid).toFixed(2)}` : '$0.00'} />
        <Metric label={t('Pendiente', 'Pending')} value={stats?.pending != null ? `$${Number(stats.pending).toFixed(2)}` : '$0.00'} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.eyebrow}>{t('RECOMPENSAS', 'REWARDS')}</Text>
        <Text style={styles.title}>{t('Recompensas', 'Rewards')}</Text>
        <Text style={styles.copy}>
          {t(
            'Gestiona balance, codigos especiales, pagos del organizador y beneficios promocionales.',
            'Manage balance, special codes, organizer payouts and promotional benefits.'
          )}
        </Text>

        <RewardCard
          title={t('Balance disponible', 'Available balance')}
          copy={t('Ingreso estimado listo para conciliacion y pagos.', 'Estimated revenue ready for reconciliation and payouts.')}
          value={stats?.balance != null ? `$${Number(stats.balance).toFixed(2)}` : '$0.00'}
          tone="orange"
        />

        <RewardCard
          title={t('Codigos especiales', 'Special codes')}
          copy={t('Codigos de descuento, acceso privado o recompensas.', 'Discount, private access or reward codes.')}
          value={String(stats?.activeCodes ?? 0)}
          tone="navy"
        />

        <RewardCard
          title={t('Historial de pagos', 'Payout history')}
          copy={t('Resumen de pagos realizados al organizador.', 'Summary of payouts sent to the organizer.')}
          value={stats?.totalPaid != null ? `$${Number(stats.totalPaid).toFixed(2)}` : '$0.00'}
          tone="green"
        />

        <View style={styles.actions}>
          <Button label={t('VER VENTAS', 'VIEW SALES')} onPress={() => goTo('attendees')} />
          <Button label={t('MIS EVENTOS', 'MY EVENTS')} muted onPress={() => goTo('events')} />
          <Button label={t('DETALLES', 'DETAILS')} muted onPress={() => goTo('details')} />
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

function RewardCard({ title, copy, value, tone }: { title: string; copy: string; value: string; tone: 'orange' | 'navy' | 'green' }) {
  return (
    <View style={styles.rewardCard}>
      <View style={[styles.rewardIcon, tone === 'navy' && styles.rewardIconNavy, tone === 'green' && styles.rewardIconGreen]}>
        <Text style={styles.rewardIconText}>{value.slice(0, 2)}</Text>
      </View>
      <View style={styles.rewardMain}>
        <Text style={styles.rewardTitle}>{title}</Text>
        <Text style={styles.rewardCopy}>{copy}</Text>
      </View>
      <Text style={styles.rewardValue}>{value}</Text>
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
  rewardCard: {
    backgroundColor: '#030B14',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  rewardIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: 'rgba(249,115,22,0.16)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.36)', alignItems: 'center', justifyContent: 'center' },
  rewardIconNavy: { backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'rgba(255,255,255,0.14)' },
  rewardIconGreen: { backgroundColor: 'rgba(249,115,22,0.10)', borderColor: 'rgba(249,115,22,0.28)' },
  rewardIconText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  rewardMain: { flex: 1 },
  rewardTitle: { color: '#F8FAFC', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  rewardCopy: { color: 'rgba(226,232,240,0.64)', fontSize: 12, lineHeight: 18, fontWeight: '600' },
  rewardValue: { color: colors.orange, fontSize: 16, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  button: { minHeight: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, flexGrow: 1 },
  buttonMuted: { backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  buttonText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 0, fontWeight: '600' },
  buttonTextMuted: { color: '#F8FAFC' },
});
