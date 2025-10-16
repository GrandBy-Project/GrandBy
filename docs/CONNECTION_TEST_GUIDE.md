# 🧪 보호자-어르신 연결 기능 테스트 가이드

> 전체 플로우 검증: 보호자 요청 → 어르신 수락

---

## ✅ 구현 완료 내역

### **백엔드** (100%)
- [x] API 7개 완성
- [x] 알림 시스템 연동
- [x] 권한 체크 및 검증
- [x] 시드 데이터 생성

### **프론트엔드** (100%)
- [x] 보호자 화면 (검색 & 요청)
- [x] 어르신 화면 (알림 & 수락/거절)
- [x] API 연동 완료
- [x] 에러 처리

---

## 🧪 테스트 시나리오

### **시나리오 A: Swagger UI 테스트** (빠른 검증)

#### **Step 1: 보호자 로그인**
```bash
# 브라우저 열기
http://localhost:8000/docs

# POST /api/auth/login
{
  "email": "test2@test.com",
  "password": "12341234"
}

# 응답에서 access_token 복사
# Authorize 버튼 클릭 → Bearer {access_token} 입력
```

#### **Step 2: 어르신 검색**
```bash
# GET /api/users/search
query: test1

# 응답:
[
  {
    "user_id": "...",
    "name": "테르신",
    "email": "test1@test.com",
    "phone_number": "01012345678",
    "is_already_connected": false,
    "connection_status": null
  }
]
```

#### **Step 3: 연결 요청**
```bash
# POST /api/users/connections
{
  "elderly_phone_or_email": "test1@test.com"
}

# 응답:
{
  "connection_id": "...",
  "caregiver_id": "...",
  "elderly_id": "...",
  "status": "pending",
  "created_at": "..."
}
```

#### **Step 4: 어르신 로그인 & 연결 확인**
```bash
# 로그아웃 (Authorize 버튼 → Logout)

# POST /api/auth/login
{
  "email": "test1@test.com",
  "password": "12341234"
}

# 새 access_token으로 Authorize

# GET /api/users/connections
# 응답의 pending 배열에 요청 확인:
{
  "active": [],
  "pending": [
    {
      "connection_id": "...",
      "status": "pending",
      "user_id": "...",
      "name": "테호자",
      "email": "test2@test.com"
    }
  ],
  "rejected": []
}

# GET /api/notifications/
# CONNECTION_REQUEST 타입 알림 확인
```

#### **Step 5: 연결 수락**
```bash
# PATCH /api/users/connections/{connection_id}/accept

# 응답:
{
  "status": "active"  # PENDING → ACTIVE
}
```

#### **Step 6: 보호자 알림 확인**
```bash
# 보호자로 다시 로그인 (test2@test.com)

# GET /api/notifications/
# CONNECTION_ACCEPTED 타입 알림 확인:
{
  "type": "connection_accepted",
  "title": "연결 수락됨",
  "message": "테르신님이 연결 요청을 수락했습니다."
}
```

---

### **시나리오 B: 실제 앱 테스트** (권장)

#### **사전 준비**

```bash
# 1. 백엔드 실행 확인
docker ps | grep grandby

# 2. DB에 시드 데이터 확인
docker exec grandby_postgres psql -U grandby -d grandby_db -c "SELECT email, name, role FROM users;"
docker exec grandby_postgres psql -U grandby -d grandby_db -c "SELECT * FROM user_connections;"
docker exec grandby_postgres psql -U grandby -d grandby_db -c "SELECT * FROM notifications WHERE type='CONNECTION_REQUEST';"

# 3. 프론트엔드 실행
cd frontend
npm start
```

#### **테스트 플로우**

**1단계: 보호자 앱 (디바이스 1)**

```
1. 로그인
   - 이메일: test2@test.com
   - 비밀번호: 12341234

2. GuardianHomeScreen 진입
   - "어르신 추가하기" 버튼 클릭

3. 어르신 검색
   - 입력: test1@test.com
   - "검색" 버튼 클릭
   - 결과: "테르신" 표시됨

4. 연결 요청
   - "연결 요청" 버튼 클릭
   - 확인 팝업: "요청" 클릭
   - 성공 메시지 확인
```

**2단계: 어르신 앱 (디바이스 2 또는 로그아웃 후)**

```
1. 로그인
   - 이메일: test1@test.com
   - 비밀번호: 12341234

2. ElderlyHomeScreen 진입
   - 상단에 주황색 알림 배너 표시 확인:
     "🔔 새로운 연결 요청 (1)"
     "테호자님이 보호자 연결을 요청했습니다"

3. 알림 배너 클릭
   - 연결 요청 모달 열림
   - 보호자 정보 확인:
     • 이름: 테호자
     • 이메일: test2@test.com

4. 연결 수락
   - "수락" 버튼 클릭
   - 성공 메시지: "테호자님과 연결되었습니다!"
   - 알림 배너 사라짐 확인
```

**3단계: 보호자 앱 (다시)**

```
1. 로그아웃 → test2@test.com 로그인

2. GuardianHomeScreen
   - connectedElderly 목록에 "테르신" 추가 확인
     (현재는 목업이므로 API 연동 후 확인 가능)

3. [선택] 알림 확인
   - 알림 아이콘에 "테르신님이 연결 요청을 수락했습니다" 확인
```

---

### **시나리오 C: 거절 테스트**

#### **추가 사용자 생성** (선택사항)

```bash
# Swagger UI에서 /api/auth/register

{
  "email": "elderly2@test.com",
  "password": "12341234",
  "name": "김할머니",
  "role": "elderly",
  "phone_number": "01099998888"
}
```

#### **거절 플로우**

```
1. 보호자 → 어르신2에게 연결 요청
2. 어르신2 로그인
3. 알림 배너 클릭
4. "거절" 버튼 클릭
5. 확인 팝업: "거절" 클릭
6. 거절 완료 메시지 확인

7. 보호자로 돌아가서
8. 24시간 내 재요청 시도
9. 오류 메시지: "거절 후 24시간이 지나야..."
```

---

### **시나리오 D: 연결 취소/해제 테스트**

#### **취소 (PENDING → 삭제)**

```bash
# Swagger UI
# 보호자로 로그인

# POST /api/users/connections (어르신에게 요청)

# DELETE /api/users/connections/{id}/cancel (취소)

# GET /api/users/connections
# pending 배열이 비어있음 확인
```

#### **해제 (ACTIVE → 삭제)**

```bash
# 연결 수락 후

# DELETE /api/users/connections/{id} (해제)

# GET /api/users/connections
# active 배열이 비어있음 확인
```

---

## 🔍 DB 직접 확인

### **연결 상태 확인**

```sql
docker exec -it grandby_postgres psql -U grandby -d grandby_db

-- 모든 연결
SELECT 
  c.connection_id,
  u1.name as caregiver_name,
  u2.name as elderly_name,
  c.status,
  c.created_at
FROM user_connections c
JOIN users u1 ON c.caregiver_id = u1.user_id
JOIN users u2 ON c.elderly_id = u2.user_id
ORDER BY c.created_at DESC;

-- 대기 중인 연결
SELECT * FROM user_connections WHERE status='PENDING';

-- 활성 연결
SELECT * FROM user_connections WHERE status='ACTIVE';
```

### **알림 확인**

```sql
-- 연결 관련 알림
SELECT 
  n.notification_id,
  u.name as user_name,
  n.type,
  n.title,
  n.message,
  n.is_read,
  n.created_at
FROM notifications n
JOIN users u ON n.user_id = u.user_id
WHERE n.type IN ('CONNECTION_REQUEST', 'CONNECTION_ACCEPTED')
ORDER BY n.created_at DESC;
```

---

## ✅ 체크리스트

### **백엔드 API**
- [ ] 어르신 검색 작동
- [ ] 연결 요청 생성 작동
- [ ] 중복 요청 방지 작동
- [ ] 24시간 재요청 제한 작동
- [ ] 연결 수락 작동
- [ ] 연결 거절 작동
- [ ] 알림 자동 생성 작동

### **프론트엔드**
- [ ] 보호자: 어르신 검색 UI 표시
- [ ] 보호자: 검색 결과 표시
- [ ] 보호자: 연결 요청 버튼 작동
- [ ] 보호자: 성공 메시지 표시
- [ ] 어르신: 알림 배너 표시
- [ ] 어르신: 모달 열림
- [ ] 어르신: 보호자 정보 표시
- [ ] 어르신: 수락 버튼 작동
- [ ] 어르신: 거절 버튼 작동

---

## 🐛 예상 문제 및 해결

### **문제 1: 검색 결과가 안 나와요**

**원인**: 어르신이 DB에 없음

**해결**:
```bash
docker exec grandby_api python scripts/seed_users.py
```

### **문제 2: 알림 배너가 안 보여요**

**원인**: 연결 요청이 없음

**해결**:
```bash
docker exec grandby_api python scripts/seed_connections.py
```

### **문제 3: API 호출이 401 오류**

**원인**: 토큰 만료

**해결**:
- 앱에서 로그아웃 후 재로그인
- AsyncStorage 초기화

### **문제 4: CORS 오류**

**원인**: 프론트엔드 URL이 CORS에 등록 안 됨

**해결**:
```bash
# docker-compose.yml
CORS_ORIGINS: http://localhost:19000,http://localhost:19006,exp://localhost:19000

# 또는
docker-compose restart api
```

---

## 📊 테스트 결과 확인

### **성공 기준**

✅ **백엔드**
- 모든 API가 200/201 응답
- 알림이 자동 생성됨
- DB에 정확한 상태 저장

✅ **프론트엔드**
- UI가 부드럽게 작동
- 로딩 상태 표시
- 성공/실패 메시지 표시
- 목록 자동 새로고침

---

## 🚀 다음 단계

### **Phase 1 완료** ✅
- 기본 연결 기능

### **Phase 2** (향후 개발)
- [ ] connectedElderly를 실제 API로 교체
- [ ] 푸시 알림 (FCM)
- [ ] 이메일 알림
- [ ] 연결 관리 상세 화면
- [ ] 프로필 사진 업로드

---

## 📝 개발자 노트

### **현재 제한 사항**

1. **GuardianHomeScreen**:
   - `connectedElderly`는 아직 목업 데이터
   - 실제 연결된 어르신을 불러오려면 `getConnectedElderly()` API 연동 필요

2. **알림**:
   - 앱 내부 알림만 (DB 저장)
   - 푸시 알림은 미구현

3. **실시간 업데이트**:
   - 수동 새로고침
   - WebSocket/Polling 미구현

### **개선 아이디어**

1. **연결 목록 실시간 업데이트**
   - WebSocket 또는 5초마다 polling
   
2. **프로필 사진**
   - 어르신/보호자 프로필 이미지 업로드
   
3. **연결 통계**
   - 몇 명의 보호자와 연결되어 있는지
   - 연결된 날짜

4. **차단 기능**
   - 특정 보호자 영구 차단

---

**테스트 완료일**: TBD  
**작성자**: Grandby 개발팀  
**버전**: 1.0



