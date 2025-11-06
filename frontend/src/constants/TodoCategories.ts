/**
 * TODO 카테고리 정의
 * 백엔드 Enum과 일치해야 함: MEDICINE, HOSPITAL, EXERCISE, MEAL, OTHER
 * 
 * 프로젝트 전체에서 일관된 카테고리 정보를 사용하기 위해 통합
 */

export interface TodoCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

/**
 * TODO 카테고리 배열
 * 모든 화면에서 동일한 카테고리 정보 사용
 */
export const TODO_CATEGORIES: TodoCategory[] = [
  { id: 'MEDICINE', name: '약 복용', icon: 'medical', color: '#FF6B6B' },
  { id: 'HOSPITAL', name: '병원 방문', icon: 'medical-outline', color: '#4ECDC4' },
  { id: 'EXERCISE', name: '운동', icon: 'fitness', color: '#45B7D1' },
  { id: 'MEAL', name: '식사', icon: 'restaurant', color: '#96CEB4' },
  { id: 'OTHER', name: '기타', icon: 'list', color: '#95A5A6' },
];

/**
 * 카테고리 ID로 카테고리 정보 조회
 * @param id 카테고리 ID (대소문자 구분 없음)
 * @returns TodoCategory 객체 또는 undefined
 */
export const getCategoryById = (id: string | null): TodoCategory | undefined => {
  if (!id) return TODO_CATEGORIES.find(cat => cat.id === 'OTHER');
  return TODO_CATEGORIES.find(cat => cat.id.toUpperCase() === id.toUpperCase());
};

/**
 * 카테고리 ID로 카테고리 이름 조회
 * 기존 GuardianHomeScreen의 getCategoryName 함수와 호환
 * @param id 카테고리 ID (대소문자 구분 없음)
 * @returns 카테고리 이름 (없으면 '기타')
 */
export const getCategoryName = (id: string | null): string => {
  const category = getCategoryById(id);
  return category?.name || '기타';
};

/**
 * 카테고리 ID로 아이콘 이름 조회
 * 기존 GuardianHomeScreen의 getCategoryIcon 함수와 호환
 * @param id 카테고리 ID (대소문자 구분 없음)
 * @returns 아이콘 이름 (없으면 'list')
 */
export const getCategoryIcon = (id: string | null): string => {
  const category = getCategoryById(id);
  return category?.icon || 'list';
};

/**
 * 카테고리 ID로 색상 조회
 * @param id 카테고리 ID (대소문자 구분 없음)
 * @returns 색상 코드 (없으면 '#95A5A6')
 */
export const getCategoryColor = (id: string | null): string => {
  const category = getCategoryById(id);
  return category?.color || '#95A5A6';
};

