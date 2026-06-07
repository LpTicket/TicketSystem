import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';

type Props = {
  onSignIn: () => void;
};

export function LoginScreen({ onSignIn }: Props) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('sundin@example.com');
  const [password, setPassword] = useState('123456');

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t('CUENTA', 'ACCOUNT')}</Text>
        <Text style={styles.title}>{t('Iniciar sesión', 'Sign in')}</Text>
        <Text style={styles.copy}>{t('Accede a tus tickets, perfil e información de checkout.', 'Access your tickets, profile and checkout information.')}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>{t('Email', 'Email')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="email@example.com"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('Contraseña', 'Password')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t('Contraseña', 'Password')}
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />
        </View>

        <TouchableOpacity style={styles.button} onPress={onSignIn}>
          <Text style={styles.buttonText}>{t('INICIAR SESIÓN', 'SIGN IN')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>{t('CREAR CUENTA', 'CREATE ACCOUNT')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 18,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 22,
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 12,
    letterSpacing: 3,
    fontWeight: '800',
    marginBottom: 8,
  },
  title: {
    color: colors.navy,
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
  },
  copy: {
    color: '#6B7280',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    marginBottom: 22,
  },
  field: {
    gap: 7,
    marginBottom: 14,
  },
  label: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    color: colors.navy,
    fontSize: 16,
    fontWeight: '700',
  },
  button: {
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: '900',
  },
  secondaryButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryText: {
    color: colors.navy,
    fontSize: 13,
    letterSpacing: 1.5,
    fontWeight: '900',
  },
});
