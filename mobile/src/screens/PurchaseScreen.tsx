import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { MobileEvent } from '../types/event';

type Props = {
  event: MobileEvent;
  onBack: () => void;
  onContinue: () => void;
};

export function PurchaseScreen({ event, onBack, onContinue }: Props) {
  const { t } = useLanguage();
  const [qty, setQty] = useState(1);
  const price = Number(event.price.replace(/[^0-9.]/g, '')) || 20;
  const subtotal = price * qty;
  const service = subtotal * 0.1;
  const total = subtotal + service;

  return (
    <View style={styles.screen}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Text style={styles.backText}>‹ Event</Text>
      </TouchableOpacity>

      <Text style={styles.eyebrow}>{t('CHECKOUT', 'CHECKOUT')}</Text>
      <Text style={styles.title}>{t('Selecciona tus tickets', 'Select your tickets')}</Text>
      <Text style={styles.subtitle}>{event.title}</Text>

      <View style={styles.ticketType}>
        <View>
          <Text style={styles.typeLabel}>{t('ACCESO GENERAL', 'GENERAL ACCESS')}</Text>
          <Text style={styles.typeName}>{t('Ticket estándar', 'Standard ticket')}</Text>
          <Text style={styles.typeMeta}>{event.venue} · {event.date}</Text>
        </View>
        <Text style={styles.typePrice}>${price.toFixed(2)}</Text>
      </View>

      <View style={styles.qtyCard}>
        <Text style={styles.qtyLabel}>{t('Cantidad', 'Quantity')}</Text>
        <View style={styles.qtyControls}>
          <TouchableOpacity style={styles.qtyButton} onPress={() => setQty(Math.max(1, qty - 1))}>
            <Text style={styles.qtyButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyValue}>{qty}</Text>
          <TouchableOpacity style={styles.qtyButton} onPress={() => setQty(Math.min(10, qty + 1))}>
            <Text style={styles.qtyButtonText}>＋</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{t('Resumen de orden', 'Order summary')}</Text>
        <View style={styles.row}><Text style={styles.rowLabel}>{t('Tickets', 'Tickets')}</Text><Text style={styles.rowValue}>${subtotal.toFixed(2)}</Text></View>
        <View style={styles.row}><Text style={styles.rowLabel}>{t('Cargo de servicio', 'Service fee')}</Text><Text style={styles.rowValue}>${service.toFixed(2)}</Text></View>
        <View style={styles.divider} />
        <View style={styles.row}><Text style={styles.totalLabel}>{t('Total', 'Total')}</Text><Text style={styles.totalValue}>${total.toFixed(2)}</Text></View>
      </View>

      <TouchableOpacity style={styles.continueButton} onPress={onContinue}>
        <Text style={styles.continueText}>{t('CONTINUAR', 'CONTINUE')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 18, paddingBottom: 120 },
  backButton: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: colors.border },
  backText: { color: colors.navy, fontWeight: '800', fontSize: 14 },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 4, fontWeight: '800', marginTop: 28 },
  title: { color: colors.navy, fontSize: 32, lineHeight: 36, fontWeight: '800', marginTop: 12 },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22, fontWeight: '600', marginTop: 8, marginBottom: 22 },
  ticketType: { backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  typeLabel: { color: colors.orange, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  typeName: { color: colors.navy, fontSize: 19, fontWeight: '800', marginTop: 8 },
  typeMeta: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: 6, maxWidth: 220 },
  typePrice: { color: colors.navy, fontSize: 20, fontWeight: '800' },
  qtyCard: { marginTop: 16, backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyLabel: { color: colors.navy, fontSize: 17, fontWeight: '800' },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  qtyButtonText: { color: colors.navy, fontSize: 22, fontWeight: '800' },
  qtyValue: { color: colors.navy, fontSize: 22, fontWeight: '800', minWidth: 24, textAlign: 'center' },
  summary: { marginTop: 16, backgroundColor: colors.white, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18 },
  summaryTitle: { color: colors.navy, fontSize: 19, fontWeight: '800', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  rowLabel: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  rowValue: { color: colors.navy, fontSize: 15, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 8 },
  totalLabel: { color: colors.navy, fontSize: 18, fontWeight: '800' },
  totalValue: { color: colors.orange, fontSize: 22, fontWeight: '800' },
  continueButton: { marginTop: 18, height: 56, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  continueText: { color: colors.white, fontSize: 14, fontWeight: '800', letterSpacing: 2.6 },
});
