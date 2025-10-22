/**
 * 공통 타입 정의
 */

// 사용자 역할
export enum UserRole {
  ELDERLY = 'elderly',
  CAREGIVER = 'caregiver',
  ADMIN = 'admin',
}

// 성별
export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
}

// 사용자 정보
export interface User {
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  phone_number?: string;
  birth_date?: string;  // 생년월일 (YYYY-MM-DD)
  gender?: Gender;  // 성별
  profile_image_url?: string;  // 프로필 이미지 URL
  auth_provider?: string;  // 인증 제공자 (email, kakao 등)
  is_active: boolean;
  created_at: string;
}

// 로그인 요청
export interface LoginRequest {
  email: string;
  password: string;
}

// 회원가입 요청
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  phone_number: string;
  birth_date: string;  // 필수: YYYY-MM-DD 형식
  gender: Gender;  // 필수
  auth_provider?: string;
}

// 전화번호 인증 정보
export interface PhoneVerification {
  required: boolean;
  message: string;
  validation_code: string;
  phone_number: string;
}

// 인증 응답
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
  phone_verification?: PhoneVerification;
}

// API 에러 응답
export interface ApiError {
  detail: string;
  error?: string;
}

// 다이어리
export interface Diary {
  diary_id: string;
  user_id: string;
  author_id: string;
  date: string;
  content: string;
  author_type: 'elderly' | 'caregiver' | 'ai';
  is_auto_generated: boolean;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

// 다이어리 댓글
export interface DiaryComment {
  comment_id: string;
  user_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  user_name: string;
  user_role: string;
}

// 댓글 작성 요청
export interface CommentCreateRequest {
  content: string;
}

// TODO
export interface Todo {
  todo_id: string;
  elderly_id: string;
  creator_id: string;
  title: string;
  description?: string;
  due_date: string;
  due_time?: string;
  status: 'pending' | 'completed' | 'cancelled';
  creator_type: 'caregiver' | 'ai' | 'elderly';
  is_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

// 통화 기록
export interface CallLog {
  call_id: string;
  elderly_id: string;
  call_status: string;
  call_start_time?: string;
  call_end_time?: string;
  call_duration?: number;
  audio_file_url?: string;
  created_at: string;
}

// 알림
export interface Notification {
  notification_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  related_id?: string;
  is_read: boolean;
  is_pushed: boolean;
  created_at: string;
  read_at?: string;
}

