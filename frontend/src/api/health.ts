/**
 * 건강 데이터 관련 API
 * 걸음 수, 거리 등
 */
import apiClient from './client';

// 건강 데이터 타입 정의
export interface HealthData {
  health_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  step_count: number;
  distance: number; // 미터 단위
  created_at: string;
  updated_at: string;
}

export interface HealthDataCreate {
  step_count: number;
  distance: number;
}

export interface HealthDataUpdate {
  step_count?: number;
  distance?: number;
}

export interface HealthDataStats {
  date: string; // YYYY-MM-DD (백엔드에서 date 타입이 JSON으로 변환되면 string이 됨)
  step_count: number;
  distance: number;
}

export interface HealthDataRange {
  start_date: string; // YYYY-MM-DD (백엔드에서 date 타입이 JSON으로 변환되면 string이 됨)
  end_date: string; // YYYY-MM-DD
  total_steps: number;
  total_distance: number;
  average_steps: number;
  average_distance: number;
  daily_data: HealthDataStats[];
}

/**
 * 건강 데이터 생성 또는 업데이트
 * @param healthData 건강 데이터
 * @param targetDate 대상 날짜 (기본값: 오늘)
 * @param elderlyId 어르신 ID (보호자용, 선택사항)
 */
export const createOrUpdateHealthData = async (
  healthData: HealthDataCreate,
  targetDate?: string,
  elderlyId?: string
): Promise<HealthData> => {
  const params: any = {};
  if (targetDate) params.target_date = targetDate;
  if (elderlyId) params.elderly_id = elderlyId;

  const response = await apiClient.post<HealthData>('/api/health/', healthData, { params });
  return response.data;
};

/**
 * 건강 데이터 조회 (오늘 또는 특정 날짜)
 * @param targetDate 조회할 날짜 (기본값: 오늘)
 * @param elderlyId 어르신 ID (보호자용, 선택사항)
 */
export const getHealthData = async (
  targetDate?: string,
  elderlyId?: string
): Promise<HealthData | null> => {
  const params: any = {};
  if (targetDate) params.target_date = targetDate;
  if (elderlyId) params.elderly_id = elderlyId;

  const response = await apiClient.get<HealthData | null>('/api/health/', { params });
  return response.data;
};

/**
 * 오늘의 건강 데이터 조회
 * @param elderlyId 어르신 ID (보호자용, 선택사항)
 */
export const getTodayHealthData = async (elderlyId?: string): Promise<HealthData | null> => {
  const params: any = {};
  if (elderlyId) params.elderly_id = elderlyId;

  const response = await apiClient.get<HealthData | null>('/api/health/today', { params });
  return response.data;
};

/**
 * 기간별 건강 데이터 조회 및 통계
 * @param startDate 시작 날짜 (YYYY-MM-DD)
 * @param endDate 종료 날짜 (YYYY-MM-DD)
 * @param elderlyId 어르신 ID (보호자용, 선택사항)
 */
export const getHealthDataRange = async (
  startDate: string,
  endDate: string,
  elderlyId?: string
): Promise<HealthDataRange> => {
  const params: any = {
    start_date: startDate,
    end_date: endDate,
  };
  if (elderlyId) params.elderly_id = elderlyId;

  const response = await apiClient.get<HealthDataRange>('/api/health/range', { params });
  return response.data;
};

/**
 * 건강 데이터 업데이트 (부분 업데이트)
 * @param healthData 업데이트할 건강 데이터
 * @param targetDate 대상 날짜 (기본값: 오늘)
 * @param elderlyId 어르신 ID (보호자용, 선택사항)
 */
export const updateHealthData = async (
  healthData: HealthDataUpdate,
  targetDate?: string,
  elderlyId?: string
): Promise<HealthData> => {
  const params: any = {};
  if (targetDate) params.target_date = targetDate;
  if (elderlyId) params.elderly_id = elderlyId;

  const response = await apiClient.put<HealthData>('/api/health/', healthData, { params });
  return response.data;
};

