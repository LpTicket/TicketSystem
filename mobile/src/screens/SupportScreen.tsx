import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';

type Props = { onContact: () => void; onBack: () => void };

export function SupportScreen({ onContact, onBack }: Props) {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number | null>(0);

  const faqs = [
    {
      q: t('¿Cómo recibo mis entradas?', 'How do I get my tickets?'),
      a: t('Tras pagar, tus entradas aparecen en "Mis Tickets" con su código QR. También las recibes por email.', 'After paying, your tickets appear in "My Tickets" with their QR code. You also receive them by email.'),
    },
    {
      q: t('¿Cómo entro al evento?', 'How do I enter the event?'),
      a: t('Muestra el código QR de tu ticket en la puerta. El organizador lo escanea para validar tu acceso.', 'Show your ticket QR code at the door. The organizer scans it to validate your entry.'),
    },
    {
      q: t('¿Puedo pedir reembolso?', 'Can I get a refund?'),
      a: t('Las políticas de reembolso dependen de cada evento. Escríbenos por Contacto con tu número de orden.', 'Refund policies depend on each event. Reach us via Contact with your order number.'),
    },
    {
      q: t('¿Es seguro pagar en la app?', 'Is it safe to pay in the app?'),
      a: t('Sí. Los pagos se procesan con Stripe; no guardamos los datos de tu tarjeta.', 'Yes. Payments are processed with Stripe; we never store your card details.'),
    },
    {
      q: t('No me llegó mi ticket, ¿qué hago?', 'I did not get my ticket, what do I do?'),
      a: t('Revisa "Mis Tickets" y tu correo (incluido spam). Si no aparece, contáctanos con tu email de compra.', 'Check "My Tickets" and your email (including spam). If it is missing, contact us with your purchase email.'),
    },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} style={styles.back}><Text style={styles.backText}>‹ {t('Volver', 'Back')}</Text></TouchableOpacity>
      <Text style={styles.eyebrow}>{t('SOPORTE', 'SUPPORT')}</Text>
      <Text style={styles.title}>{t('¿En qué te ayudamos?', 'How can we help?')}</Text>
      <Text style={styles.copy}>{t('Preguntas frecuentes sobre tickets, pagos y acceso.', 'Frequently asked questions about tickets, payments and entry.')}</Text>

      {faqs.map((f, i) => (
        <TouchableOpacity key={i} style={styles.faq} activeOpacity={0.8} onPress={() => setOpen(open === i ? null : i)}>
          <View style={styles.faqHeader}>
            <Text style={styles.faqQ}>{f.q}</Text>
            <Text style={styles.faqToggle}>{open === i ? '−' : '+'}</Text>
          </View>
          {open === i && <Text style={styles.faqA}>{f.a}</Text>}
        </TouchableOpacity>
      ))}

      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>{t('¿No encuentras tu respuesta?', "Can't find your answer?")}</Text>
        <Text style={styles.helpCopy}>{t('Escríbenos y te ayudamos personalmente.', 'Send us a message and we will help you personally.')}</Text>
        <TouchableOpacity style={styles.button} onPress={onContact}>
          <Text style={styles.buttonText}>{t('IR A CONTACTO', 'GO TO CONTACT')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030B14' },
  content: { padding: 18, paddingTop: 78, paddingBottom: 120 },
  back: { alignSelf: 'flex-start', marginBottom: 14 },
  backText: { color: '#CBD5E1', fontSize: 15, fontWeight: '700' },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '900', marginBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', marginBottom: 8 },
  copy: { color: '#CBD5E1', fontSize: 15, lineHeight: 22, marginBottom: 18 },
  faq: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16, marginBottom: 10 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  faqQ: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', flex: 1 },
  faqToggle: { color: colors.orange, fontSize: 22, fontWeight: '900' },
  faqA: { color: '#CBD5E1', fontSize: 14, lineHeight: 21, marginTop: 12 },
  helpCard: { marginTop: 8, backgroundColor: 'rgba(249,115,22,0.10)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', padding: 20 },
  helpTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  helpCopy: { color: '#CBD5E1', fontSize: 14, lineHeight: 21, marginBottom: 16 },
  button: { height: 52, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 13, letterSpacing: 1.5, fontWeight: '900' },
});
