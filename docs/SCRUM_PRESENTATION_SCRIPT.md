# 🎤 데일리 스크럼 발표 스크립트

> 실제 미팅에서 발표할 내용 (약 3-5분)

---

## 📢 발표 내용

### **오프닝 (30초)**

안녕하세요! 오늘은 **데이터베이스 관리 체계**를 정리했습니다.

기존에는 DB 스키마 변경할 때 방법이 명확하지 않았는데, 이제 **표준화된 프로세스**를 만들었고 **자동화**도 구현했습니다.

---

### **1. 무엇을 했나요? (1분)**

#### **✅ 완료한 작업**

1. **Alembic 마이그레이션 시스템 정리**
   - DB 스키마 변경 이력을 Git처럼 관리하는 시스템
   - 파일 위치: `backend/migrations/versions/`

2. **자동화 구현**
   - Docker 시작 시 최신 마이그레이션 자동 적용
   - 첫 실행 시 테스트 데이터 자동 생성
   - `entrypoint.sh` 스크립트로 구현

3. **더미 데이터 생성 스크립트**
   - `seed_users.py`: 테스트 사용자
   - `seed_todos.py`: 할일 더미 데이터
   - 추가 스크립트 작성 가능한 구조

4. **문서화**
   - 상세 가이드 3개 작성
   - 팀 규칙 및 체크리스트 포함

---

### **2. 어떻게 사용하나요? (1분 30초)**

#### **시나리오 A: 테이블에 컬럼 추가**

예를 들어 `todos` 테이블에 `priority` 컬럼을 추가한다면:

```bash
# 1. 모델 파일 수정
# models/todo.py 에서 컬럼 추가

# 2. 마이그레이션 자동 생성
docker exec -it grandby_api alembic revision --autogenerate -m "Add priority"

# 3. DB에 적용
docker exec -it grandby_api alembic upgrade head

# 4. Git 커밋
git add models/todo.py migrations/versions/새파일.py
git commit -m "feat: Add priority to todos"
```

**소요 시간**: 약 5분

#### **시나리오 B: 팀원이 변경사항 받기**

```bash
# 1. 코드 받기
git pull

# 2. Docker 재시작 (자동으로 마이그레이션 적용!)
docker-compose restart api
```

**핵심**: 팀원은 따로 마이그레이션 명령어 실행 안 해도 됨!

---

### **3. 왜 이렇게 했나요? (1분)**

#### **기존 문제점**
- ❌ SQL 파일로 수동 관리 → 버전 관리 어려움
- ❌ 팀원마다 DB 상태가 다름
- ❌ 프로덕션 배포 시 실수 위험

#### **개선된 점**
- ✅ **버전 관리**: Git처럼 변경 이력 추적
- ✅ **자동화**: Docker 시작 시 자동 적용
- ✅ **일관성**: 모든 팀원이 같은 DB 상태
- ✅ **안전성**: 롤백 가능
- ✅ **생산성**: 수동 작업 최소화

---

### **4. 주의사항 (30초)**

#### **⚠️ 꼭 지켜야 할 규칙**

1. **이미 실행된 마이그레이션 파일 절대 수정 금지**
   - 새 마이그레이션 파일 만들어야 함

2. **마이그레이션 파일 반드시 Git에 커밋**
   - 팀원들이 같은 변경사항 적용하려면 필수

3. **프로덕션에서 `docker-compose down -v` 절대 금지**
   - `-v` 옵션은 데이터 완전 삭제!

---

### **5. 다음 단계 (30초)**

#### **✅ 즉시 적용 가능**
- 지금부터 DB 변경 시 이 프로세스 사용
- 문서 참조: `docs/DB_WORKFLOW_GUIDE.md`

#### **📝 추가 작업 필요**
- [ ] 더미 데이터 스크립트 추가 (diaries, calls 등)
- [ ] 팀 전체 테스트
- [ ] CI/CD에 마이그레이션 검증 추가

---

### **마무리 (30초)**

이제 DB 변경이 훨씬 **안전하고 쉬워졌습니다**.

팀원 여러분은 **`git pull` → `docker restart`** 만 하면 자동으로 최신 DB 구조가 적용됩니다.

자세한 내용은 **`docs/DB_WORKFLOW_GUIDE.md`** 참조해주세요!

질문 있으신가요?

---

## 💬 예상 질문과 답변

### **Q1: 기존 데이터는 어떻게 되나요?**

**A:** 안전하게 보존됩니다!
- 컬럼 추가: 기존 행에 `NULL` 또는 `default` 값 설정
- 컬럼 삭제: Alembic이 경고하고 확인 필요
- 데이터 이전: 마이그레이션 파일에 Python 코드로 작성 가능

### **Q2: 실수로 잘못된 마이그레이션을 적용했어요**

**A:** 롤백 가능합니다!
```bash
docker exec -it grandby_api alembic downgrade -1
```

### **Q3: 개발 중에 DB 완전히 초기화하고 싶어요**

**A:** 다음 명령어로 가능합니다 (⚠️ 데이터 삭제!)
```bash
docker-compose down -v
docker-compose up -d
```

### **Q4: GUI 툴로 DB 보고 싶어요**

**A:** DBeaver나 pgAdmin 추천!
```
Host: localhost:5432
Database: grandby_db
Username: grandby
Password: grandby_secret_password
```

### **Q5: 시드 데이터가 중복 생성돼요**

**A:** 스크립트에 중복 체크 로직이 있어서 대부분 자동으로 스킵됩니다.
수동 삭제 필요 시:
```sql
TRUNCATE todos CASCADE;
```

### **Q6: 마이그레이션이 자동으로 안 돼요**

**A:** 수동으로 실행:
```bash
docker exec -it grandby_api alembic upgrade head
```

로그 확인:
```bash
docker logs grandby_api
```

---

## 📊 시각 자료 (선택)

### **Before vs After**

| 항목 | Before ❌ | After ✅ |
|-----|----------|---------|
| **변경 방법** | SQL 직접 실행 | Alembic 자동 생성 |
| **이력 관리** | 없음 | Git처럼 추적 |
| **팀 동기화** | 수동 공유 | Git pull → 자동 |
| **롤백** | 불가능 | 가능 |
| **소요 시간** | 10-15분 | 5분 |

### **워크플로우 다이어그램**

```
모델 수정
    ↓
alembic revision --autogenerate  (마이그레이션 생성)
    ↓
alembic upgrade head             (DB 적용)
    ↓
git commit & push
    ↓
팀원: git pull → docker restart  (자동 적용!)
```

---

## 📎 첨부 문서

발표 후 공유할 문서:
1. **상세 가이드**: `docs/DB_WORKFLOW_GUIDE.md`
2. **빠른 참조**: `docs/DAILY_SCRUM_DB_SUMMARY.md`
3. **전체 DB 관리**: `docs/DB_MANAGEMENT_GUIDE.md`

---

**발표 시간**: 약 3-5분  
**작성일**: 2025-10-17


