# 🔗 카카오 로그인 딥링크 설정 가이드

## ✅ 완료된 설정

### 1. Expo 딥링크 설정
`frontend/app.json`에 추가됨:
```json
{
  "expo": {
    "scheme": "grandby",
    "ios": {
      "bundleIdentifier": "com.grandby.app"
    },
    "android": {
      "package": "com.grandby.app"
    }
  }
}
```

### 2. 딥링크 URL 형식
- **개발 환경**: `exp://192.168.x.x:8081/--/kakao-callback`
- **프로덕션**: `grandby://kakao-callback`

---

## 🔧 설정 방법

### Step 1: Expo 앱 실행 및 URL 확인

```bash
cd frontend
npx expo start
```

터미널에 표시되는 URL을 확인하세요:
```
Metro waiting on exp://192.168.0.100:8081
```

### Step 2: 딥링크 URL 생성

개발 환경의 딥링크 URL은:
```
exp://192.168.0.100:8081/--/kakao-callback
```

### Step 3: 카카오 개발자 콘솔 설정

1. **카카오 개발자 콘솔 접속**: https://developers.kakao.com
2. **내 애플리케이션** > **GrandBy** 선택
3. **카카오 로그인** > **Redirect URI** 섹션
4. **Redirect URI 등록**:
   ```
   exp://192.168.0.100:8081/--/kakao-callback
   ```
   
   ⚠️ **주의**: 
   - IP 주소는 `npx expo start` 실행 시 표시되는 IP로 변경
   - 포트 번호도 확인 (보통 8081)
   - `/--/kakao-callback` 부분은 정확히 입력

5. **저장** 버튼 클릭

### Step 4: 백엔드 환경변수 설정

`backend/.env` 파일 수정:
```bash
# 카카오 OAuth
KAKAO_REST_API_KEY=e845607e091193791c0d40d313e01d5f
KAKAO_REDIRECT_URI=exp://192.168.0.100:8081/--/kakao-callback
KAKAO_CLIENT_SECRET=
```

⚠️ **주의**: IP 주소는 실제 Expo 서버 IP로 변경

### Step 5: Docker 재시작

```bash
docker-compose restart api
```

---

## 🧪 테스트 방법

### 1. Expo 앱 실행
```bash
cd frontend
npx expo start
```

### 2. 스마트폰에서 Expo Go 앱으로 QR 코드 스캔

### 3. 카카오 로그인 버튼 클릭

### 4. 예상 플로우
```
1. 카카오 로그인 버튼 클릭
   ↓
2. 카카오 로그인 페이지 열림 (브라우저)
   ↓
3. 카카오 계정으로 로그인
   ↓
4. 동의 버튼 클릭
   ↓
5. 자동으로 앱으로 돌아옴 ✅
   ↓
6. 기존 사용자: 홈 화면으로 이동
   신규 사용자: 추가 정보 입력 화면으로 이동
```

---

## 🚨 트러블슈팅

### 문제 1: "Redirect URI mismatch" 에러

**원인**: 카카오 개발자 콘솔에 등록된 URI와 실제 URI가 다름

**해결**:
1. `npx expo start` 실행 시 표시되는 정확한 URL 확인
2. 카카오 개발자 콘솔에서 정확히 동일한 URL로 등록
3. Docker 재시작: `docker-compose restart api`

### 문제 2: 앱으로 돌아오지 않음

**원인**: 딥링크 설정 문제

**해결**:
1. `app.json`에 `"scheme": "grandby"` 확인
2. Expo 앱 재시작: Ctrl+C 후 다시 `npx expo start`
3. Expo Go 앱에서 앱 다시 로드

### 문제 3: IP 주소가 자주 바뀜

**해결**:
1. 라우터에서 고정 IP 할당
2. 또는 매번 변경된 IP로 카카오 개발자 콘솔 업데이트
3. 프로덕션에서는 `grandby://kakao-callback` 사용 (고정)

### 문제 4: 여전히 accounts.kakao.com에 머물러 있음

**원인**: WebBrowser가 세션을 제대로 종료하지 못함

**해결**:
```typescript
// LoginScreen.tsx 상단에 추가
WebBrowser.maybeCompleteAuthSession();
```
이미 추가되어 있는지 확인

---

## 📱 프로덕션 배포 시

### 1. Custom URL Scheme 사용

`app.json`:
```json
{
  "expo": {
    "scheme": "grandby"
  }
}
```

### 2. 카카오 개발자 콘솔 Redirect URI
```
grandby://kakao-callback
```

### 3. iOS Universal Links 설정 (선택사항)
```json
{
  "expo": {
    "ios": {
      "associatedDomains": ["applinks:yourdomain.com"]
    }
  }
}
```

### 4. Android App Links 설정 (선택사항)
```json
{
  "expo": {
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "https",
              "host": "yourdomain.com",
              "pathPrefix": "/kakao-callback"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

---

## 📝 체크리스트

개발 환경 테스트 전:
- [ ] `npx expo start` 실행 및 IP 주소 확인
- [ ] 카카오 개발자 콘솔에 Redirect URI 등록 (`exp://IP:PORT/--/kakao-callback`)
- [ ] `backend/.env`에 동일한 URI 설정
- [ ] Docker 재시작
- [ ] Expo Go로 앱 실행
- [ ] 카카오 로그인 테스트

프로덕션 배포 전:
- [ ] `app.json`의 `scheme` 확인
- [ ] 카카오 개발자 콘솔에 `grandby://kakao-callback` 추가
- [ ] iOS Bundle ID 및 Android Package 확인
- [ ] 앱 빌드 및 배포

---

## 💡 참고사항

### Expo Go vs Standalone App

**Expo Go (개발):**
- URL: `exp://192.168.x.x:8081/--/kakao-callback`
- IP와 포트가 변경될 수 있음
- 개발 중에만 사용

**Standalone App (프로덕션):**
- URL: `grandby://kakao-callback`
- 고정된 스킴
- 앱 스토어 배포 버전

### 현재 설정으로 예상되는 URL

```bash
# Expo 실행
npx expo start

# 표시되는 URL 예시
Metro waiting on exp://192.168.0.100:8081

# 카카오 Redirect URI로 등록할 URL
exp://192.168.0.100:8081/--/kakao-callback
```

---

**작성일**: 2025-10-14  
**버전**: 1.0.0  
**작성자**: GrandBy 개발팀

