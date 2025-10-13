/**
 * 인증 관련 API
 */
import apiClient from './client';
import { AuthResponse, LoginRequest, RegisterRequest } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 회원가입
 */
export const register = async (data: RegisterRequest): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/api/auth/register', data);
  
  // 토큰 저장
  await AsyncStorage.setItem('access_token', response.data.access_token);
  await AsyncStorage.setItem('refresh_token', response.data.refresh_token);
  await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
  
  return response.data;
};

/**
 * 로그인
 */
export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/api/auth/login', data);
  
  // 토큰 저장
  await AsyncStorage.setItem('access_token', response.data.access_token);
  await AsyncStorage.setItem('refresh_token', response.data.refresh_token);
  await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
  
  return response.data;
};

/**
 * 로그아웃
 */
export const logout = async (): Promise<void> => {
  await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
};

/**
 * 저장된 사용자 정보 가져오기
 */
export const getCurrentUser = async () => {
  const userStr = await AsyncStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

/**
 * 인증 상태 확인
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const token = await AsyncStorage.getItem('access_token');
  return !!token;
};

/**
 * 토큰 검증 (스플래쉬에서 사용)
 */
export const verifyToken = async () => {
  const response = await apiClient.get('/api/auth/verify');
  return response.data;
};

/**
 * 토큰 갱신
 */
export const refreshToken = async (refreshToken: string) => {
  const response = await apiClient.post('/api/auth/refresh', {
    refresh_token: refreshToken,
    device_id: 'mobile-app',
  });
  
  // 새 토큰 저장
  await AsyncStorage.setItem('access_token', response.data.access_token);
  await AsyncStorage.setItem('refresh_token', response.data.refresh_token);
  await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
  
  return response.data;
};

