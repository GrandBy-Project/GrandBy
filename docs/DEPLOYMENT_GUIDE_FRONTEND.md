# GrandBy 프론트엔드 배포 가이드

이 문서는 GrandBy 프로젝트의 프론트엔드(Expo/React Native)를 Android Play Store에 배포하는 전체 과정을 상세히 설명합니다.

## 📋 목차

1. [사전 준비사항](#사전-준비사항)
2. [EAS CLI 설정](#eas-cli-설정)
3. [프로덕션 빌드](#프로덕션-빌드)
4. [Play Store 제출](#play-store-제출)
5. [업데이트 배포](#업데이트-배포)
6. [유지보수](#유지보수)
7. [트러블슈팅](#트러블슈팅)

---

## 🎯 사전 준비사항

### 필요한 계정 및 도구
- Expo 계정 (https://expo.dev)
- Google Play Console 계정 (https://play.google.com/console)
- Node.js 18+ 설치
- npm 또는 yarn 설치

### 프로젝트 정보
- Package Name: `com.parad327.grandby`
- Project ID: `034ee5d2-677f-46a1-95f6-a022d63f5874`
- 백엔드 API URL: `https://api.grandby-app.store`

---

## 🔧 EAS CLI 설정

### 1. EAS CLI 설치

```bash
npm install -g eas-cli@latest
```

### 2. Expo 계정 로그인

```bash
npx eas-cli login
```

Expo 계정이 없으면 회원가입: https://expo.dev/signup

### 3. 프로젝트 설정 확인

```bash
cd frontend

# EAS 설정 확인
cat eas.json

# app.json 확인
cat app.json | grep -A 5 "android"
```

### 4. 빌드 설정 확인 (최초 1회)

```bash
npx eas-cli build:configure
```

이미 설정되어 있으면 스킵 가능.

---

## 🌍 환경 변수 설정 (선택사항)

### 현재 상태

프로덕션 환경에서는:
- **API URL**: `client.ts`에 하드코딩되어 있음 (`https://api.grandby-app.store`)
- **날씨 API 키**: `weather.ts`에 하드코딩되어 있음

따라서 **EAS Secret 설정은 선택사항**입니다.

### EAS Secret 설정 (원하는 경우)

#### 날씨 API 키 설정 (선택사항)

```bash
# 새로운 명령어 사용 (권장)
npx eas env:create --scope project --name EXPO_PUBLIC_OPENWEATHER_API_KEY --value 24cda4505796412dfad4647a6119adfa --type string --environment production --visibility plain-text

# 또는 기존 명령어 (deprecated지만 작동)
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_OPENWEATHER_API_KEY --value 24cda4505796412dfad4647a6119adfa
# Select secret type: string
# Select visibility: plain-text (EXPO_PUBLIC_ 접두사는 Secret 불가)
# Select environment: production (스페이스바로 선택 후 Enter)
```

**참고:** 현재는 하드코딩되어 있어서 설정하지 않아도 빌드 가능합니다.

---

## 📦 프로덕션 빌드

### 1. 버전 확인

`app.json`의 버전 확인:

```json
{
  "expo": {
    "version": "1.0.0"
  }
}
```

업데이트 시 버전 증가 필요 (예: `1.0.1`)

### 2. Android 프로덕션 빌드 실행

```bash
cd frontend
npx eas-cli build -p android --profile production
```

**빌드 옵션 선택:**
- Build for: **production**
- 기타 설정은 기본값 사용

### 3. 빌드 진행 상황 확인

빌드가 시작되면:
- EAS 빌드 서버에서 자동으로 빌드 진행
- 빌드 시간: **10-30분** 소요
- 진행 상황은 터미널에서 확인 가능

### 4. 빌드 완료

빌드 완료 시:
- AAB 파일 다운로드 링크 제공
- 또는 EAS 웹 대시보드에서 다운로드 가능

**빌드 상태 확인:**
```bash
npx eas-cli build:list
```

---

## 📱 Play Store 제출

### 1. Play Console 설정 (최초 1회)

#### 1-1. 개발자 계정 등록
1. https://play.google.com/console 접속
2. 개발자 등록비 **$25** 결제 (1회만)
3. 개발자 프로그램 정책 동의

#### 1-2. 앱 생성
1. **앱 만들기** 클릭
2. 설정:
   - 앱 이름: **Grandby**
   - 기본 언어: **한국어**
   - 앱 또는 게임: **앱**
   - 무료 또는 유료: **무료**
   - 개발자 프로그램 정책 동의

### 2. 스토어 등록 정보 작성

#### 2-1. 기본 정보
1. **스토어 등록 정보** 탭 클릭
2. 작성 항목:
   - **앱 이름**: Grandby
   - **간단한 설명**: (80자 이내)
   - **전체 설명**: (4000자 이내)
   - **앱 아이콘**: 512x512px PNG
   - **기능 그래픽**: 1024x500px (선택사항)
   - **스크린샷**: 최소 2개 (권장 4-8개)
     - Phone: 1080x1920px 이상
     - 7인치 태블릿: 1200x1920px 이상
     - 10인치 태블릿: 1600x2560px 이상
   - **카테고리**: 건강/의료 또는 라이프스타일
   - **연락처**: 이메일 주소

### 3. 콘텐츠 등급 설정

#### 3-1. 등급 설문 작성
1. **콘텐츠 등급** 탭 클릭
2. 설문 작성 (대부분 무료)
3. 등급 확인서 다운로드

### 4. 개인정보 보호 정책 (필수)

#### 4-1. 정책 URL 입력
1. **정책** → **앱 콘텐츠** 탭
2. **개인정보 보호 정책** 섹션
3. **개인정보 보호 정책 URL** 입력

**정책 페이지가 없으면:**
- GitHub Pages로 간단한 페이지 생성
- 또는 Notion 공개 페이지 사용
- 또는 웹사이트에 정책 페이지 추가

**예시 정책 내용:**
- 수집하는 정보 (이름, 이메일, 전화번호 등)
- 정보 사용 목적
- 정보 보호 방법
- 제3자 공유 정책

### 5. 프로덕션 트랙에 AAB 업로드

#### 5-1. 새 버전 만들기
1. **프로덕션** 트랙 클릭
2. **새 버전 만들기** 클릭

#### 5-2. AAB 파일 업로드
1. **AAB 파일 업로드** 섹션
2. **EAS에서 빌드한 AAB 파일** 선택
   - 다운로드한 AAB 파일 업로드
3. **버전 이름**: `1.0.0` (app.json의 version과 일치)

#### 5-3. 출시 노트 작성
- **출시 노트**: 이번 버전의 주요 변경사항
  - 한국어: 사용자에게 표시
  - 영어: 선택사항

### 6. 출시 검토 제출

#### 6-1. 검토 전 확인사항
- [ ] 스토어 등록 정보 완료
- [ ] 콘텐츠 등급 완료
- [ ] 개인정보 보호 정책 URL 입력 완료
- [ ] AAB 파일 업로드 완료
- [ ] 출시 노트 작성 완료

#### 6-2. 검토 제출
1. **변경사항 검토** 클릭
2. 모든 항목 확인 후 **출시** 버튼 클릭

### 7. 검토 대기

- **일반 검토 시간**: 1-3일
- **첫 배포**: 더 오래 걸릴 수 있음 (최대 7일)
- 검토 상태는 Play Console에서 확인 가능

---

## 🔄 업데이트 배포

### 1. 코드 수정 및 버전 업데이트

#### 1-1. app.json 버전 업데이트

```bash
cd frontend
nano app.json
```

버전 증가:

```json
{
  "expo": {
    "version": "1.0.1"  // 1.0.0 → 1.0.1
  }
}
```

#### 1-2. Git 커밋

```bash
git add .
git commit -m "feat: 버전 1.0.1 업데이트"
git push origin main
```

### 2. 새 빌드 생성

```bash
cd frontend
npx eas-cli build -p android --profile production
```

### 3. Play Store 업데이트 제출

#### 방법 1: EAS 자동 제출 (권장)

**서비스 계정 키 설정 (최초 1회):**

1. Play Console → **설정** → **API 액세스**
2. **서비스 계정 생성** 클릭
3. JSON 키 파일 다운로드
4. EAS에 키 업로드:

```bash
npx eas-cli credentials
# Android → Google Play → 서비스 계정 키 업로드
```

**자동 제출:**

```bash
npx eas-cli submit -p android --profile production
```

#### 방법 2: 수동 제출

1. Play Console → **프로덕션** 트랙
2. **새 버전 만들기** 클릭
3. 새로 빌드한 AAB 파일 업로드
4. 출시 노트 작성
5. **출시** 버튼 클릭

---

## 🔧 유지보수

### 1. 빌드 목록 확인

```bash
npx eas-cli build:list
```

### 2. 빌드 상태 확인

```bash
npx eas-cli build:view [BUILD_ID]
```

### 3. 환경 변수 관리

#### 조회

```bash
npx eas env:list
```

#### 수정

```bash
npx eas env:delete --name EXPO_PUBLIC_OPENWEATHER_API_KEY
npx eas env:create --scope project --name EXPO_PUBLIC_OPENWEATHER_API_KEY --value [새_값] --type string --environment production --visibility plain-text
```

### 4. Keystore 관리

EAS가 자동으로 관리하지만, 필요 시:

```bash
npx eas-cli credentials
# Android → Keystore 관리
```

---

## 🐛 트러블슈팅

### 문제 1: 빌드 실패

**원인:** 환경 변수 누락, 코드 오류 등

**해결:**
```bash
# 빌드 로그 확인
npx eas-cli build:view [BUILD_ID]

# 로컬에서 테스트
npm run android
```

### 문제 2: Play Store 제출 실패

**원인:** 서명 키 불일치, 버전 충돌 등

**해결:**
1. Play Console에서 오류 메시지 확인
2. 서명 키 확인 (EAS가 자동 관리)
3. 버전 번호 확인 (이전 버전보다 높아야 함)

### 문제 3: 앱이 백엔드에 연결 안 됨

**원인:** API URL 설정 문제

**확인:**
```typescript
// frontend/src/api/client.ts
// 프로덕션에서 하드코딩된 URL 확인
if (!__DEV__) {
  return 'https://api.grandby-app.store'; // 올바른지 확인
}
```

**해결:**
- 코드에서 URL 확인
- 백엔드 헬스체크: `https://api.grandby-app.store/health`

### 문제 4: 날씨 정보가 안 나옴

**원인:** OpenWeather API 키 문제

**확인:**
```typescript
// frontend/src/api/weather.ts
const OPENWEATHER_API_KEY = '24cda4505796412dfad4647a6119adfa'; // 확인
```

**해결:**
- API 키가 올바른지 확인
- OpenWeather 계정에서 API 키 확인

---

## 📝 체크리스트

### 첫 배포 전 확인사항

- [ ] Expo 계정 생성 및 로그인 완료
- [ ] EAS CLI 설치 완료
- [ ] `app.json` 버전 확인
- [ ] 백엔드 API URL 확인 (`https://api.grandby-app.store`)
- [ ] Google Play Console 개발자 등록 완료
- [ ] 스토어 등록 정보 작성 완료
- [ ] 콘텐츠 등급 완료
- [ ] 개인정보 보호 정책 URL 입력 완료
- [ ] 프로덕션 빌드 성공
- [ ] AAB 파일 업로드 완료

### 업데이트 배포 전 확인사항

- [ ] 코드 수정 완료 및 테스트 완료
- [ ] `app.json` 버전 업데이트
- [ ] Git 커밋 및 푸시 완료
- [ ] 새 프로덕션 빌드 생성
- [ ] 출시 노트 작성

---

## 🔑 주요 파일 위치

### 설정 파일
- `frontend/app.json` - 앱 기본 설정
- `frontend/eas.json` - EAS 빌드 설정
- `frontend/package.json` - 의존성 관리

### 환경 변수 관련
- `frontend/src/api/client.ts` - API URL 설정 (프로덕션 하드코딩)
- `frontend/src/api/weather.ts` - 날씨 API 키 (하드코딩)

### 빌드 아티팩트
- AAB 파일: EAS 빌드 완료 후 다운로드
- Keystore: EAS가 자동 관리

---

## 📊 버전 관리

### 버전 업데이트 규칙

**Semantic Versioning (SemVer):**
- `MAJOR.MINOR.PATCH` (예: 1.0.0)
- **MAJOR**: 호환되지 않는 변경사항
- **MINOR**: 새로운 기능 추가 (하위 호환)
- **PATCH**: 버그 수정

**예시:**
- `1.0.0` → `1.0.1` (버그 수정)
- `1.0.1` → `1.1.0` (새 기능 추가)
- `1.1.0` → `2.0.0` (주요 변경사항)

### 자동 버전 증가

`eas.json`에 `autoIncrement: true` 설정되어 있어서:
- 빌드 시 자동으로 버전 증가 가능
- 또는 수동으로 `app.json`에서 버전 관리

---

## 🚀 빠른 업데이트 배포 가이드

### 전체 프로세스 (한 번에)

```bash
# 1. 코드 수정
# ... (코드 편집) ...

# 2. 버전 업데이트
cd frontend
nano app.json  # version 증가

# 3. Git 커밋
git add .
git commit -m "feat: 버전 1.0.1 업데이트"
git push origin main

# 4. 빌드
npx eas-cli build -p android --profile production

# 5. 제출 (자동 - 서비스 계정 설정 완료 시)
npx eas-cli submit -p android --profile production
```

---

## 📞 참고 자료

- **Expo 문서**: https://docs.expo.dev
- **EAS Build 문서**: https://docs.expo.dev/build/introduction/
- **Play Console**: https://play.google.com/console
- **프로젝트 저장소**: https://github.com/GrandBy-Project/GrandBy

---

## 💡 팁

### 빌드 시간 단축
- 첫 빌드: 20-30분 (캐시 없음)
- 이후 빌드: 10-20분 (캐시 활용)

### 비용 최적화
- EAS Build: 무료 플랜 (월 30회)
- Play Console: 개발자 등록비 $25 (1회만)

### 테스트 전략
1. **Development 빌드**: 내부 테스트용
2. **Preview 빌드**: APK로 테스트
3. **Production 빌드**: Play Store 배포용

---

**프론트엔드 배포 완료! 🎉**

