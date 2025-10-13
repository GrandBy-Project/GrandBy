/**
 * 인증 관련 API
 */
import apiClient, { TokenManager } from './client';
import { AuthResponse, LoginRequest, RegisterRequest } from '../types';

/**
 * 회원가입
 */
export const register = async (data: RegisterRequest): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/api/auth/register', data);
  
  // 새로운 TokenManager 사용
  await TokenManager.saveTokens(response.data.access_token, response.data.refresh_token);
  
  return response.data;
};

/**
 * 로그인
 */
export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  const response = await apiClient.post<AuthResponse>('/api/auth/login', data);
  
  // 새로운 TokenManager 사용
  await TokenManager.saveTokens(response.data.access_token, response.data.refresh_token);
  
  return response.data;
};

/**
 * 로그아웃
 */
export const logout = async (): Promise<void> => {
  await TokenManager.clearTokens();
};

/**
 * 저장된 사용자 정보 가져오기
 */
export const getCurrentUser = async () => {
  const tokens = await TokenManager.getTokens();
  if (!tokens) return null;
  
  // 사용자 정보는 토큰 검증으로 가져오기
  try {
    return await verifyToken();
  } catch {
    return null;
  }
};

/**
 * 인증 상태 확인
 */
export const isAuthenticated = async (): Promise<boolean> => {
  return await TokenManager.isAccessTokenValid();
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
  
  // 새로운 TokenManager 사용
  await TokenManager.saveTokens(response.data.access_token, response.data.refresh_token);
  
  return response.data;
};


