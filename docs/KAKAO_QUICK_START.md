# 🚀 카카오 로그인 빠른 시작 가이드

## ⚠️ 중요: 사업자 등록 없이 개발 중

현재 사업자 등록이 없어서 카카오에서 받을 수 있는 정보가 제한됩니다:

| 정보 | 받을 수 있나요? |
|------|---------------|
| ✅ 카카오 ID | O |
| ✅ 닉네임 | O |
| ✅ 프로필 이미지 | O |
| ⚠️ 이메일 | O (사용자 동의 필요) |
| ❌ 실명 | X (비즈니스 인증 필요) |
| ❌ 전화번호 | X (비즈니스 인증 필요) |
| ❌ 생년월일 | X (비즈니스 인증 필요) |
| ❌ 성별 | X (비즈니스 인증 필요) |

→ **카카오 로그인 시 대부분의 정보를 사용자가 직접 입력해야 합니다.**

---

## ⚡ 5분 만에 테스트하기

### Step 1: Expo 앱 실행 (1분)

```bash
cd frontend
npx expo start
```

**출력 예시:**
```
Metro waiting on exp://192.168.0.100:8081
```

👆 이 IP 주소와 포트를 복사하세요!

---

### Step 2: 카카오 개발자 콘솔 설정 (2분)

1. **접속**: https://developers.kakao.com
2. **내 애플리케이션** > **GrandBy** 선택
3. **카카오 로그인** > **Redirect URI** 클릭
4. **Redirect URI 등록** 버튼 클릭
5. 다음 URL 입력:
   ```
   exp://192.168.0.100:8081/--/kakao-callback
   ```
   ⚠️ IP 주소를 Step 1에서 확인한 IP로 변경!
   
6. **저장** 클릭

---

### Step 3: 백엔드 환경변수 설정 (1분)

`backend/.env` 파일 열기:

```bash
# 기존 내용 유지하고 아래만 수정
KAKAO_REST_API_KEY=e845607e091193791c0d40d313e01d5f
KAKAO_REDIRECT_URI=exp://192.168.0.100:8081/--/kakao-callback
```

⚠️ IP 주소를 Step 1에서 확인한 IP로 변경!

---

### Step 4: Docker 재시작 (30초)

```bash
docker-compose restart api
```

---

### Step 5: 테스트! (30초)

1. **스마트폰에서 Expo Go 앱 열기**
2. **QR 코드 스캔** (터미널에 표시됨)
3. **카카오 로그인 버튼 클릭**
4. **카카오 계정으로 로그인**
5. **동의 버튼 클릭**
6. **자동으로 앱으로 돌아오는지 확인** ✅

---

## ✅ 성공 시나리오

```
카카오 로그인 버튼 클릭
    ↓
브라우저에서 카카오 로그인 페이지 열림
    ↓
카카오 계정 입력 (또는 카카오톡으로 로그인)
    ↓
동의 버튼 클릭
    ↓
✨ 자동으로 앱으로 돌아옴 ✨
    ↓
기존 사용자: 홈 화면
신규 사용자: 추가 정보 입력 화면
```

---

## 🚨 문제 해결

### "Redirect URI mismatch" 에러가 나요

**확인사항:**
1. Step 1에서 확인한 IP 주소가 정확한가요?
2. 카카오 개발자 콘솔의 URI와 backend/.env의 URI가 동일한가요?
3. Docker를 재시작했나요?

**해결:**
```bash
# 1. Expo 서버의 정확한 IP 확인
npx expo start
# 출력: exp://192.168.0.100:8081

# 2. 카카오 개발자 콘솔에서 정확히 입력
exp://192.168.0.100:8081/--/kakao-callback

# 3. backend/.env 수정
KAKAO_REDIRECT_URI=exp://192.168.0.100:8081/--/kakao-callback

# 4. Docker 재시작
docker-compose restart api
```

---

### 앱으로 돌아오지 않아요

**확인사항:**
1. `frontend/app.json`에 `"scheme": "grandby"`가 있나요?
2. Expo 앱을 재시작했나요?

**해결:**
```bash
# 1. Expo 재시작
Ctrl + C
npx expo start

# 2. Expo Go 앱에서 다시 QR 스캔
```

---

### IP 주소가 자주 바뀌어요

**임시 해결:**
- 매번 변경된 IP로 카카오 개발자 콘솔 업데이트

**영구 해결:**
1. 라우터 설정에서 PC에 고정 IP 할당
2. 또는 ngrok 사용

---

## 📱 프로덕션 배포 시

프로덕션에서는 고정된 스킴 사용:
```
grandby://kakao-callback
```

자세한 내용은 `KAKAO_DEEPLINK_SETUP.md` 참고

---

## 💡 팁

### 개발 팀원과 공유

팀원마다 IP가 다르므로:
1. 각자 자신의 IP 확인: `npx expo start`
2. 카카오 개발자 콘솔에 여러 Redirect URI 등록 가능:
   ```
   exp://192.168.0.100:8081/--/kakao-callback  (팀원 A)
   exp://192.168.0.101:8081/--/kakao-callback  (팀원 B)
   exp://192.168.0.102:8081/--/kakao-callback  (팀원 C)
   ```

### 빠른 체크

```bash
# 1. Expo 실행 중인지 확인
npx expo start

# 2. Docker 실행 중인지 확인
docker-compose ps

# 3. API 응답 확인
curl http://localhost:8000/health

# 4. 카카오 로그인 URL 생성 테스트
curl http://localhost:8000/api/auth/kakao/login
```

---

**🎉 준비 완료!**

이제 카카오 로그인을 테스트해보세요!

문제가 있으면 `KAKAO_DEEPLINK_SETUP.md`의 트러블슈팅 섹션을 확인하세요.

