import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/LanguageContext';

type Props = {
  goTo: (section: 'attendees' | 'events' | 'details') => void;
};

export function OrganizerRewardsMobile({ goTo }: Props) {
  const { t } = useLanguage();

  return (
    <View>
      <View style={styles.metricsGrid}>
        <Metric label={t('Balance actual', 'Current balance')} value="$320.00" />
        <Metric label={t('Codigos activos', 'Active codes')} value="2" />
        <Metric label={t('Pagado historico', 'Total paid')} value="$540.00" />
        <Metric label={t('Pendiente', 'Pending')} value="$120.00" />
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
          value="$320.00"
          tone="orange"
        />

        <RewardCard
          title={t('Codigos especiales', 'Special codes')}
          copy={t('Codigos de descuento, acceso privado o recompensas.', 'Discount, private access or reward codes.')}
          value="2"
          tone="navy"
        />

        <RewardCard
          title={t('Historial de pagos', 'Payout history')}
          copy={t('Resumen de pagos realizados al organizador.', 'Summary of payouts sent to the organizer.')}
          value="$540.00"
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
  return (
    <TouchableOpacity onPress={onPress} style={[styles.button, muted && styles.buttonMuted]}>
      <Text style={[styles.buttonText, muted && styles.buttonTextMuted]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  metric: { width: '48%', backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E5E7EB', padding: 16 },
  metricValue: { color: colors.orange, fontSize: 25, fontWeight: '900', marginBottom: 4 },
  metricLabel: { color: '#6B7280', fontSize: 12, fontWeight: '900' },
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
  rewardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  rewardIcon: { width: 52, height: 52, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  rewardIconNavy: { backgroundColor: colors.navy },
  rewardIconGreen: { backgroundColor: '#16a34a' },
  rewardIconText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  rewardMain: { flex: 1 },
  rewardTitle: { color: colors.navy, fontSize: 16, fontWeight: '900', marginBottom: 4 },
  rewardCopy: { color: '#6B7280', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  rewardValue: { color: colors.orange, fontSize: 16, fontWeight: '900' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  button: { minHeight: 46, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, flexGrow: 1 },
  buttonMuted: { backgroundColor: '#F9FAFB' },
  buttonText: { color: '#FFFFFF', fontSize: 12, letterSpacing: 1.3, fontWeight: '900' },
  buttonTextMuted: { color: colors.navy },
});
