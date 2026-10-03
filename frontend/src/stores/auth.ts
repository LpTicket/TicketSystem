'use client';

/**
 * useAuthStore (Zustand)
 * EN: Global auth state for the web — current user, login/register/logout,
 *     profile load/update, avatar upload, and the buyer/organizer view mode.
 *     Persists tokens in localStorage and hydrates the user from /auth/profile.
 * ES: Estado global de autenticación de la web — usuario actual, login/registro/
 *     logout, carga/actualización de perfil, subida de avatar y el modo de vista
 *     comprador/organizador. Persiste los tokens en localStorage e hidrata el
 *     usuario desde /auth/profile.
 */
import { create } from 'zustand';
import api from '@/lib/api';
import { User, AuthResponse } from '@/types';
import { clearSupportSession, getSupportSession, saveSupportSession, SupportSession } from '@/lib/supportSession';

export type UserMode = 'buyer' | 'organizer';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  mode: UserMode;
  supportSession: SupportSession | null;
  setMode: (mode: UserMode) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; password: string; firstName: string; lastName: string; idType?: string; idNumber?: string; phone?: string; role?: string }) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  startSupportSession: (userId: string) => Promise<void>;
  stopSupportSession: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  mode: (typeof window !== 'undefined' ? localStorage.getItem('userMode') as UserMode : 'buyer') || 'buyer',
  supportSession: null,

  setMode: (mode) => {
    localStorage.setItem('userMode', mode);
    set({ mode });
  },

  login: async (email, password) => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    clearSupportSession();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('cachedUser', JSON.stringify(data.user));
    set({ user: data.user, isAuthenticated: true, isLoading: false, supportSession: null });
  },

  register: async (formData) => {
    const { data } = await api.post<AuthResponse>('/auth/register', formData);
    clearSupportSession();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('cachedUser', JSON.stringify(data.user));
    set({ user: data.user, isAuthenticated: true, isLoading: false, supportSession: null });
  },

  logout: () => {
    clearSupportSession();
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('cachedUser');
    set({ user: null, isAuthenticated: false, isLoading: false, supportSession: null });
  },

  loadUser: async () => {
    try {
      const supportSession = getSupportSession();
      if (supportSession) {
        set({ user: supportSession.user, supportSession, isAuthenticated: true, isLoading: false, mode: 'buyer' });
        const { data } = await api.get<User>('/auth/profile');
        const updated = { ...supportSession, user: data };
        saveSupportSession(updated);
        set({ user: data, supportSession: updated, isAuthenticated: true, isLoading: false });
        return;
      }
      const token = localStorage.getItem('accessToken');
      if (!token) {
        set({ user: null, supportSession: null, isAuthenticated: false, isLoading: false });
        return;
      }
      // Hydrate instantly from cache so the UI never blocks on a network round-trip
      const cached = localStorage.getItem('cachedUser');
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as User;
          set({ user: parsed, isAuthenticated: true, isLoading: false });
        } catch {}
      }
      // Refresh in the background — update state when it arrives
      const { data } = await api.get<User>('/auth/profile');
      localStorage.setItem('cachedUser', JSON.stringify(data));
      set({ user: data, supportSession: null, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('cachedUser');
      set({ user: null, isAuthenticated: false, isLoading: false, supportSession: null });
    }
  },

  updateProfile: async (profileData) => {
    const { data } = await api.patch<User>('/auth/profile', profileData);
    const supportSession = getSupportSession();
    if (supportSession) {
      const updated = { ...supportSession, user: data };
      saveSupportSession(updated);
      set({ user: data, supportSession: updated });
    } else {
      localStorage.setItem('cachedUser', JSON.stringify(data));
      set({ user: data });
    }
  },
  
  uploadAvatar: async (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const { data } = await api.post<User>('/auth/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    set({ user: data });
  },

  setAuth: (user, accessToken, refreshToken) => {
    clearSupportSession();
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, isAuthenticated: true, isLoading: false, supportSession: null });
  },

  startSupportSession: async (userId) => {
    const { data } = await api.post<SupportSession>(`/admin/users/${userId}/support-session`);
    const session = { accessToken: data.accessToken, user: data.user };
    saveSupportSession(session);
    set({ user: data.user, supportSession: session, isAuthenticated: true, isLoading: false, mode: 'buyer' });
  },

  stopSupportSession: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) throw new Error('No hay sesión de administrador');
      const { data } = await api.post<AuthResponse>('/auth/refresh', { refreshToken });
      if (data.user.role !== 'admin') throw new Error('La cuenta ya no es administradora');
      clearSupportSession();
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('cachedUser', JSON.stringify(data.user));
      set({ user: data.user, supportSession: null, isAuthenticated: true, isLoading: false });
      return true;
    } catch {
      clearSupportSession();
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('cachedUser');
      set({ user: null, supportSession: null, isAuthenticated: false, isLoading: false });
      return false;
    }
  },
}));
