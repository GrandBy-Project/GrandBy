# 캘린더 화면 종합 분석 및 개선 제안

## 📊 현재 상태 분석

### 1. 코드 중복 문제 (Critical)

#### 1.1 날짜/시간 포맷팅 함수 중복
**위치**: `CalendarScreen.tsx`, `GuardianTodoAddScreen.tsx`, `GuardianHomeScreen.tsx`, `DiaryWriteScreen.tsx`

**중복되는 함수들**:
```typescript
// CalendarScreen.tsx
- formatDate(date: Date) → "X월 X일 (요일)"
- formatDateString(date: Date) → "YYYY-MM-DD"
- formatDateDisplay(dateString: string) → "X월 X일 (요일)"
- convertHHMMToKoreanTime(timeStr: string) → "X시 X분"
- formatTimeToHHMM(hour, minute) → "HH:MM"

// GuardianTodoAddScreen.tsx
- formatDate(dateString?: string) → "X월 X일 요일"
- formatDateForDisplay(dateString: string) → "오늘/어제/내일 X월 X일 요일"

// GuardianHomeScreen.tsx
- formatDateForDisplay(dateString: string) → "X월 X일 (요일)"
- formatTime(timeStr: string) → "오전/오후 X:XX"

// DiaryWriteScreen.tsx
- formatTodoDate(dateStr, timeStr) → "오늘/내일/X월 X일"
- formatTimeToDisplay(time24) → "HH:MM"
```

**문제점**:
- 동일한 기능의 함수가 4개 화면에서 각각 다른 구현
- 버그 수정 시 모든 파일 수정 필요
- 일관성 없는 포맷팅 (예: "X월 X일 (요일)" vs "X월 X일 요일")

**개선 방안**: `frontend/src/utils/dateUtils.ts` 생성
```typescript
// 통합된 날짜/시간 유틸리티
- formatDate(date: Date | string): string
- formatDateWithWeekday(date: Date | string): string
- formatDateString(date: Date): string
- formatTimeHHMM(time: string | null): string
- formatTimeKorean(time: string | null): string
- formatTimeAmPm(time: string | null): string
```

---

#### 1.2 카테고리 정의 중복
**위치**: `CalendarScreen.tsx:83-89`, `GuardianTodoAddScreen.tsx`, `GuardianHomeScreen.tsx`

**중복되는 코드**:
```typescript
const categories = [
  { id: 'MEDICINE', name: '약 복용', icon: 'medical', color: '#FF6B6B' },
  { id: 'HOSPITAL', name: '병원 방문', icon: 'medical-outline', color: '#4ECDC4' },
  { id: 'EXERCISE', name: '운동', icon: 'fitness', color: '#45B7D1' },
  { id: 'MEAL', name: '식사', icon: 'restaurant', color: '#96CEB4' },
  { id: 'OTHER', name: '기타', icon: 'list', color: '#95A5A6' },
];
```

**문제점**:
- 카테고리 추가/수정 시 모든 파일 수정 필요
- 아이콘/색상 불일치 가능성

**개선 방안**: `frontend/src/constants/TodoCategories.ts` 생성
```typescript
export const TODO_CATEGORIES = [
  { id: 'MEDICINE', name: '약 복용', icon: 'medical', color: '#FF6B6B' },
  // ...
];

export const getCategoryById = (id: string) => { ... };
export const getCategoryName = (id: string) => { ... };
export const getCategoryIcon = (id: string) => { ... };
```

---

#### 1.3 TODO 추가/수정 로직 중복
**위치**: 
- `CalendarScreen.tsx:806-881` (어르신용 모달)
- `GuardianTodoAddScreen.tsx:169-287` (보호자용 전용 화면)
- `GuardianHomeScreen.tsx:1873-1911` (보호자 홈 화면 모달)

**문제점**:
- 검증 로직 중복 (제목, 카테고리, 시간 필수 체크)
- API 호출 로직 중복
- 에러 처리 로직 중복
- 반복 일정 처리 로직 중복

**개선 방안**: `frontend/src/hooks/useTodoForm.ts` 커스텀 훅 생성
```typescript
export const useTodoForm = (initialTodo?: TodoItem) => {
  const [formData, setFormData] = useState({ ... });
  const [errors, setErrors] = useState({ ... });
  
  const validate = () => { ... };
  const prepareCreateData = () => { ... };
  const prepareUpdateData = () => { ... };
  
  return { formData, errors, validate, prepareCreateData, prepareUpdateData };
};
```

---

### 2. UI 통일성 문제 (High Priority)

#### 2.1 모달 스타일 불일치
**비교**:
- `CalendarScreen.tsx`: 중앙 배치 모달 (`centeredModalContent`)
- `GuardianTodoAddScreen.tsx`: 전체 화면 스타일
- `GuardianHomeScreen.tsx`: 하단 슬라이드 모달 (`editModalContent`)

**문제점**:
- 사용자 경험 불일치
- 스타일 시트 중복 (약 200줄 이상)

**개선 방안**: 공통 모달 컴포넌트 생성
```typescript
// frontend/src/components/TodoFormModal.tsx
<TodoFormModal
  visible={show}
  mode="create" | "edit"
  initialData={todo}
  onSubmit={handleSave}
  onCancel={handleCancel}
/>
```

---

#### 2.2 입력 필드 스타일 불일치
**비교**:
- `CalendarScreen`: `titleInput`, `descriptionInput`
- `GuardianTodoAddScreen`: `textInput`, `textArea`
- `GuardianHomeScreen`: `textInput`, `textArea`

**문제점**:
- 동일한 스타일이지만 다른 이름 사용
- 스타일 수정 시 여러 파일 수정 필요

**개선 방안**: 공통 스타일 상수화
```typescript
// frontend/src/constants/InputStyles.ts
export const InputStyles = StyleSheet.create({
  textInput: { ... },
  textArea: { ... },
  dateButton: { ... },
  categoryGrid: { ... },
});
```

---

#### 2.3 카테고리 선택 UI 불일치
**비교**:
- `CalendarScreen`: 인라인 그리드 (`categoryGridInline`)
- `GuardianTodoAddScreen`: 인라인 그리드 (동일)
- `GuardianHomeScreen`: 인라인 그리드 (동일)

**다행히 동일하지만**: 컴포넌트화 필요

**개선 방안**: `CategorySelector` 컴포넌트 생성
```typescript
// frontend/src/components/CategorySelector.tsx
<CategorySelector
  selectedCategory={category}
  onSelect={setCategory}
  layout="inline" | "grid"
/>
```

---

### 3. 기능 분산 문제 (Medium Priority)

#### 3.1 TODO 추가 플로우 불일치
**현재 상황**:
- **보호자**: `CalendarScreen` → `GuardianTodoAddScreen` (전용 화면 이동)
- **어르신**: `CalendarScreen` → 내부 모달 (인라인)

**문제점**:
- 사용자 경험 불일치
- 보호자는 더 많은 기능 (반복 일정 등) 사용 가능
- 어르신 모달에는 반복 일정 기능 없음

**개선 방안**: 
1. **Option A (권장)**: 어르신도 `GuardianTodoAddScreen` 사용 (파라미터로 구분)
   ```typescript
   router.push(`/guardian-todo-add?elderlyId=${user.user_id}&role=elderly`);
   ```
   - 장점: 일관된 UX, 반복 일정 기능 활용 가능
   - 단점: 화면 이름이 "Guardian"인데 어르신도 사용

2. **Option B**: 어르신 모달에 반복 일정 기능 추가
   - 장점: 현재 플로우 유지
   - 단점: 코드 중복 증가

---

#### 3.2 TODO 수정 플로우
**현재**: 모든 사용자가 `GuardianTodoAddScreen`으로 이동
**상태**: ✅ 이미 통합됨

---

### 4. 다이어리 통합 현황 (Good)

#### 4.1 현재 구현 상태
**좋은 점**:
- ✅ 다이어리와 TODO가 같은 화면에 통합
- ✅ 필터로 분리 가능 (`all`, `schedule`, `diary`)
- ✅ 달력 마킹에 다이어리 표시
- ✅ 일기 상세 화면으로 이동 가능

**개선 가능한 점**:
- 다이어리 작성 버튼 위치가 명확하지 않음 (일정 추가 버튼과 분리되어 있음)
- 다이어리와 TODO의 시각적 구분이 약함

---

## 🎯 개선 우선순위

### Phase 1: 긴급 (코드 품질, 유지보수성)
1. **날짜/시간 유틸리티 함수 통합** ⭐⭐⭐
   - `frontend/src/utils/dateUtils.ts` 생성
   - 모든 화면에서 공통 함수 사용
   - 예상 시간: 2-3시간

2. **카테고리 상수 통합** ⭐⭐⭐
   - `frontend/src/constants/TodoCategories.ts` 생성
   - 모든 화면에서 공통 상수 사용
   - 예상 시간: 1시간

3. **카테고리 선택 컴포넌트화** ⭐⭐
   - `frontend/src/components/CategorySelector.tsx` 생성
   - 예상 시간: 2시간

### Phase 2: 중요 (UX 개선)
4. **TODO 추가 플로우 통합** ⭐⭐
   - 어르신도 `GuardianTodoAddScreen` 사용하거나
   - 어르신 모달에 반복 일정 기능 추가
   - 예상 시간: 3-4시간

5. **입력 필드 스타일 통합** ⭐
   - 공통 스타일 상수화
   - 예상 시간: 1-2시간

### Phase 3: 개선 (선택적)
6. **TODO 폼 커스텀 훅 생성** ⭐
   - 검증, 데이터 준비 로직 통합
   - 예상 시간: 4-5시간

7. **공통 모달 컴포넌트 생성** ⭐
   - `TodoFormModal` 컴포넌트
   - 예상 시간: 5-6시간

---

## 📋 구체적 개선 계획

### Step 1: 유틸리티 함수 생성 (즉시 시작 가능)

**파일**: `frontend/src/utils/dateUtils.ts`
```typescript
/**
 * 날짜/시간 포맷팅 유틸리티
 * 프로젝트 전체에서 일관된 날짜/시간 표시를 위해 통합
 */

export const formatDateString = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateWithWeekday = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
};

export const formatTimeKorean = (timeStr: string | null): string => {
  if (!timeStr) return '시간 미정';
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  return `${hour}시 ${minute}분`;
};

export const formatTimeAmPm = (timeStr: string | null): string => {
  if (!timeStr) return '시간 미정';
  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const isPM = hour >= 12;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${isPM ? '오후' : '오전'} ${displayHour}시 ${minute}분`;
};
```

---

### Step 2: 카테고리 상수 생성

**파일**: `frontend/src/constants/TodoCategories.ts`
```typescript
/**
 * TODO 카테고리 정의
 * 백엔드 Enum과 일치해야 함: MEDICINE, HOSPITAL, EXERCISE, MEAL, OTHER
 */

export interface TodoCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

export const TODO_CATEGORIES: TodoCategory[] = [
  { id: 'MEDICINE', name: '약 복용', icon: 'medical', color: '#FF6B6B' },
  { id: 'HOSPITAL', name: '병원 방문', icon: 'medical-outline', color: '#4ECDC4' },
  { id: 'EXERCISE', name: '운동', icon: 'fitness', color: '#45B7D1' },
  { id: 'MEAL', name: '식사', icon: 'restaurant', color: '#96CEB4' },
  { id: 'OTHER', name: '기타', icon: 'list', color: '#95A5A6' },
];

export const getCategoryById = (id: string): TodoCategory | undefined => {
  return TODO_CATEGORIES.find(cat => cat.id === id);
};

export const getCategoryName = (id: string | null): string => {
  const category = getCategoryById(id || 'OTHER');
  return category?.name || '기타';
};

export const getCategoryIcon = (id: string | null): string => {
  const category = getCategoryById(id || 'OTHER');
  return category?.icon || 'list';
};

export const getCategoryColor = (id: string | null): string => {
  const category = getCategoryById(id || 'OTHER');
  return category?.color || '#95A5A6';
};
```

---

### Step 3: CalendarScreen 리팩토링 계획

**현재 CalendarScreen의 주요 문제**:
1. 파일 크기: 3,666줄 (너무 큼)
2. 책임 과다: 달력, 일정 관리, 일기 표시, 모달 관리 등
3. 상태 관리 복잡: 20개 이상의 useState

**리팩토링 전략**:

#### 3.1 컴포넌트 분리
```
CalendarScreen.tsx (메인)
├── CalendarView.tsx (달력 뷰)
├── ScheduleList.tsx (일정 목록)
├── DiaryList.tsx (일기 목록)
├── TodoFormModal.tsx (TODO 추가/수정 모달)
└── TodoDetailModal.tsx (TODO 상세 모달)
```

#### 3.2 커스텀 훅 분리
```
hooks/
├── useCalendar.ts (날짜 선택, 주간/월간 뷰)
├── useSchedules.ts (일정 로딩, 필터링)
├── useDiaries.ts (일기 로딩, 필터링)
└── useTodoForm.ts (TODO 폼 관리)
```

---

## 🎨 UI 통일성 개선 방안

### 다이어리 통합 유지 전제

#### 현재 좋은 점 ✅
- 다이어리와 TODO가 같은 화면에 통합
- 필터로 분리 가능
- 달력 마킹으로 한눈에 확인

#### 개선 제안
1. **시각적 구분 강화**
   - 다이어리 카드와 TODO 카드의 스타일 차별화
   - 다이어리는 좌측 보더 색상으로 기분 표시 (현재 구현됨)

2. **작성 버튼 통합**
   - "추가" 버튼을 누르면 모달에서 "일정 추가" / "일기 작성" 선택
   - 또는 두 개 버튼을 나란히 배치

3. **필터 개선**
   - 현재: `all`, `schedule`, `diary`
   - 제안: `all`, `todo`, `diary` (더 명확한 네이밍)

---

## 📝 다이어리 기능 유지 및 통합 방안

### 현재 구조 유지 (권장)
- 다이어리는 별도 화면(`DiaryListScreen`, `DiaryWriteScreen`)에서 관리
- 캘린더 화면에서는 조회 및 간단한 표시만
- 일기 상세는 `DiaryDetailScreen`으로 이동

### 개선 포인트
1. **일기 작성 버튼 위치 명확화**
   ```typescript
   // 현재: 별도 버튼
   // 개선: "추가" 버튼 옆에 배치하거나 통합 모달
   ```

2. **일기 미리보기 개선**
   - 현재: 일기 목록에 제목, 내용, 기분만 표시
   - 개선: 썸네일 이미지 표시 (있는 경우)

---

## ✅ 최종 권장 사항

### 즉시 적용 (Phase 1)
1. ✅ 날짜/시간 유틸리티 함수 통합
2. ✅ 카테고리 상수 통합
3. ✅ 카테고리 선택 컴포넌트화

### 단기 개선 (Phase 2)
4. TODO 추가 플로우 통합 (어르신도 `GuardianTodoAddScreen` 사용)
5. 입력 필드 스타일 통합

### 장기 개선 (Phase 3)
6. TODO 폼 커스텀 훅 생성
7. CalendarScreen 컴포넌트 분리
8. 공통 모달 컴포넌트 생성

---

## 🚀 시작하기

**가장 먼저 할 것**:
1. `frontend/src/utils/dateUtils.ts` 생성
2. `frontend/src/constants/TodoCategories.ts` 생성
3. `CalendarScreen.tsx`에서 중복 함수 제거 및 공통 함수 사용

**예상 효과**:
- 코드 라인 수: 약 200-300줄 감소
- 유지보수성: 크게 향상
- 버그 발생 가능성: 감소
- 일관성: 향상

---

## 📌 참고사항

- 다이어리 기능은 현재 구조 유지 (별도 화면에서 관리)
- 캘린더 화면은 조회 및 통합 표시만 담당
- 모든 TODO 관련 기능은 `GuardianTodoAddScreen`으로 통합 권장

