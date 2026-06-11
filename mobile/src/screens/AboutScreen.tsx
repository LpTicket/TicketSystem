import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguage } from '../i18n/LanguageContext';
import { GradientButton } from '../components/GradientButton';

type Props = { onBack: () => void; onContact?: () => void };

export function AboutScreen({ onBack, onContact }: Props) {
  const { lang, t } = useLanguage();
  const es = lang === 'es';

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={onBack} style={styles.back}><Text style={styles.backText}>‹ {t('Volver', 'Back')}</Text></TouchableOpacity>

      {/* Hero */}
      <View style={styles.hero}>
        <View style={styles.pill}><Text style={styles.pillText}>LPTicket</Text></View>
        <Text style={styles.title}>{es ? 'Quiénes somos' : 'About us'}</Text>
        <Text style={styles.subtitle}>
          {es
            ? 'LPTicket es una plataforma de boletería digital creada en Estados Unidos para conectar eventos, organizadores y asistentes a través de una experiencia moderna, segura y fácil de usar.'
            : 'LPTicket is a digital ticketing platform built in the United States to connect events, organizers and attendees through a modern, secure and easy-to-use experience.'}
        </Text>
      </View>

      {/* Main description */}
      <View style={styles.card}>
        <Text style={styles.paragraph}>
          {es
            ? 'Nacemos con el propósito de ofrecer una solución confiable para la venta de tickets en línea, ayudando a productores, promotores, empresas, marcas y organizaciones a gestionar sus eventos de manera profesional, desde la publicación del evento hasta el control de acceso.'
            : 'We were born to offer a reliable solution for online ticket sales, helping producers, promoters, companies, brands and organizations manage their events professionally — from publishing the event to access control.'}
        </Text>
        <Text style={styles.paragraph}>
          {es
            ? 'Nuestra plataforma está diseñada para todo tipo de eventos: conciertos, conferencias, networking, teatros, exposiciones, festivales, eventos corporativos, sociales, culturales y experiencias especiales.'
            : 'Our platform is designed for every kind of event: concerts, conferences, networking, theater, exhibitions, festivals, corporate, social and cultural events, and special experiences.'}
        </Text>
        <Text style={[styles.paragraph, styles.paragraphLast]}>
          {es
            ? 'En LPTicket creemos que cada evento merece una presentación profesional, una venta organizada y una experiencia de entrada confiable. Por eso trabajamos para que organizadores y asistentes tengan una plataforma clara, elegante, segura y preparada para el mercado actual.'
            : 'At LPTicket we believe every event deserves a professional presentation, organized sales and a reliable entry experience. That is why we work so organizers and attendees have a clear, elegant, secure platform ready for today’s market.'}
        </Text>
      </View>

      {/* Mission */}
      <View style={styles.card}>
        <Text style={styles.cardHeading}>{es ? 'Nuestra misión' : 'Our mission'}</Text>
        <Text style={[styles.paragraph, styles.paragraphLast]}>
          {es
            ? 'Ofrecer una plataforma de boletería moderna, segura y accesible que permita a organizadores, productores, empresas y marcas vender tickets de manera profesional, rápida y confiable, brindando al público una experiencia de compra simple, clara y segura.'
            : 'To offer a modern, secure and accessible ticketing platform that lets organizers, producers, companies and brands sell tickets professionally, quickly and reliably, giving the public a simple, clear and secure buying experience.'}
        </Text>
      </View>

      {/* Vision */}
      <View style={styles.card}>
        <Text style={styles.cardHeading}>{es ? 'Nuestra visión' : 'Our vision'}</Text>
        <Text style={styles.paragraph}>
          {es
            ? 'Convertirnos en una de las plataformas de boletería digital más confiables en Estados Unidos, impulsando eventos de todo tipo con tecnología, innovación y una experiencia de usuario premium.'
            : 'To become one of the most trusted digital ticketing platforms in the United States, powering all kinds of events with technology, innovation and a premium user experience.'}
        </Text>
        <Text style={[styles.paragraph, styles.paragraphLast]}>
          {es
            ? 'Queremos ser el puente entre grandes experiencias y las personas que desean vivirlas, ayudando a que cada evento tenga mayor alcance, mejor organización y una presentación profesional desde el primer clic.'
            : 'We want to be the bridge between great experiences and the people who want to live them, helping every event reach more people with better organization and a professional presentation from the first click.'}
        </Text>
      </View>

      {/* CTA */}
      <View style={styles.ctaCard}>
        <Text style={styles.ctaTitle}>
          {es ? 'Crea, vende y valida tickets con LPTicket' : 'Create, sell and validate tickets with LPTicket'}
        </Text>
        <Text style={styles.ctaCopy}>
          {es ? 'Una experiencia profesional para organizadores y asistentes.' : 'A professional experience for organizers and attendees.'}
        </Text>
        <GradientButton label={es ? 'CONTACTAR' : 'CONTACT'} onPress={() => (onContact ? onContact() : onBack())} height={52} style={styles.ctaButton} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030B14' },
  content: { padding: 18, paddingTop: 18, paddingBottom: 120 },
  back: { alignSelf: 'flex-start', marginBottom: 14 },
  backText: { color: '#CBD5E1', fontSize: 15, fontWeight: '700' },
  hero: { alignItems: 'center', marginBottom: 22, marginTop: 6, gap: 14 },
  pill: { backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  pillText: { color: '#F97316', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 32, lineHeight: 36, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: 'rgba(203,213,225,0.78)', fontSize: 15, lineHeight: 23, textAlign: 'center' },
  card: { backgroundColor: 'rgba(8,31,51,0.82)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 20, marginBottom: 16 },
  cardHeading: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginBottom: 14 },
  paragraph: { color: 'rgba(203,213,225,0.82)', fontSize: 15, lineHeight: 24, marginBottom: 14 },
  paragraphLast: { marginBottom: 0 },
  ctaCard: { backgroundColor: 'rgba(8,31,51,0.82)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(249,115,22,0.28)', padding: 20 },
  ctaTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginBottom: 6, lineHeight: 23 },
  ctaCopy: { color: 'rgba(203,213,225,0.7)', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  ctaButton: { alignSelf: 'flex-start', paddingHorizontal: 26 },
});
