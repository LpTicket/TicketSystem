import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { AuthUser, apiPost } from '../services/api';
import { GradientButton } from '../components/GradientButton';
import { ScreenBackground } from '../components/ScreenBackground';

type Props = {
  user?: AuthUser | null;
  onBack: () => void;
};

export function ContactScreen({ user, onBack }: Props) {
  const { t } = useLanguage();
  const [name, setName] = useState(`${user?.firstName || ''} ${user?.lastName || ''}`.trim());
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError(t('Completa nombre, email y mensaje.', 'Fill in name, email and message.'));
      return;
    }
    setLoading(true);
    try {
      await apiPost('/contact', { name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() });
      setSent(true);
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setError(err?.message || t('No pudimos enviar tu mensaje.', 'We could not send your message.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screenWrap, Platform.OS === 'web' && { backgroundColor: 'transparent' }]}>
      <ScreenBackground />
      <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={onBack} style={styles.back}><Text style={styles.backText}>› {t('Volver', 'Back')}</Text></TouchableOpacity>

      {/* Centered title block (matches web) */}
      <View style={styles.headerBlock}>
        <Text style={styles.title}>{t('Estamos aquí para ayudarte', 'We are here to help')}</Text>
        <Text style={styles.subtitle}>
          {t(
            'Nuestro equipo está disponible para atender tus preguntas, escuchar tus necesidades y brindarte el soporte que necesitas.',
            'Our team is available to answer your questions, listen to your needs, and provide the support you need.',
          )}
        </Text>
        <View style={styles.underline} />
      </View>

      {/* Info cards */}
      <InfoCard icon="call-outline" title={t('Contacto en línea', 'Online Contact')} lines={['+1 (832) 379-0809']} />
      <InfoCard icon="location-outline" title={t('Nuestra dirección', 'Our Address')} lines={['1325 Main St Suite 203', 'Katy, TX 77494 United States']} />
      <InfoCard icon="mail-outline" title="E-mail" lines={['Info@lpticket.com']} />

      {/* Form */}
      {sent ? (
        <View style={styles.successCard}>
          <Text style={styles.successTitle}>{t('¡Mensaje enviado! ✅', 'Message sent! ✅')}</Text>
          <Text style={styles.successCopy}>{t('Te responderemos por email lo antes posible.', 'We will get back to you by email as soon as possible.')}</Text>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setSent(false)}>
            <Text style={styles.secondaryText}>{t('ENVIAR OTRO', 'SEND ANOTHER')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('Envíanos un mensaje', 'Send us a message')}</Text>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TextInput value={name} onChangeText={setName} placeholder={t('Nombre completo', 'Full name')} placeholderTextColor="#8B95A3" style={styles.input} />
          <TextInput value={email} onChangeText={setEmail} placeholder={t('Correo electrónico', 'Email address')} placeholderTextColor="#8B95A3" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
          <TextInput value={subject} onChangeText={setSubject} placeholder={t('Asunto', 'Subject')} placeholderTextColor="#8B95A3" style={styles.input} />
          <TextInput value={message} onChangeText={setMessage} placeholder={t('¿En qué podemos ayudarte?', 'How can we help you?')} placeholderTextColor="#8B95A3" multiline style={[styles.input, styles.textArea]} />
          <GradientButton
            label={loading ? t('ENVIANDO...', 'SENDING...') : t('ENVIAR MENSAJE', 'SEND MESSAGE')}
            onPress={submit}
            disabled={loading}
            height={56}
            style={styles.submit}
          />
        </View>
      )}
      </ScrollView>
    </View>
  );
}

function InfoCard({ icon, title, lines }: { icon: keyof typeof Ionicons.glyphMap; title: string; lines: string[] }) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={22} color="#ff7a00" />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoTitle}>{title}</Text>
        {lines.map((line, i) => (
          <Text key={i} style={i === 0 ? styles.infoValue : styles.infoSub}>{line}</Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenWrap: { flex: 1, backgroundColor: '#030B14' },
  root: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 18, paddingTop: 18, paddingBottom: 120 },
  back: { alignSelf: 'flex-start', marginBottom: 14 },
  backText: { color: '#CBD5E1', fontSize: 15, fontWeight: '700' },
  headerBlock: { alignItems: 'center', marginBottom: 24, marginTop: 8 },
  title: { color: '#FFFFFF', fontSize: 30, lineHeight: 34, fontWeight: '900', textAlign: 'center', marginBottom: 12 },
  subtitle: { color: 'rgba(203,213,225,0.78)', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  underline: { width: 96, height: 4, borderRadius: 999, backgroundColor: '#F97316', marginTop: 18 },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 16,
    backgroundColor: 'rgba(8,31,51,0.82)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(246,198,95,0.14)',
    padding: 18, marginBottom: 14,
  },
  infoIcon: {
    width: 48, height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,122,0,0.55)', backgroundColor: 'rgba(255,122,0,0.10)',
  },
  infoCopy: { flex: 1, gap: 2 },
  infoTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 2 },
  infoValue: { color: 'rgba(226,232,240,0.86)', fontSize: 14, fontWeight: '500' },
  infoSub: { color: 'rgba(203,213,225,0.6)', fontSize: 13, fontWeight: '400' },
  card: { backgroundColor: 'rgba(8,31,51,0.82)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(246,198,95,0.14)', padding: 18, marginTop: 4 },
  cardTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginBottom: 14 },
  successCard: { backgroundColor: 'rgba(22,163,74,0.12)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)', padding: 22, marginTop: 4 },
  successTitle: { color: '#86EFAC', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  successCopy: { color: '#CBD5E1', fontSize: 15, lineHeight: 22, marginBottom: 16 },
  error: { color: '#FCA5A5', fontSize: 13, marginBottom: 12 },
  input: { minHeight: 50, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(3,11,20,0.72)', paddingHorizontal: 14, paddingVertical: 12, color: '#FFFFFF', fontSize: 15, fontWeight: '500', marginBottom: 12 },
  textArea: { minHeight: 110, paddingTop: 13, textAlignVertical: 'top' },
  submit: { marginTop: 2 },
  secondaryButton: { height: 50, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secondaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
});
