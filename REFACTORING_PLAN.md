# 캘린더 화면 리팩토링 실행 계획

## 📋 순차적 수정 계획

### Step 1: 날짜/시간 유틸리티 함수 생성 ✅ (최우선)

**작업 내용**:
1. `frontend/src/utils/dateUtils.ts` 파일 생성
2. 공통 날짜/시간 포맷팅 함수 구현

**수정할 파일**:
- ✨ `frontend/src/utils/dateUtils.ts` (신규 생성)

**함수 목록**:
- `formatDateString(date: Date | string): string` - "YYYY-MM-DD"
- `formatDateWithWeekday(date: Date | string): string` - "X월 X일 (요일)"
- `formatTimeKorean(timeStr: string | null): string` - "X시 X분"
- `formatTimeAmPm(timeStr: string | null): string` - "오전/오후 X시 X분"
- `isToday(date: Date | string): boolean`
- `isSameDate(date1: Date | string, date2: Date | string): boolean`

---

### Step 2: 카테고리 상수 생성 ✅

**작업 내용**:
1. `frontend/src/constants/TodoCategories.ts` 파일 생성
2. 카테고리 정의 및 헬퍼 함수 구현

**수정할 파일**:
- ✨ `frontend/src/constants/TodoCategories.ts` (신규 생성)

**내용**:
- `TODO_CATEGORIES` 배열
- `getCategoryById(id: string)`
- `getCategoryName(id: string | null)`
- `getCategoryIcon(id: string | null)`
- `getCategoryColor(id: string | null)`

---

### Step 3: CalendarScreen 리팩토링

**작업 내용**:
- 중복 함수 제거하고 공통 유틸리티 사용
- 카테고리 상수 사용

**수정할 파일**:
- 📝 `frontend/src/screens/CalendarScreen.tsx`

**변경사항**:
1. `formatDate` → `formatDateWithWeekday` 사용
2. `formatDateString` → 공통 함수 사용
3. `convertHHMMToKoreanTime` → `formatTimeKorean` 사용
4. `formatTimeToHHMM` → 유틸리티에 추가 또는 유지
5. `categories` 배열 → `TODO_CATEGORIES` 사용
6. `getCategoryName`, `getCategoryIcon` 등 → 공통 함수 사용

**제거할 코드** (예상):
- `formatDate` 함수 (447-452줄)
- `formatDateString` 함수 (454-459줄)
- `convertHHMMToKoreanTime` 함수 (227-237줄)
- `categories` 배열 (83-89줄)
- 카테고리 관련 헬퍼 함수들

---

### Step 4: GuardianTodoAddScreen 리팩토링

**작업 내용**:
- 날짜 포맷팅 함수를 공통 유틸리티로 교체
- 카테고리 상수 사용

**수정할 파일**:
- 📝 `frontend/src/screens/GuardianTodoAddScreen.tsx`

**변경사항**:
1. `formatDate` → `formatDateWithWeekday` 사용
2. `formatDateForDisplay` → 공통 함수로 대체 또는 유지 (복잡한 로직)
3. `categories` 배열 → `TODO_CATEGORIES` 사용

---

### Step 5: GuardianHomeScreen 리팩토링

**작업 내용**:
- 날짜/시간 포맷팅 함수를 공통 유틸리티로 교체
- 카테고리 상수 사용

**수정할 파일**:
- 📝 `frontend/src/screens/GuardianHomeScreen.tsx`

**변경사항**:
1. `formatDateForDisplay` → 공통 함수 사용
2. `formatTime` → `formatTimeAmPm` 사용
3. `getCategoryName` → 공통 함수 사용
4. `getCategoryIcon` → 공통 함수 사용
5. 카테고리 관련 로직 제거

---

### Step 6: CategorySelector 컴포넌트 생성

**작업 내용**:
- 재사용 가능한 카테고리 선택 컴포넌트 생성

**수정할 파일**:
- ✨ `frontend/src/components/CategorySelector.tsx` (신규 생성)

**프로퍼티**:
```typescript
interface CategorySelectorProps {
  selectedCategory: string | null;
  onSelect: (categoryId: string) => void;
  layout?: 'inline' | 'grid';
  disabled?: boolean;
}
```

---

### Step 7: 각 화면에서 CategorySelector 사용

**작업 내용**:
- CalendarScreen, GuardianTodoAddScreen, GuardianHomeScreen에서
- 카테고리 선택 UI를 컴포넌트로 교체

**수정할 파일**:
- 📝 `frontend/src/screens/CalendarScreen.tsx`
- 📝 `frontend/src/screens/GuardianTodoAddScreen.tsx`
- 📝 `frontend/src/screens/GuardianHomeScreen.tsx`

---

## 🎯 실행 순서 (권장)

### Phase 1: 기반 구조 만들기 (1-2시간)
1. ✅ Step 1: 날짜/시간 유틸리티 함수 생성
2. ✅ Step 2: 카테고리 상수 생성

### Phase 2: 리팩토링 (2-3시간)
3. ✅ Step 3: CalendarScreen 리팩토링
4. ✅ Step 4: GuardianTodoAddScreen 리팩토링
5. ✅ Step 5: GuardianHomeScreen 리팩토링

### Phase 3: 컴포넌트화 (1-2시간)
6. ✅ Step 6: CategorySelector 컴포넌트 생성
7. ✅ Step 7: 각 화면에서 CategorySelector 사용

---

## ⚠️ 주의사항

1. **한 번에 하나씩**: 각 단계를 완료하고 테스트 후 다음 단계 진행
2. **백업**: 큰 변경 전에 커밋 권장
3. **테스트**: 각 화면에서 날짜/시간 표시가 정상인지 확인
4. **기존 기능 유지**: 리팩토링 중에도 모든 기능이 정상 작동해야 함

---

## 📝 체크리스트

### Step 1 완료 체크
- [ ] `frontend/src/utils/dateUtils.ts` 파일 생성
- [ ] 모든 함수 구현 및 export
- [ ] 타입 정의 확인

### Step 2 완료 체크
- [ ] `frontend/src/constants/TodoCategories.ts` 파일 생성
- [ ] 카테고리 배열 정의
- [ ] 헬퍼 함수 구현

### Step 3 완료 체크
- [ ] CalendarScreen에서 공통 함수 import
- [ ] 중복 함수 제거
- [ ] 카테고리 상수 사용
- [ ] 테스트: 날짜/시간 표시 확인
- [ ] 테스트: 카테고리 표시 확인

### Step 4 완료 체크
- [ ] GuardianTodoAddScreen에서 공통 함수 import
- [ ] 중복 함수 제거
- [ ] 카테고리 상수 사용
- [ ] 테스트: 날짜/시간 포맷팅 확인

### Step 5 완료 체크
- [ ] GuardianHomeScreen에서 공통 함수 import
- [ ] 중복 함수 제거
- [ ] 카테고리 상수 사용
- [ ] 테스트: 모든 표시 확인

### Step 6 완료 체크
- [ ] CategorySelector 컴포넌트 생성
- [ ] 스타일 정의
- [ ] props 타입 정의

### Step 7 완료 체크
- [ ] CalendarScreen에서 컴포넌트 사용
- [ ] GuardianTodoAddScreen에서 컴포넌트 사용
- [ ] GuardianHomeScreen에서 컴포넌트 사용
- [ ] 테스트: 카테고리 선택 기능 확인

---

## 🚀 시작하기

**Step 1부터 시작하세요!**

각 단계를 완료하면 체크리스트를 업데이트하고 다음 단계로 진행합니다.

