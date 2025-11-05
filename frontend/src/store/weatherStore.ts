/**
 * 날씨 정보 전역 상태 관리 (Zustand with persist)
 * AsyncStorage를 사용하여 날씨 데이터 캐싱
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface WeatherData {
  temperature?: number;
  description?: string;
  location?: string;
  hasPermission?: boolean;
  lastUpdated?: number; // 마지막 업데이트 시간 (timestamp)
}

interface WeatherState {
  weather: WeatherData;
  isLoading: boolean;
  
  setWeather: (data: WeatherData) => void;
  setLoading: (isLoading: boolean) => void;
  clearWeather: () => void;
  
  // 캐시 만료 확인 (기본 10분)
  isCachedWeatherValid: (expireMinutes?: number) => boolean;
  
  // 날씨 정보가 있는지 확인
  hasWeather: () => boolean;
}

const CACHE_EXPIRE_MINUTES = 10;

export const useWeatherStore = create<WeatherState>()(
  persist(
    (set, get) => ({
      weather: {},
      isLoading: false,

      setWeather: (data) => {
        set({ 
          weather: { 
            ...data, 
            lastUpdated: Date.now() 
          } 
        });
      },

      setLoading: (isLoading) => set({ isLoading }),

      clearWeather: () => set({ weather: {}, isLoading: false }),

      // 캐시된 날씨가 유효한지 확인
      isCachedWeatherValid: (expireMinutes = CACHE_EXPIRE_MINUTES) => {
        const { weather } = get();
        
        // 날씨 데이터가 없으면 유효하지 않음
        if (!weather.lastUpdated) {
          return false;
        }
        
        // 만료 시간 체크
        const elapsedMinutes = (Date.now() - weather.lastUpdated) / (1000 * 60);
        return elapsedMinutes < expireMinutes;
      },

      // 날씨 정보가 있는지 확인
      hasWeather: () => {
        const { weather } = get();
        return weather.temperature !== undefined && weather.temperature !== null;
      },
    }),
    {
      name: 'weather-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // lastUpdated는 persist에서 자동 직렬화/역직렬화됨
    }
  )
);

