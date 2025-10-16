# 📊 데이터베이스 관리 가이드

> Grandby 프로젝트의 PostgreSQL 데이터베이스 관리 방법

## 🎯 핵심 개념 이해하기

### 1️⃣ **Alembic 마이그레이션**
- **역할**: 데이터베이스 스키마 변경 이력 관리 (Git과 비슷)
- **위치**: `backend/migrations/versions/`
- **실행**: Docker 컨테이너 시작 시 **자동 실행**
- **결과**: PostgreSQL에 테이블 생성/변경

### 2️⃣ **Docker Volume (데이터 영구 저장)**
- **역할**: 컨테이너 삭제해도 데이터 보존
- **위치**: `docker-compose.yml` → `postgres_data` 볼륨
- **효과**: Docker 껐다 켜도 **데이터 유지** ✅

### 3️⃣ **시드 데이터 (더미 데이터)**
- **역할**: 테스트용 샘플 데이터
- **위치**: `backend/scripts/seed_*.py`
- **실행**: 환경변수 `AUTO_SEED=true`면 **자동 생성** (최초 1회만)

---

## 🚀 데이터베이스 자동 초기화

### **현재 설정 (자동화됨!)**

Docker Compose로 시작하면 **자동으로**:
1. ✅ PostgreSQL 컨테이너 시작
2. ✅ Alembic 마이그레이션 실행 (테이블 생성)
3. ✅ 시드 데이터 생성 (사용자가 없을 때만)
4. ✅ FastAPI 서버 시작

```powershell
# 한 번만 실행하면 끝!
docker-compose up -d

# 로그 확인
docker logs -f grandby_api
```

### **출력 예시:**
```
🚀 Grandby Backend 시작 중...
⏳ 데이터베이스 연결 대기 중...
✅ 데이터베이스 연결 완료!
🔄 데이터베이스 마이그레이션 실행 중...
INFO  [alembic.runtime.migration] Running upgrade  -> 7c30e54c1546, Initial tables
✅ 마이그레이션 완료!
🌱 시드 데이터 확인 중...
📝 시드 데이터 생성 중...
✅ 테스트 사용자 생성 완료!
✅ 시드 데이터 생성 완료!
🎉 초기화 완료! 서버 시작...
```

---

## 📋 데이터베이스 테이블 구조

### **현재 테이블 (12개)**

| 테이블명 | 설명 | 주요 컬럼 |
|---------|------|----------|
| `users` | 사용자 (어르신/보호자) | email, name, role, auth_provider |
| `user_connections` | 보호자-어르신 연결 | caregiver_id, elderly_id, status |
| `user_settings` | 사용자 설정 | auto_diary_enabled, push_enabled |
| `todos` | 할일 관리 | title, due_date, status, creator_type |
| `diaries` | 일기 | date, content, author_type, is_auto_generated |
| `diary_photos` | 일기 사진 | photo_url |
| `diary_comments` | 일기 댓글 | content, is_read |
| `call_logs` | AI 통화 기록 | call_status, call_duration, audio_url |
| `call_settings` | 통화 스케줄 설정 | frequency, call_time, is_active |
| `call_transcripts` | 통화 내용 텍스트 | speaker, text, timestamp |
| `emotion_logs` | 감정 분석 | emotion_type, emotion_score |
| `notifications` | 알림 | type, title, message, is_read |

---

## 🔧 수동 명령어

### **Alembic 마이그레이션**

```powershell
# 현재 마이그레이션 버전 확인
docker exec -it grandby_api alembic current

# 최신 버전으로 업그레이드
docker exec -it grandby_api alembic upgrade head

# 마이그레이션 히스토리 보기
docker exec -it grandby_api alembic history

# 새 마이그레이션 생성 (모델 변경 후)
docker exec -it grandby_api alembic revision --autogenerate -m "변경 내용 설명"

# 이전 버전으로 롤백
docker exec -it grandby_api alembic downgrade -1
```

### **시드 데이터 생성**

```powershell
# 사용자만 생성
docker exec -it grandby_api python scripts/seed_users.py

# 모든 시드 데이터 생성 (추가 개발 필요)
docker exec -it grandby_api python scripts/seed_all.py
```

### **PostgreSQL 직접 접속**

```powershell
# psql로 접속
docker exec -it grandby_postgres psql -U grandby -d grandby_db

# 접속 후 사용 가능한 명령어
\dt              # 테이블 목록
\d users         # users 테이블 구조
SELECT * FROM users;   # 사용자 조회
\q               # 종료
```

---

## 💻 GUI 도구로 DB 확인 (추천!)

### **방법 1: DBeaver (추천 ⭐)**

1. **설치**: https://dbeaver.io/download/
2. **연결 정보**:
   ```
   Host: localhost
   Port: 5432
   Database: grandby_db
   Username: grandby
   Password: grandby_secret_password
   ```

### **방법 2: pgAdmin 4**

1. **설치**: https://www.pgadmin.org/download/
2. 같은 연결 정보 사용

### **방법 3: VSCode Extension**

1. Extension 설치: **PostgreSQL** (by Chris Kolkman)
2. 연결 추가:
   ```
   postgresql://grandby:grandby_secret_password@localhost:5432/grandby_db
   ```

---

## 🔄 데이터 관리 시나리오

### **시나리오 1: 개발 중 DB 초기화**

```powershell
# 1. 컨테이너와 볼륨 모두 삭제 (⚠️ 데이터 손실)
docker-compose down -v

# 2. 다시 시작 (자동으로 테이블 생성 + 시드 데이터 생성)
docker-compose up -d

# 3. 로그 확인
docker logs -f grandby_api
```

### **시나리오 2: 데이터는 유지하고 코드만 재시작**

```powershell
# 데이터 그대로, 컨테이너만 재시작
docker-compose restart api
```

### **시나리오 3: 마이그레이션만 다시 실행**

```powershell
# 마이그레이션 재실행
docker exec -it grandby_api alembic upgrade head
```

### **시나리오 4: 자동 시드 끄기**

`.env` 파일이나 환경변수에 추가:
```bash
AUTO_SEED=false
```

그리고 재시작:
```powershell
docker-compose down
docker-compose up -d
```

---

## 🗑️ 데이터 삭제/정리

### **테이블 데이터만 삭제 (구조는 유지)**

```sql
-- psql 접속 후
docker exec -it grandby_postgres psql -U grandby -d grandby_db

-- 모든 데이터 삭제 (Foreign Key 순서 중요!)
TRUNCATE diary_comments, diary_photos CASCADE;
TRUNCATE diaries CASCADE;
TRUNCATE call_transcripts, emotion_logs CASCADE;
TRUNCATE call_logs, call_settings CASCADE;
TRUNCATE todos CASCADE;
TRUNCATE notifications CASCADE;
TRUNCATE user_connections, user_settings CASCADE;
TRUNCATE users CASCADE;
```

### **테이블 구조까지 완전 삭제**

```powershell
# 방법 1: 다운그레이드
docker exec -it grandby_api alembic downgrade base

# 방법 2: 볼륨 삭제
docker-compose down -v
```

---

## ⚠️ 주의사항

### **❌ 절대 하지 말 것**

1. **프로덕션에서 `docker-compose down -v`** 
   → 모든 데이터 손실!
   
2. **Alembic 없이 직접 테이블 수정**
   → 마이그레이션 이력 불일치

3. **수동 SQL과 Alembic 혼용**
   → 버전 관리 실패

### **✅ 권장 사항**

1. **모델 변경 시 항상 Alembic 사용**
   ```powershell
   # 1. models/*.py 파일 수정
   # 2. 마이그레이션 생성
   docker exec -it grandby_api alembic revision --autogenerate -m "변경사항"
   # 3. 적용
   docker exec -it grandby_api alembic upgrade head
   ```

2. **개발 환경에서만 AUTO_SEED 사용**
   - 프로덕션: `AUTO_SEED=false`
   - 개발: `AUTO_SEED=true` (기본값)

3. **정기적인 백업**
   ```powershell
   # DB 전체 백업
   docker exec grandby_postgres pg_dump -U grandby grandby_db > backup.sql
   
   # 복원
   docker exec -i grandby_postgres psql -U grandby -d grandby_db < backup.sql
   ```

---

## 🐛 트러블슈팅

### **문제 1: 마이그레이션 실패**

```powershell
# 현재 상태 확인
docker exec -it grandby_api alembic current

# 로그 확인
docker logs grandby_api

# 강제 재시도
docker exec -it grandby_api alembic upgrade head
```

### **문제 2: DB 연결 실패**

```powershell
# DB 컨테이너 상태 확인
docker ps | grep postgres

# DB 로그 확인
docker logs grandby_postgres

# 헬스체크
docker exec grandby_postgres pg_isready -U grandby -d grandby_db
```

### **문제 3: 시드 데이터 중복**

시드 스크립트는 자동으로 중복 체크하지만, 수동으로 확인:
```sql
-- 사용자 수 확인
SELECT COUNT(*) FROM users;

-- 테스트 계정 확인
SELECT email, name, role FROM users WHERE email LIKE 'test%';
```

---

## 📚 더 알아보기

- **Alembic 공식 문서**: https://alembic.sqlalchemy.org/
- **PostgreSQL 공식 문서**: https://www.postgresql.org/docs/
- **SQLAlchemy ORM**: https://docs.sqlalchemy.org/

---

## 🎓 요약

✅ **자동화된 것:**
- Alembic 마이그레이션 실행
- 시드 데이터 생성 (AUTO_SEED=true)
- 데이터 영구 저장 (Docker Volume)

❌ **수동으로 해야 하는 것:**
- 모델 변경 후 마이그레이션 생성
- 추가 테스트 데이터 삽입
- 데이터 백업/복원

**결론: 대부분 자동화되어 있으니 `docker-compose up -d`만 하면 됩니다! 🚀**


