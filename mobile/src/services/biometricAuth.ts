import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { apiPost, AuthUser, AuthResponse, setAuthTokens } from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BIOMETRIC_TOKEN_KEY = 'lp_biometric_refresh_token';
const TOKENS_KEY = 'lp_auth_tokens';
const USER_KEY = 'lp_auth_user';

export async function getBiometricAvailability() {
  try {
    const [hasHardware, enrolled, types, saved] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY),
    ]);

    return {
      hasHardware,
      enrolled,
      hasSavedLogin: Boolean(saved),
      supportsFaceId: types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION),
    };
  } catch {
    return {
      hasHardware: false,
      enrolled: false,
      hasSavedLogin: false,
      supportsFaceId: false,
    };
  }
}

/**
 * Saves the refresh token (NOT the password) into SecureStore for later
 * biometric login. Called right after a successful email/password login.
 */
export async function saveBiometricLogin(refreshToken: string) {
  try {
    // keychainAccessible is iOS/Android only — web falls back to localStorage
    await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, refreshToken, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    } as any);
  } catch {
    // Fallback for web where the option is unsupported
    await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, refreshToken);
  }
}

export async function signInWithBiometrics(copy: {
  prompt: string;
  cancel: string;
  fallback: string;
  noSavedLogin: string;
  unavailable: string;
  failed: string;
}): Promise<AuthUser> {
  const availability = await getBiometricAvailability();
  if (!availability.hasHardware || !availability.enrolled) {
    throw new Error(copy.unavailable);
  }

  if (!availability.hasSavedLogin) {
    throw new Error(copy.noSavedLogin);
  }

  const auth = await LocalAuthentication.authenticateAsync({
    promptMessage: copy.prompt,
    cancelLabel: copy.cancel,
    fallbackLabel: copy.fallback,
    disableDeviceFallback: false,
  });

  if (!auth.success) {
    throw new Error(copy.failed);
  }

  const storedRefreshToken = await SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
  if (!storedRefreshToken) {
    throw new Error(copy.noSavedLogin);
  }

  // Exchange the refreshToken for new tokens — never exposes the user password
  const data = await apiPost<AuthResponse>('/auth/refresh', { refreshToken: storedRefreshToken });
  setAuthTokens(data.accessToken, data.refreshToken);

  // Persist new tokens
  try {
    await AsyncStorage.multiSet([
      [TOKENS_KEY, JSON.stringify({ accessToken: data.accessToken, refreshToken: data.refreshToken })],
      [USER_KEY, JSON.stringify(data.user)],
    ]);
    // Keep SecureStore up to date with the latest refresh token
    try {
      await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, data.refreshToken, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      } as any);
    } catch {
      await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, data.refreshToken);
    }
  } catch {
    /* storage unavailable */
  }

  return data.user;
}

export async function clearBiometricLogin() {
  await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
}
