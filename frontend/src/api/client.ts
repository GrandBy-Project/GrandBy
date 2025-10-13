/**
 * API 클라이언트 설정
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL (개발 환경)
// TODO: 실제 배포 시에는 환경 변수로 관리
export const API_BASE_URL = 'http://192.168.0.161:8000'; // PC의 실제 IP로 변경 필요

// Axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터: 토큰 자동 추가
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 응답 인터셉터: 에러 처리
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // 토큰 만료 시 로그아웃 처리
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
      // TODO: 로그인 화면으로 리다이렉트
    }
    return Promise.reject(error);
  }
);

export default apiClient;

