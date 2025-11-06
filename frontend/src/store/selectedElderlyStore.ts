/**
 * 선택된 어르신 정보 전역 상태 관리 (Zustand)
 * 보호자가 메인 화면에서 선택한 어르신을 다른 페이지에서도 사용하기 위함
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SelectedElderlyState {
  selectedElderlyId: string | null;
  selectedElderlyName: string | null;
  
  // Actions
  setSelectedElderly: (elderlyId: string | null, elderlyName: string | null) => void;
  clearSelectedElderly: () => void;
}

export const useSelectedElderlyStore = create<SelectedElderlyState>()(
  persist(
    (set) => ({
      selectedElderlyId: null,
      selectedElderlyName: null,
      
      setSelectedElderly: (elderlyId, elderlyName) => {
        set({ 
          selectedElderlyId: elderlyId, 
          selectedElderlyName: elderlyName 
        });
      },
      
      clearSelectedElderly: () => {
        set({ 
          selectedElderlyId: null, 
          selectedElderlyName: null 
        });
      },
    }),
    {
      name: 'selected-elderly-storage', // AsyncStorage 키
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

