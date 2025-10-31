/**
 * 전역 폰트 크기 상태 관리 (Zustand)
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface FontSizeState {
  fontSizeLevel: number; // 0=작게, 1=크게(기본), 2=더크게
  setFontSizeLevel: (level: number) => void;
  toggleFontSize: () => void;
  getFontSizeText: () => string;
}

export const useFontSizeStore = create<FontSizeState>()(
  persist(
    (set, get) => ({
      fontSizeLevel: 1, // 기본값: 크게

      setFontSizeLevel: (level) => set({ fontSizeLevel: level }),

      toggleFontSize: () => {
        const current = get().fontSizeLevel;
        set({ fontSizeLevel: (current + 1) % 3 }); // 0 -> 1 -> 2 -> 0 순환
      },

      getFontSizeText: () => {
        const level = get().fontSizeLevel;
        switch (level) {
          case 0: return '작게';
          case 1: return '크게';
          case 2: return '더크게';
          default: return '크게';
        }
      },
    }),
    {
      name: 'font-size-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

