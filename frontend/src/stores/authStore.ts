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

    const maxRetries = 3;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
        return;
      } catch (err: any) {
        lastErr = err;
        const status = err.response?.status;
        const isColdStart =
          !err.response ||
          status === 502 ||
          status === 503 ||
          status === 504 ||
          err.code === 'ECONNABORTED' ||
          err.message?.includes('timeout');

        // If it's a cold start error and we have retries left, wait 4s and retry silently
        if (isColdStart && attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, 4000));
          continue;
        }
        break;
      }
    }

    const err = lastErr;
    let message = err.response?.data?.error?.message || err.response?.data?.message;
    if (!message) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        message = 'Server cold-start timeout. Please wait a moment and click Login again.';
      } else if (err.response?.status === 502 || err.response?.status === 503 || err.response?.status === 504) {
        message = 'Server is finishing cold-start setup. Please click Login again in a few seconds.';
      } else if (!err.response) {
        message = 'Network error. Please check your connection or retry in a few seconds.';
      } else {
        message = 'Login failed. Please check credentials.';
      }
    }

    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: message,
    });
    throw new Error(message);
  },

  logout: async () => {
    try {
      const refreshToken = localStorage.getItem('xe_refresh_token');
      if (refreshToken) {
        await authApi.logout(refreshToken).catch(() => {});
      }
    } finally {
      localStorage.removeItem('xe_access_token');
      localStorage.removeItem('xe_refresh_token');
      localStorage.removeItem('xe_user');
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  setUser: (user: User | null) => {
    set({
      user,
      isAuthenticated: !!user,
    });
  },

  clearError: () => set({ error: null }),

  checkAuth: async () => {
    if (typeof window === 'undefined') return;

    const token = localStorage.getItem('xe_access_token');
    const savedUser = localStorage.getItem('xe_user');

    if (!token || !savedUser) {
      set({ user: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const parsedUser = JSON.parse(savedUser);
      set({
        user: parsedUser,
        isAuthenticated: true,
        isLoading: false,
      });

      // Verify session in background
      authApi
        .verifyToken()
        .then((res) => {
          if (res.data?.data) {
            const updatedUser = res.data.data;
            localStorage.setItem('xe_user', JSON.stringify(updatedUser));
            set({ user: updatedUser, isAuthenticated: true });
          }
        })
        .catch(() => {
          // Keep saved session if offline
        });
    } catch {
      localStorage.removeItem('xe_access_token');
      localStorage.removeItem('xe_refresh_token');
      localStorage.removeItem('xe_user');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
