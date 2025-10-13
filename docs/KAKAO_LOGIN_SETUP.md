# 카카오 로그인 설정 가이드

## 📋 카카오 개발자 애플리케이션 등록

### 1단계: 카카오 개발자 계정 생성

1. **카카오 개발자 사이트 접속**
   - https://developers.kakao.com

2. **로그인**
   - 카카오 계정으로 로그인
   - 계정이 없다면 회원가입

### 2단계: 애플리케이션 등록

1. **[내 애플리케이션] 메뉴 클릭**
   - 우측 상단 프로필 → "내 애플리케이션"

2. **애플리케이션 추가하기**
   ```
   앱 이름: Grandby (그랜비)
   사업자명: [회사명 또는 개인 이름]
   카테고리: 라이프스타일 > 건강/의료
   ```

3. **앱 키 확인**
   - 생성 후 "앱 키" 탭에서 다음 키들 복사:
   ```
   REST API 키: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   Native 앱 키: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### 3단계: 플랫폼 설정

#### Android 설정

1. **[플랫폼] → [Android 플랫폼 등록]**
   ```
   패키지명: com.grandby.app
   마켓 URL: (나중에 입력)
   키 해시: (아래 명령어로 생성)
   ```

2. **키 해시 생성 (개발용)**
   ```bash
   # Windows (PowerShell)
   keytool -exportcert -alias androiddebugkey -keystore %USERPROFILE%\.android\debug.keystore -storepass android -keypass android | openssl sha1 -binary | openssl base64
   
   # Mac/Linux
   keytool -exportcert -alias androiddebugkey -keystore ~/.android/debug.keystore -storepass android -keypass android | openssl sha1 -binary | openssl base64
   ```

3. **키 해시 등록**
   - 생성된 키 해시를 Kakao Developers에 등록

#### iOS 설정

1. **[플랫폼] → [iOS 플랫폼 등록]**
   ```
   Bundle ID: com.grandby.app
   App Store ID: (나중에 입력)
   ```

### 4단계: 카카오 로그인 활성화

1. **[제품 설정] → [카카오 로그인]**
   - "카카오 로그인 활성화" ON

2. **Redirect URI 설정**
   ```
   kakaoxxxxxxxxxxxxxxxx://oauth
   ```
   (xxxxxxxx는 Native 앱 키)

3. **동의 항목 설정**
   - [제품 설정] → [카카오 로그인] → [동의 항목]
   
   **필수 동의 항목:**
   - 닉네임 (필수)
   - 이메일 (필수)
   - 전화번호 (선택 → 필수로 변경)

### 5단계: 비즈니스 인증 (나중에)

프로덕션 배포 전 필수:
- 사업자 등록증 또는 개인 신분증
- 서비스 URL
- 개인정보 처리방침 URL

---

## 🔧 프로젝트 설정

### 1. 환경 변수 설정

**백엔드 `.env` 파일:**
```env
# Kakao OAuth
KAKAO_REST_API_KEY=your_rest_api_key
KAKAO_REDIRECT_URI=http://localhost:8000/auth/kakao/callback
```

**프론트엔드 `.env` 파일:**
```env
# Kakao SDK
EXPO_PUBLIC_KAKAO_APP_KEY=your_native_app_key
```

### 2. 패키지 설치

```bash
cd frontend
npm install @react-native-seoul/kakao-login
```

### 3. app.json 설정

```json
{
  "expo": {
    "plugins": [
      [
        "@react-native-seoul/kakao-login",
        {
          "kakaoAppKey": "your_native_app_key",
          "androidKeyHash": "your_android_key_hash"
        }
      ]
    ],
    "scheme": "kakaoxxxxxxxxxxxxxxxx"
  }
}
```

---

## 🧪 테스트 계정 등록

개발 중 테스트를 위해:

1. **[앱 설정] → [테스트 앱]**
2. **테스트 계정 등록**
   - 테스트할 카카오 계정 이메일 등록

---

## 📝 주의사항

1. **개발/배포 단계별 설정**
   - 개발: Debug 키 해시
   - 배포: Release 키 해시 (별도 생성 필요)

2. **비즈니스 인증 전 제약**
   - 테스트 계정만 로그인 가능
   - 일반 사용자 로그인 불가

3. **개인정보 수집**
   - 전화번호는 "선택" → "필수"로 변경 필요
   - 심사 과정 필요

---

## 🔗 참고 링크

- [Kakao Developers](https://developers.kakao.com)
- [카카오 로그인 가이드](https://developers.kakao.com/docs/latest/ko/kakaologin/common)
- [React Native 카카오 로그인](https://github.com/react-native-seoul/kakao-login)

