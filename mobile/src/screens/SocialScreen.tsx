import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SocialMatchMobile } from '../components/profile/SocialMatchMobile';
import { useLanguage } from '../i18n/LanguageContext';

export function SocialScreen() {
  const { t } = useLanguage();

  return (
    <ScrollView style={styles.root} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Social match</Text>
        <Text style={styles.title}>{t('Conexiones del evento', 'Event connections')}</Text>
        <Text style={styles.subtitle}>
          {t('Encuentra asistentes compatibles, solicitudes y chats de tus eventos.', 'Find compatible attendees, requests and chats from your events.')}
        </Text>
      </View>

      <SocialMatchMobile />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 18, paddingTop: 46, paddingBottom: 132 },
  header: {
    marginBottom: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    padding: 18,
  },
  eyebrow: {
    color: '#F97316',
    fontSize: 12,
    letterSpacing: 0,
    fontWeight: '700',
    marginBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '700',
  },
  subtitle: {
    color: 'rgba(226,232,240,0.66)',
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
    marginTop: 8,
  },
});
