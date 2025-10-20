/**
 * OpenWeatherMap API 클라이언트
 * 실제 기기와 Emulator 모두 지원
 */
import axios from 'axios';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

// 디버깅: API 키 확인
console.log('🔑 Weather API Key:', OPENWEATHER_API_KEY ? `${OPENWEATHER_API_KEY.substring(0, 10)}...` : '❌ 없음');

// 개발 환경 확인
const isDevelopment = __DEV__;
const USE_MOCK_LOCATION = isDevelopment && !Constants.isDevice; // Emulator에서만 Mock 사용

console.log('🔍 위치 서비스 환경:');
console.log(`   - isDevelopment: ${isDevelopment}`);
console.log(`   - isDevice: ${Constants.isDevice}`);
console.log(`   - USE_MOCK_LOCATION: ${USE_MOCK_LOCATION}`);

export interface WeatherData {
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  feelsLike: number;
}

/**
 * GPS 위치 권한 요청 및 좌표 가져오기
 * - 실제 기기: GPS 사용
 * - Emulator: 설정된 가상 좌표 사용
 */
export const getLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    // 개발 환경(Emulator)에서는 Mock 좌표 사용
    if (USE_MOCK_LOCATION) {
      console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.warn('⚠️  [개발 모드] Emulator GPS 한계로 인한 Mock 좌표 사용');
      console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.warn('📍 사용 좌표: 서울 시청 (37.5665, 126.9780)');
      console.warn('');
      console.warn('🔍 Emulator GPS 상태:');
      console.warn('   - 권한: ✅ 허용됨');
      console.warn('   - GPS Provider: ❌ OFF 상태 (Emulator 한계)');
      console.warn('   - 해결: 실제 기기에서는 정상 GPS 작동');
      console.warn('');
      console.warn('✅ 실제 기기 배포 시:');
      console.warn('   - 이 Mock 좌표는 자동으로 비활성화됨');
      console.warn('   - 실제 GPS 좌표가 사용됨');
      console.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return {
        latitude: 37.5665,
        longitude: 126.9780,
      };
    }

    console.log('📍 위치 권한 요청 중...');
    
    // 1. 위치 권한 요청
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    console.log('📍 위치 권한 상태:', status);
    
    if (status !== 'granted') {
      console.log('⚠️ 위치 권한이 거부되었습니다.');
      return null;
    }

    console.log('📍 GPS 좌표 가져오는 중...');
    
    // 2. 현재 위치 가져오기 (타임아웃 10초)
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
    
    // 디버깅: 어디서 실행 중인지 표시
    const isAndroid = Platform.OS === 'android';
    const deviceType = isAndroid 
      ? 'Android'
      : 'iOS';
    
    console.log(`📍 [${deviceType}] 현재 좌표:`, latitude.toFixed(4), longitude.toFixed(4));

    return { latitude, longitude };
  } catch (error: any) {
    console.error('❌ 위치 가져오기 실패:', error.message || error);
    console.error('❌ 에러 전체:', JSON.stringify(error, null, 2));
    console.log('💡 해결 방법:');
    console.log('  1. Emulator Location 패널 열기 (우측 ... 버튼)');
    console.log('  2. 좌표 입력 (Lat: 37.5665, Lon: 126.9780)');
    console.log('  3. SET LOCATION 클릭');
    console.log('  4. Google Maps 앱에서 위치 확인');
    
    return null;
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
      throw new Error('OpenWeatherMap API 키가 설정되지 않았습니다. .env 파일을 확인하세요.');
    }

    console.log(`🌤️ 날씨 API 요청: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

    const response = await axios.get(`${BASE_URL}/weather`, {
      params: {
        lat: lat,
        lon: lon,
        appid: OPENWEATHER_API_KEY,
        units: 'metric', // 섭씨 온도
        lang: 'kr',      // 한국어 설명
      },
    });

    const data = response.data;

    const weatherData: WeatherData = {
      temperature: Math.round(data.main.temp),
      description: data.weather[0].description,
      icon: data.weather[0].icon,
      humidity: data.main.humidity,
      feelsLike: Math.round(data.main.feels_like),
    };

    console.log('✅ 날씨 정보:', `${weatherData.temperature}°C, ${weatherData.description}`);

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
    return weather;
  } catch (error) {
    console.error('❌ 위치 기반 날씨 로딩 실패:', error);
    return null;
  }
};

