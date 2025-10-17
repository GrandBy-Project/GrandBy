# 📝 데일리 스크럼 - DB 관리 체계 정리

> 팀 공유용 요약 문서

---

## 🎯 오늘 정리한 내용

### **DB 관리 자동화 시스템 구축 완료**

프로젝트의 데이터베이스 스키마 변경부터 더미 데이터 생성까지 전체 워크플로우를 정리하고 자동화했습니다.

---

## 📌 핵심 개념 (3줄 요약)

1. **Alembic 마이그레이션** = DB 스키마 변경 이력 관리 (Git처럼)
2. **모델 우선** = Python 코드로 테이블 정의 → 자동으로 DB 반영
3. **자동화** = Docker 시작 시 최신 마이그레이션 자동 적용

---

## 🔄 일반적인 개발 흐름

### **1. 컬럼 추가하기 (가장 많이 사용)**

```bash
# 1단계: 모델 수정
# backend/app/models/todo.py 에서 컬럼 추가

# 2단계: 마이그레이션 생성
docker exec -it grandby_api alembic revision --autogenerate -m "Add priority"

# 3단계: DB 적용
docker exec -it grandby_api alembic upgrade head

# 4단계: Git 커밋
git add backend/app/models/todo.py
git add backend/migrations/versions/20251017_*_add_priority.py
git commit -m "feat: Add priority to todos"
```

### **2. 더미 데이터만 추가**

```bash
# 1단계: 시드 스크립트 수정
# backend/scripts/seed_todos.py

# 2단계: 실행
docker exec -it grandby_api python scripts/seed_todos.py
```

### **3. 팀원이 변경사항 받기**

```bash
# 1단계: 코드 업데이트
git pull

# 2단계: Docker 재시작 (자동으로 마이그레이션 적용됨)
docker-compose restart api
```

---

## ✅ 자동화된 것들

Docker 시작 시 **자동으로** 실행:

- ✅ PostgreSQL 시작 및 연결 대기
- ✅ **Alembic 마이그레이션 자동 적용** (`alembic upgrade head`)
- ✅ 시드 데이터 자동 생성 (첫 실행 시, `AUTO_SEED=true`)
- ✅ FastAPI 서버 시작

→ **결론**: `docker-compose up -d` 한 번이면 모든 게 준비됨!

---

## 📂 파일 구조

```
backend/
├── app/
│   └── models/          # 📝 여기서 테이블 정의 (Python)
│       ├── user.py
│       ├── todo.py
│       └── diary.py
│
├── migrations/
│   └── versions/        # 📦 마이그레이션 이력 (자동 생성)
│       └── 20251010_0727-xxx_initial_tables.py
│
└── scripts/
    ├── seed_users.py    # 🌱 더미 데이터 생성
    ├── seed_todos.py
    └── seed_all.py
```

---

## 🚀 자주 사용하는 명령어

### **마이그레이션 관련**
```bash
# 생성
docker exec -it grandby_api alembic revision --autogenerate -m "메시지"

# 적용
docker exec -it grandby_api alembic upgrade head

# 현재 버전 확인
docker exec -it grandby_api alembic current

# 롤백 (한 단계 뒤로)
docker exec -it grandby_api alembic downgrade -1
```

### **더미 데이터**
```bash
# 전체 시드
docker exec -it grandby_api python scripts/seed_all.py

# 개별 시드
docker exec -it grandby_api python scripts/seed_users.py
```

### **DB 확인**
```bash
# psql 접속
docker exec -it grandby_postgres psql -U grandby -d grandby_db

# GUI 툴 (DBeaver, pgAdmin)
Host: localhost:5432
DB: grandby_db
User: grandby
Pass: grandby_secret_password
```

---

## 📊 현재 DB 테이블 (12개)

| 카테고리 | 테이블 | 설명 |
|---------|-------|------|
| **사용자** | users, user_connections, user_settings | 사용자 관리 |
| **할일** | todos | 할일 관리 |
| **일기** | diaries, diary_photos, diary_comments | 일기 관리 |
| **통화** | call_logs, call_settings, call_transcripts, emotion_logs | AI 통화 기록 |
| **알림** | notifications | 푸시 알림 |

---

## ⚠️ 중요 규칙

### **DO ✅**
- 모델 수정 → 마이그레이션 생성 → Git 커밋
- 마이그레이션 파일은 **반드시** Git에 포함
- 의미 있는 커밋 메시지 작성

### **DON'T ❌**
- ❌ **이미 실행된 마이그레이션 파일 절대 수정 금지**
- ❌ `docker-compose down -v` 프로덕션에서 절대 금지 (데이터 삭제됨)
- ❌ 수동 SQL 실행하고 마이그레이션 스킵하지 말기

---

## 🐛 자주 발생하는 문제

### **Q1: 컬럼이 중복 생성됐어요**
```bash
# 롤백 후 다시
docker exec -it grandby_api alembic downgrade -1
docker exec -it grandby_api alembic upgrade head
```

### **Q2: 모델과 DB가 안 맞아요**
```bash
# 새 마이그레이션으로 동기화
docker exec -it grandby_api alembic revision --autogenerate -m "Sync"
docker exec -it grandby_api alembic upgrade head
```

### **Q3: 개발 DB 완전 초기화하고 싶어요**
```bash
# ⚠️ 모든 데이터 삭제됨!
docker-compose down -v
docker-compose up -d
```

---

## 📚 상세 문서

더 자세한 내용은 다음 문서 참조:
- **전체 가이드**: `docs/DB_WORKFLOW_GUIDE.md`
- **DB 관리**: `docs/DB_MANAGEMENT_GUIDE.md`

---

## 🎯 다음 작업

- [ ] 팀원들에게 공유
- [ ] 실제 개발 시 테스트
- [ ] 필요시 추가 시드 스크립트 작성 (diaries, calls 등)

---

**정리 완료**: 2025-10-17  
**작성자**: Grandby 개발팀




