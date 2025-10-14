# Grandby EAS 전환 - 팀원 온보딩 가이드

## 📋 개요

**목적**: 팀원들이 Git에서 최신 코드를 받은 후 EAS Build 환경에서 개발하는 전체 과정  
**대상**: 모든 팀원 (Frontend, Backend, QA, 디자이너)  
**소요 시간**: 약 30분 (첫 설정)  

---

## 🚀 1단계: Git에서 최신 코드 받기

### 📥 **코드 다운로드**
```bash
# 1. 저장소 클론 (처음인 경우)
git clone https://github.com/[저장소주소]/grandby_proj.git
cd grandby_proj

# 2. 최신 코드 받기 (이미 클론한 경우)
git pull origin develop
```

### 🔍 **변경사항 확인**
```bash
# 주요 변경된 파일들
- frontend/package.json        # React 버전 변경
- frontend/package-lock.json   # 의존성 업데이트
- frontend/app.json           # EAS 프로젝트 ID 추가
- frontend/eas.json           # EAS 빌드 설정 (새 파일)
- docs/EAS_*.md               # EAS 관련 문서들 (새 파일들)
```

---

## 🛠️ 2단계: EAS 개발 환경 설정

### 📦 **EAS CLI 설치**
```bash
# 전역 설치 (한 번만 하면 됨)
npm install -g eas-cli

# 설치 확인
eas --version
```

### 🔐 **Expo 계정 로그인**
```bash
# EAS 로그인 (각자 개별 계정 필요)
eas login

# 브라우저가 열리면 Expo 계정으로 로그인
# - Google 계정 연동 가능
# - GitHub 계정 연동 가능
# - 새 계정 생성 가능
```

### 📁 **프로젝트 설정**
```bash
# frontend 디렉토리로 이동
cd frontend

# 의존성 설치
npm install

# 프로젝트 상태 확인
npx expo-doctor
# 결과: 17/17 checks passed! 가 나와야 함
```

---

## 📱 3단계: Development Build 설치

### 🔗 **빌드 다운로드**
1. **EAS Builds 페이지 접속**:
   ```
   https://expo.dev/accounts/parad327/projects/frontend/builds
   ```

2. **최신 Development Build 찾기**:
   - "development" 프로필 빌드 선택
   - 가장 최근 빌드 (Build ID: 83dfae06-faa2-47bf-8526-4a59ea3e98e9)

3. **다운로드 방법 선택**:
   - **QR 코드**: 스마트폰으로 직접 스캔
   - **Download**: APK 파일 다운로드 후 전송
   - **Install on device**: Expo Go 앱으로 설치

### 📲 **Android 디바이스에 설치**
```bash
# 1. 개발자 모드 활성화
# 설정 > 휴대전화 정보 > 빌드 번호를 7번 연속 터치

# 2. 알 수 없는 출처 설치 허용
# 설정 > 보안 > 알 수 없는 앱 설치 허용

# 3. APK 설치
# 다운로드한 APK 파일 실행하여 설치

# 4. 앱 실행
# "Grandby Development" 앱 실행
```

### 🍎 **iOS 디바이스에 설치** (선택사항)
```bash
# 1. TestFlight 링크 사용 (권장)
# 2. 또는 직접 IPA 파일 설치
# 3. 기기 등록 필요 (Apple Developer 계정)
```

---

## 🔧 4단계: 개발 서버 시작

### 🌐 **개발 서버 실행**
```bash
# frontend 디렉토리에서
npx expo start --dev-client

# 또는 npm 스크립트 사용
npm start
```

### 📱 **앱과 연결**
1. **Grandby Development 앱 실행**
2. **자동 연결 대기** (몇 초 소요)
3. **또는 QR 코드 스캔**:
   - 터미널에 표시된 QR 코드를 앱으로 스캔
   - 또는 앱에서 수동으로 서버 주소 입력

### ✅ **연결 확인**
```bash
# 터미널에서 다음과 같은 메시지 확인
✅ Metro waiting on exp+frontend://expo-development-client/?url=http%3A%2F%2F[IP]:8081
✅ Android Bundled [시간]ms index.ts ([모듈수] modules)
✅ LOG 🔗 환경 변수에서 API URL 사용: [API_URL]
```

---

## 🎯 5단계: 개발 워크플로우

### 🔥 **일반 개발 (Hot Reload)**
```bash
# JS/TS 코드만 수정하는 경우
- 컴포넌트 수정 → 즉시 반영
- 스타일 변경 → 즉시 반영  
- API 호출 로직 → 즉시 반영
- 상태 관리 코드 → 즉시 반영

# 빌드 불필요! ✅
```

### 🔨 **네이티브 모듈 추가 시**
```bash
# 1. 패키지 설치
npx expo install expo-camera

# 2. 팀 리더에게 빌드 요청 (Slack #grandby-dev)
# 또는 직접 빌드 (권한 있는 경우)
eas build --platform android --profile development

# 3. 새 빌드 완료 후 APK 설치
# 4. 개발 서버 재시작
npx expo start --dev-client
```

---

## 🌐 6단계: 백엔드 서버 연결

### 🖥️ **팀장 서버 사용 (권장)**

#### 팀장 서버 정보
```bash
# 서버 주소 (ngrok)
API_URL: https://dotty-supersecure-pouncingly.ngrok-free.dev

# 또는 로컬 서버 (같은 네트워크)
API_URL: http://[팀장컴퓨터IP]:8000
```

#### 환경 변수 설정
```bash
# frontend/.env 파일 생성/수정
EXPO_PUBLIC_API_BASE_URL=https://dotty-supersecure-pouncingly.ngrok-free.dev
```

#### 연결 확인
```bash
# 개발 서버 시작 시 로그 확인
LOG 🔗 환경 변수에서 API URL 사용: https://dotty-supersecure-pouncingly.ngrok-free.dev
LOG 🔗 API Base URL: https://dotty-supersecure-pouncingly.ngrok-free.dev
```

### 🏠 **로컬 백엔드 서버 실행** (선택사항)

#### Docker로 실행
```bash
# 프로젝트 루트에서
docker-compose up -d

# 서버 상태 확인
docker-compose ps
```

#### 직접 실행
```bash
# backend 디렉토리에서
cd ../backend

# 가상환경 활성화 (Windows)
venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 서버 실행
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 🔄 7단계: 일일 개발 플로우

### 🌅 **매일 아침 시작하기**
```bash
# 1. 최신 코드 받기
git pull origin develop

# 2. 의존성 확인
cd frontend
npm install

# 3. 개발 서버 시작
npx expo start --dev-client

# 4. 앱에서 자동 연결 확인
```

### 🌙 **매일 저녁 마무리하기**
```bash
# 1. 변경사항 커밋
git add .
git commit -m "feat: [기능명] 구현"

# 2. 푸시
git push origin feature/[브랜치명]

# 3. 개발 서버 종료
# 터미널에서 Ctrl+C
```

---

## 🐛 8단계: 문제 해결

### ❌ **앱이 개발 서버에 연결 안 됨**
```bash
# 1. 같은 WiFi인지 확인
# 2. 개발 서버 재시작
r (터미널에서)

# 3. 캐시 삭제
npx expo start --clear

# 4. 앱 재시작
# Android: RR (빠르게 두 번 누르기)
```

### ❌ **빌드 오류 발생**
```bash
# 1. 의존성 재설치
rm -rf node_modules package-lock.json
npm install

# 2. 프로젝트 검증
npx expo-doctor

# 3. EAS 상태 확인
eas project:info
```

### ❌ **API 연결 오류**
```bash
# 1. 팀장에게 서버 상태 확인 요청
# 2. 환경 변수 확인
cat .env

# 3. 네트워크 연결 확인
ping dotty-supersecure-pouncingly.ngrok-free.dev
```

---

## 📋 9단계: 체크리스트

### ✅ **설치 완료 체크**
- [ ] Git에서 최신 코드 받기
- [ ] EAS CLI 설치
- [ ] Expo 계정 로그인
- [ ] npm install 완료
- [ ] expo-doctor 통과 (17/17)
- [ ] Development Build APK 설치
- [ ] 개발 서버 정상 시작
- [ ] 앱과 개발 서버 연결 확인
- [ ] API 서버 연결 확인

### ✅ **개발 시작 전 체크**
- [ ] 최신 코드 동기화
- [ ] 개발 서버 실행
- [ ] 앱 연결 상태 확인
- [ ] Hot Reload 작동 확인

---

## 🎯 10단계: 팀 규칙 및 가이드라인

### 📱 **빌드 관리**
- **정기 빌드**: 월요일, 목요일
- **긴급 빌드**: 필요 시 팀 리더에게 요청
- **네이티브 모듈**: 한 번에 모아서 추가
- **빌드 알림**: Slack #grandby-dev 채널에 공지

### 🔄 **코드 관리**
- **브랜치 전략**: feature/[기능명]
- **커밋 규칙**: feat:, fix:, style:, refactor:
- **PR 리뷰**: 24시간 내 완료
- **코드 품질**: TypeScript, ESLint 준수

### 📞 **소통 방법**
- **일일 스크럼**: 매일 오전 9시
- **블로커 공유**: 즉시 Slack 공지
- **문서화**: 변경사항 즉시 문서 업데이트
- **지식 공유**: 새로운 발견사항 공유

---

## 🔗 11단계: 유용한 링크들

### 📚 **문서**
- [EAS 설정 가이드](./EAS_SETUP_GUIDE.md)
- [EAS 트러블슈팅 리포트](./EAS_TROUBLESHOOTING_REPORT.md)
- [EAS 가능 기능들](./EAS_ENABLED_FEATURES.md)
- [빠른 참조](./EAS_QUICK_REFERENCE.md)

### 🌐 **대시보드**
- [EAS 프로젝트](https://expo.dev/accounts/parad327/projects/frontend)
- [EAS 빌드](https://expo.dev/accounts/parad327/projects/frontend/builds)
- [Expo 문서](https://docs.expo.dev/)

### 💬 **소통**
- Slack: #grandby-dev
- 팀 리더: [이름]
- 기술 지원: [담당자]

---

## 🚨 12단계: 긴급 상황 대응

### 🔴 **서버 다운**
```bash
# 1. 팀장에게 즉시 연락
# 2. Slack #grandby-dev에 공지
# 3. 로컬 백엔드 서버 실행 (가능한 경우)
# 4. 작업 내용 백업
```

### 🔴 **빌드 실패**
```bash
# 1. EAS 대시보드에서 로그 확인
# 2. 팀 리더에게 공유
# 3. 이전 빌드로 임시 작업
# 4. 문제 해결 후 새 빌드 요청
```

### 🔴 **코드 충돌**
```bash
# 1. 충돌 해결
git pull origin develop
# 충돌 파일 수정 후
git add .
git commit -m "resolve: 충돌 해결"

# 2. 팀원과 소통
# 3. 재테스트 후 푸시
```

---

## 📊 13단계: 성능 모니터링

### 📈 **개발 효율성 체크**
```bash
# Hot Reload 속도 확인
# 일반적으로 1-3초 내 반영

# 빌드 시간 확인
# Development 빌드: 10-20분
# Preview 빌드: 15-25분
```

### 🔍 **디버깅 도구**
```bash
# React Native Debugger
# 앱에서: Ctrl+M → "Debug"

# Metro 번들러 로그
npx expo start --dev-client

# Android 로그
adb logcat
```

---

## 🎉 완료!

이제 EAS Build 환경에서 Grandby 개발을 시작할 수 있습니다!

### 🎯 **다음 단계**
1. **기존 기능 테스트**: 로그인, 홈 화면, 캘린더 등
2. **새 기능 개발**: 네이티브 모듈 활용한 기능들
3. **팀 협업**: 정기 빌드 및 코드 리뷰 참여
4. **문서화**: 새로운 기능 문서 작성

### 💡 **기억할 점**
- **Hot Reload 우선**: 빌드 없이 개발 가능한 것부터
- **네이티브 모듈**: 정기 빌드일에 모아서 추가
- **팀 소통**: 문제 발생 시 즉시 공유
- **문서 활용**: 작성된 가이드 적극 활용

---

**작성일**: 2025-01-15  
**작성자**: 팀 리더  
**검토**: [검토자 이름]  
**버전**: 1.0.0
