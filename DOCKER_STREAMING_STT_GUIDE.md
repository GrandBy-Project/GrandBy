# Docker 환경에서 Streaming STT 실행 가이드

## ✅ Docker 설정 완료 사항

### 수정된 파일

1. **docker-compose.yml** ✅
   - `api` 서비스에 Streaming STT 환경변수 추가
   - `celery_worker` 서비스에 환경변수 추가
   - `celery_beat` 서비스에 환경변수 추가
   - credentials 볼륨 read-only로 마운트

2. **backend/.dockerignore** ✅ (신규)
   - 불필요한 파일 빌드 제외
   - 빌드 속도 향상

### 추가된 환경변수

```yaml
# Google Cloud Speech-to-Text (Streaming STT)
STT_PROVIDER: ${STT_PROVIDER:-google}
STT_MODE: ${STT_MODE:-streaming}
GOOGLE_APPLICATION_CREDENTIALS: /app/credentials/google-cloud-stt.json
GOOGLE_STT_LANGUAGE_CODE: ${GOOGLE_STT_LANGUAGE_CODE:-ko-KR}
GOOGLE_STT_MODEL: ${GOOGLE_STT_MODEL:-phone_call}
GOOGLE_STT_INTERIM_RESULTS: ${GOOGLE_STT_INTERIM_RESULTS:-true}
GOOGLE_STT_SINGLE_UTTERANCE: ${GOOGLE_STT_SINGLE_UTTERANCE:-false}
GOOGLE_STT_MAX_ALTERNATIVES: ${GOOGLE_STT_MAX_ALTERNATIVES:-1}
```

---

## 🚀 빠른 시작

### 1. 필수 파일 확인

```bash
# Google Cloud 인증 파일 확인
ls -la backend/credentials/google-cloud-stt.json

# 출력 예시:
# -rw-r--r-- 1 user user 2374 Oct 20 15:21 google-cloud-stt.json
```

✅ **확인됨**: `google-cloud-stt.json` 파일이 존재합니다.

### 2. .env 파일 설정

```bash
cd /c/MyWorkSpace/grandby/GrandBy
```

`.env` 파일에 다음이 설정되어 있는지 확인:

```env
# STT 설정 (이미 추가하셨다고 하셨죠!)
STT_MODE=streaming
GOOGLE_STT_INTERIM_RESULTS=true
GOOGLE_STT_SINGLE_UTTERANCE=false
GOOGLE_STT_MAX_ALTERNATIVES=1

# 기존 설정들도 필수
OPENAI_API_KEY=sk-...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+...
API_BASE_URL=...
# ... 기타
```

### 3. Docker 빌드 및 실행

```bash
# 1. 기존 컨테이너 정리 (선택사항)
docker-compose down

# 2. 이미지 재빌드 (새 코드 반영)
docker-compose build api

# 3. 모든 서비스 시작
docker-compose up -d

# 4. 로그 확인
docker-compose logs -f api
```

### 4. 확인 사항

#### 4.1 서비스 상태 확인

```bash
docker-compose ps
```

**예상 출력**:
```
NAME                   IMAGE              STATUS
grandby_api            ...                Up (healthy)
grandby_postgres       postgres:15        Up (healthy)
grandby_redis          redis:7            Up (healthy)
grandby_celery_worker  ...                Up
grandby_celery_beat    ...                Up
```

#### 4.2 Streaming STT 활성화 확인

```bash
docker-compose logs api | grep "STT Mode"
```

**예상 출력**:
```
🎙️ [STT Mode] Streaming 방식 활성화
```

#### 4.3 Google Cloud 인증 확인

```bash
docker-compose logs api | grep "Google Cloud"
```

**예상 출력**:
```
✅ Google Cloud 인증 파일 로드: /app/credentials/google-cloud-stt.json
✅ Google Cloud Speech Client 초기화 성공
```

---

## 🔍 문제 해결

### 문제 1: "STT Mode Streaming 방식 활성화" 메시지가 안 보임

**원인**: 환경변수가 컨테이너에 전달되지 않음

**해결**:
```bash
# 컨테이너 내부 환경변수 확인
docker-compose exec api env | grep STT

# 출력되어야 할 내용:
# STT_MODE=streaming
# STT_PROVIDER=google
# GOOGLE_STT_MODEL=phone_call
```

없다면:
```bash
# .env 파일 확인
cat .env | grep STT

# docker-compose 재시작
docker-compose down
docker-compose up -d
```

### 문제 2: Google Cloud 인증 파일 없음 오류

**에러 메시지**:
```
❌ Google Cloud Client 초기화 실패: 인증 파일 없음
```

**해결**:
```bash
# 1. 호스트에서 파일 존재 확인
ls backend/credentials/google-cloud-stt.json

# 2. 컨테이너에서 파일 존재 확인
docker-compose exec api ls -la /app/credentials/

# 3. 파일이 없다면 볼륨 마운트 확인
docker-compose exec api cat /app/credentials/google-cloud-stt.json | head -n 5
```

### 문제 3: 모듈 import 에러

**에러 메시지**:
```
ModuleNotFoundError: No module named 'app.services.ai_call.streaming_stt_manager'
```

**원인**: 새로 생성한 파일들이 컨테이너에 반영되지 않음

**해결**:
```bash
# 1. 볼륨 마운트 확인
docker-compose exec api ls -la /app/app/services/ai_call/

# 출력에 다음 파일들이 있어야 함:
# streaming_stt_manager.py
# streaming_audio_processor.py
# streaming_websocket_handler.py

# 2. 없다면 이미지 재빌드
docker-compose build api
docker-compose up -d api
```

### 문제 4: 권한 오류 (Permission Denied)

**에러 메시지**:
```
PermissionError: [Errno 13] Permission denied: '/app/credentials/google-cloud-stt.json'
```

**해결**:
```bash
# credentials 폴더 권한 확인
ls -la backend/credentials/

# 권한이 너무 제한적이면 수정
chmod 644 backend/credentials/google-cloud-stt.json

# 컨테이너 재시작
docker-compose restart api
```

---

## 📊 실시간 모니터링

### 로그 실시간 확인

```bash
# API 서버 로그
docker-compose logs -f api

# 특정 키워드 필터링
docker-compose logs -f api | grep -E "STT|Streaming|발화"

# 에러만 확인
docker-compose logs -f api | grep -E "ERROR|❌"
```

### 리소스 사용량 확인

```bash
# 컨테이너 리소스 모니터링
docker stats grandby_api grandby_postgres grandby_redis
```

---

## 🧪 테스트 시나리오

### 1. 헬스 체크

```bash
# API 헬스 체크
curl http://localhost:8000/health

# 예상 응답:
# {"status": "healthy"}
```

### 2. STT 모드 확인

```bash
# 컨테이너 내부에서 Python 실행
docker-compose exec api python -c "from app.config import settings; print(f'STT_MODE: {settings.STT_MODE}')"

# 예상 출력:
# STT_MODE: streaming
```

### 3. 전체 통합 테스트

```bash
# 1. 서비스 시작
docker-compose up -d

# 2. 로그 모니터링 시작 (별도 터미널)
docker-compose logs -f api

# 3. 프론트엔드 앱에서 AI 통화 시작

# 4. 로그에서 확인할 내용:
# ✅ "🎙️ [STT Mode] Streaming 방식 활성화"
# ✅ "🎬 [StreamingSTT] 스트리밍 시작"
# ✅ "✅ [STT Final #1] 안녕하세요 (신뢰도: 0.95)"
# ✅ "🎯 [발화 감지] 안녕하세요"
```

---

## 🔄 롤백 (Streaming → Chunk)

Streaming이 문제가 있을 경우 즉시 기존 방식으로 전환:

```bash
# 1. .env 파일 수정
echo "STT_MODE=chunk" >> .env

# 2. 컨테이너 재시작 (설정 반영)
docker-compose restart api

# 3. 로그 확인
docker-compose logs -f api | grep "STT Mode"

# 예상 출력:
# 📦 [STT Mode] Chunk 방식 활성화
```

---

## 📈 성능 측정

### 응답 시간 측정

```bash
# 로그에서 성능 지표 추출
docker-compose logs api | grep "⏱️"

# 예상 출력:
# ⏱️ 전체 응답 사이클: 1.35초
# ⏱️ 전체 응답 사이클: 1.52초
# ⏱️ 전체 응답 사이클: 1.28초
```

### STT 처리 시간

```bash
docker-compose logs api | grep "STT Final"

# 예상 출력:
# ✅ [STT Final #1] 안녕하세요 (신뢰도: 0.95)
```

---

## 🎯 체크리스트

테스트 전 확인:

- [ ] `backend/credentials/google-cloud-stt.json` 파일 존재
- [ ] `.env` 파일에 `STT_MODE=streaming` 설정
- [ ] `.env` 파일에 모든 필수 환경변수 설정
- [ ] `docker-compose build api` 실행
- [ ] `docker-compose up -d` 실행
- [ ] `docker-compose ps` 모든 서비스 `Up` 상태
- [ ] `docker-compose logs api | grep "STT Mode"` → "Streaming 방식 활성화" 출력
- [ ] `docker-compose logs api | grep "Google Cloud"` → 인증 성공 메시지 출력

모두 ✅ 체크되면 테스트 시작!

---

## 🆘 긴급 지원

### 컨테이너 내부 접속

```bash
# 컨테이너 쉘 접속
docker-compose exec api bash

# Python 인터프리터 실행
python

# 수동 테스트
>>> from app.config import settings
>>> print(settings.STT_MODE)
>>> print(settings.GOOGLE_APPLICATION_CREDENTIALS)
>>> import os
>>> os.path.exists(settings.GOOGLE_APPLICATION_CREDENTIALS)
```

### 전체 로그 저장

```bash
# 문제 발생 시 전체 로그 저장
docker-compose logs api > api_logs.txt

# 로그 파일 확인
cat api_logs.txt | grep -E "ERROR|WARN|❌"
```

---

## 📝 추가 정보

### 볼륨 마운트 설명

```yaml
volumes:
  - ./backend/app:/app/app                    # 코드 실시간 반영 (개발)
  - ./backend/credentials:/app/credentials:ro # 인증 파일 (읽기 전용)
```

- `:ro` = read-only (보안 강화)
- 개발 중에는 코드 변경이 즉시 반영됨 (--reload 옵션)

### 포트 매핑

```yaml
ports:
  - "8000:8000"  # API
  - "5432:5432"  # PostgreSQL
  - "6379:6379"  # Redis
  - "5555:5555"  # Flower (Celery 모니터링)
```

---

**작성일**: 2025-01-27
**최종 수정**: 2025-01-27

**준비 완료!** 이제 `docker-compose up -d` 실행하시면 됩니다! 🚀
