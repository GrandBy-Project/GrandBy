# 반복 일정 중복 체크 개선 사항

## 현재 상황

### ✅ 현재 작동 방식
- 중복 체크: `parent_recurring_id + due_date` 조합으로 체크
- 매일, 매주, 매월 모두 동일한 방식으로 처리
- 기본적인 중복 방지는 잘 작동함

### ⚠️ 개선이 필요한 사항

#### 1. 동시성 문제 (Race Condition)
**현재 문제:**
```python
existing = db.query(Todo).filter(...).first()  # 체크
if existing:
    continue
# 여기서 다른 프로세스가 동시에 실행되면 둘 다 None을 반환
db.add(new_todo)  # 둘 다 생성 가능
```

**해결 방안:**
- 데이터베이스 레벨에서 Unique 제약 조건 추가
- 또는 `SELECT FOR UPDATE` 사용

#### 2. 매월(MONTHLY) 마지막 날짜 처리
**현재 문제:**
- `recurring_day_of_month=31`이고 해당 월이 30일까지만 있으면 생성되지 않음
- 예: 2월 31일, 4월 31일 등

**해결 방안:**
```python
# 매월 로직 개선
if todo.recurring_type == RecurringType.MONTHLY:
    if not todo.recurring_day_of_month:
        return False
    
    # 마지막 날짜 처리
    last_day = calendar.monthrange(target_date.year, target_date.month)[1]
    target_day = min(todo.recurring_day_of_month, last_day)
    return target_date.day == target_day
```

#### 3. 데이터베이스 Unique 제약 조건
**현재:**
- 애플리케이션 레벨에서만 체크
- 데이터베이스 제약 조건 없음

**개선:**
```sql
-- 마이그레이션에 추가
CREATE UNIQUE INDEX idx_todos_parent_date 
ON todos (parent_recurring_id, due_date) 
WHERE parent_recurring_id IS NOT NULL;
```

또는 SQLAlchemy 모델에:
```python
from sqlalchemy import Index

Index('idx_todos_parent_date', Todo.parent_recurring_id, Todo.due_date, 
      unique=True, postgresql_where=Todo.parent_recurring_id.isnot(None))
```

## 구현 우선순위

1. **높음**: 데이터베이스 Unique 제약 조건 추가
2. **중간**: 매월 마지막 날짜 처리 로직 개선
3. **낮음**: 트랜잭션 격리 수준 고려 (Unique 제약으로 해결 가능)

## 참고사항

- `seed_todos.py`는 이미 올바른 구조로 수정됨 (원본 + 자식 TODO)
- Celery Beat는 매일 자정에 실행되어 반복 일정 생성
- 현재 구조는 실용적으로는 충분히 작동함

