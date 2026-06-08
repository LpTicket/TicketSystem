import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { AuthUser } from '../services/api';

type Props = {
  event: any;
  user?: AuthUser | null;
  onBack: () => void;
  onPay: () => void;
};

export function OrderSummaryScreen({ event, user, onBack, onPay }: Props) {
  const { t } = useLanguage();
  const [quantity, setQuantity] = useState(1);

  const ticketPrice = Number(event?.price || 20);
  const subtotal = ticketPrice * quantity;
  const serviceFee = subtotal * 0.08 + 1.5;
  const total = subtotal + serviceFee;

  const decrease = () => setQuantity((value) => Math.max(1, value - 1));
  const increase = () => setQuantity((value) => Math.min(8, value + 1));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerTextWrap}>
          <Text style={styles.eyebrow}>{t('ORDEN', 'ORDER')}</Text>
          <Text style={styles.title}>{t('Revisar resumen', 'Review summary')}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.eventCard}>
          <View style={styles.eventBadge}>
            <Text style={styles.eventBadgeText}>{t('EVENTO PRIVADO', 'PRIVATE EVENT')}</Text>
          </View>

          <Text style={styles.eventTitle}>{event?.title || 'Event'}</Text>
          <Text style={styles.eventMeta}>{event?.date || '06/25 at 07:00 PM'} · {event?.venue || 'Ambriza'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('TICKETS', 'TICKETS')}</Text>

          <View style={styles.ticketRow}>
            <View>
              <Text style={styles.ticketName}>{t('Entrada general', 'General admission')}</Text>
              <Text style={styles.ticketPrice}>$ {ticketPrice.toFixed(2)} USD each</Text>
            </View>

            <View style={styles.stepper}>
              <TouchableOpacity onPress={decrease} style={styles.stepButton}>
                <Text style={styles.stepText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.quantity}>{quantity}</Text>
              <TouchableOpacity onPress={increase} style={styles.stepButton}>
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('COMPRADOR', 'BUYER')}</Text>
          <Text style={styles.buyerName}>{`${user?.firstName || ''} ${user?.lastName || ''}`.trim() || (user?.email || '')}</Text>
          <Text style={styles.buyerMeta}>{user?.email || ''}</Text>
          <Text style={styles.buyerMeta}>{user?.phone || ''}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('DETALLES DE PAGO', 'PAYMENT DETAILS')}</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('Subtotal', 'Subtotal')}</Text>
            <Text style={styles.rowValue}>$ {subtotal.toFixed(2)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('Cargo de servicio', 'Service fee')}</Text>
            <Text style={styles.rowValue}>$ {serviceFee.toFixed(2)}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t('Total', 'Total')}</Text>
            <Text style={styles.totalValue}>$ {total.toFixed(2)} USD</Text>
          </View>
        </View>

        <View style={styles.notice}>
          <View style={styles.noticeIcon}>
            <Text style={styles.noticeIconText}>✓</Text>
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>{t('Pago seguro', 'Secure payment')}</Text>
            <Text style={styles.noticeText}>{t('Stripe procesará el pago final usando el mismo sistema seguro de la página web.', 'Stripe checkout will process the final payment using the same secure system as the website.')}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.payButton} onPress={onPay}>
          <Text style={styles.payText}>{t('PAGAR SEGURO', 'PAY SECURELY')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e6ebf1',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: { color: colors.navy, fontSize: 34, lineHeight: 36, fontWeight: '300' },
  headerTextWrap: { flex: 1 },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '700', marginBottom: 3 },
  title: { color: colors.navy, fontSize: 24, fontWeight: '700' },
  content: { padding: 18, paddingBottom: 34 },
  eventCard: {
    backgroundColor: colors.navy,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
  },
  eventBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 18,
  },
  eventBadgeText: {
    color: colors.navy,
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '800',
  },
  eventTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  eventMeta: { color: '#cbd5e1', fontSize: 15, fontWeight: '400', lineHeight: 21 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 18,
    marginBottom: 14,
  },
  cardLabel: {
    color: '#6B7280',
    fontSize: 12,
    letterSpacing: 2.5,
    fontWeight: '800',
    marginBottom: 13,
  },
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  ticketName: { color: colors.navy, fontSize: 18, fontWeight: '800', marginBottom: 5 },
  ticketPrice: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    padding: 5,
    gap: 10,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.navy, fontSize: 22, fontWeight: '600', lineHeight: 24 },
  quantity: { minWidth: 18, textAlign: 'center', color: colors.navy, fontSize: 17, fontWeight: '800' },
  buyerName: { color: colors.navy, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  buyerMeta: { color: '#6B7280', fontSize: 15, fontWeight: '400', marginTop: 2 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 9 },
  rowLabel: { color: '#6B7280', fontSize: 15, fontWeight: '400' },
  rowValue: { color: colors.navy, fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'center' },
  totalLabel: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  totalValue: { color: colors.orange, fontSize: 20, fontWeight: '800' },
  notice: {
    backgroundColor: '#fff7ed',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 16,
    flexDirection: 'row',
    gap: 12,
  },
  noticeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeIconText: { color: colors.orange, fontSize: 18, fontWeight: '900' },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: colors.navy, fontSize: 16, fontWeight: '800', marginBottom: 5 },
  noticeText: { color: '#6B7280', fontSize: 14, lineHeight: 21, fontWeight: '400' },
  payButton: {
    height: 58,
    borderRadius: 15,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 2, fontWeight: '800' },
});
