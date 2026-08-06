'use client';

import { create } from 'zustand';
import { authApi } from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  requiresPasswordReset: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string, tenantSlug?: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authApi.login(email, password, tenantSlug);
      const { accessToken, refreshToken, user } = response.data.data;

      localStorage.setItem('xe_access_token', accessToken);
      localStorage.setItem('xe_refresh_token', refreshToken);
      localStorage.setItem('xe_user', JSON.stringify(user));

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      const message = err.response?.data?.error?.message || err.response?.data?.message || 'Login failed. Please check credentials.';
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: message,
      });
      throw new Error(message);
    }
  },

  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('xe_refresh_token');
      await authApi.logout(refreshToken || undefined);
    } catch {
      // Ignore logout API errors
    } finally {
      localStorage.removeItem('xe_access_token');
      localStorage.removeItem('xe_refresh_token');
      localStorage.removeItem('xe_user');
      set({ user: null, isAuthenticated: false, error: null });
    }
  },

  setUser: (user: User | null) => {
    if (user) localStorage.setItem('xe_user', JSON.stringify(user));
    else localStorage.removeItem('xe_user');
    set({ user, isAuthenticated: !!user });
  },

  clearError: () => set({ error: null }),

  checkAuth: async () => {
    const token = localStorage.getItem('xe_access_token');
    const storedUserStr = localStorage.getItem('xe_user');
    
    let parsedStoredUser: User | null = null;
    try {
      if (storedUserStr) parsedStoredUser = JSON.parse(storedUserStr);
    } catch (e) {}

    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    try {
      const response = await authApi.verifyToken();
      const userData = response.data.data?.user || response.data?.user || {};
      const restoredUser: User = {
        id: userData.id || parsedStoredUser?.id || '',
        email: userData.email || parsedStoredUser?.email || '',
        firstName: userData.firstName || parsedStoredUser?.firstName || 'Logged In',
        lastName: userData.lastName || parsedStoredUser?.lastName || 'User',
        role: userData.role || parsedStoredUser?.role || 'PROCTOR',
        tenantId: userData.tenantId || parsedStoredUser?.tenantId || '',
        requiresPasswordReset: Boolean(userData.requiresPasswordReset),
      };
      
      localStorage.setItem('xe_user', JSON.stringify(restoredUser));
      set({
        user: restoredUser,
        isAuthenticated: true,
      });
    } catch {
      if (parsedStoredUser && token) {
        set({
          user: parsedStoredUser,
          isAuthenticated: true,
        });
      } else {
        localStorage.removeItem('xe_access_token');
        localStorage.removeItem('xe_refresh_token');
        localStorage.removeItem('xe_user');
        set({ isAuthenticated: false, user: null });
      }
    }
  },
}));
