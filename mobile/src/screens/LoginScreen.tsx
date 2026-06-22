import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useLanguage } from '../i18n/LanguageContext';
import { API_URL, AuthUser, setAuthTokens } from '../services/api';
import { login as loginRequest, register as registerRequest, forgotPassword as forgotPasswordRequest, refreshSession } from '../services/auth';
import { getBiometricAvailability, saveBiometricLogin, signInWithBiometrics } from '../services/biometricAuth';
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
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricReady, setBiometricReady] = useState(false);
  const [hasSavedBiometricLogin, setHasSavedBiometricLogin] = useState(false);
  const [error, setError] = useState('');
  const autoBiometricAttempted = useRef(false);

  const isRegister = mode === 'register';

  useEffect(() => {
    AsyncStorage.getItem(REMEMBERED_EMAIL_KEY)
      .then((savedEmail) => {
        if (!savedEmail) return;
        setEmail(savedEmail);
        setRememberMe(true);
      })
      .catch(() => {});

    getBiometricAvailability()
      .then((availability) => {
        setBiometricReady(availability.hasHardware && availability.enrolled);
        setHasSavedBiometricLogin(availability.hasSavedLogin);
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
      // Store the refreshToken (not the password) for future biometric logins
      if (!isRegister) {
        const TOKENS_KEY = 'lp_auth_tokens';
        const raw = await AsyncStorage.getItem(TOKENS_KEY).catch(() => null);
        const tokens = raw ? JSON.parse(raw) : null;
        if (tokens?.refreshToken) {
          await saveBiometricLogin(tokens.refreshToken);
          setHasSavedBiometricLogin(true);
        }
      }
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
    // Build the OAuth URL with ?platform=mobile so the backend knows to
    // redirect back to the lpticket:// deep link instead of the web app.
    const redirectUri = Platform.OS === 'web' ? Linking.createURL('login/success') : 'lpticket://login/success';
    const url = `${API_URL}/auth/${provider}?platform=mobile&redirectUri=${encodeURIComponent(redirectUri)}`;
    try {
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const token = parsed.queryParams?.token as string | undefined;
        const refreshToken = parsed.queryParams?.refreshToken as string | undefined;
        if (token && refreshToken) {
          // Exchange for a fresh session via the refresh endpoint
          const user = await refreshSession(refreshToken);
          onSignIn(user);
        }
      }
    } catch {
      Alert.alert(
        t('No se pudo abrir', 'Could not open'),
        t('Inténtalo nuevamente en unos segundos.', 'Please try again in a few seconds.'),
      );
    }
  };

  const handleForgotPassword = async () => {
    // Ask for the email first
    Alert.alert(
      t('Recuperar contraseña', 'Recover password'),
      t(
        'Ingresa tu email para recibir un enlace de recuperación.',
        'Enter your email to receive a recovery link.',
      ),
      [
        { text: t('Cancelar', 'Cancel'), style: 'cancel' },
        {
          text: t('Enviar', 'Send'),
          onPress: async () => {
            const target = email.trim();
            if (!target) {
              Alert.alert(
                t('Email requerido', 'Email required'),
                t('Escribe tu email en el campo de arriba primero.', 'Write your email in the field above first.'),
              );
              return;
            }
            try {
              await forgotPasswordRequest(target);
              Alert.alert(
                t('¡Listo!', 'Done!'),
                t(
                  'Si existe una cuenta con ese email, recibirás un enlace en los próximos minutos.',
                  'If an account exists with that email, you will receive a link within the next few minutes.',
                ),
              );
            } catch {
              Alert.alert(
                t('Error', 'Error'),
                t('No pudimos procesar tu solicitud. Intenta de nuevo.', 'We could not process your request. Please try again.'),
              );
            }
          },
        },
      ],
    );
  };

  const handleFaceId = async () => {
    setError('');
    setBiometricLoading(true);
    try {
      const user = await signInWithBiometrics({
        prompt: t('Usa Face ID para entrar a LPTicket', 'Use Face ID to enter LPTicket'),
        cancel: t('Cancelar', 'Cancel'),
        fallback: t('Usar código', 'Use passcode'),
        noSavedLogin: t('Primero inicia sesión con email y contraseña para activar Face ID.', 'Sign in with email and password first to enable Face ID.'),
        unavailable: t('Face ID no está configurado en este dispositivo.', 'Face ID is not configured on this device.'),
        failed: t('No pudimos validar Face ID.', 'We could not verify Face ID.'),
      });
      onSignIn(user);
    } catch (err: any) {
      setError(err?.message || t('No pudimos validar Face ID.', 'We could not verify Face ID.'));
    } finally {
      setBiometricLoading(false);
    }
  };

  useEffect(() => {
    if (
      isRegister ||
      autoBiometricAttempted.current ||
      !biometricReady ||
      !hasSavedBiometricLogin ||
      biometricLoading ||
      loading
    ) {
      return;
    }

    autoBiometricAttempted.current = true;
    const timer = setTimeout(() => {
      handleFaceId();
    }, 300);

    return () => clearTimeout(timer);
  }, [isRegister, biometricReady, hasSavedBiometricLogin, biometricLoading, loading]);

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

            <TouchableOpacity style={[styles.faceButton, (!biometricReady || biometricLoading) && styles.faceButtonDisabled]} onPress={handleFaceId} disabled={biometricLoading} activeOpacity={0.86}>
              <Ionicons name="scan-outline" size={16} color={colors.orange} />
              <Text style={styles.faceText}>{biometricLoading ? t('Validando', 'Checking') : hasSavedBiometricLogin ? 'Face ID' : t('Activar Face ID', 'Enable Face ID')}</Text>
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
    fontWeight: '600',
    marginBottom: 7,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '600',
    marginBottom: 7,
    textAlign: 'center',
  },
  copy: {
    color: 'rgba(203,213,225,0.78)',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
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
    fontWeight: '600',
  },
  forgotText: {
    color: colors.orange,
    fontSize: 12,
    fontWeight: '600',
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
    fontWeight: '600',
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
  faceButtonDisabled: {
    opacity: 0.72,
  },
  faceText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
  },
});
