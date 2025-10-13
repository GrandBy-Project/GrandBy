# 🚀 프론트엔드 개발 환경 설정 가이드

## 📋 개요

그랜비 Grandby 프론트엔드 개발을 위한 환경 설정 가이드입니다.
팀 개발 시 각자 다른 환경에서 작업할 수 있도록 환경 변수 기반으로 구성되어 있습니다.

---

## 🔧 빠른 설정 (5분)

### 1️⃣ 저장소 클론 및 의존성 설치

```bash
# 저장소 클론
git clone <repository-url>
cd grandby_proj

# 프론트엔드 의존성 설치
cd frontend
npm install
```

### 2️⃣ 환경 변수 설정

```bash
# 환경 설정 파일 복사
cp env.example .env

# .env 파일 편집 (아래 설정 방법 참고)
notepad .env  # Windows
code .env     # VS Code
```

### 3️⃣ 개발 서버 실행

```bash
# 로컬 개발 서버 시작
npx expo start

# 터널 모드 (다른 기기에서 접근)
npx expo start --tunnel
```

---

## ⚙️ 상세 설정 방법

### 🔹 방법 1: 로컬 개발 (권장)

백엔드를 직접 실행하는 방식입니다.

```env
# frontend/.env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

**백엔드 실행:**
```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 🔹 방법 2: Ngrok 사용

인터넷을 통해 백엔드에 접근하는 방식입니다.

```env
# frontend/.env
EXPO_PUBLIC_API_BASE_URL=https://your-ngrok-url.ngrok-free.dev
```

**Ngrok 설정:**
```bash
# 1. Ngrok 계정 생성 및 토큰 설정
ngrok authtoken YOUR_AUTHTOKEN

# 2. 백엔드 실행
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 3. 다른 터미널에서 Ngrok 실행
ngrok http 8000

# 4. 생성된 URL을 .env에 설정
```

### 🔹 방법 3: 팀 공용 서버

팀장이 Ngrok을 실행하고 URL을 공유하는 방식입니다.

```env
# frontend/.env
EXPO_PUBLIC_API_BASE_URL=https://team-shared.ngrok-free.dev
```

### 🔹 방법 4: 모바일 테스트 (같은 와이파이)

같은 네트워크의 모바일 기기에서 테스트하는 방식입니다.

```bash
# 1. IP 주소 확인
ipconfig  # Windows
ifconfig  # Mac/Linux

# 2. .env 파일 설정
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000
```

---

## 📱 플랫폼별 실행

### iOS 시뮬레이터
```bash
npx expo start --ios
```

### Android 에뮬레이터
```bash
npx expo start --android
```

### 웹 브라우저
```bash
npx expo start --web
```

### 실제 기기 (QR 코드)
```bash
npx expo start
# Expo Go 앱으로 QR 코드 스캔
```

---

## 🔍 문제 해결

### ❌ API 연결 실패

**증상:** "서버에 연결할 수 없습니다" 오류

**해결 방법:**
1. 백엔드가 실행 중인지 확인
2. `.env` 파일의 URL이 올바른지 확인
3. 방화벽 설정 확인

```bash
# 백엔드 상태 확인
curl http://localhost:8000/health
```

### ❌ Ngrok 연결 실패

**증상:** "ERR_NGROK_4018" 오류

**해결 방법:**
```bash
# 1. Ngrok 계정 생성
# https://dashboard.ngrok.com/signup

# 2. 인증 토큰 설정
ngrok authtoken YOUR_AUTHTOKEN

# 3. 다시 실행
ngrok http 8000
```

### ❌ 모바일에서 연결 안 됨

**증상:** 모바일에서 API 호출 실패

**해결 방법:**
1. 같은 와이파이에 연결되어 있는지 확인
2. IP 주소가 올바른지 확인
3. 백엔드가 `0.0.0.0:8000`으로 실행되고 있는지 확인

```bash
# IP 주소 확인
ipconfig | findstr IPv4  # Windows
ifconfig | grep inet     # Mac/Linux
```

### ❌ 환경 변수 적용 안 됨

**증상:** .env 파일을 수정했는데 반영 안 됨

**해결 방법:**
```bash
# 1. 앱 완전 종료
# 2. 캐시 클리어
npx expo start --clear

# 3. 다시 시작
npx expo start
```

---

## 🛠️ 개발 도구

### 디버깅

```bash
# React Native Debugger
npx react-native log-android  # Android
npx react-native log-ios      # iOS

# Expo 개발자 도구
# 앱에서 흔들기 → Debug → Debug Remote JS
```

### 성능 분석

```bash
# 번들 크기 분석
npx expo export --platform web --dev

# 메트로 번들러 캐시 클리어
npx expo start --clear
```

---

## 📚 추가 리소스

### 공식 문서
- [Expo 공식 문서](https://docs.expo.dev/)
- [React Native 문서](https://reactnative.dev/)
- [Expo Router 문서](https://expo.github.io/router/)

### 유용한 명령어

```bash
# 프로젝트 정보 확인
npx expo doctor

# 의존성 업데이트 확인
npm outdated

# 캐시 정리
npm cache clean --force
npx expo start --clear
```

---

## 👥 팀 개발 팁

### 1. 환경 변수 공유
- `.env` 파일은 절대 Git에 커밋하지 마세요
- 팀원들에게는 `env.example` 파일을 참고하도록 안내
- 새로운 환경 변수 추가 시 `env.example`도 업데이트

### 2. Ngrok URL 관리
- 팀장이 안정적인 Ngrok URL 제공
- URL 변경 시 팀원들에게 알림
- 가능하면 고정 도메인 사용 (유료 플랜)

### 3. 코드 스타일
- Prettier, ESLint 설정 준수
- 커밋 전에 `npm run lint` 실행
- 의미 있는 커밋 메시지 작성

---

## 🆘 도움이 필요하다면

1. **문서 확인:** 이 가이드의 문제 해결 섹션 참고
2. **팀 채팅:** 슬랙/디스코드에서 질문
3. **이슈 등록:** GitHub Issues에 버그 리포트
4. **코드 리뷰:** PR 시 상세한 설명 추가

---

**🎉 설정 완료! 이제 개발을 시작할 수 있습니다!**
