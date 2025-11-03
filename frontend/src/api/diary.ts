/**
 * 다이어리 API 클라이언트
 * 일기 CRUD 기능
 */

import apiClient from './client';

export interface Diary {
  diary_id: string;
  user_id: string;
  author_id: string;
  call_id?: string | null;  // 통화 ID 추가
  date: string; // YYYY-MM-DD 형식
  title?: string | null;
  content: string;
  mood?: string | null; // happy, sad, calm, excited, angry 등
  author_type: 'elderly' | 'caregiver' | 'ai';
  is_auto_generated: boolean;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  comment_count?: number; // 댓글 개수
}

export interface DiaryCreate {
  date: string; // YYYY-MM-DD 형식
  title?: string;
  content: string;
  mood?: string;
  status?: 'draft' | 'published';
}

export interface DiaryUpdate {
  title?: string;
  content?: string;
  mood?: string;
  status?: 'draft' | 'published';
}

/**
 * 다이어리 목록 조회
 * 
 * @param params - 조회 옵션
 * @returns 다이어리 목록
 */
export const getDiaries = async (params?: {
  skip?: number;
  limit?: number;
  start_date?: string;
  end_date?: string;
  elderly_id?: string;
}): Promise<Diary[]> => {
  const response = await apiClient.get<Diary[]>('/api/diaries/', { params });
  return response.data;
};

/**
 * 다이어리 상세 조회
 * 
 * @param diaryId - 다이어리 ID
 * @returns 다이어리 상세 정보
 */
export const getDiary = async (diaryId: string): Promise<Diary> => {
  const response = await apiClient.get<Diary>(`/api/diaries/${diaryId}`);
  return response.data;
};

/**
 * 다이어리 작성
 * 
 * @param data - 다이어리 작성 데이터
 * @returns 생성된 다이어리 (보호자인 경우 여러 개)
 */
export const createDiary = async (data: DiaryCreate): Promise<Diary[]> => {
  const response = await apiClient.post<Diary[]>('/api/diaries/', data);
  return response.data;
};

/**
 * 다이어리 수정
 * 
 * @param diaryId - 다이어리 ID
 * @param data - 수정 데이터
 * @returns 수정된 다이어리
 */
export const updateDiary = async (diaryId: string, data: DiaryUpdate): Promise<Diary> => {
  const response = await apiClient.put<Diary>(`/api/diaries/${diaryId}`, data);
  return response.data;
};

/**
 * 다이어리 삭제
 * 
 * @param diaryId - 다이어리 ID
 * @returns 삭제 결과 메시지
 */
export const deleteDiary = async (diaryId: string): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>(`/api/diaries/${diaryId}`);
  return response.data;
};

// ==================== 댓글 API ====================

export interface DiaryComment {
  comment_id: string;
  user_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  user_name: string;
  user_role: string;
}

export interface CommentCreateRequest {
  content: string;
}

/**
 * 댓글 목록 조회
 * 
 * @param diaryId - 다이어리 ID
 * @returns 댓글 목록
 */
export const getComments = async (diaryId: string): Promise<DiaryComment[]> => {
  const response = await apiClient.get<DiaryComment[]>(`/api/diaries/${diaryId}/comments`);
  return response.data;
};

/**
 * 댓글 작성
 * 
 * @param diaryId - 다이어리 ID
 * @param data - 댓글 내용
 * @returns 생성된 댓글
 */
export const createComment = async (diaryId: string, data: CommentCreateRequest): Promise<DiaryComment> => {
  const response = await apiClient.post<DiaryComment>(`/api/diaries/${diaryId}/comments`, data);
  return response.data;
};

/**
 * 댓글 삭제
 * 
 * @param diaryId - 다이어리 ID
 * @param commentId - 댓글 ID
 * @returns 삭제 결과 메시지
 */
export const deleteComment = async (diaryId: string, commentId: string): Promise<{ message: string }> => {
  const response = await apiClient.delete<{ message: string }>(`/api/diaries/${diaryId}/comments/${commentId}`);
  return response.data;
};

