# Google Cloud Speech-to-Text 설정 가이드

## 📋 목차
1. [Google Cloud 프로젝트 설정](#1-google-cloud-프로젝트-설정)
2. [인증 파일 준비](#2-인증-파일-준비)
3. [환경 변수 설정](#3-환경-변수-설정)
4. [패키지 설치](#4-패키지-설치)
5. [Docker 설정](#5-docker-설정)
6. [사용 방법](#6-사용-방법)
7. [문제 해결](#7-문제-해결)

---

## 1. Google Cloud 프로젝트 설정

### 1.1 Google Cloud Console 접속
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 생성 또는 기존 프로젝트 선택

### 1.2 Speech-to-Text API 활성화
1. 좌측 메뉴 → **APIs & Services** → **Library**
2. "Cloud Speech-to-Text API" 검색
3. **Enable** 클릭

### 1.3 서비스 계정 생성
1. 좌측 메뉴 → **APIs & Services** → **Credentials**
2. **Create Credentials** → **Service Account** 선택
3. 서비스 계정 정보 입력:
   - Name: `grandby-stt-service`
   - Description: `GrandBy STT Service Account`
4. **Create and Continue** 클릭

### 1.4 역할 부여
1. **Select a role** → **Cloud Speech Client** 선택
2. **Continue** 클릭
3. **Done** 클릭

### 1.5 JSON 키 다운로드
1. 생성된 서비스 계정 클릭
2. **Keys** 탭 선택
3. **Add Key** → **Create new key**
4. **JSON** 선택 → **Create**
5. JSON 파일 자동 다운로드 (예: `grandby-xxxxxxx.json`)

---

## 2. 인증 파일 준비

### 2.1 디렉토리 생성
```bash
cd backend
mkdir -p credentials
```

### 2.2 JSON 키 파일 배치
다운로드한 JSON 파일을 `backend/credentials/`에 저장하고 이름을 변경:
```bash
# Windows
move Downloads\grandby-xxxxxxx.json backend\credentials\google-cloud-stt.json

# Linux/Mac
mv ~/Downloads/grandby-xxxxxxx.json backend/credentials/google-cloud-stt.json
```

### 2.3 권한 설정 (Linux/Mac)
```bash
chmod 600 backend/credentials/google-cloud-stt.json
```

### 2.4 .gitignore 확인
`.gitignore`에 다음 라인이 있는지 확인:
```
credentials/
*.json
```

---

## 3. 환경 변수 설정

### 3.1 backend/.env 파일 수정
```bash
# STT 제공자 선택 ("google" 또는 "openai")
STT_PROVIDER=google

# Google Cloud STT 설정
GOOGLE_APPLICATION_CREDENTIALS=credentials/google-cloud-stt.json
GOOGLE_STT_LANGUAGE_CODE=ko-KR
GOOGLE_STT_MODEL=phone_call
```

### 3.2 STT 모델 옵션
- `phone_call`: 전화 통화 최적화 (8kHz 오디오) - **권장**
- `latest_short`: 짧은 발화 (< 60초)
- `latest_long`: 긴 발화 (> 60초)
- `command_and_search`: 명령어/검색어

---

## 4. 패키지 설치

### 4.1 로컬 개발 환경
```bash
cd backend
pip install google-cloud-speech==2.26.0
```

### 4.2 requirements.txt 확인
`backend/requirements.txt`에 다음이 포함되어 있는지 확인:
```
google-cloud-speech==2.26.0
```

---

## 5. Docker 설정

### 5.1 docker-compose.yml 수정
```yaml
services:
  api:
    environment:
      # STT 설정 추가
      STT_PROVIDER: ${STT_PROVIDER:-google}
      GOOGLE_APPLICATION_CREDENTIALS: /app/credentials/google-cloud-stt.json
      GOOGLE_STT_LANGUAGE_CODE: ${GOOGLE_STT_LANGUAGE_CODE:-ko-KR}
      GOOGLE_STT_MODEL: ${GOOGLE_STT_MODEL:-phone_call}
    
    volumes:
      - ./backend/app:/app/app
      - ./backend/migrations:/app/migrations
      - ./backend/scripts:/app/scripts
      # Google Cloud 인증 파일 마운트 (읽기 전용)
      - ./backend/credentials:/app/credentials:ro
```

### 5.2 Docker 재빌드
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

### 5.3 로그 확인
```bash
docker-compose logs -f api

# 다음 로그가 보이면 성공:
# ✅ Google Cloud 인증 파일 로드: credentials/google-cloud-stt.json
# ✅ Google Cloud STT 초기화 완료
# 🎤 STT 서비스 초기화 완료: GOOGLE
```

---

## 6. 사용 방법

### 6.1 STT 제공자 전환
환경 변수로 언제든지 전환 가능:

**Google Cloud 사용:**
```bash
# .env 파일
STT_PROVIDER=google
```

**OpenAI Whisper 사용:**
```bash
# .env 파일
STT_PROVIDER=openai
```

### 6.2 코드에서 자동 선택
코드 변경 없이 자동으로 선택됨:
```python
# app/services/ai_call/stt_service.py
stt_service = STTService()  # 자동으로 환경 변수에 따라 Google 또는 OpenAI 사용
```

### 6.3 동작 방식
1. **Twilio → 오디오 수신** (mulaw 8kHz)
2. **AudioProcessor → 버퍼링 및 침묵 감지**
3. **Google Cloud STT → 실시간 텍스트 변환** (0.3-0.5초)
4. **LLM → AI 응답 생성**
5. **TTS → 음성 변환 및 재생**

---

## 7. 문제 해결

### 7.1 인증 실패
```
❌ Google Cloud STT 초기화 실패
```

**해결방법:**
1. JSON 파일 경로 확인:
   ```bash
   ls -la backend/credentials/google-cloud-stt.json
   ```
2. 환경 변수 확인:
   ```bash
   echo $GOOGLE_APPLICATION_CREDENTIALS
   ```
3. 서비스 계정 권한 확인 (Cloud Speech Client 역할)

### 7.2 API 비활성화
```
google.api_core.exceptions.PermissionDenied: Cloud Speech-to-Text API has not been used
```

**해결방법:**
1. Google Cloud Console에서 API 활성화 확인
2. 프로젝트 ID 확인
3. 청구 계정 연결 확인

### 7.3 할당량 초과
```
google.api_core.exceptions.ResourceExhausted: Quota exceeded
```

**해결방법:**
1. Google Cloud Console → **IAM & Admin** → **Quotas**
2. "Speech-to-Text API" 검색
3. 할당량 증가 요청 또는 대기

### 7.4 OpenAI로 폴백
Google Cloud 초기화 실패 시 자동으로 OpenAI Whisper로 전환됩니다:
```
⚠️ Google Cloud STT 초기화 실패, OpenAI로 폴백
✅ OpenAI Whisper 초기화 완료
```

---

## 📊 성능 비교

| 항목 | Google Cloud STT | OpenAI Whisper |
|------|------------------|----------------|
| **응답 시간** | 0.3-0.5초 | 1-2초 |
| **전화 통화 최적화** | ✅ phone_call 모델 | ⚠️ 범용 모델 |
| **한국어 정확도** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **신뢰도 점수** | ✅ confidence 제공 | ❌ 없음 |
| **가격 (15초)** | $0.006 (Standard) | $0.006 (60초 기준) |
| **스트리밍 지원** | ✅ 완전 지원 | ❌ 청크 단위만 |

**권장:** 실시간 전화 통화는 **Google Cloud STT** 사용

---

## 🔐 보안 주의사항

### 중요: JSON 키 파일은 절대 Git에 커밋하지 마세요!

1. `.gitignore`에 `credentials/` 포함 확인
2. GitHub에 푸시하기 전 확인:
   ```bash
   git status
   # credentials/ 폴더가 보이면 안됨
   ```
3. 실수로 커밋한 경우:
   ```bash
   git rm --cached credentials/google-cloud-stt.json
   git commit -m "Remove credentials"
   ```
4. 키 노출 시 즉시 Google Cloud Console에서 키 삭제 및 재생성

---

## ✅ 설정 완료 체크리스트

- [ ] Google Cloud 프로젝트 생성
- [ ] Speech-to-Text API 활성화
- [ ] 서비스 계정 생성 및 역할 부여
- [ ] JSON 키 다운로드
- [ ] `backend/credentials/google-cloud-stt.json` 배치
- [ ] `.env` 파일에 `STT_PROVIDER=google` 설정
- [ ] `google-cloud-speech` 패키지 설치
- [ ] Docker 볼륨 마운트 설정
- [ ] 서버 재시작 및 로그 확인
- [ ] Twilio 통화 테스트

---

## 📞 테스트 방법

### 1. 서버 실행 확인
```bash
# 로그에서 다음 확인:
✅ Google Cloud STT 초기화 완료
🎤 STT 서비스 초기화 완료: GOOGLE
```

### 2. Twilio 통화 테스트
1. 설정된 전화번호로 전화 걸기
2. "안녕하세요" 말하기
3. 로그에서 다음 확인:
   ```
   🎤 [Google STT] 안녕하세요 (신뢰도: 0.95, 0.42초)
   ```

### 3. 성능 확인
- STT 변환 시간이 0.5초 이하인지 확인
- 신뢰도 점수가 0.8 이상인지 확인

---

문제가 있거나 추가 도움이 필요하면 GitHub Issues에 문의하세요!

