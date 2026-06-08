import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';

type Props = { onBack: () => void };

export function AboutScreen({ onBack }: Props) {
  const { t } = useLanguage();

  const features = [
    { icon: '🎟️', title: t('Tickets digitales', 'Digital tickets'), copy: t('Compra y recibe tus entradas con código QR directo en tu celular.', 'Buy and receive your tickets with a QR code right on your phone.') },
    { icon: '🔒', title: t('Pagos seguros', 'Secure payments'), copy: t('Procesados por Stripe, con protección de extremo a extremo.', 'Processed by Stripe, with end-to-end protection.') },
    { icon: '🗺️', title: t('Selección de asientos', 'Seat selection'), copy: t('Elige tu mesa o asiento en un mapa visual interactivo.', 'Pick your table or seat on an interactive visual map.') },
    { icon: '⚡', title: t('Acceso rápido', 'Fast entry'), copy: t('Validación por QR en la puerta, sin filas.', 'QR validation at the door, no lines.') },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={onBack} style={styles.back}><Text style={styles.backText}>‹ {t('Volver', 'Back')}</Text></TouchableOpacity>
      <Text style={styles.eyebrow}>{t('QUIÉNES SOMOS', 'ABOUT US')}</Text>
      <Text style={styles.title}>LP Ticket</Text>
      <Text style={styles.copy}>
        {t(
          'LP Ticket es la plataforma para descubrir, comprar y vivir eventos: conciertos, fiestas, eventos privados y más. Conectamos a organizadores con su público de forma simple, segura y moderna.',
          'LP Ticket is the platform to discover, buy and live events: concerts, parties, private events and more. We connect organizers with their audience in a simple, secure and modern way.',
        )}
      </Text>

      {features.map((f) => (
        <View key={f.title} style={styles.card}>
          <Text style={styles.cardIcon}>{f.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{f.title}</Text>
            <Text style={styles.cardCopy}>{f.copy}</Text>
          </View>
        </View>
      ))}

      <View style={styles.missionCard}>
        <Text style={styles.missionLabel}>{t('NUESTRA MISIÓN', 'OUR MISSION')}</Text>
        <Text style={styles.missionCopy}>
          {t(
            'Hacer que comprar y disfrutar entradas sea tan fácil como abrir tu teléfono.',
            'Make buying and enjoying tickets as easy as opening your phone.',
          )}
        </Text>
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
  title: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', marginBottom: 10 },
  copy: { color: '#CBD5E1', fontSize: 15, lineHeight: 23, marginBottom: 18 },
  card: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16, marginBottom: 12 },
  cardIcon: { fontSize: 26 },
  cardTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginBottom: 4 },
  cardCopy: { color: '#CBD5E1', fontSize: 14, lineHeight: 20 },
  missionCard: { marginTop: 6, backgroundColor: 'rgba(249,115,22,0.10)', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', padding: 20 },
  missionLabel: { color: colors.orange, fontSize: 11, letterSpacing: 2, fontWeight: '900', marginBottom: 8 },
  missionCopy: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', lineHeight: 26 },
});
