# 🚀 카카오 로그인 사용 가이드

## ✅ 완료된 구현

### 백엔드 ✅
- User 모델 확장 (kakao_id, 토큰, 생년월일, 성별)
- 카카오 API 유틸리티 (`backend/app/utils/kakao.py`)
- 카카오 인증 엔드포인트 4개
- 데이터베이스 마이그레이션
- 환경설정

### 프론트엔드 ✅
- 카카오 로그인 버튼 연동 (`LoginScreen.tsx`)
- WebBrowser 인증 플로우
- 추가 정보 입력 화면 (`KakaoRegisterScreen.tsx`)
- API 함수 구현 (`api/auth.ts`)

---

## 🔧 설정 방법

### 1. 백엔드 환경변수 설정

`backend/.env` 파일에 추가:

```bash
# 카카오 OAuth
KAKAO_REST_API_KEY=e845607e091193791c0d40d313e01d5f
KAKAO_REDIRECT_URI=https://your-ngrok-url.ngrok.io/api/auth/kakao/callback
KAKAO_CLIENT_SECRET=
```

### 2. 프론트엔드 환경변수 설정

`frontend/.env` 파일 생성 (`.env.example` 참고):

```bash
EXPO_PUBLIC_API_BASE_URL=https://your-ngrok-url.ngrok.io
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=a869a1f6e13c03fc0916f4bb9f288343
```

### 3. 카카오 개발자 콘솔 설정

**필수 설정 사항** (자세한 내용은 `docs/KAKAO_DEVELOPER_SETUP.md` 참고):

1. ✅ 카카오 로그인 활성화
2. ✅ Redirect URI 등록:
   ```
   https://your-ngrok-url.ngrok.io/api/auth/kakao/callback
   ```
3. ✅ 동의항목 설정:
   - 필수: 닉네임, 이메일
   - 선택: 전화번호, 생일, 성별
4. ✅ 플랫폼 등록:
   - Android: 패키지명 `com.grandby.app`
   - iOS: 번들 ID `com.grandby.app`

### 4. Docker 재시작

```bash
# 백엔드 재시작
docker-compose restart api

# 또는 전체 재시작
docker-compose down
docker-compose up -d
```

### 5. 프론트엔드 실행

```bash
cd frontend
npm start
# 또는
npx expo start --lan
```

---

## 📱 사용자 플로우

### 기존 사용자 (자동 로그인)
```
1. 카카오 로그인 버튼 클릭
2. 카카오 인증 페이지 열림 (WebBrowser)
3. 카카오 계정으로 로그인
4. 동의 후 앱으로 돌아오기
5. JWT 토큰 자동 발급
6. 홈 화면으로 이동 ✅
```

### 신규 사용자 (추가 정보 입력)
```
1. 카카오 로그인 버튼 클릭
2. 카카오 인증 페이지 열림 (WebBrowser)
3. 카카오 계정으로 로그인
4. 동의 후 앱으로 돌아오기
5. 추가 정보 입력 화면 표시
   - 이메일 (카카오에서 못 받은 경우 필수)
   - 이름 (필수)
   - 전화번호 (필수)
   - 역할 선택 (어르신/보호자)
   - 비밀번호 설정 (필수)
6. 회원가입 완료
7. 홈 화면으로 이동 ✅
```

---

## 🎯 주요 기능

### 1. 자동 로그인
- 카카오 ID로 기존 사용자 확인
- 자동으로 JWT 토큰 발급
- 카카오 토큰 저장 (자동 갱신 가능)

### 2. 신규 사용자 회원가입
- 카카오에서 받은 정보 자동 입력
- 부족한 정보만 추가 입력
- 역할 선택 (어르신/보호자)
- 비밀번호 필수 설정

### 3. 보안
- 카카오 사용자도 비밀번호 설정 필수
- 카카오 로그인 장애 시 일반 로그인 가능
- 카카오 연결 해제 후에도 계정 유지

---

## 🧪 테스트 방법

### 1. API 테스트 (Postman/Swagger)
```
http://localhost:8000/docs
```

### 2. 실제 테스트
1. 프론트엔드 앱 실행
2. 로그인 화면에서 "카카오 로그인" 버튼 클릭
3. 카카오 계정으로 로그인
4. 플로우 확인

---

## 🚨 트러블슈팅

### 문제 1: "Redirect URI mismatch" 에러
**원인**: 등록된 Redirect URI와 요청한 URI가 다름

**해결**:
1. 카카오 개발자 콘솔에서 Redirect URI 확인
2. ngrok URL이 바뀌면 다시 등록
3. 백엔드 `.env` 파일의 `KAKAO_REDIRECT_URI` 업데이트
4. Docker 재시작: `docker-compose restart api`

### 문제 2: "Invalid client" 에러
**원인**: REST API 키가 잘못됨

**해결**:
- 백엔드 `.env` 파일의 `KAKAO_REST_API_KEY` 확인
- 카카오 개발자 콘솔에서 키 재확인

### 문제 3: WebBrowser가 열리지 않음
**원인**: 패키지 미설치 또는 권한 문제

**해결**:
```bash
cd frontend
npm install expo-web-browser expo-auth-session
```

### 문제 4: 카카오에서 이메일을 못 받음
**원인**: 카카오 계정에 이메일 미등록 또는 동의하지 않음

**해결**:
- 추가 정보 입력 화면에서 이메일 직접 입력
- 카카오 계정에 이메일 등록 권장

### 문제 5: 전화번호/생년월일/성별을 못 받음
**원인**: 비즈니스 앱만 수집 가능

**해결**:
- 비즈니스 앱 전환 신청
- 또는 추가 정보 입력 화면에서 입력받기 (전화번호는 필수 입력)

---

## 📄 관련 문서

- [카카오 개발자 콘솔 설정 가이드](./KAKAO_DEVELOPER_SETUP.md)
- [카카오 로그인 구현 완료 문서](./KAKAO_LOGIN_IMPLEMENTATION.md)

---

## ✨ 완료!

카카오 소셜 로그인이 완전히 구현되었습니다! 🎉

이제 다음 명령어로 테스트해보세요:

```bash
# 1. Docker 확인
docker-compose ps

# 2. 프론트엔드 실행
cd frontend
npm start

# 3. 앱에서 카카오 로그인 테스트!
```

**주의**: ngrok URL이 바뀔 때마다:
1. 카카오 개발자 콘솔에서 Redirect URI 업데이트
2. 백엔드 `.env` 파일의 `KAKAO_REDIRECT_URI` 업데이트
3. 프론트엔드 `.env` 파일의 `EXPO_PUBLIC_API_BASE_URL` 업데이트
4. Docker 재시작

---

**작성일**: 2025-10-14  
**버전**: 1.0.0  
**작성자**: GrandBy 개발팀

