import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { login, logout } from './auth';
import { AuthUser } from './api';

const BIOMETRIC_CREDENTIALS_KEY = 'lp_biometric_credentials';

type StoredCredentials = {
  email: string;
  password: string;
};

export async function getBiometricAvailability() {
  try {
    const [hasHardware, enrolled, types, saved] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
      SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY),
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

export async function saveBiometricLogin(email: string, password: string) {
  const credentials: StoredCredentials = {
    email: email.trim(),
    password,
  };

  await SecureStore.setItemAsync(BIOMETRIC_CREDENTIALS_KEY, JSON.stringify(credentials), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
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

  const raw = await SecureStore.getItemAsync(BIOMETRIC_CREDENTIALS_KEY);
  if (!raw) {
    throw new Error(copy.noSavedLogin);
  }

  const credentials = JSON.parse(raw) as StoredCredentials;
  return login(credentials.email, credentials.password);
}

export async function clearBiometricLogin() {
  await SecureStore.deleteItemAsync(BIOMETRIC_CREDENTIALS_KEY);
  await logout();
}
