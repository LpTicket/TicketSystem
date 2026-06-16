import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { API_URL, AuthUser } from '../services/api';
import { login as loginRequest, register as registerRequest } from '../services/auth';
import { GradientButton } from '../components/GradientButton';

type Props = {
  onSignIn: (user: AuthUser) => void;
};

type Mode = 'login' | 'register';
const REMEMBERED_EMAIL_KEY = 'lp_remembered_email';

export function LoginScreen({ onSignIn }: Props) {
  const { t, lang } = useLanguage();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';

  useEffect(() => {
    AsyncStorage.getItem(REMEMBERED_EMAIL_KEY)
      .then((savedEmail) => {
        if (!savedEmail) return;
        setEmail(savedEmail);
        setRememberMe(true);
      })
      .catch(() => {});
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
  };

  const submit = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError(t('Ingresa tu email y contraseña.', 'Enter your email and password.'));
      return;
    }

    if (isRegister) {
      if (!firstName.trim() || !lastName.trim()) {
        setError(t('Ingresa tu nombre y apellido.', 'Enter your first and last name.'));
        return;
      }
      if (password.length < 6) {
        setError(t('La contraseña debe tener al menos 6 caracteres.', 'Password must be at least 6 characters.'));
        return;
      }
      if (password !== confirm) {
        setError(t('Las contraseñas no coinciden.', 'Passwords do not match.'));
        return;
      }
    }

    setLoading(true);
    try {
      if (!isRegister) {
        if (rememberMe) {
          await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
        } else {
          await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
      }

      const user = isRegister
        ? await registerRequest({
            email,
            password,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim() || undefined,
            lang: lang === 'en' ? 'en' : 'es',
          })
        : await loginRequest(email, password);
      onSignIn(user);
    } catch (err: any) {
      setError(
        err?.message ||
          (isRegister
            ? t('No pudimos crear la cuenta.', 'We could not create the account.')
            : t('No pudimos iniciar sesión.', 'We could not sign in.')),
      );
    } finally {
      setLoading(false);
    }
  };

  const openSocialLogin = async (provider: 'google' | 'facebook') => {
    const url = `${API_URL}/auth/${provider}`;
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      Alert.alert(t('No se pudo abrir', 'Could not open'), t('Inténtalo nuevamente en unos segundos.', 'Please try again in a few seconds.'));
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      t('Recuperar contraseña', 'Recover password'),
      t('La recuperación de contraseña móvil quedará conectada cuando el backend active este flujo. Por ahora puedes cambiarla desde tu perfil si tienes sesión iniciada.', 'Mobile password recovery will be connected when the backend enables this flow. For now, you can change it from your profile if you are signed in.'),
    );
  };

  const handleFaceId = () => {
    Alert.alert(
      'Face ID',
      t('El acceso biométrico está preparado visualmente. Para activarlo de forma real hay que instalar el módulo nativo de autenticación biométrica y guardar una sesión válida.', 'Biometric access is visually prepared. To enable it for real, the native biometric authentication module must be installed and a valid session stored.'),
    );
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Ionicons name="ticket-outline" size={26} color={colors.orange} />
          </View>
          <Text style={styles.title}>{isRegister ? t('Crear cuenta', 'Create account') : t('Iniciar sesión', 'Sign in')}</Text>
          <Text style={styles.copy}>
            {t('Tu entrada a ', 'Your entry to ')}
            <Text style={styles.copyAccent}>{t('grandes', 'great')}</Text>
            {t(' experiencias', ' experiences')}
          </Text>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        {isRegister && (
          <View style={styles.row}>
            <View style={[styles.field, styles.rowItem]}>
              <Text style={styles.label}>{t('Nombre', 'First name')}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color="rgba(226,232,240,0.52)" />
                <TextInput value={firstName} onChangeText={setFirstName} placeholder={t('Nombre', 'First name')} placeholderTextColor="rgba(226,232,240,0.40)" style={styles.input} />
              </View>
            </View>
            <View style={[styles.field, styles.rowItem]}>
              <Text style={styles.label}>{t('Apellido', 'Last name')}</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={18} color="rgba(226,232,240,0.52)" />
                <TextInput value={lastName} onChangeText={setLastName} placeholder={t('Apellido', 'Last name')} placeholderTextColor="rgba(226,232,240,0.40)" style={styles.input} />
              </View>
            </View>
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>{t('Email', 'Email')}</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="rgba(226,232,240,0.52)" />
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="email@example.com"
              placeholderTextColor="rgba(226,232,240,0.40)"
              style={styles.input}
            />
          </View>
        </View>

        {isRegister && (
          <View style={styles.field}>
            <Text style={styles.label}>{t('Teléfono (con código de país)', 'Phone (with country code)')}</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="call-outline" size={18} color="rgba(226,232,240,0.52)" />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+1 305 555 1234"
                placeholderTextColor="rgba(226,232,240,0.40)"
                style={styles.input}
              />
            </View>
          </View>
        )}

        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{t('Contraseña', 'Password')}</Text>
            {!isRegister && (
              <TouchableOpacity onPress={handleForgotPassword} hitSlop={8}>
                <Text style={styles.forgotText}>{t('Olvidé contraseña', 'Forgot password')}</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="rgba(226,232,240,0.52)" />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder={t('Contraseña', 'Password')}
              placeholderTextColor="rgba(226,232,240,0.40)"
              style={styles.input}
            />
            <TouchableOpacity onPress={() => setShowPassword((value) => !value)} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={19} color="rgba(226,232,240,0.58)" />
            </TouchableOpacity>
          </View>
        </View>

        {isRegister && (
          <View style={styles.field}>
            <Text style={styles.label}>{t('Confirmar contraseña', 'Confirm password')}</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="shield-checkmark-outline" size={18} color="rgba(226,232,240,0.52)" />
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showPassword}
                placeholder={t('Confirmar contraseña', 'Confirm password')}
                placeholderTextColor="rgba(226,232,240,0.40)"
                style={styles.input}
              />
            </View>
          </View>
        )}

        {!isRegister && (
          <View style={styles.accountTools}>
            <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe((value) => !value)} activeOpacity={0.82}>
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe ? <Ionicons name="checkmark" size={13} color="#FFFFFF" /> : null}
              </View>
              <Text style={styles.rememberText}>{t('Recordarme', 'Remember me')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.faceButton} onPress={handleFaceId} activeOpacity={0.86}>
              <Ionicons name="scan-outline" size={16} color={colors.orange} />
              <Text style={styles.faceText}>Face ID</Text>
            </TouchableOpacity>
          </View>
        )}

        <GradientButton
          label={loading
            ? isRegister
              ? t('CREANDO...', 'CREATING...')
              : t('ENTRANDO...', 'SIGNING IN...')
            : isRegister
              ? t('CREAR CUENTA', 'CREATE ACCOUNT')
              : t('INICIAR SESIÓN', 'SIGN IN')}
          onPress={submit}
          disabled={loading}
          height={58}
          style={[styles.button, loading ? styles.buttonDisabled : {}]}
          textStyle={styles.buttonText}
        />

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>{t('O continúa con', 'Or continue with')}</Text>
          <View style={styles.divider} />
        </View>

        <View style={styles.socialGrid}>
          <TouchableOpacity style={styles.socialButton} onPress={() => openSocialLogin('google')} disabled={loading} activeOpacity={0.86}>
            <FontAwesome5 name="google" size={16} color={colors.orange} />
            <Text style={styles.socialText}>Google</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.socialButton} onPress={() => openSocialLogin('facebook')} disabled={loading} activeOpacity={0.86}>
            <FontAwesome5 name="facebook-f" size={16} color={colors.orange} />
            <Text style={styles.socialText}>Facebook</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => switchMode(isRegister ? 'login' : 'register')}>
          <Text style={styles.secondaryText}>
            {isRegister ? t('YA TENGO CUENTA', 'I ALREADY HAVE AN ACCOUNT') : t('CREAR CUENTA', 'CREATE ACCOUNT')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flexGrow: 1,
    padding: 18,
    paddingTop: 8,
    paddingBottom: 40,
    justifyContent: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowItem: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.018)',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    padding: 20,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
  },
  header: {
    alignItems: 'center',
    marginBottom: 18,
  },
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#ff6800',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  eyebrow: {
    color: colors.orange,
    fontSize: 11,
    letterSpacing: 0,
    fontWeight: '700',
    marginBottom: 7,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 7,
    textAlign: 'center',
  },
  copy: {
    color: 'rgba(203,213,225,0.78)',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  copyAccent: {
    color: colors.orange,
  },
  error: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  field: {
    gap: 7,
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  forgotText: {
    color: colors.orange,
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrap: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(3,11,20,0.72)',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 0,
    minHeight: 50,
  },
  accountTools: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: -2,
    marginBottom: 10,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 34,
  },
  checkbox: {
    width: 19,
    height: 19,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: '#030B14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.orange,
    borderColor: colors.orange,
  },
  rememberText: {
    color: 'rgba(226,232,240,0.74)',
    fontSize: 12,
    fontWeight: '700',
  },
  faceButton: {
    height: 30,
    borderRadius: 10,
    paddingHorizontal: 9,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.32)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  faceText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '700',
  },
  button: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.62,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 0,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  dividerText: {
    color: 'rgba(226,232,240,0.48)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0,
  },
  socialGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  socialButton: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(3,11,20,0.72)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  socialText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#030B14',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 0,
    fontWeight: '700',
  },
});
