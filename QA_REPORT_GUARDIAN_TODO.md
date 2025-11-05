# 보호자 TODO 기능 QA 리포트

## 📋 분석 대상
- `GuardianHomeScreen.tsx` - 보호자 홈 화면 (할일 조회/수정/삭제)
- `GuardianTodoAddScreen.tsx` - 보호자 할일 추가 화면
- 백엔드 API: `todos.py`, `todo_service.py`

---

## 🔴 Critical Issues (심각)

### 1. TODO 수정 시 시간 필드 타입 불일치
**위치**: `GuardianHomeScreen.tsx:1296-1301`

**문제**:
- 백엔드 `TodoUpdate` 스키마는 `due_time: Optional[time]` (time 객체)를 기대
- 프론트엔드에서 문자열 `"08:00"` 형식으로 전송
- 백엔드가 time 객체로 파싱하지 못해 에러 발생 가능

**코드**:
```typescript
const updateData: todoApi.TodoUpdateRequest = {
  title: editedTodo.title,
  description: editedTodo.description || undefined,
  category: editedTodo.category.toUpperCase() as any,
  due_time: parseDisplayTimeToApi(editedTodo.time), // "08:00" 문자열
};
```

**해결책**: 
- 백엔드 스키마 확인 필요 (TodoUpdate가 실제로 time 객체를 받는지 문자열을 받는지)
- 또는 프론트엔드 API 인터페이스와 백엔드 스키마 일치 확인

---

### 2. 통계 데이터 비효율적 로딩
**위치**: `GuardianHomeScreen.tsx:1049-1056`

**문제**:
- `selectedPeriod`가 변경되어도 항상 주간/월간 통계를 모두 로딩
- 사용자가 선택한 기간만 로딩하면 되는데 불필요한 API 호출 발생

**코드**:
```typescript
useEffect(() => {
  if (currentElderly) {
    loadTodosForElderly(currentElderly.id);
    loadWeeklyStatsForElderly(currentElderly.id);  // 항상 호출
    loadMonthlyStatsForElderly(currentElderly.id);  // 항상 호출
    loadAllTodosForElderly(currentElderly.id);
  }
}, [currentElderlyIndex, connectedElderly.length, selectedDayTab]);
```

**해결책**:
- `selectedPeriod`에 따라 필요한 통계만 로딩
- 또는 통계 탭으로 전환할 때만 로딩

---

## ⚠️ Medium Issues (중간)

### 3. useEffect 의존성 배열 부정확
**위치**: `GuardianHomeScreen.tsx:1049-1056`

**문제**:
- `currentElderlyIndex`와 `connectedElderly.length`를 의존성으로 사용
- `currentElderly?.id`를 직접 사용하는 것이 더 정확함

**현재 코드**:
```typescript
useEffect(() => {
  if (currentElderly) {
    // ...
  }
}, [currentElderlyIndex, connectedElderly.length, selectedDayTab]);
```

**개선안**:
```typescript
useEffect(() => {
  if (currentElderly) {
    // ...
  }
}, [currentElderly?.id, selectedDayTab]);
```

---

### 4. 날짜 필터링 로직 중복
**위치**: `GuardianHomeScreen.tsx:911-963`

**문제**:
- 백엔드 API가 날짜별 조회를 지원 (`GET /api/todos/?date_filter=today`)
- 하지만 프론트엔드는 `getTodosByRange`로 범위 조회 후 프론트엔드에서 필터링
- API 호출이 비효율적일 수 있음

**현재 로직**:
1. 오늘부터 1개월 후까지 조회 (930줄)
2. 프론트엔드에서 selectedDayTab에 따라 필터링 (939-943줄)

**개선안**:
- `getTodos` API를 사용하여 `date_filter` 파라미터 활용
- 또는 현재 방식 유지하되 주석 추가

---

### 5. 반복 일정 삭제 로직 확인 필요
**위치**: `GuardianHomeScreen.tsx:1330-1418`

**문제**:
- `handleDeleteTodo`에서 `delete_future` 파라미터 사용
- 백엔드 API는 `delete_future: bool = Query(False)`로 받음
- 프론트엔드에서 `deleteTodo(todoId, false)` 또는 `deleteTodo(todoId, true)` 호출
- **확인 필요**: 반복 일정의 경우 `parent_recurring_id`가 있는지, 원본 일정인지 구분 필요

**백엔드 로직 확인**:
- `todo_service.py:489-512`에서 `parent_recurring_id` 또는 `is_recurring`으로 확인
- 원본 반복 일정(`is_recurring=True`)의 경우만 미래 일정 삭제 가능

**개선안**:
- 프론트엔드에서도 반복 일정인지 확인하고 적절한 옵션 제공
- 현재 로직은 괜찮지만 사용자 안내 메시지 개선 필요

---

## 💡 Low Priority Issues (낮음)

### 6. 에러 처리 개선
**위치**: 여러 곳

**문제**:
- API 호출 실패 시 에러 메시지가 사용자에게 명확히 전달되지 않음
- 일부 catch 블록에서 `console.error`만 사용

**개선안**:
- 모든 API 호출 실패 시 `show()` 함수로 사용자에게 알림
- 에러 메시지를 더 구체적으로 표시

---

### 7. 로딩 상태 관리
**위치**: `GuardianHomeScreen.tsx`

**문제**:
- 통계 로딩과 할일 로딩이 각각 별도의 로딩 상태 사용
- `isLoadingStats`와 `isLoadingTodos`가 분리되어 있음
- 전체 로딩 상태를 통합 관리하면 UI 개선 가능

---

### 8. 날짜 표시 형식 일관성
**위치**: `GuardianHomeScreen.tsx:337-350`

**문제**:
- 오늘/내일 날짜 표시 로직이 복잡함
- `dayNames` 배열이 컴포넌트 내부에서 매번 생성됨

**개선안**:
- 상수로 분리
- 날짜 포맷팅 함수로 추출

---

## ✅ 잘 구현된 부분

1. **할일 추가 화면 (`GuardianTodoAddScreen.tsx`)**
   - 시간 변환 로직이 올바름
   - 반복 일정 설정이 잘 구현됨
   - 날짜 선택 UI가 사용자 친화적

2. **할일 목록 표시**
   - 완료/미완료 상태 표시가 명확함
   - 카테고리별 아이콘 표시가 잘 됨

3. **통계 화면**
   - 빈 상태 처리 (`hasNoStats`)가 잘 구현됨
   - 카테고리별 통계 표시가 명확함

---

## 📝 권장 수정 사항

### 우선순위 1 (Critical)
1. ✅ TODO 수정 시 시간 필드 타입 확인 및 수정
2. ✅ 통계 데이터 로딩 최적화

### 우선순위 2 (Medium)
3. ✅ useEffect 의존성 배열 개선
4. ✅ 날짜 필터링 로직 최적화 (선택적)

### 우선순위 3 (Low)
5. ✅ 에러 처리 개선
6. ✅ 로딩 상태 통합 관리
7. ✅ 코드 리팩토링 (날짜 포맷팅 함수 분리)

---

## 🧪 테스트 시나리오

### 필수 테스트
1. ✅ 할일 추가 (일반, 반복)
2. ✅ 할일 수정 (시간 변경 포함)
3. ✅ 할일 삭제 (일반, 반복 일정)
4. ✅ 통계 조회 (주간/월간)
5. ✅ 오늘/내일 탭 전환

### 추가 테스트
6. ✅ 여러 어르신 간 전환
7. ✅ 네트워크 에러 처리
8. ✅ 빈 상태 처리

---

## 📌 참고사항

- 백엔드 API 스펙과 프론트엔드 인터페이스 일치 확인 필요
- 특히 `TodoUpdate`의 `due_time` 필드 타입 확인 필요
- 반복 일정 생성/삭제 로직이 복잡하므로 주의 깊은 테스트 필요

