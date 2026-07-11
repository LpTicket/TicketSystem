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

export type UserMode = 'buyer' | 'organizer';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  mode: UserMode;
  setMode: (mode: UserMode) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; username: string; password: string; firstName: string; lastName: string; idType?: string; idNumber?: string; phone?: string; role?: string }) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  mode: (typeof window !== 'undefined' ? localStorage.getItem('userMode') as UserMode : 'buyer') || 'buyer',

  setMode: (mode) => {
    localStorage.setItem('userMode', mode);
    set({ mode });
  },

  login: async (email, password) => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('cachedUser', JSON.stringify(data.user));
    set({ user: data.user, isAuthenticated: true, isLoading: false });
  },

  register: async (formData) => {
    const { data } = await api.post<AuthResponse>('/auth/register', formData);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('cachedUser', JSON.stringify(data.user));
    set({ user: data.user, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('cachedUser');
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  loadUser: async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        set({ isLoading: false });
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
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('cachedUser');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  updateProfile: async (profileData) => {
    const { data } = await api.patch<User>('/auth/profile', profileData);
    localStorage.setItem('cachedUser', JSON.stringify(data));
    set({ user: data });
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
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, isAuthenticated: true, isLoading: false });
  },
}));
