# Grandby 프로젝트 EAS Build 설정 가이드

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [EAS 전환 배경](#eas-전환-배경)
3. [설정 완료 내역](#설정-완료-내역)
4. [트러블슈팅](#트러블슈팅)
5. [데일리 스크럼 (개발 워크플로우)](#데일리-스크럼-개발-워크플로우)
6. [팀원 가이드라인](#팀원-가이드라인)
7. [FAQ](#faq)

---

## 프로젝트 개요

**Grandby** - 노인과 보호자를 위한 AI 기반 일정 관리 및 전화 알림 서비스

### 기술 스택
- **Backend**: FastAPI, PostgreSQL, Redis, Celery, Twilio, OpenAI
- **Frontend**: React Native (Expo), React 19.2.0, TypeScript
- **배포**: Docker Compose (Backend), EAS Build (Frontend)

### 프로젝트 구조
```
grandby_proj/
├── backend/          # FastAPI 서버
│   ├── app/
│   ├── migrations/
│   └── Dockerfile
├── frontend/         # React Native 앱
│   ├── app/          # Expo Router 페이지
│   ├── src/          # 컴포넌트, 스크린, API
│   ├── app.json      # Expo 설정
│   ├── eas.json      # EAS Build 설정
│   └── package.json
└── docker-compose.yml
```

---

## EAS 전환 배경

### Expo Go의 한계
- ❌ 네이티브 모듈 사용 불가
- ❌ 커스텀 네이티브 코드 추가 불가
- ❌ 특정 라이브러리(카메라, 알림, 위치 등) 제한적
- ❌ Production 빌드 생성 불가

### EAS Build의 장점
- ✅ 모든 네이티브 라이브러리 사용 가능
- ✅ 커스텀 네이티브 코드 추가 가능
- ✅ Production 빌드 및 스토어 배포 가능
- ✅ CI/CD 파이프라인 구축 가능
- ✅ 클라우드 빌드 지원 (로컬 환경 불필요)

---

## 설정 완료 내역

### 1. EAS CLI 설치 및 프로젝트 초기화
```bash
npm install -g eas-cli
eas login
cd frontend
eas build:configure
```

**생성된 프로젝트 정보:**
- EAS Project ID: `e28f1ca6-9d5f-4503-997a-ac6a21fd7eb0`
- Owner: `parad327`
- Project URL: https://expo.dev/accounts/parad327/projects/frontend

### 2. 의존성 업데이트
```json
// package.json 변경 내역
{
  "dependencies": {
    "react": "19.2.0",           // 19.1.0 → 19.2.0
    "react-dom": "19.2.0",       // 19.1.0 → 19.2.0
    "expo-dev-client": "~6.0.15", // 새로 추가
    "expo-constants": "~18.0.9"   // 새로 추가
  },
  "devDependencies": {
    "@types/react": "19.2.0",     // ~19.1.10 → 19.2.0
    "@types/react-dom": "19.2.0"  // ~19.1.7 → 19.2.0
  }
}
```

### 3. app.json 설정
```json
{
  "expo": {
    "name": "Grandby",
    "slug": "frontend",
    "version": "1.0.0",
    "owner": "parad327",
    "ios": {
      "bundleIdentifier": "com.parad327.grandby"
    },
    "android": {
      "package": "com.parad327.grandby"
    },
    "extra": {
      "eas": {
        "projectId": "e28f1ca6-9d5f-4503-997a-ac6a21fd7eb0"
      }
    }
  }
}
```

### 4. eas.json 설정
```json
{
  "cli": {
    "version": ">= 13.2.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

### 5. 첫 번째 빌드 성공
- Build URL: https://expo.dev/accounts/parad327/projects/frontend/builds/83dfae06-faa2-47bf-8526-4a59ea3e98e9
- Platform: Android
- Profile: Development
- Status: ✅ 완료

---

## 트러블슈팅

### 🔴 문제 1: React 버전 충돌 (ERESOLVE)
**증상:**
```
npm error ERESOLVE could not resolve
npm error peer react@"^19.2.0" from react-dom@19.2.0
npm error Found: react@19.1.0
```

**원인:**
- `react-dom@19.2.0`이 `react@^19.2.0`을 요구
- 현재 설치된 React는 `19.1.0`

**해결 방법:**
```bash
cd frontend
npm install react@19.2.0 react-dom@19.2.0 @types/react@19.2.0 @types/react-dom@19.2.0
```

**결과:** ✅ 해결됨

---

### 🟡 문제 2: Slug 불일치 오류
**증상:**
```
Project config: Slug for project identified by "extra.eas.projectId" (frontend)
does not match the "slug" field (grandby).
```

**원인:**
- EAS 프로젝트가 "frontend"로 생성됨
- `app.json`의 slug를 "grandby"로 변경하려다 충돌 발생

**해결 방법:**
1. **옵션 A**: slug를 "frontend"로 유지 (선택한 방법)
```json
{
  "expo": {
    "slug": "frontend"
  }
}
```

2. **옵션 B**: EAS 웹사이트에서 프로젝트 slug 변경
   - https://expo.dev/accounts/parad327/projects/frontend/settings
   - Project Settings → Slug 변경

**결과:** ✅ 옵션 A로 해결됨

---

### 🟡 문제 3: expo-constants 누락
**증상:**
```
✖ Check that required peer dependencies are installed
Missing peer dependency: expo-constants
Required by: expo-router
```

**원인:**
- `expo-router`가 `expo-constants`를 peer dependency로 요구
- 초기 설정 시 누락됨

**해결 방법:**
```bash
cd frontend
npx expo install expo-constants
```

**결과:** ✅ 해결됨

---

### 🟡 문제 4: React 버전 불일치 경고
**증상:**
```
✖ Check that packages match versions required by installed Expo SDK
⚠️ Minor version mismatches
package           expected  found
react             19.1.0    19.2.0
react-dom         19.1.0    19.1.0
```

**원인:**
- Expo SDK 54는 React 19.1.0을 권장
- 하지만 `expo-dev-client` 설치를 위해 19.2.0으로 업그레이드 필요

**해결 방법:**
이 경고는 무시해도 됩니다. React 19.2.0은 19.1.0과 호환되며, 실제 빌드 및 실행에 문제가 없습니다.

**또는:**
```bash
# package.json에 예외 추가
{
  "expo": {
    "install": {
      "exclude": ["react", "react-dom", "@types/react", "@types/react-dom"]
    }
  }
}
```

**결과:** ⚠️ 경고이지만 빌드 성공, 무시 가능

---

### 🔴 문제 5: appVersionSource 누락 경고
**증상:**
```
The field "cli.appVersionSource" is not set, but it will be required in the future.
```

**원인:**
- EAS CLI가 앱 버전 관리 방식을 명시하지 않음

**해결 방법:**
`eas.json`에 추가:
```json
{
  "cli": {
    "appVersionSource": "remote"
  }
}
```

- `"remote"`: EAS 서버에서 버전 관리 (권장)
- `"local"`: 로컬 app.json에서 버전 관리

**결과:** ✅ 해결됨

---

## 데일리 스크럼 (개발 워크플로우)

### 일반 개발 (JS/TS 코드만 수정)
**빌드 없이 개발 가능!**

```bash
# 1. 개발 서버 시작
cd frontend
npx expo start --dev-client

# 2. 디바이스에서 Grandby Development 앱 실행
# 3. QR 코드 스캔 또는 자동 연결
# 4. 코드 수정 → 자동 Hot Reload
```

**특징:**
- ⚡ 빠른 피드백 (Hot Reload)
- 🔄 빌드 불필요
- 💻 로컬 개발 서버 사용

---

### 네이티브 모듈 추가 시
**새 빌드 필요!**

```bash
# 1. 네이티브 모듈 설치
npx expo install expo-camera expo-location

# 2. EAS 개발 빌드 생성 (약 10-20분)
eas build --platform android --profile development

# 3. 빌드 완료 후 APK 다운로드 및 설치
# 4. 개발 서버 시작
npx expo start --dev-client
```

**네이티브 모듈 예시:**
- `expo-camera`: 카메라 기능
- `expo-location`: 위치 추적
- `expo-notifications`: 푸시 알림
- `expo-local-authentication`: 생체 인증
- `expo-image-picker`: 이미지/비디오 선택

---

### Preview 빌드 (내부 테스트용)
```bash
# Android APK 생성
eas build --platform android --profile preview

# 빌드 완료 후 팀원에게 다운로드 링크 공유
# QR 코드로 바로 설치 가능
```

**사용 시나리오:**
- 🧪 QA 팀 테스트
- 👥 내부 베타 테스트
- 📱 실제 디바이스에서 기능 검증

---

### Production 빌드 (스토어 배포용)
```bash
# Android (Google Play)
eas build --platform android --profile production
eas submit --platform android

# iOS (App Store)
eas build --platform ios --profile production
eas submit --platform ios
```

**배포 전 체크리스트:**
- [ ] 모든 기능 테스트 완료
- [ ] 버전 번호 업데이트 (app.json)
- [ ] 릴리즈 노트 작성
- [ ] 스크린샷 및 앱 설명 업데이트

---

### 일일 개발 플로우 예시

#### Case 1: UI 개발 (일반적인 경우)
```
09:00 - npx expo start --dev-client 실행
09:05 - HomeScreen.tsx 수정 → 즉시 반영 확인
10:00 - CalendarScreen.tsx 추가 → Hot Reload
11:00 - API 연동 테스트
12:00 - 점심
13:00 - 버그 수정 및 스타일 조정
17:00 - 개발 서버 종료
```

#### Case 2: 네이티브 기능 추가
```
09:00 - expo-camera 설치
09:05 - eas build --platform android --profile development 실행
09:10 - 빌드 대기 (다른 작업 진행 가능)
09:25 - 빌드 완료 알림
09:30 - APK 다운로드 및 설치
09:35 - npx expo start --dev-client 실행
09:40 - 카메라 기능 개발 시작
```

---

## 팀원 가이드라인

### 🎯 신규 팀원 온보딩

#### Step 1: 개발 환경 설정
```bash
# 1. 저장소 클론
git clone https://github.com/GrandBy-Project/GrandBy.git
cd GrandBy/frontend

# 2. 의존성 설치
npm install

# 3. EAS CLI 설치 (전역)
npm install -g eas-cli

# 4. Expo 계정 로그인
eas login
```

#### Step 2: Development Build 설치
1. 아래 링크에서 최신 Development Build 다운로드:
   https://expo.dev/accounts/parad327/projects/frontend/builds

2. Android 디바이스에 APK 설치
   - 개발자 모드 활성화 필요
   - "알 수 없는 출처" 설치 허용

3. iOS 디바이스 (Mac 필요)
   - TestFlight 링크 또는 직접 설치

#### Step 3: 개발 시작
```bash
# frontend 디렉토리에서
npx expo start --dev-client

# 디바이스에서 Grandby Development 앱 실행
# QR 코드 스캔 또는 자동 연결
```

---

### 📱 Development Build 사용 방법

#### 빌드 다운로드
1. EAS 대시보드 접속:
   https://expo.dev/accounts/parad327/projects/frontend/builds

2. 최신 "development" 프로필 빌드 찾기

3. 다운로드 옵션:
   - **QR 코드**: 디바이스로 직접 스캔
   - **Download**: APK 파일 다운로드 후 전송
   - **Install on device**: Expo Go 앱으로 설치 (Android)

#### 앱 실행
1. **Grandby Development** 앱 실행
2. 자동으로 개발 서버 검색 시작
3. 또는 수동으로 QR 코드 스캔

---

### 🔧 일반 개발 작업

#### JS/TS 코드 수정 (빌드 불필요)
```bash
# 개발 서버만 실행
npx expo start --dev-client

# 수정 가능한 파일 (빌드 불필요):
- app/*.tsx (페이지)
- src/components/*.tsx (컴포넌트)
- src/api/*.ts (API 호출)
- src/store/*.ts (상태 관리)
- styles, constants 등
```

**Hot Reload 활성화:**
- 파일 저장 시 자동으로 앱에 반영
- Cmd/Ctrl + R로 수동 새로고침 가능

#### 네이티브 모듈 추가 (빌드 필요)
```bash
# 1. 패키지 설치
npx expo install [패키지명]

# 2. 팀 리더에게 빌드 요청 또는 직접 빌드
eas build --platform android --profile development

# 3. 새 빌드 설치 후 개발 진행
```

**팀 규칙:**
- 네이티브 모듈 추가 시 Slack에 공지
- 새 빌드 링크 공유
- 모든 팀원이 새 빌드로 업데이트

---

### 🐛 디버깅

#### React Native Debugger 사용
```bash
# Chrome DevTools
# 앱에서: Cmd/Ctrl + M → "Debug"

# 또는 Flipper 사용 (권장)
# https://fbflipper.com/
```

#### 로그 확인
```bash
# Metro 번들러 로그
npx expo start --dev-client

# Android 로그
adb logcat

# iOS 로그 (Mac)
xcrun simctl spawn booted log stream --predicate 'processImagePath endswith "Grandby"'
```

#### 일반적인 문제 해결
```bash
# 1. 캐시 삭제
npx expo start --clear

# 2. node_modules 재설치
rm -rf node_modules
npm install

# 3. Metro 번들러 재시작
r (터미널에서)
```

---

### 📤 코드 커밋 및 푸시

#### 브랜치 전략
```bash
# feature 브랜치 생성
git checkout -b feature/[기능명]

# 예시
git checkout -b feature/camera-integration
git checkout -b fix/login-bug
```

#### 커밋 메시지 규칙
```
<타입>(<범위>): <제목>

예시:
feat(camera): 카메라 촬영 기능 추가
fix(login): 로그인 버튼 비활성화 버그 수정
style(home): 홈 화면 레이아웃 개선
refactor(api): API 클라이언트 리팩토링
```

#### Pull Request 생성
1. 기능 개발 완료 후 push
2. GitHub에서 PR 생성
3. 코드 리뷰 요청
4. 승인 후 develop 브랜치에 merge

---

### 🚀 빌드 권한 및 책임

#### 누가 빌드를 생성하나요?
- **팀 리더**: Production 빌드
- **시니어 개발자**: Development, Preview 빌드
- **주니어 개발자**: 필요 시 요청

#### 빌드 생성 시 주의사항
```bash
# ⚠️ 빌드 전 확인 사항
1. 최신 develop 브랜치와 동기화
2. package.json 의존성 확인
3. app.json 버전 확인 (production의 경우)
4. 빌드 프로필 확인 (development/preview/production)

# ✅ 빌드 명령어
eas build --platform android --profile [프로필명]

# 📢 빌드 완료 후
1. Slack에 빌드 링크 공유
2. 변경 사항 요약 작성
3. 테스트 필요 사항 명시
```

---

### 📊 EAS 대시보드 활용

#### 빌드 모니터링
- URL: https://expo.dev/accounts/parad327/projects/frontend
- 실시간 빌드 진행 상황 확인
- 빌드 로그 및 에러 확인
- 빌드 아티팩트 다운로드

#### 빌드 히스토리
```bash
# CLI로 빌드 목록 확인
eas build:list

# 특정 빌드 상세 정보
eas build:view [BUILD_ID]
```

---

### 🧪 테스트 가이드

#### 개발 중 테스트
```bash
# 1. 개발 서버 실행
npx expo start --dev-client

# 2. 기능 테스트
- 각 화면 네비게이션 확인
- API 연동 테스트
- 에러 핸들링 확인

# 3. 여러 디바이스에서 테스트
- 다양한 Android 버전
- 다양한 화면 크기
```

#### Preview 빌드 테스트
```bash
# Preview 빌드 생성
eas build --platform android --profile preview

# 테스트 항목:
□ 로그인/로그아웃
□ 주요 기능 동작
□ 네트워크 오류 처리
□ 권한 요청 (카메라, 위치 등)
□ 백그라운드 동작
```

---

### 🔐 환경 변수 관리

#### 로컬 개발
```bash
# frontend/.env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
```

#### EAS 빌드
```bash
# eas.json에 환경 변수 추가
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://api.grandby.com"
      }
    }
  }
}

# 또는 빌드 시 전달
eas build --platform android --profile production \
  --env EXPO_PUBLIC_API_BASE_URL=https://api.grandby.com
```

#### 코드에서 사용
```typescript
const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
```

---

### 💡 베스트 프랙티스

#### 1. 효율적인 개발
- ✅ JS/TS 코드는 빌드 없이 개발
- ✅ 네이티브 모듈은 한 번에 모아서 추가
- ✅ 자주 커밋, 자주 푸시
- ✅ 작은 단위로 PR 생성

#### 2. 코드 품질
- ✅ TypeScript 타입 정의 철저히
- ✅ ESLint 규칙 준수
- ✅ 컴포넌트 재사용성 고려
- ✅ 코드 리뷰 적극 참여

#### 3. 협업
- ✅ 일일 스탠드업 참여
- ✅ 블로커 즉시 공유
- ✅ 문서화 습관화
- ✅ 지식 공유

---

## FAQ

### Q1: 빌드 시간이 너무 오래 걸려요
**A:** EAS 무료 플랜은 빌드 대기 시간이 있을 수 있습니다.
- 평균 10-20분 소요
- 유료 플랜으로 업그레이드 시 우선 순위 상승
- 빌드 중 다른 작업 진행 권장

### Q2: Development Build를 언제 업데이트해야 하나요?
**A:** 다음 경우에만 업데이트 필요:
- ✅ 네이티브 모듈 추가/제거
- ✅ app.json 설정 변경
- ✅ 네이티브 코드 수정
- ❌ JS/TS 코드만 수정한 경우 불필요

### Q3: Expo Go와 Development Build의 차이는?
**A:**
- **Expo Go**: 제한된 네이티브 기능, 빠른 시작
- **Development Build**: 모든 네이티브 기능, 빌드 필요

### Q4: 로컬에서 빌드할 수 있나요?
**A:** 가능합니다:
```bash
eas build --platform android --profile development --local
```
- Android Studio 또는 Xcode 필요
- 빠른 빌드 (로컬 리소스 사용)

### Q5: iOS 빌드는 어떻게 하나요?
**A:** iOS 빌드는 Apple 개발자 계정 필요:
```bash
# 디바이스 등록
eas device:create

# iOS 빌드
eas build --platform ios --profile development
```

### Q6: 빌드가 실패했어요
**A:** 빌드 로그 확인:
1. EAS 대시보드에서 빌드 클릭
2. "View Logs" 확인
3. 에러 메시지 검색 또는 팀에 공유

### Q7: 여러 빌드 환경을 관리하려면?
**A:** eas.json에 프로필 추가:
```json
{
  "build": {
    "staging": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://staging.grandby.com"
      }
    }
  }
}
```

### Q8: 빌드 비용은 얼마인가요?
**A:** EAS 무료 플랜:
- 월 30회 빌드 무료
- 초과 시 유료 ($29/월 Production 플랜)

---

## 참고 자료

### 공식 문서
- [EAS Build 공식 문서](https://docs.expo.dev/build/introduction/)
- [Expo Development Client](https://docs.expo.dev/development/introduction/)
- [EAS Submit](https://docs.expo.dev/submit/introduction/)

### 내부 문서
- [API 문서](../backend/README.md)
- [프로젝트 아키텍처](./ARCHITECTURE.md)
- [배포 가이드](./DEPLOYMENT.md)

### 유용한 명령어
```bash
# EAS 프로젝트 정보
eas project:info

# 빌드 목록
eas build:list

# 디바이스 등록 (iOS)
eas device:create

# 빌드 취소
eas build:cancel [BUILD_ID]

# 환경 변수 관리
eas secret:list
eas secret:create --name API_KEY --value xxx
```

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2025-10-15
**작성자**: Grandby Development Team
**문의**: 팀 리더 또는 Slack #grandby-dev 채널
