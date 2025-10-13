# 📧 SMTP 이메일 발송 설정 완료

## ✅ 구현 완료 내용

### 1. 패키지 설치
- ✅ `aiosmtplib==3.0.1` - 비동기 SMTP 클라이언트
- ✅ `jinja2==3.1.4` - 이메일 템플릿

### 2. 파일 생성/수정
- ✅ `backend/app/utils/email.py` - 이메일 전송 유틸리티
- ✅ `backend/app/config.py` - SMTP 설정 추가
- ✅ `backend/app/routers/auth.py` - 실제 이메일 발송 적용
- ✅ `backend/requirements.txt` - 의존성 추가

---

## 🚀 사용 방법

### 1. `.env` 파일 설정 확인

`backend/.env` 파일에 다음 내용이 있는지 확인하세요:

```env
# ==================== Email (SMTP) ====================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=rlarjsdn0327@gmail.com
SMTP_PASSWORD=여기에_Gmail_앱_비밀번호_16자리
SMTP_FROM_EMAIL=rlarjsdn0327@gmail.com
SMTP_FROM_NAME=그랜비 Grandby

# ⭐ 실제 이메일 발송 활성화
ENABLE_EMAIL=true
```

**중요:** 
- `ENABLE_EMAIL=true` → 실제 이메일 발송
- `ENABLE_EMAIL=false` → 콘솔 출력만 (개발 모드)

---

### 2. 백엔드 서버 실행

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

### 3. 테스트 방법

#### 방법 A: 프론트엔드에서 테스트

```bash
# 프론트엔드 실행
cd frontend
npx expo start
```

1. 회원가입 화면으로 이동
2. 이메일 입력: `test@example.com`
3. "인증코드 발송" 버튼 클릭
4. **실제 이메일로 인증 코드 수신** ✅
5. 코드 입력 후 인증 완료

#### 방법 B: Swagger UI에서 테스트

1. http://localhost:8000/docs 접속
2. `POST /api/auth/send-verification-code` 엔드포인트 선택
3. Request body 입력:
   ```json
   {
     "email": "rlarjsdn0327@gmail.com"
   }
   ```
4. "Execute" 클릭
5. 이메일 확인!

#### 방법 C: cURL로 테스트

```bash
curl -X POST "http://localhost:8000/api/auth/send-verification-code" \
  -H "Content-Type: application/json" \
  -d '{"email": "rlarjsdn0327@gmail.com"}'
```

---

## 📧 발송되는 이메일 예시

### 제목
```
[그랜비] 이메일 인증 코드
```

### 내용
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           👴❤️ 그랜비
        소중한 부모님 곁에 함께
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

안녕하세요!
그랜비 회원가입을 위한 이메일 인증 코드입니다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        인증 코드
        
        123456
        
     유효시간: 5분
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

위 인증 코드를 회원가입 화면에 입력해주세요.

⚠️ 본인이 요청하지 않은 인증 코드라면 
   이 이메일을 무시하셔도 됩니다.
```

이메일은 **아름다운 HTML 디자인**으로 발송됩니다! 🎨

---

## 🔧 트러블슈팅

### 문제 1: 이메일이 발송되지 않음

**원인:** 환경 변수가 제대로 로드되지 않음

**해결:**
```bash
# .env 파일 확인
cat backend/.env | grep SMTP

# 백엔드 재시작
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 문제 2: "SMTPAuthenticationError" 오류

**원인:** Gmail 앱 비밀번호가 잘못되었거나 2단계 인증 미활성화

**해결:**
1. Google 계정 → 보안 → 2단계 인증 활성화
2. https://myaccount.google.com/apppasswords 에서 앱 비밀번호 재생성
3. `.env` 파일의 `SMTP_PASSWORD` 업데이트 (공백 제거)

### 문제 3: 이메일이 스팸함으로 이동

**해결:**
1. 스팸함 확인
2. "스팸 아님" 표시
3. 프로덕션에서는 SendGrid나 AWS SES 사용 권장

### 문제 4: 개발 모드로 테스트하고 싶음

**해결:**
```env
# backend/.env
ENABLE_EMAIL=false
```

→ 이메일 대신 **백엔드 콘솔에 인증 코드 출력**

---

## 📊 로그 확인

### 성공 시 로그
```
INFO:app.utils.email:✅ 이메일 발송 성공: rlarjsdn0327@gmail.com
```

### 실패 시 로그
```
ERROR:app.utils.email:❌ 이메일 발송 실패: test@example.com - [에러 메시지]
```

### 개발 모드 로그
```
INFO:app.utils.email:
==================================================
📧 이메일 발송 (개발 모드 - 콘솔 출력)
==================================================
받는 사람: test@example.com
제목: [그랜비] 이메일 인증 코드
내용:
[그랜비] 이메일 인증 코드

인증 코드: 123456
유효시간: 5분
==================================================
```

---

## 🎯 체크리스트

실제 이메일 발송이 작동하려면:

- [x] `aiosmtplib` 패키지 설치
- [x] `backend/app/utils/email.py` 파일 생성
- [x] `backend/app/config.py` SMTP 설정 추가
- [x] `backend/app/routers/auth.py` 수정
- [ ] `backend/.env`에 SMTP 설정 추가
- [ ] **`ENABLE_EMAIL=true` 설정** ⭐ 중요!
- [ ] 백엔드 서버 재시작
- [ ] 이메일 발송 테스트

---

## 🚀 다음 단계

### 현재 상태
- ✅ Gmail SMTP로 실제 이메일 발송 가능
- ✅ 아름다운 HTML 템플릿
- ✅ 개발/프로덕션 모드 지원

### 프로덕션 배포 시
1. **SendGrid** 또는 **AWS SES**로 전환 권장
2. 환경 변수에 `ENABLE_EMAIL=true` 설정
3. 도메인 인증 (SPF, DKIM) 설정

---

## 📝 요약

```bash
# 1. 패키지 설치 완료
pip install aiosmtplib jinja2

# 2. .env 파일에 추가
ENABLE_EMAIL=true

# 3. 백엔드 실행
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 4. 테스트
# 프론트엔드에서 회원가입 시도
# → 실제 이메일 수신 확인! ✅
```

**완료!** 실제 이메일로 인증 코드가 발송됩니다! 🎉

