/**
 * API 클라이언트 설정
 * 토큰 자동 갱신 (슬라이딩 윈도우) 포함
 * 
 * 🔧 팀 개발을 위한 환경 변수 기반 설정
 * 
 * 사용법:
 * 1. frontend/.env 파일 생성
 * 2. EXPO_PUBLIC_API_BASE_URL 설정
 * 3. 각자 개발 환경에 맞게 URL 설정
 * 
 * 예시:
 * - 로컬 개발: http://localhost:8000
 * - Ngrok 사용: https://abc123.ngrok-free.dev
 * - 팀 공용: https://team-shared.ngrok-free.dev
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ==================== API Base URL 설정 ====================
const getApiBaseUrl = () => {
  // 1. 환경 변수 우선 사용 (개발자별 설정)
  // frontend/.env 파일에서 EXPO_PUBLIC_API_BASE_URL 설정
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    console.log('🔗 환경 변수에서 API URL 사용:', process.env.EXPO_PUBLIC_API_BASE_URL);
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  
  // 2. 프로덕션 환경
  if (!__DEV__) {
    return 'https://api.grandby.com'; // 실제 프로덕션 URL
  }
  
  // 3. 개발 환경: Expo 개발 서버의 호스트 자동 감지
  // exp.direct는 Expo 터널이므로 백엔드 주소로 사용 불가
const debuggerHost = Constants.expoConfig?.hostUri?.split(':').shift();
if (debuggerHost && debuggerHost !== 'localhost' && !debuggerHost.includes('exp.direct')) {
  console.log('🔗 자동 감지된 API URL:', `http://${debuggerHost}:8000`);
  return `http://${debuggerHost}:8000`;
}
  
  // 4. Fallback: 로컬 개발 (백엔드를 직접 실행한 경우)
  console.log('🔗 Fallback 로컬 API URL 사용');
  return 'http://localhost:8000';
};

export const API_BASE_URL = getApiBaseUrl();

// 개발 환경에서 URL 로깅
if (__DEV__) {
  console.log('🔗 API Base URL:', API_BASE_URL);
}

// ==================== Axios 인스턴스 생성 ====================
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30초 (AI 처리 고려)
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== 토큰 관리 유틸리티 ====================
export const TokenManager = {
  async getTokens() {
    const tokensStr = await AsyncStorage.getItem('auth_tokens');
    return tokensStr ? JSON.parse(tokensStr) : null;
  },

  async saveTokens(accessToken: string, refreshToken: string) {
    const tokens = {
      access_token: accessToken,
      refresh_token: refreshToken,
      access_expires_at: Date.now() + 30 * 60 * 1000, // 30분
      refresh_expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7일
    };
    await AsyncStorage.setItem('auth_tokens', JSON.stringify(tokens));
  },

  async clearTokens() {
    await AsyncStorage.multiRemove(['auth_tokens', 'user']);
  },

  async isAccessTokenValid() {
    const tokens = await this.getTokens();
    if (!tokens) return false;
    return Date.now() < tokens.access_expires_at;
  },

  async isRefreshTokenValid() {
    const tokens = await this.getTokens();
    if (!tokens) return false;
    return Date.now() < tokens.refresh_expires_at;
  },
};

// 갱신 중 플래그 (중복 요청 방지)
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ==================== 요청 인터셉터 ====================
apiClient.interceptors.request.use(
  async (config) => {
    const tokens = await TokenManager.getTokens();
    
    if (tokens?.access_token) {
      config.headers.Authorization = `Bearer ${tokens.access_token}`;
    }
    
    // 개발 환경에서 요청 로깅
    if (__DEV__) {
      console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ==================== 응답 인터셉터 (자동 갱신) ====================
apiClient.interceptors.response.use(
  (response) => {
    // 개발 환경에서 응답 로깅
    if (__DEV__) {
      console.log(`📥 ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // 네트워크 연결 실패
    if (!error.response) {
      console.error('❌ 네트워크 연결 실패:', error.message);
      return Promise.reject({
        message: '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.'
      });
    }
    
    const status = error.response?.status;
    
    // 401: Access Token 만료 → 자동 갱신 시도
    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // 이미 갱신 중이면 대기
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        }).catch((err) => {
          return Promise.reject(err);
        });
      }
      
      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        const tokens = await TokenManager.getTokens();
        
        if (!tokens?.refresh_token) {
          throw new Error('No refresh token');
        }
        
        // Refresh Token으로 새 토큰 발급
        const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
          refresh_token: tokens.refresh_token,
          device_id: 'mobile-app', // TODO: 실제 device ID 사용
        });
        
        const { access_token, refresh_token } = response.data;
        
        // 새 토큰 저장 (슬라이딩: 만료 시간 +7일)
        await TokenManager.saveTokens(access_token, refresh_token);
        
        // 대기 중인 요청들 처리
        processQueue(null, access_token);
        
        // 원래 요청 재시도
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        isRefreshing = false;
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        // 갱신 실패 → 로그아웃
        processQueue(refreshError, null);
        await TokenManager.clearTokens();
        isRefreshing = false;
        
        return Promise.reject({
          message: '로그인이 만료되었습니다. 다시 로그인해주세요.',
          shouldLogout: true
        });
      }
    }
    
    // 403: 권한 없음
    if (status === 403) {
      return Promise.reject({
        message: '접근 권한이 없습니다.'
      });
    }
    
    // 404: 찾을 수 없음
    if (status === 404) {
      return Promise.reject({
        message: '요청하신 리소스를 찾을 수 없습니다.'
      });
    }
    
    // 429: Too Many Requests
    if (status === 429) {
      return Promise.reject({
        message: error.response.data?.detail || '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    // 500: 서버 오류
    if (status >= 500) {
      console.error('❌ 서버 오류:', error.response.data);
      return Promise.reject({
        message: '서버에 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
      });
    }
    
    // 기타 에러
    return Promise.reject(error);
  }
);

export default apiClient;
