# 통계 기능 안정성 문제점 분석

## 🔴 심각한 문제점

### 1. 백엔드: 보호자 권한 필터링 누락
**문제**: `get_detailed_stats`에서 `is_shared_with_caregiver` 필터가 없음
- 보호자가 통계를 볼 때 공유되지 않은 할일도 포함됨
- 다른 보호자 함수들(`get_todos_by_date`, `get_todos_by_range`)은 `shared_only` 파라미터를 받지만 통계는 받지 않음

**위치**: `backend/app/services/todo/todo_service.py:901-971`
```python
# 현재 코드 - 공유 필터 없음
todos = db.query(Todo).filter(
    and_(
        Todo.elderly_id == elderly_id,
        Todo.due_date >= start_date,
        Todo.due_date <= end_date,
        # is_shared_with_caregiver 필터 없음!
    )
)
```

### 2. 백엔드: 반복 일정 필터링 로직 문제
**문제**: 복잡한 OR 조건으로 인한 혼란
```python
or_(
    Todo.is_recurring == False,
    Todo.is_recurring.is_(None),
    Todo.parent_recurring_id.isnot(None)
)
```
- `is_recurring == False`와 `is_recurring.is_(None)` 중복
- `parent_recurring_id.isnot(None)`이면 이미 생성된 인스턴스인데 다시 체크
- 로직이 불명확하고 버그 가능성 높음

### 3. 백엔드: 날짜 계산 버그 가능성
**문제**: `last_month` 계산 로직이 복잡하고 오류 가능
```python
elif period == "last_month":
    if today.month == 1:
        start_date = date(today.year - 1, 12, 1)
        end_date = date(today.year - 1, 12, 31)
    else:
        start_date = date(today.year, today.month - 1, 1)
        if today.month - 1 == 12:  # 이 조건은 절대 True가 될 수 없음!
            end_date = date(today.year - 1, 12, 31)
        else:
            end_date = date(today.year, today.month, 1) - timedelta(days=1)
```
- `today.month - 1 == 12` 조건은 논리적으로 불가능 (month가 1이면 위에서 처리됨)
- 불필요한 중복 조건

### 4. 프론트엔드: 데이터 로딩 상태 불일치
**문제**: 비동기 데이터 로딩 중 null 체크 부족
- `todayTodos`, `allTodos`가 비동기로 로드되는데 `getCategoryAnalysis`에서 사용할 때 null 체크 없음
- `stats`가 null일 때 `stats?.by_category` 접근은 안전하지만, `categoryStats`가 null일 때 처리 부족

**위치**: `frontend/src/screens/GuardianStatisticsScreen.tsx:224-319`
```typescript
const getCategoryAnalysis = (category) => {
  const todayCategoryTodos = todayTodos.filter(...); // todayTodos가 []일 수 있음
  const stats = selectedPeriod === 'month' ? monthlyStats : lastMonthStats;
  const categoryStats = stats?.by_category.find(...); // stats가 null이면 undefined
  // categoryStats가 null일 때 처리 부족
}
```

### 5. 프론트엔드: 에러 처리 불일치
**문제**: 
- `loadStatsForElderly`는 에러 발생 시 알림 표시
- `loadAllTodosForElderly`, `loadTodayTodos`는 에러 발생 시 조용히 빈 배열로 설정
- 일관성 없는 에러 처리로 디버깅 어려움

### 6. DB: 성능 문제
**문제**: 
- 모든 할일을 메모리로 가져온 후 필터링
- 인덱스 확인 필요 (elderly_id, due_date, is_recurring, parent_recurring_id 조합)
- 대량 데이터 시 성능 저하 가능

**위치**: `backend/app/services/todo/todo_service.py:922-934`
```python
todos = db.query(Todo).filter(...).all()  # 모든 데이터를 메모리로 가져옴
# 메모리에서 필터링
category_todos = [t for t in todos if t.category == category]
```

### 7. 프론트엔드: 기간 전환 시 데이터 재로딩 문제
**문제**: `selectedPeriod` 변경 시 이미 로드된 데이터는 재로딩하지 않음
- `selectedPeriod`가 'month'에서 'last_month'로 변경될 때 `lastMonthStats`가 없으면 로딩하지만
- 이미 로드된 경우 업데이트되지 않음

## 🟡 개선 필요 사항

### 1. 백엔드: 공유 필터 추가 필요
- `get_detailed_stats`에 `shared_only` 파라미터 추가
- 보호자용 통계는 공유된 할일만 포함

### 2. 백엔드: 반복 일정 필터링 로직 단순화
```python
# 개선 제안
and_(
    Todo.elderly_id == elderly_id,
    Todo.due_date >= start_date,
    Todo.due_date <= end_date,
    # 반복 일정 템플릿 제외: parent_recurring_id가 있거나 is_recurring이 False인 것만
    or_(
        Todo.is_recurring == False,
        Todo.parent_recurring_id.isnot(None)
    )
)
```

### 3. 백엔드: 날짜 계산 로직 개선
```python
# 개선 제안 - calendar 모듈 사용
from calendar import monthrange
if period == "last_month":
    if today.month == 1:
        start_date = date(today.year - 1, 12, 1)
        end_date = date(today.year - 1, 12, 31)
    else:
        start_date = date(today.year, today.month - 1, 1)
        last_day = monthrange(today.year, today.month - 1)[1]
        end_date = date(today.year, today.month - 1, last_day)
```

### 4. 프론트엔드: 데이터 로딩 상태 관리 개선
- 로딩 상태를 명확히 표시
- null 체크 강화
- 에러 처리 일관성 확보

### 5. DB: 인덱스 추가
```sql
-- 권장 인덱스
CREATE INDEX idx_todos_stats ON todos(elderly_id, due_date, is_recurring, parent_recurring_id);
CREATE INDEX idx_todos_category ON todos(elderly_id, category, due_date);
```

## 📊 우선순위

1. **긴급**: 백엔드 공유 필터 추가 (보안/권한 문제)
2. **높음**: 반복 일정 필터링 로직 개선
3. **높음**: 프론트엔드 null 체크 및 에러 처리 개선
4. **중간**: 날짜 계산 로직 개선
5. **중간**: DB 인덱스 추가
6. **낮음**: 성능 최적화 (대량 데이터 처리)

