/**
 * 전역 에러 상태 관리 (Zustand)
 * API 에러를 중앙에서 관리하고 GlobalAlertProvider에서 표시
 */
import { create } from 'zustand';

interface ErrorState {
  error: {
    title: string;
    message: string;
  } | null;
  currentPath: string; // 현재 경로 추적
  setError: (title: string, message: string) => void;
  clearError: () => void;
  setCurrentPath: (path: string) => void;
}

export const useErrorStore = create<ErrorState>((set) => ({
  error: null,
  currentPath: '',
  setError: (title, message) => set({ error: { title, message } }),
  clearError: () => set({ error: null }),
  setCurrentPath: (path) => set({ currentPath: path }),
}));

