/**
 * 인증 상태 관리 (Zustand)
 */
import { create } from 'zustand';
import { User } from '../types';
import * as authApi from '../api/auth';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  login: async (email, password) => {
    try {
      set({ isLoading: true, error: null });
      const response = await authApi.login({ email, password });
      set({ user: response.user, isLoading: false });
    } catch (error: any) {
      const errorMessage = error?.message || error.response?.data?.detail || '아이디 또는 비밀번호가 일치하지 않습니다.';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  register: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const response = await authApi.register(data);
      set({ user: response.user, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || '회원가입에 실패했습니다.';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true });
      // 먼저 사용자 정보를 즉시 null로 설정
      set({ user: null });
      await authApi.logout();
      set({ isLoading: false, error: null });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  loadUser: async () => {
    try {
      const user = await authApi.getCurrentUser();
      set({ user });
    } catch (error) {
      set({ user: null });
    }
  },
}));

