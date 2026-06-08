import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { apiPost, AuthResponse, AuthUser, setAuthTokens } from '../services/api';

type Props = {
  onSignIn: (user: AuthUser) => void;
};

export function LoginScreen({ onSignIn }: Props) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t('Ingresa tu email y contraseña.', 'Enter your email and password.'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await apiPost<AuthResponse>('/auth/login', {
        email: email.trim(),
        password,
      });

      setAuthTokens(data.accessToken, data.refreshToken);
      onSignIn(data.user);
    } catch (err: any) {
      setError(err?.message || t('No pudimos iniciar sesión.', 'We could not sign in.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t('CUENTA', 'ACCOUNT')}</Text>
        <Text style={styles.title}>{t('Iniciar sesión', 'Sign in')}</Text>
        <Text style={styles.copy}>{t('Accede con la misma cuenta real de la página web.', 'Use the same real account from the website.')}</Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

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

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={login} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? t('ENTRANDO...', 'SIGNING IN...') : t('INICIAR SESIÓN', 'SIGN IN')}</Text>
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
    backgroundColor: '#030B14',
    padding: 18,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: 'rgba(8,31,51,0.82)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
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
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 8,
  },
  copy: {
    color: '#CBD5E1',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
    marginBottom: 18,
  },
  error: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  field: {
    gap: 7,
    marginBottom: 14,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(3,11,20,0.72)',
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    height: 58,
    borderRadius: 8,
    backgroundColor: colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.62,
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secondaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 1.5,
    fontWeight: '900',
  },
});
