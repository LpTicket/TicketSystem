import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  apiGet,
  apiPatch,
  apiPost,
  AuthResponse,
  AuthUser,
  clearAuthTokens,
  setAuthTokens,
} from './api';

const TOKENS_KEY = 'lp_auth_tokens';
const USER_KEY = 'lp_auth_user';

async function persist(
  tokens: { accessToken: string; refreshToken: string },
  user: AuthUser,
) {
  try {
    await AsyncStorage.multiSet([
      [TOKENS_KEY, JSON.stringify(tokens)],
      [USER_KEY, JSON.stringify(user)],
    ]);
  } catch {
    /* storage unavailable — session just won't persist */
  }
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await apiPost<AuthResponse>('/auth/login', {
    email: email.trim(),
    password,
  });
  setAuthTokens(data.accessToken, data.refreshToken);
  await persist({ accessToken: data.accessToken, refreshToken: data.refreshToken }, data.user);
  return data.user;
}

export async function register(payload: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  lang?: 'es' | 'en';
}): Promise<AuthUser> {
  const username = `${payload.email.split('@')[0]}${Math.floor(Math.random() * 1000)}`;
  const data = await apiPost<AuthResponse>('/auth/register', {
    ...payload,
    email: payload.email.trim(),
    username,
    role: 'client',
  });
  setAuthTokens(data.accessToken, data.refreshToken);
  await persist({ accessToken: data.accessToken, refreshToken: data.refreshToken }, data.user);
  return data.user;
}

export async function fetchProfile(): Promise<AuthUser> {
  return apiGet<AuthUser>('/auth/profile');
}

export async function updateProfile(
  dto: Partial<AuthUser> & { password?: string; address?: string },
): Promise<AuthUser> {
  const user = await apiPatch<AuthUser>('/auth/profile', dto);
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
  return user;
}

/** Restore a saved session on app launch. Returns the user or null. */
export async function restoreSession(): Promise<AuthUser | null> {
  try {
    const tokensRaw = await AsyncStorage.getItem(TOKENS_KEY);
    if (!tokensRaw) return null;
    const tokens = JSON.parse(tokensRaw);
    setAuthTokens(tokens.accessToken, tokens.refreshToken);
    // Only restore a session that the backend still accepts. Otherwise the app
    // can show admin UI with a stale token and fail every admin request.
    try {
      const fresh = await fetchProfile();
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(fresh));
      return fresh;
    } catch {
      clearAuthTokens();
      await AsyncStorage.multiRemove([TOKENS_KEY, USER_KEY]);
      return null;
    }
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  clearAuthTokens();
  try {
    await AsyncStorage.multiRemove([TOKENS_KEY, USER_KEY]);
  } catch {
    /* ignore */
  }
}
