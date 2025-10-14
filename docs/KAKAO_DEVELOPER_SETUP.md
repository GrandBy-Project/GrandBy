# 카카오 로그인 개발자 콘솔 설정 가이드

## 📋 목차
1. [카카오 개발자 계정 생성](#1-카카오-개발자-계정-생성)
2. [애플리케이션 등록](#2-애플리케이션-등록)
3. [플랫폼 설정](#3-플랫폼-설정)
4. [카카오 로그인 활성화](#4-카카오-로그인-활성화)
5. [동의항목 설정](#5-동의항목-설정)
6. [Redirect URI 설정](#6-redirect-uri-설정)
7. [환경변수 설정](#7-환경변수-설정)
8. [테스트 계정 등록](#8-테스트-계정-등록)

---

## 1. 카카오 개발자 계정 생성

### 1-1. 카카오 개발자 사이트 접속
```
https://developers.kakao.com
```

### 1-2. 로그인
- 카카오 계정으로 로그인
- 계정이 없다면 카카오 계정 생성 후 로그인

---

## 2. 애플리케이션 등록

### 2-1. 내 애플리케이션 메뉴 접속
- 상단 메뉴에서 **"내 애플리케이션"** 클릭
- **"애플리케이션 추가하기"** 버튼 클릭

### 2-2. 앱 정보 입력
```
앱 이름: GrandBy (그랜비)
회사명: (선택사항)
```

### 2-3. 앱 생성 완료
- 생성된 앱의 **앱 키** 확인:
  - REST API 키: `e845607e091193791c0d40d313e01d5f`
  - JavaScript 키: `1375f6ffbe24625cdd532203d1fb0d43`
  - Native 앱 키: `a869a1f6e13c03fc0916f4bb9f288343`
  - 앱 ID: `1323125`

---

## 3. 플랫폼 설정

### 3-1. Android 플랫폼 추가
1. **플랫폼 설정** > **Android 플랫폼 등록**
2. 패키지명 입력:
   ```
   com.grandby.app
   ```
3. 키 해시 입력:
   ```bash
   # 개발용 키 해시 생성 (Windows)
   keytool -exportcert -alias androiddebugkey -keystore %USERPROFILE%\.android\debug.keystore | openssl sha1 -binary | openssl base64
   
   # 개발용 키 해시 생성 (Mac/Linux)
   keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore | openssl sha1 -binary | openssl base64
   
   # 기본 비밀번호: android
   ```

### 3-2. iOS 플랫폼 추가
1. **플랫폼 설정** > **iOS 플랫폼 등록**
2. 번들 ID 입력:
   ```
   com.grandby.app
   ```

### 3-3. Web 플랫폼 추가
1. **플랫폼 설정** > **Web 플랫폼 등록**
2. 사이트 도메인 입력:
   ```
   http://localhost:19000
   http://localhost:8081
   https://your-ngrok-url.ngrok.io
   ```

---

## 4. 카카오 로그인 활성화

### 4-1. 카카오 로그인 활성화
1. 좌측 메뉴에서 **"카카오 로그인"** 선택
2. **"활성화 설정"** 을 **ON** 으로 변경

### 4-2. 로그인 동의항목 확인
- 기본적으로 제공되는 항목:
  - 닉네임
  - 프로필 사진

---

## 5. 동의항목 설정

### 5-1. 필수 동의항목 설정
1. 좌측 메뉴에서 **"동의항목"** 선택
2. 다음 항목들을 **필수 동의**로 설정:

#### ✅ 닉네임 (profile_nickname)
```
타입: 필수 동의
접근 권한: 카카오 계정(이메일)
용도: 사용자 이름 표시
```

#### ✅ 카카오계정(이메일) (account_email)
```
타입: 필수 동의
접근 권한: 카카오 계정(이메일)
용도: 이메일 주소로 사용자 식별
```

### 5-2. 선택 동의항목 설정
다음 항목들을 **선택 동의**로 설정:

#### 📱 전화번호 (phone_number)
```
타입: 선택 동의
접근 권한: 전화번호
용도: 사용자 연락처
⚠️ 비즈니스 채널 필요
```

#### 🎂 생일 (birthday)
```
타입: 선택 동의
접근 권한: 생일
용도: 사용자 생년월일
```

#### 👤 성별 (gender)
```
타입: 선택 동의
접근 권한: 성별
용도: 사용자 성별 정보
```

### 5-3. 검수 요청
- 전화번호, 생일, 성별 등의 정보를 사용하려면 **비즈니스 앱 전환** 필요
- 개발 중에는 테스트 계정으로 테스트 가능

---

## 6. Redirect URI 설정

### 6-1. Redirect URI 등록
1. 좌측 메뉴에서 **"카카오 로그인"** 선택
2. **"Redirect URI"** 섹션에서 URI 추가

### 6-2. 등록할 URI 목록

#### 개발 환경 (ngrok)
```
https://your-ngrok-url.ngrok.io/api/auth/kakao/callback
```

#### 로컬 테스트 (선택사항)
```
http://localhost:8000/api/auth/kakao/callback
```

#### 프로덕션 환경 (향후)
```
https://your-domain.com/api/auth/kakao/callback
```

---

## 7. 환경변수 설정

### 7-1. 백엔드 환경변수 (.env)
`backend/.env` 파일에 다음 내용 추가:

```bash
# ==================== Kakao OAuth ====================
KAKAO_REST_API_KEY=e845607e091193791c0d40d313e01d5f
KAKAO_REDIRECT_URI=https://your-ngrok-url.ngrok.io/api/auth/kakao/callback
KAKAO_CLIENT_SECRET=
```

### 7-2. 프론트엔드 환경변수 (.env)
`frontend/.env` 파일에 다음 내용 추가:

```bash
# ==================== Kakao OAuth ====================
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=a869a1f6e13c03fc0916f4bb9f288343
EXPO_PUBLIC_API_BASE_URL=https://your-ngrok-url.ngrok.io
```

---

## 8. 테스트 계정 등록

### 8-1. 테스트 사용자 등록
1. 좌측 메뉴에서 **"카카오 로그인"** > **"테스트 앱"** 선택
2. **"테스트 사용자 관리"** 클릭
3. **"테스트 사용자 추가"** 버튼 클릭
4. 카카오 계정 이메일 또는 전화번호 입력

### 8-2. 테스트 사용자 권한
- 검수 전에도 모든 동의항목 테스트 가능
- 앱이 활성화 상태가 아니어도 로그인 가능

---

## 🔧 추가 설정 (선택사항)

### Client Secret 설정 (보안 강화)
1. **앱 설정** > **보안** 메뉴 선택
2. **Client Secret** 생성
3. 코드 검증 활성화
4. `.env` 파일에 `KAKAO_CLIENT_SECRET` 추가

### 비즈니스 앱 전환
1. **앱 설정** > **비즈니스** 메뉴 선택
2. 사업자 정보 입력
3. 비즈니스 앱 전환 신청
4. 승인 후 전화번호 등 추가 정보 수집 가능

---

## 📝 API 엔드포인트 요약

### 백엔드 API 엔드포인트
```
GET  /api/auth/kakao/login          - 카카오 로그인 URL 생성
POST /api/auth/kakao/callback       - 카카오 로그인 콜백
POST /api/auth/kakao/register       - 카카오 회원가입 (추가 정보)
DELETE /api/auth/kakao/unlink       - 카카오 연결 해제
```

### 프론트엔드 플로우
```
1. 사용자가 "카카오 로그인" 버튼 클릭
2. GET /api/auth/kakao/login 호출 → authorization_url 받기
3. 카카오 로그인 페이지로 이동 (WebView 또는 Browser)
4. 사용자 로그인 및 동의
5. Redirect URI로 돌아오면서 code 파라미터 받기
6. POST /api/auth/kakao/callback에 code 전달
7-1. 기존 사용자: Token 받아서 로그인 완료
7-2. 신규 사용자: KakaoUserInfo 받아서 회원가입 화면으로 이동
8. (신규 사용자만) POST /api/auth/kakao/register로 회원가입
```

---

## 🚨 트러블슈팅

### 문제 1: Redirect URI mismatch 에러
**원인**: 등록된 Redirect URI와 요청한 URI가 다름
**해결**: 
- 개발자 콘솔에서 정확한 URI 등록
- ngrok URL이 바뀌면 다시 등록

### 문제 2: Invalid client 에러
**원인**: REST API 키가 잘못됨
**해결**: 
- `.env` 파일의 `KAKAO_REST_API_KEY` 확인
- 개발자 콘솔에서 키 재확인

### 문제 3: Consent required 에러
**원인**: 필요한 동의항목이 활성화되지 않음
**해결**:
- 개발자 콘솔 > 동의항목에서 필요한 항목 활성화
- 테스트 계정으로 먼저 테스트

### 문제 4: 전화번호/생일/성별 받지 못함
**원인**: 비즈니스 앱만 가능
**해결**:
- 비즈니스 앱 전환 신청
- 또는 테스트 계정으로만 테스트

---

## ✅ 체크리스트

카카오 로그인 구현 전 확인사항:

- [ ] 카카오 개발자 계정 생성
- [ ] 애플리케이션 등록
- [ ] Android/iOS 플랫폼 등록
- [ ] 카카오 로그인 활성화
- [ ] 필수 동의항목 설정 (닉네임, 이메일)
- [ ] Redirect URI 등록
- [ ] 환경변수 설정 (백엔드, 프론트엔드)
- [ ] 테스트 사용자 등록
- [ ] ngrok URL 업데이트

---

## 📞 지원

### 카카오 개발자 문서
```
https://developers.kakao.com/docs/latest/ko/kakaologin/common
```

### 카카오 개발자 포럼
```
https://devtalk.kakao.com
```

---

**작성일**: 2025-10-14  
**버전**: 1.0.0  
**작성자**: GrandBy 개발팀

