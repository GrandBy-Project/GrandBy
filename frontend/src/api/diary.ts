/**
 * 다이어리 API 클라이언트
 * 일기 CRUD 기능
 */

import apiClient from './client';

export interface Diary {
  diary_id: string;
  user_id: string;
  author_id: string;
  date: string; // YYYY-MM-DD 형식
  title?: string | null;
  content: string;
  mood?: string | null; // happy, sad, calm, excited, angry 등
  author_type: 'elderly' | 'caregiver' | 'ai';
  is_auto_generated: boolean;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
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
 * @returns 생성된 다이어리
 */
export const createDiary = async (data: DiaryCreate): Promise<Diary> => {
  const response = await apiClient.post<Diary>('/api/diaries/', data);
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

/**
 * 일기에서 감지된 TODO 추천 조회
 * 
 * @param diaryId - 다이어리 ID
 * @returns TODO 추천 목록
 */
export const getSuggestedTodos = async (diaryId: string): Promise<{
  diary_id: string;
  diary_date: string;
  suggested_todos: Array<{
    title: string;
    description: string;
    due_date: string | null;
    due_time: string | null;
    priority: 'high' | 'medium' | 'low';
    category: string;
    elderly_id: string;
    elderly_name?: string;
    creator_id: string;
    source: 'todo' | 'future_plan';
  }>;
}> => {
  const response = await apiClient.get(`/api/diaries/${diaryId}/suggested-todos`);
  return response.data;
};

/**
 * 감지된 TODO를 실제로 등록
 * 
 * @param diaryId - 다이어리 ID
 * @param selectedIndices - 선택된 TODO 인덱스 배열
 * @returns 생성된 TODO 정보
 */
export const acceptSuggestedTodos = async (
  diaryId: string,
  selectedIndices: number[]
): Promise<{
  success: boolean;
  created_todos_count: number;
  created_todos: Array<{
    todo_id: string;
    title: string;
    due_date: string | null;
    priority: string;
  }>;
}> => {
  const response = await apiClient.post(
    `/api/diaries/${diaryId}/accept-todos`,
    selectedIndices
  );
  return response.data;
};

