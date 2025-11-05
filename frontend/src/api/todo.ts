/**
 * TODO 관련 API
 */
import apiClient from './client';

// TODO 타입 정의
export interface TodoItem {
  todo_id: string;
  elderly_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  category: 'MEDICINE' | 'EXERCISE' | 'MEAL' | 'HOSPITAL' | 'OTHER' | null;
  due_date: string; // YYYY-MM-DD
  due_time: string | null; // HH:MM
  creator_type: 'caregiver' | 'ai' | 'elderly';
  status: 'pending' | 'completed' | 'cancelled';
  is_confirmed: boolean;
  is_shared_with_caregiver: boolean; // 보호자와 공유 여부
  is_recurring: boolean;
  recurring_type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;
  recurring_interval: number | null;
  recurring_days: number[] | null;
  recurring_day_of_month: number | null;
  recurring_start_date: string | null;
  recurring_end_date: string | null;
  parent_recurring_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface TodoCreateRequest {
  elderly_id: string;
  title: string;
  description?: string;
  category?: 'MEDICINE' | 'EXERCISE' | 'MEAL' | 'HOSPITAL' | 'OTHER';
  due_date: string; // YYYY-MM-DD
  due_time?: string; // HH:MM
  is_shared_with_caregiver?: boolean; // 보호자와 공유 여부 (기본값: true)
  is_recurring?: boolean;
  recurring_type?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recurring_interval?: number;
  recurring_days?: number[]; // [0,1,2,3,4,5,6] (월~일)
  recurring_day_of_month?: number; // 1~31
  recurring_start_date?: string;
  recurring_end_date?: string;
}

export interface TodoUpdateRequest {
  title?: string;
  description?: string;
  category?: 'MEDICINE' | 'EXERCISE' | 'MEAL' | 'HOSPITAL' | 'OTHER';
  due_date?: string;
  due_time?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  is_shared_with_caregiver?: boolean; // 공유 설정 수정 가능
  is_recurring?: boolean;
  recurring_type?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  recurring_interval?: number;
  recurring_days?: number[];
  recurring_day_of_month?: number;
  recurring_end_date?: string;
}

export interface TodoStats {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  completion_rate: number; // 0.0 ~ 1.0
}

export interface CategoryStats {
  category: string;
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  completion_rate: number;
}

export interface TodoDetailedStats {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  completion_rate: number;
  by_category: CategoryStats[];
}

/**
 * TODO 목록 조회 (날짜별)
 * 
 * @param elderly_id - 어르신 ID (보호자용, optional)
 * @param date_filter - 'yesterday' | 'today' | 'tomorrow'
 * @param status - 상태 필터 (optional)
 */
export const getTodos = async (
  date_filter: 'yesterday' | 'today' | 'tomorrow' = 'today',
  elderly_id?: string,
  status?: 'pending' | 'completed' | 'cancelled'
): Promise<TodoItem[]> => {
  const params: any = { date_filter };
  if (elderly_id) params.elderly_id = elderly_id;
  if (status) params.status = status;

  console.log('📡 [API] getTodos 호출:', { date_filter, elderly_id, status });
  
  try {
    const response = await apiClient.get<TodoItem[]>('/api/todos/', { params });
    console.log('✅ [API] getTodos 성공:', response.data.length, '개');
    console.log('📊 [API] 할일 목록:', response.data.map(t => ({ title: t.title, date: t.due_date, is_recurring: t.is_recurring })));
    return response.data;
  } catch (error: any) {
    console.error('❌ [API] getTodos 실패:', error);
    console.error('❌ [API] 에러 응답:', error.response?.data);
    throw error;
  }
};

/**
 * TODO 목록 조회 (날짜 범위)
 * 
 * @param start_date - 시작 날짜 (YYYY-MM-DD)
 * @param end_date - 종료 날짜 (YYYY-MM-DD)
 * @param elderly_id - 어르신 ID (보호자용, optional)
 * @param status - 상태 필터 (optional)
 */
export const getTodosByRange = async (
  start_date: string,
  end_date: string,
  elderly_id?: string,
  status?: 'pending' | 'completed' | 'cancelled'
): Promise<TodoItem[]> => {
  const params: any = { start_date, end_date };
  if (elderly_id) params.elderly_id = elderly_id;
  if (status) params.status = status;

  const response = await apiClient.get<TodoItem[]>('/api/todos/range', { params });
  return response.data;
};

/**
 * TODO 통계 조회
 * 
 * @param period - 'week' | 'month'
 * @param elderly_id - 어르신 ID (보호자용, optional)
 */
export const getTodoStats = async (
  period: 'week' | 'month' = 'week',
  elderly_id?: string
): Promise<TodoStats> => {
  const params: any = { period };
  if (elderly_id) params.elderly_id = elderly_id;

  const response = await apiClient.get<TodoStats>('/api/todos/stats/', { params });
  return response.data;
};

/**
 * TODO 상세 통계 조회 (카테고리별)
 * 
 * @param period - 'week' | 'month'
 * @param elderly_id - 어르신 ID (보호자용, optional)
 */
export const getDetailedStats = async (
  period: 'week' | 'month' | 'last_month' = 'week',
  elderly_id?: string
): Promise<TodoDetailedStats> => {
  const params: any = { period };
  if (elderly_id) params.elderly_id = elderly_id;

  const response = await apiClient.get<TodoDetailedStats>('/api/todos/stats/detailed', { params });
  return response.data;
};

/**
 * TODO 생성 (보호자 전용)
 */
export const createTodo = async (data: TodoCreateRequest): Promise<TodoItem> => {
  console.log('📡 [API] createTodo 호출:', JSON.stringify(data, null, 2));
  
  try {
    const response = await apiClient.post<TodoItem>('/api/todos/', data);
    console.log('✅ [API] createTodo 성공:', response.data);
    console.log('📊 [API] 생성된 할일:', {
      todo_id: response.data.todo_id,
      title: response.data.title,
      due_date: response.data.due_date,
      is_recurring: response.data.is_recurring,
      is_shared_with_caregiver: response.data.is_shared_with_caregiver
    });
    return response.data;
  } catch (error: any) {
    console.error('❌ [API] createTodo 실패:', error);
    console.error('❌ [API] 에러 응답:', error.response?.data);
    throw error;
  }
};

/**
 * TODO 상세 조회
 */
export const getTodoById = async (todo_id: string): Promise<TodoItem> => {
  const response = await apiClient.get<TodoItem>(`/api/todos/${todo_id}`);
  return response.data;
};

/**
 * TODO 수정 (보호자 전용)
 */
export const updateTodo = async (
  todo_id: string,
  data: TodoUpdateRequest
): Promise<TodoItem> => {
  const response = await apiClient.put<TodoItem>(`/api/todos/${todo_id}`, data);
  return response.data;
};

/**
 * TODO 완료 처리 (어르신 전용)
 */
export const completeTodo = async (todo_id: string): Promise<TodoItem> => {
  const response = await apiClient.patch<TodoItem>(`/api/todos/${todo_id}/complete`);
  return response.data;
};

/**
 * TODO 완료 취소 (어르신 전용)
 */
export const cancelTodo = async (todo_id: string): Promise<TodoItem> => {
  const response = await apiClient.patch<TodoItem>(`/api/todos/${todo_id}/cancel`);
  return response.data;
};

/**
 * TODO 삭제 (보호자 전용)
 * 
 * @param todo_id - TODO ID
 * @param delete_future - 이후 반복 일정도 삭제 여부
 */
export const deleteTodo = async (
  todo_id: string,
  delete_future: boolean = false
): Promise<{ message: string; deleted_count: number }> => {
  const response = await apiClient.delete<{ message: string; deleted_count: number }>(
    `/api/todos/${todo_id}`,
    { params: { delete_future } }
  );
  return response.data;
};

