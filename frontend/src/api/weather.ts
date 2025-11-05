/**
 * OpenWeatherMap API 클라이언트
 * 실제 기기와 Emulator 모두 지원
 */
import axios from 'axios';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// OpenWeatherMap API 키 (하드코딩 - 클라이언트 노출되지만 날씨 정보만 제공하므로 보안 문제 없음)
const OPENWEATHER_API_KEY = '24cda4505796412dfad4647a6119adfa';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// 디버깅: API 키 확인
console.log('🔑 Weather API Key:', OPENWEATHER_API_KEY ? `${OPENWEATHER_API_KEY.substring(0, 10)}...` : '❌ 없음');

// 개발 환경 확인
const isDevelopment = __DEV__;

// Emulator 감지: Android의 경우 여러 방법으로 체크
const isDeviceValue = Constants.isDevice;
const platformConstants = Platform.constants as any;
const fingerprint = platformConstants?.Fingerprint || '';
const brand = platformConstants?.Brand || '';
const product = platformConstants?.Product || '';
const model = platformConstants?.Model || '';

// Constants.isDevice가 undefined면 다른 방법으로 판단
let isRealDevice = false;

if (isDeviceValue === undefined) {
  // isDevice가 undefined인 경우, Fingerprint와 Brand로 판단
  const isGenericEmulator = fingerprint.toLowerCase().includes('generic') || 
                           brand.toLowerCase().includes('generic') ||
                           product.toLowerCase().includes('sdk') ||
                           model.toLowerCase().includes('sdk');
  isRealDevice = !isGenericEmulator;
} else {
  // isDevice 값이 있으면 그대로 사용
  isRealDevice = isDeviceValue === true;
}

const isEmulator = !isRealDevice;
const USE_MOCK_LOCATION = isDevelopment && isEmulator;

// 환경 정보 (간단)
console.log(`🔍 환경: ${isRealDevice ? '실제 기기' : 'Emulator'} | GPS: ${USE_MOCK_LOCATION ? 'Mock' : '실제'}`);

export interface WeatherData {
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  feelsLike: number;
  location?: string; // 시/구 수준 위치
  cityName?: string; // 도시 이름
  countryCode?: string; // 국가 코드
  hasPermission?: boolean; // 위치 권한 여부
}

/**
 * GPS 위치 권한 요청 및 좌표 가져오기
 * - 실제 기기: GPS 사용
 * - Emulator: Mock 좌표 사용
 */
export const getLocation = async (): Promise<{ latitude: number; longitude: number; hasPermission: boolean } | null> => {
  try {
    // 개발 환경(Emulator)에서는 Mock 좌표 사용
    if (USE_MOCK_LOCATION) {
      console.log('📍 Mock 좌표 사용: 서울 시청');
      return {
        latitude: 37.5665,
        longitude: 126.9780,
        hasPermission: true, // Emulator에서는 권한 있음으로 처리
      };
    }

    // 1. 위치 권한 확인
    const { status } = await Location.getForegroundPermissionsAsync();
    console.log(`🔐 현재 위치 권한 상태: ${status}`);
    
    // 권한이 없으면 요청
    if (status !== 'granted') {
      console.log('🔐 위치 권한 요청 중...');
      const requestResult = await Location.requestForegroundPermissionsAsync();
      if (requestResult.status !== 'granted') {
        console.log('⚠️ 위치 권한 거부됨');
        console.log('📍 Fallback 좌표 사용: 서울 시청');
        return {
          latitude: 37.5665,
          longitude: 126.9780,
          hasPermission: false,
        };
      }
      console.log('✅ 위치 권한 허용됨');
    } else {
      console.log('✅ 위치 권한 이미 허용됨');
    }
    
    // 2. 현재 위치 가져오기 (타임아웃 10초)
    try {
      const location = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // 배터리 효율적
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => {
            console.log('⏱️ GPS 타임아웃 (10초 초과)');
            reject(new Error('GPS timeout after 10 seconds'));
          }, 10000)
        )
      ]);

      const { latitude, longitude } = location.coords;
      console.log(`📍 GPS 좌표: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);

      return { latitude, longitude, hasPermission: true };
    } catch (timeoutError) {
      // GPS 타임아웃 시 fallback 좌표 사용 (권한은 있지만 GPS 실패)
      console.log('⚠️ GPS 타임아웃, 서울 시청 좌표 사용 (Fallback)');
      return {
        latitude: 37.5665,
        longitude: 126.9780,
        hasPermission: true, // 권한은 있지만 GPS 실패
      };
    }
  } catch (error: any) {
    console.error('❌ GPS 오류:', error.message || error);
    // GPS 오류 시 fallback 좌표 사용
    console.log('⚠️ GPS 오류, 서울 시청 좌표 사용 (Fallback)');
    return {
      latitude: 37.5665,
      longitude: 126.9780,
      hasPermission: false, // 오류 발생 시 권한 없음으로 간주
    };
  }
};

/**
 * 영어 지명을 한글로 변환
 */
const translateToKorean = (text: string): string => {
  const translations: Record<string, string> = {
    // 시/도
    'Seoul': '서울특별시',
    'Busan': '부산광역시',
    'Incheon': '인천광역시',
    'Daegu': '대구광역시',
    'Daejeon': '대전광역시',
    'Gwangju': '광주광역시',
    'Ulsan': '울산광역시',
    'Sejong': '세종특별자치시',
    'Gyeonggi-do': '경기도',
    'Gangwon-do': '강원도',
    'North Chungcheong': '충청북도',
    'South Chungcheong': '충청남도',
    'North Jeolla': '전라북도',
    'South Jeolla': '전라남도',
    'North Gyeongsang': '경상북도',
    'South Gyeongsang': '경상남도',
    'Jeju-do': '제주특별자치도',
    
    // 서울 구
    'Gangnam-gu': '강남구',
    'Gangdong-gu': '강동구',
    'Gangbuk-gu': '강북구',
    'Gangseo-gu': '강서구',
    'Gwanak-gu': '관악구',
    'Gwangjin-gu': '광진구',
    'Guro-gu': '구로구',
    'Geumcheon-gu': '금천구',
    'Nowon-gu': '노원구',
    'Dobong-gu': '도봉구',
    'Dongdaemun-gu': '동대문구',
    'Dongjak-gu': '동작구',
    'Mapo-gu': '마포구',
    'Seodaemun-gu': '서대문구',
    'Seocho-gu': '서초구',
    'Seongdong-gu': '성동구',
    'Seongbuk-gu': '성북구',
    'Songpa-gu': '송파구',
    'Yangcheon-gu': '양천구',
    'Yeongdeungpo-gu': '영등포구',
    'Yongsan-gu': '용산구',
    'Eunpyeong-gu': '은평구',
    'Jongno-gu': '종로구',
    'Jung-gu': '중구',
    'Jungnang-gu': '중랑구',
  };
  
  return translations[text] || text;
};

/**
 * 좌표를 시/구 주소로 변환 (Reverse Geocoding)
 * @param lat 위도
 * @param lon 경도
 * @returns 시/구 수준 주소 (예: "서울특별시 서초구")
 */
const getLocationName = async (lat: number, lon: number): Promise<string> => {
  try {
    // OpenWeatherMap Geocoding API 사용
    const response = await axios.get('http://api.openweathermap.org/geo/1.0/reverse', {
      params: {
        lat: lat,
        lon: lon,
        limit: 1,
        appid: OPENWEATHER_API_KEY,
      },
    });

    if (response.data && response.data.length > 0) {
      const location = response.data[0];
      const state = location.state || ''; // 시/도
      const name = location.name || '';   // 구/군
      
      // 한글로 변환
      const stateKo = translateToKorean(state);
      const nameKo = translateToKorean(name);
      
      // 한국의 경우 "시/도 + 구/군" 형태로 반환
      if (stateKo && nameKo) {
        const result = `${stateKo} ${nameKo}`;
        console.log(`   📍 위치: ${result}`);
        return result;
      } else if (stateKo) {
        console.log(`   📍 위치: ${stateKo}`);
        return stateKo;
      } else if (nameKo) {
        console.log(`   📍 위치: ${nameKo}`);
        return nameKo;
      }
    }
    
    return ''; // 변환 실패 시 빈 문자열
  } catch (error) {
    console.error('❌ Geocoding 실패:', error);
    return '';
  }
};

/**
 * 현재 날씨 정보 가져오기
 * @param lat 위도
 * @param lon 경도
 * @returns WeatherData
 */
export const getCurrentWeather = async (
  lat: number,
  lon: number
): Promise<WeatherData> => {
  try {
    if (!OPENWEATHER_API_KEY) {
      throw new Error('OpenWeatherMap API 키가 설정되지 않았습니다.');
    }

    // 1. 날씨 정보 가져오기
    const weatherResponse = await axios.get(`${BASE_URL}/weather`, {
      params: {
        lat: lat,
        lon: lon,
        appid: OPENWEATHER_API_KEY,
        units: 'metric',
        lang: 'kr',
      },
    });

    const data = weatherResponse.data;
    
    // 2. 주소 변환 (Geocoding)
    const locationDisplay = await getLocationName(lat, lon);

    const weatherData: WeatherData = {
      temperature: Math.round(data.main.temp),
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      humidity: data.main.humidity,
      feelsLike: Math.round(data.main.feels_like),
      location: locationDisplay,
      cityName: data.name || '',
      countryCode: data.sys?.country || '',
    };

    console.log(`🌤️ 날씨: ${locationDisplay || ''} ${weatherData.temperature}°C, ${weatherData.description}`);

    return weatherData;
  } catch (error: any) {
    console.error('❌ 날씨 API 호출 실패:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * 위치 기반 날씨 정보 가져오기 (원스톱 함수)
 * - GPS 좌표 획득 + 날씨 API 호출을 한 번에 처리
 */
export const getLocationBasedWeather = async (): Promise<WeatherData | null> => {
  try {
    // 1. 위치 가져오기
    const location = await getLocation();
    if (!location) {
      console.log('⚠️ 위치를 가져올 수 없어 날씨 정보를 불러오지 못했습니다.');
      return null;
    }

    // 2. 날씨 정보 가져오기
    const weather = await getCurrentWeather(location.latitude, location.longitude);
    // 위치 권한 정보 추가
    weather.hasPermission = location.hasPermission;
    return weather;
  } catch (error) {
    console.error('❌ 위치 기반 날씨 로딩 실패:', error);
    return null;
  }
};
