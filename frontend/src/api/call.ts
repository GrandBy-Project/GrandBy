/**
 * Twilio REST API 클라이언트
 * 백엔드를 통해 전화 발신 기능 제공
 */

import apiClient from './client';

export interface MakeCallRequest {
  to_number: string;  // 전화번호 (+821012345678 형식)
  user_id: string;    // 사용자 ID
}

export interface MakeCallResponse {
  call_sid: string;
  status: string;
  to_number: string;
  message: string;
}

/**
 * 실시간 AI 대화 통화 시작 (WebSocket 기반)
 * 
 * 사용자의 전화번호로 전화를 걸고, WebSocket을 통해 실시간 AI 대화를 제공합니다.
 * STT → LLM → TTS 파이프라인을 통해 사용자와 자유롭게 대화할 수 있습니다.
 * 
 * @param toNumber - 전화번호 (+821012345678 형식)
 * @param userId - 사용자 ID
 * @returns 전화 발신 결과
 */
export const makeRealtimeAICall = async (
  toNumber: string,
  userId: string
): Promise<MakeCallResponse> => {
  const response = await apiClient.post<MakeCallResponse>(
    '/api/twilio/call',  // main.py의 WebSocket 기반 엔드포인트
    {
      to_number: toNumber,
      user_id: userId,
    }
  );
  return response.data;
};

// ==================== 자동 통화 스케줄 ====================

export interface CallSchedule {
  auto_call_enabled: boolean;
  scheduled_call_time: string | null;  // HH:MM 형식 (예: "14:30")
}

/**
 * 자동 통화 스케줄 설정 조회
 */
export const getCallSchedule = async (): Promise<CallSchedule> => {
  const response = await apiClient.get<CallSchedule>('/api/users/me/call-schedule');
  return response.data;
};

/**
 * 자동 통화 스케줄 설정 업데이트
 * 
 * @param schedule - 자동 통화 활성화 여부 및 예약 시간
 */
export const updateCallSchedule = async (schedule: CallSchedule): Promise<CallSchedule> => {
  const response = await apiClient.put<CallSchedule>('/api/users/me/call-schedule', schedule);
  return response.data;
};

// ==================== 통화 상태 조회 ====================

export interface CallStatus {
  call_sid: string;
  call_status: string;
  call_duration: number | null;
}

/**
 * 통화 상태 조회
 * 
 * @param callSid - 통화 ID
 * @returns 통화 상태 정보
 */
export const getCallStatus = async (callSid: string): Promise<CallStatus> => {
  const response = await apiClient.get<CallStatus>(`/api/calls/${callSid}`);
  return response.data;
};

// ==================== 통화 기록 상세 정보 ====================

export interface CallLog {
  call_id: string;
  elderly_id: string;
  call_status: string;
  call_start_time: string | null;
  call_end_time: string | null;
  call_duration: number | null;
  audio_file_url: string | null;
  conversation_summary: string | null;  // ⭐ 핵심: 통화 요약
  created_at: string;
}

/**
 * 통화 기록 상세 정보 조회 (요약 포함)
 * 
 * @param callId - 통화 ID (Call SID)
 * @returns 통화 기록 정보 (conversation_summary 포함)
 */
export const getCallLog = async (callId: string): Promise<CallLog> => {
  const response = await apiClient.get<CallLog>(`/api/calls/${callId}`);
  return response.data;
};

