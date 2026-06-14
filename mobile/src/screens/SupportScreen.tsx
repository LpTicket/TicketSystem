import { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../i18n/LanguageContext';
import { GradientButton } from '../components/GradientButton';
import { ScreenBackground } from '../components/ScreenBackground';

type Props = { onContact: () => void; onBack: () => void };
type CatId = 'all' | 'payments' | 'tickets' | 'events';

export function SupportScreen({ onContact, onBack }: Props) {
  const { t, lang } = useLanguage();
  const es = lang === 'es';
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<CatId>('all');
  const [open, setOpen] = useState<number | null>(0);

  const faqs = [
    { category: 'payments', q: es ? '¿Qué métodos de pago se aceptan?' : 'What payment methods are accepted?', a: es ? 'Aceptamos todas las tarjetas de crédito y débito Visa, Mastercard y American Express a través de nuestra pasarela segura integrada con Stripe.' : 'We accept all major Visa, Mastercard, and American Express credit and debit cards through our secure integration with Stripe.' },
    { category: 'payments', q: es ? '¿Es seguro ingresar mi tarjeta en LPTicket?' : 'Is it safe to enter my card details on LPTicket?', a: es ? 'Absolutamente. LPTicket nunca almacena tus datos bancarios ni de tarjeta. Toda la información de pago se procesa de manera cifrada a través de Stripe (PCI-DSS Nivel 1).' : 'Absolutely. LPTicket never stores your card or banking details. All payment information is processed securely via Stripe (Tier 1 PCI-DSS).' },
    { category: 'tickets', q: es ? '¿Cómo recibo mis boletos adquiridos?' : 'How do I receive my purchased tickets?', a: es ? 'Inmediatamente después del pago, tus boletos estarán en la sección "Mis Tickets" y se envía un correo de confirmación con sus códigos QR listos para escanear.' : 'Immediately after checkout, your tickets appear in the "My Tickets" tab and a confirmation email with QR codes is sent instantly.' },
    { category: 'tickets', q: es ? '¿Cómo descargo las entradas en Apple o Google Wallet?' : 'How do I add my tickets to Apple Wallet or Google Wallet?', a: es ? 'Al ver tu entrada en "Mis Tickets" verás botones para "Añadir a Apple Wallet" o "Google Wallet". Tócalos para guardar tu pase en el celular.' : 'When viewing your ticket in "My Tickets" you will see "Add to Apple Wallet" and "Add to Google Wallet" buttons. Tap them to save your pass to your phone.' },
    { category: 'events', q: es ? '¿Puedo cambiar o reembolsar mis boletos?' : 'Can I exchange or refund my tickets?', a: es ? 'Todas las compras son definitivas. Sin embargo, en caso de cancelación del evento, se procesa un reembolso automático del 100% a la misma tarjeta.' : 'All purchases are final. However, if the event is cancelled, an automatic 100% refund is processed to the original card.' },
  ];

  const categories: { id: CatId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'all', label: es ? 'Todos' : 'All', icon: 'help-circle-outline' },
    { id: 'payments', label: es ? 'Pagos' : 'Payments', icon: 'card-outline' },
    { id: 'tickets', label: es ? 'Boletos' : 'My Tickets', icon: 'ticket-outline' },
    { id: 'events', label: es ? 'Eventos' : 'Events', icon: 'sparkles-outline' },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return faqs.filter((f) => {
      const matchesCat = cat === 'all' || f.category === cat;
      const matchesQuery = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [faqs, query, cat]);

  return (
    <View style={[styles.screenWrap, Platform.OS === 'web' && { backgroundColor: 'transparent' }]}>
      <ScreenBackground />
      <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={onBack} style={styles.back}><Text style={styles.backText}>‹ {t('Volver', 'Back')}</Text></TouchableOpacity>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.pill}>
          <Ionicons name="help-buoy-outline" size={14} color="#F97316" />
          <Text style={styles.pillText}>{es ? 'Centro de Ayuda' : 'Help & Support'}</Text>
        </View>
        <Text style={styles.title}>{es ? '¿Cómo podemos ayudarte?' : 'How can we help you?'}</Text>
        <Text style={styles.subtitle}>
          {es ? 'Encuentra respuestas rápidas sobre compras, accesos y mapas interactivos, o contáctanos directamente.' : 'Find quick answers regarding transactions, access portals, or get in touch with support.'}
        </Text>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#8B95A3" />
          <TextInput value={query} onChangeText={setQuery} placeholder={es ? 'Buscar respuestas...' : 'Search for questions...'} placeholderTextColor="#8B95A3" style={styles.searchInput} />
        </View>
      </View>

      {/* Category filter */}
      <View style={styles.catGrid}>
        {categories.map((c) => {
          const active = cat === c.id;
          return (
            <TouchableOpacity key={c.id} onPress={() => { setCat(c.id); setOpen(null); }} style={[styles.catCard, active && styles.catCardActive]}>
              <Ionicons name={c.icon} size={22} color={active ? '#F97316' : 'rgba(203,213,225,0.6)'} />
              <Text style={[styles.catLabel, active && styles.catLabelActive]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* FAQ accordion */}
      {filtered.length === 0 ? (
        <View style={styles.emptyFaq}><Text style={styles.emptyText}>{es ? 'No se encontraron preguntas.' : 'No matching FAQs found.'}</Text></View>
      ) : (
        filtered.map((f, i) => {
          const isOpen = open === i;
          return (
            <View key={i} style={styles.faq}>
              <TouchableOpacity style={styles.faqHeader} activeOpacity={0.8} onPress={() => setOpen(isOpen ? null : i)}>
                <Text style={styles.faqQ}>{f.q}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color="rgba(203,213,225,0.7)" />
              </TouchableOpacity>
              {isOpen && <Text style={styles.faqA}>{f.a}</Text>}
            </View>
          );
        })
      )}

      {/* Contact CTA */}
      <View style={styles.helpCard}>
        <Text style={styles.helpTitle}>{es ? '¿Tienes otra consulta?' : 'Have another question?'}</Text>
        <Text style={styles.helpCopy}>{es ? 'Completa el formulario y nuestro equipo te responderá en menos de 24 horas.' : 'Fill out the form and our team will get back to you within 24 hours.'}</Text>
        <GradientButton label={es ? 'IR A CONTACTO' : 'GO TO CONTACT'} onPress={onContact} height={52} style={styles.helpButton} />
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: { flex: 1, backgroundColor: '#030B14' },
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 18, paddingTop: 12, paddingBottom: 120 },
  back: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  backText: { color: '#F8FAFC', fontSize: 15, fontWeight: '700' },
  hero: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 6,
    gap: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#030B14', borderWidth: 1, borderColor: 'rgba(249,115,22,0.34)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { color: '#F97316', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: '#F8FAFC', fontSize: 30, lineHeight: 34, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: 'rgba(226,232,240,0.68)', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  searchBox: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', paddingHorizontal: 14, marginTop: 4 },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  catCard: { width: '47%', flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14' },
  catCardActive: { borderColor: 'rgba(249,115,22,0.46)', backgroundColor: 'rgba(249,115,22,0.10)' },
  catLabel: { color: 'rgba(203,213,225,0.6)', fontSize: 12, fontWeight: '700' },
  catLabelActive: { color: '#FFFFFF' },
  faq: { backgroundColor: '#030B14', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10 },
  faqHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  faqQ: { color: '#F8FAFC', fontSize: 15, fontWeight: '700', flex: 1, lineHeight: 20 },
  faqA: { color: 'rgba(226,232,240,0.68)', fontSize: 14, lineHeight: 21, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' },
  emptyFaq: { padding: 22, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#030B14', alignItems: 'center', marginBottom: 10 },
  emptyText: { color: 'rgba(203,213,225,0.7)', fontSize: 14 },
  helpCard: { marginTop: 6, backgroundColor: 'rgba(255,255,255,0.018)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', padding: 20, shadowColor: '#000000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  helpTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  helpCopy: { color: 'rgba(226,232,240,0.68)', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  helpButton: { alignSelf: 'flex-start', paddingHorizontal: 24 },
});
