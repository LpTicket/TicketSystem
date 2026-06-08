import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { AuthUser, apiPost } from '../services/api';

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
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={onBack} style={styles.back}><Text style={styles.backText}>‹ {t('Volver', 'Back')}</Text></TouchableOpacity>
      <Text style={styles.eyebrow}>{t('CONTACTO', 'CONTACT')}</Text>
      <Text style={styles.title}>{t('Hablemos', 'Get in touch')}</Text>
      <Text style={styles.copy}>{t('¿Tienes dudas sobre un evento o tu compra? Escríbenos y te respondemos.', 'Questions about an event or your purchase? Send us a message and we will reply.')}</Text>

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
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Field label={t('Nombre', 'Name')} value={name} onChangeText={setName} />
          <Field label={t('Email', 'Email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Field label={t('Asunto', 'Subject')} value={subject} onChangeText={setSubject} />
          <Field label={t('Mensaje', 'Message')} value={message} onChangeText={setMessage} multiline />
          <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
            <Text style={styles.buttonText}>{loading ? t('ENVIANDO...', 'SENDING...') : t('ENVIAR MENSAJE', 'SEND MESSAGE')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>{t('EMAIL', 'EMAIL')}</Text>
        <Text style={styles.infoValue}>info@lpticket.com</Text>
      </View>
    </ScrollView>
  );
}

function Field({ label, multiline, ...props }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} multiline={multiline} placeholderTextColor="#9CA3AF" style={[styles.input, multiline && styles.textArea]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030B14' },
  content: { padding: 18, paddingTop: 78, paddingBottom: 120 },
  back: { alignSelf: 'flex-start', marginBottom: 14 },
  backText: { color: '#CBD5E1', fontSize: 15, fontWeight: '700' },
  eyebrow: { color: colors.orange, fontSize: 12, letterSpacing: 3, fontWeight: '900', marginBottom: 8 },
  title: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', marginBottom: 8 },
  copy: { color: '#CBD5E1', fontSize: 15, lineHeight: 22, marginBottom: 18 },
  card: { backgroundColor: 'rgba(8,31,51,0.82)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 18 },
  successCard: { backgroundColor: 'rgba(22,163,74,0.12)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(34,197,94,0.35)', padding: 22 },
  successTitle: { color: '#86EFAC', fontSize: 20, fontWeight: '900', marginBottom: 8 },
  successCopy: { color: '#CBD5E1', fontSize: 15, lineHeight: 22, marginBottom: 16 },
  error: { color: '#FCA5A5', fontSize: 13, marginBottom: 12 },
  field: { gap: 7, marginBottom: 14 },
  fieldLabel: { color: '#CBD5E1', fontSize: 13, fontWeight: '600' },
  input: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(3,11,20,0.72)', paddingHorizontal: 16, color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  textArea: { minHeight: 120, paddingTop: 14, textAlignVertical: 'top' },
  button: { height: 56, borderRadius: 8, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { color: '#FFFFFF', fontSize: 14, letterSpacing: 2, fontWeight: '900' },
  secondaryButton: { height: 50, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secondaryText: { color: '#FFFFFF', fontSize: 13, letterSpacing: 1.5, fontWeight: '900' },
  infoCard: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16 },
  infoLabel: { color: colors.orange, fontSize: 11, letterSpacing: 2, fontWeight: '900', marginBottom: 6 },
  infoValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});
