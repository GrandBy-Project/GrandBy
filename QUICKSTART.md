# 🚀 Grandby 프로젝트 빠른 시작 가이드

> 신규 팀원을 위한 5분 셋업 가이드

---

## ✅ 사전 준비 (설치 필요)

### 1. 필수 설치 프로그램

- ✅ **Git**: https://git-scm.com/downloads
- ✅ **Docker Desktop**: https://www.docker.com/products/docker-desktop/
- ✅ **Node.js** (v18+): https://nodejs.org/
- ✅ **핸드폰에 Expo Go 앱 설치**:
  - iOS: https://apps.apple.com/app/expo-go/id982107779
  - Android: https://play.google.com/store/apps/details?id=host.exp.exponent

### 2. Docker Desktop 실행

- Windows: 작업 표시줄에서 Docker 아이콘 확인
- Docker Desktop이 실행 중이어야 합니다!

---

## 🎯 3단계로 시작하기

### Step 1: 프로젝트 클론

```bash
git clone https://github.com/GrandBy-Project/GrandBy.git
cd GrandBy
```

### Step 2: 자동 셋업 실행

**Windows PowerShell에서:**
```powershell
.\setup.ps1
```

**또는:**
```bash
npm run setup
```

**실행 내용:**
- Docker 컨테이너 시작
- 데이터베이스 마이그레이션
- Frontend 의존성 설치

⏱️ **소요 시간:** 3-5분

### Step 3: Frontend 실행

```bash
cd frontend
npx expo start --tunnel
```

**QR 코드가 나타나면:**
1. 핸드폰에서 **Expo Go 앱** 실행
2. **QR 코드 스캔**
3. **앱 자동 실행!** 🎉

---

## 🌐 Backend API 확인

브라우저에서 접속:

```
http://localhost:8000/docs
```

**Swagger UI**에서 모든 API를 테스트할 수 있습니다!

### 테스트 사용자 회원가입

1. Swagger UI에서 `POST /api/auth/register` 클릭
2. "Try it out" 버튼 클릭
3. 아래 JSON 입력:

```json
{
  "email": "test@example.com",
  "password": "test1234",
  "full_name": "테스트 사용자",
  "role": "GUARDIAN"
}
```

4. "Execute" 클릭
5. 성공하면 토큰 받음! ✅

---

## 📱 모바일 앱 테스트

### 로그인 화면

1. Expo Go에서 앱 실행
2. 회원가입 또는 로그인
3. 홈 화면 확인

### 현재 구현된 화면

- ✅ 로그인
- ✅ 회원가입
- ✅ 홈 (대시보드)

**나머지 기능은 함께 개발합니다!** 🚀

---

## 🛠️ 유용한 명령어

### Docker 관리

```bash
# 컨테이너 상태 확인
docker ps

# Backend 로그 확인
docker logs grandby_api -f

# DB 로그 확인
docker logs grandby_postgres -f

# 컨테이너 재시작
docker-compose restart

# 컨테이너 중지
docker-compose down
```

### Frontend 관리

```bash
# Tunnel 모드로 실행 (공용 WiFi에서 사용)
npx expo start --tunnel

# 일반 모드로 실행 (같은 WiFi)
npx expo start

# Android 에뮬레이터로 실행
npx expo start --android

# iOS 시뮬레이터로 실행 (Mac만 가능)
npx expo start --ios
```

### NPM 스크립트

```bash
# Docker 시작
npm run docker:up

# Docker 중지
npm run docker:down

# Backend 로그
npm run docker:logs

# DB 마이그레이션
npm run migrate

# Frontend 실행
npm run frontend
```

---

## ❌ 문제 해결

### 1. "Docker not running" 에러

**해결:**
- Docker Desktop을 실행하세요
- 작업 표시줄에 Docker 아이콘이 보여야 합니다

### 2. "Port 8000 already in use" 에러

**해결:**
```bash
# 기존 컨테이너 중지
docker-compose down

# 다시 시작
.\setup.ps1
```

### 3. Frontend가 핸드폰에서 안 보일 때

**해결:**
- `npx expo start --tunnel` 사용 (공용 WiFi)
- 같은 WiFi에 연결되어 있는지 확인
- `frontend/src/api/client.ts`의 IP 주소 확인

### 4. PowerShell 스크립트 파싱 에러

**증상:**
```
ParserError: MissingCatchOrFinally
식에 닫는 ')'가 없습니다
```

**해결:**
```powershell
# 최신 코드 다시 받기
git pull origin main

# 또는 저장소 새로 클론
cd ..
rmdir /s /q GrandBy
git clone https://github.com/GrandBy-Project/GrandBy.git
cd GrandBy
.\setup.ps1
```

**원인:**
- Git clone 시 인코딩 문제 발생
- 이제 .gitattributes로 해결됨

### 5. DB 마이그레이션 실패

**해결:**
```bash
# 수동으로 마이그레이션 실행
docker exec grandby_api alembic upgrade head
```

---

## 📞 도움 요청

문제가 해결되지 않으면:

1. **GitHub Issues**: https://github.com/GrandBy-Project/GrandBy/issues
2. **팀 채팅방**에 질문
3. **로그 첨부**:
   ```bash
   docker logs grandby_api > backend.log
   ```

---

## 🎓 다음 단계

### 개발 환경 설정 완료 후:

1. **코드 구조 파악**
   - `backend/app/` - Backend 코드
   - `frontend/src/` - Frontend 코드

2. **Git 브랜치 전략 확인**
   ```bash
   git checkout develop
   git checkout -b feature/내기능
   ```

3. **Issue 할당 받기**
   - GitHub Issues에서 작업할 기능 선택

4. **개발 시작!** 🚀

---

## 🎉 축하합니다!

이제 Grandby 프로젝트 개발을 시작할 준비가 되었습니다!

**Happy Coding!** 💻✨

---

**작성일:** 2025-10-11  
**최종 업데이트:** 2025-10-11

