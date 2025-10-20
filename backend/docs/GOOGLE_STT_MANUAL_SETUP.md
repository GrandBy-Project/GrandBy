# Google Cloud STT 수동 설정 가이드

## ⚠️ 사용자가 직접 수정해야 하는 부분

이 문서는 Google Cloud Speech-to-Text를 사용하기 위해 **반드시 직접 설정해야 하는 항목**들을 안내합니다.

---

## 1. 🔑 Google Cloud 인증 파일 (필수)

### 현재 상태
코드는 다음 경로에서 인증 파일을 찾습니다:
```
backend/credentials/google-cloud-stt.json
```

### 해야 할 일

#### ✅ 방법 1: Google Cloud Console에서 직접 발급 (권장)

1. **Google Cloud Console 접속**
   - https://console.cloud.google.com/

2. **프로젝트 생성/선택**
   - 신규: 우측 상단 "프로젝트 선택" → "새 프로젝트"
   - 기존: 프로젝트 선택

3. **Speech-to-Text API 활성화**
   ```
   좌측 메뉴 → APIs & Services → Library
   → "Cloud Speech-to-Text API" 검색 → Enable
   ```

4. **서비스 계정 생성**
   ```
   좌측 메뉴 → APIs & Services → Credentials
   → Create Credentials → Service Account
   
   입력 정보:
   - Service account name: grandby-stt-service
   - Service account ID: grandby-stt-service (자동 생성)
   - Description: GrandBy Speech-to-Text Service
   
   → Create and Continue
   ```

5. **역할 부여**
   ```
   Select a role → "Cloud Speech Client" 검색 및 선택
   → Continue → Done
   ```

6. **JSON 키 다운로드**
   ```
   생성된 서비스 계정 클릭
   → Keys 탭 → Add Key → Create new key
   → JSON 선택 → Create
   → 자동 다운로드됨 (예: grandby-123456-abc.json)
   ```

7. **파일 배치**
   ```bash
   # Windows
   mkdir backend\credentials
   move Downloads\grandby-123456-abc.json backend\credentials\google-cloud-stt.json
   
   # Linux/Mac
   mkdir -p backend/credentials
   mv ~/Downloads/grandby-123456-abc.json backend/credentials/google-cloud-stt.json
   chmod 600 backend/credentials/google-cloud-stt.json
   ```

#### ⚠️ 중요: 보안 주의사항
```bash
# .gitignore에 다음이 있는지 반드시 확인!
credentials/
*.json

# Git 상태 확인 (credentials가 나오면 안됨)
git status

# 실수로 커밋한 경우
git rm --cached backend/credentials/google-cloud-stt.json
git commit -m "Remove sensitive credentials"

# 노출된 키는 즉시 Google Cloud Console에서 삭제 후 재발급!
```

---

## 2. 📝 환경 변수 설정 (필수)

### 파일: `backend/.env`

현재 `.env` 파일에 다음을 추가:

```bash
# ==================== Speech-to-Text 설정 ====================
# STT 제공자: "google" 또는 "openai"
STT_PROVIDER=google

# Google Cloud 인증 파일 경로 (backend/ 기준 상대 경로)
GOOGLE_APPLICATION_CREDENTIALS=credentials/google-cloud-stt.json

# 언어 설정
GOOGLE_STT_LANGUAGE_CODE=ko-KR

# 모델 선택
GOOGLE_STT_MODEL=phone_call
```

### 모델 옵션 설명

| 모델 | 용도 | 권장 사용처 |
|------|------|-------------|
| `phone_call` | 전화 통화 최적화 (8kHz) | **Twilio 실시간 통화** ✅ |
| `latest_short` | 짧은 발화 (< 60초) | 음성 명령, 짧은 질문 |
| `latest_long` | 긴 발화 (> 60초) | 긴 대화, 강의 녹음 |
| `command_and_search` | 명령어/검색어 | 음성 명령 인식 |

**현재 프로젝트에는 `phone_call` 권장!**

---

## 3. 🐳 Docker 환경 설정 (Docker 사용 시)

### 파일: `docker-compose.yml`

**이미 수정되어 있어야 합니다만, 확인이 필요합니다.**

다음 부분이 `api` 서비스에 있는지 확인:

```yaml
services:
  api:
    environment:
      # STT 설정 (추가 필요)
      STT_PROVIDER: ${STT_PROVIDER:-google}
      GOOGLE_APPLICATION_CREDENTIALS: /app/credentials/google-cloud-stt.json
      GOOGLE_STT_LANGUAGE_CODE: ${GOOGLE_STT_LANGUAGE_CODE:-ko-KR}
      GOOGLE_STT_MODEL: ${GOOGLE_STT_MODEL:-phone_call}
    
    volumes:
      - ./backend/app:/app/app
      - ./backend/migrations:/app/migrations
      - ./backend/scripts:/app/scripts
      # 👇 이 라인이 있는지 확인! 없으면 추가!
      - ./backend/credentials:/app/credentials:ro
```

### Docker 재시작
```bash
docker-compose down
docker-compose build  # requirements.txt 변경 반영
docker-compose up -d
```

---

## 4. 📦 패키지 설치

### 로컬 개발 환경
```bash
cd backend
pip install google-cloud-speech==2.26.0
```

### requirements.txt 확인
`backend/requirements.txt`에 다음이 포함되어 있는지 확인:
```
google-cloud-speech==2.26.0
```

**이미 추가되어 있습니다.** Docker 사용 시 `docker-compose build` 실행하면 자동 설치됩니다.

---

## 5. ✅ 설정 검증

### 5.1 로컬 테스트
```bash
cd backend

# Python 인터프리터 실행
python

# 다음 코드 실행:
>>> from app.services.ai_call.stt_service import STTService
>>> stt = STTService()

# 성공 시 출력:
# ✅ Google Cloud 인증 파일 로드: credentials/google-cloud-stt.json
# ✅ Google Cloud STT 초기화 완료
# 🎤 STT 서비스 초기화 완료: GOOGLE
```

### 5.2 Docker 테스트
```bash
# Docker 로그 확인
docker-compose logs -f api

# 다음 메시지 확인:
# ✅ Google Cloud 인증 파일 로드: credentials/google-cloud-stt.json
# ✅ Google Cloud STT 초기화 완료
# 🎤 STT 서비스 초기화 완료: GOOGLE
```

---

## 6. 🔄 OpenAI Whisper로 되돌리기

Google Cloud 설정이 어렵거나 문제가 있으면 언제든지 OpenAI Whisper로 되돌릴 수 있습니다:

### backend/.env 수정
```bash
# Google → OpenAI로 변경
STT_PROVIDER=openai
```

### 재시작
```bash
# 로컬
# 서버 재시작

# Docker
docker-compose restart api
```

코드 변경 없이 환경 변수만으로 전환 가능!

---

## 7. 🧪 테스트 방법

### 7.1 Twilio 통화 테스트

1. **서버 실행 확인**
   ```bash
   # 로그에서 확인
   🎤 STT 서비스 초기화 완료: GOOGLE
   ```

2. **전화 걸기**
   - 설정된 Twilio 번호로 전화

3. **"안녕하세요" 말하기**

4. **로그 확인**
   ```bash
   docker-compose logs -f api | grep STT
   
   # 다음과 같은 로그가 보여야 함:
   🎤 [Google STT] 안녕하세요 (신뢰도: 0.95, 0.42초)
   ```

### 7.2 성능 확인
- ✅ STT 변환 시간: **0.3~0.5초** (Google)
- ⚠️ STT 변환 시간: **1~2초** (OpenAI)
- ✅ 신뢰도 점수: **0.8 이상** (Google만 제공)

---

## 8. ❌ 문제 해결

### 문제 1: 인증 파일을 찾을 수 없음
```
FileNotFoundError: Google Cloud 인증 파일을 찾을 수 없습니다
```

**해결:**
```bash
# 파일 존재 확인
ls -la backend/credentials/google-cloud-stt.json

# 없으면 위의 1번 단계 다시 수행
```

### 문제 2: API 활성화 안됨
```
google.api_core.exceptions.PermissionDenied: 
Cloud Speech-to-Text API has not been used
```

**해결:**
1. Google Cloud Console 접속
2. APIs & Services → Library
3. "Cloud Speech-to-Text API" 검색
4. **Enable** 클릭
5. 5분 정도 대기 후 재시도

### 문제 3: 권한 없음
```
google.api_core.exceptions.PermissionDenied: 
The caller does not have permission
```

**해결:**
1. Google Cloud Console → IAM & Admin → Service Accounts
2. 생성한 서비스 계정 찾기
3. Permissions 탭에서 **"Cloud Speech Client"** 역할 확인
4. 없으면 추가: Grant Access → Cloud Speech Client

### 문제 4: 할당량 초과
```
google.api_core.exceptions.ResourceExhausted: Quota exceeded
```

**해결:**
1. Google Cloud Console → IAM & Admin → Quotas
2. "Speech-to-Text API" 검색
3. 할당량 확인 및 증가 요청

### 문제 5: 자동으로 OpenAI로 폴백됨
```
⚠️ Google Cloud STT 초기화 실패, OpenAI로 폴백
```

**원인:**
- 인증 파일 경로 오류
- API 미활성화
- 권한 부족
- 네트워크 문제

**해결:**
- 위의 문제 1~4 확인
- Docker 사용 시 볼륨 마운트 확인

---

## 9. 💰 비용 예상

### Google Cloud Speech-to-Text 가격 (2024년 기준)

| 사용량 (월간) | Standard 모델 | Enhanced 모델 |
|--------------|--------------|---------------|
| 0~60분 | **무료** | **무료** |
| 60분~100만분 | $0.006/15초 | $0.009/15초 |
| 100만분 이상 | $0.004/15초 | $0.006/15초 |

### 예상 비용 계산

**시나리오: 하루 50통화, 통화당 평균 3분**
```
일일 총 시간: 50통화 × 3분 = 150분
월간 총 시간: 150분 × 30일 = 4,500분

월간 비용 (Standard):
- 무료 범위: 60분
- 유료 사용: 4,440분 = 17,760초 = 1,184 × 15초
- 비용: 1,184 × $0.006 = $7.10/월
```

**무료 범위 (월 60분) 내에서 충분히 테스트 가능!**

---

## 10. 📞 지원

### 추가 도움이 필요한 경우:

1. **Google Cloud 문서**
   - https://cloud.google.com/speech-to-text/docs

2. **GitHub Issues**
   - 프로젝트의 Issues 탭에 문의

3. **로그 첨부**
   ```bash
   docker-compose logs api > logs.txt
   # logs.txt 파일을 첨부하여 문의
   ```

---

## ✅ 최종 체크리스트

설정이 완료되었는지 확인:

- [ ] Google Cloud 프로젝트 생성 완료
- [ ] Speech-to-Text API 활성화 완료
- [ ] 서비스 계정 생성 및 역할 부여 완료
- [ ] JSON 키 다운로드 완료
- [ ] `backend/credentials/google-cloud-stt.json` 파일 배치 완료
- [ ] `backend/.env` 파일에 `STT_PROVIDER=google` 설정 완료
- [ ] Docker 볼륨 마운트 설정 확인 완료 (Docker 사용 시)
- [ ] `pip install google-cloud-speech` 실행 완료 (로컬 개발 시)
- [ ] 서버 재시작 및 로그 확인 완료
- [ ] Twilio 테스트 통화 성공

**모든 항목이 체크되면 Google Cloud STT를 사용할 준비가 완료되었습니다!** 🎉

