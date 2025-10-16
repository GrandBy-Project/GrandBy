/**
 * 연결 관리 API
 */
import apiClient from './client';

// ==================== 타입 정의 ====================
export enum ConnectionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REJECTED = 'rejected',
}

export interface ElderlySearchResult {
  user_id: string;
  name: string;
  email: string;
  phone_number?: string;
  is_already_connected: boolean;
  connection_status?: ConnectionStatus;
}

export interface ConnectionWithUserInfo {
  connection_id: string;
  status: ConnectionStatus;
  created_at: string;
  updated_at: string;
  
  // 상대방 정보
  user_id: string;
  name: string;
  email: string;
  phone_number?: string;
}

export interface ConnectionListResponse {
  active: ConnectionWithUserInfo[];
  pending: ConnectionWithUserInfo[];
  rejected: ConnectionWithUserInfo[];
}

export interface ConnectionResponse {
  connection_id: string;
  caregiver_id: string;
  elderly_id: string;
  status: ConnectionStatus;
  created_at: string;
}

// ==================== API 함수 ====================

/**
 * 어르신 검색 (이메일 또는 전화번호)
 */
export const searchElderly = async (query: string): Promise<ElderlySearchResult[]> => {
  const response = await apiClient.get(`/api/users/search`, {
    params: { query }
  });
  return response.data;
};

/**
 * 연결 요청 생성
 */
export const createConnection = async (
  elderly_phone_or_email: string
): Promise<ConnectionResponse> => {
  const response = await apiClient.post(`/api/users/connections`, {
    elderly_phone_or_email
  });
  return response.data;
};

/**
 * 내 연결 목록 조회
 */
export const getConnections = async (): Promise<ConnectionListResponse> => {
  const response = await apiClient.get(`/api/users/connections`);
  return response.data;
};

/**
 * 연결 수락 (어르신)
 */
export const acceptConnection = async (
  connection_id: string
): Promise<ConnectionResponse> => {
  const response = await apiClient.patch(`/api/users/connections/${connection_id}/accept`);
  return response.data;
};

/**
 * 연결 거절 (어르신)
 */
export const rejectConnection = async (
  connection_id: string
): Promise<ConnectionResponse> => {
  const response = await apiClient.patch(`/api/users/connections/${connection_id}/reject`);
  return response.data;
};

/**
 * 연결 요청 취소 (보호자)
 */
export const cancelConnection = async (connection_id: string): Promise<void> => {
  await apiClient.delete(`/api/users/connections/${connection_id}/cancel`);
};

/**
 * 연결 해제
 */
export const deleteConnection = async (connection_id: string): Promise<void> => {
  await apiClient.delete(`/api/users/connections/${connection_id}`);
};

/**
 * 연결된 어르신 목록 조회 (보호자용)
 */
export const getConnectedElderly = async (): Promise<any[]> => {
  const response = await apiClient.get(`/api/users/connected-elderly`);
  return response.data;
};


