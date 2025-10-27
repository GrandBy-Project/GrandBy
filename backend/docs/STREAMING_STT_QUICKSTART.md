# Streaming STT 빠른 시작 가이드

## 🚀 5분 만에 시작하기

### 1. 환경 변수 설정

`.env` 파일에 다음 추가:

```env
# STT 모드 선택
STT_MODE=streaming

# Google Cloud Streaming 설정
GOOGLE_STT_INTERIM_RESULTS=true
GOOGLE_STT_SINGLE_UTTERANCE=false
GOOGLE_STT_MAX_ALTERNATIVES=1
GOOGLE_STT_MODEL=phone_call
```

### 2. 서버 시작

```bash
cd backend
python -m uvicorn app.main:app --reload
```

### 3. 로그 확인

서버 시작 시 다음 메시지가 출력되어야 합니다:

```
🎙️ [STT Mode] Streaming 방식 활성화
```

### 4. 테스트 통화

1. 프론트엔드 앱에서 AI 통화 시작
2. 전화 받기
3. "안녕하세요"라고 말하기
4. 서버 로그에서 다음 확인:

```
🎬 [StreamingSTT] 스트리밍 시작
✅ [STT Final #1] 안녕하세요 (신뢰도: 0.95)
🎯 [발화 감지] 안녕하세요
🤖 [LLM] 생성 시작
```

---

## ✅ 체크리스트

- [ ] `.env`에 `STT_MODE=streaming` 추가
- [ ] 서버 재시작
- [ ] 시작 로그에서 "Streaming 방식 활성화" 확인
- [ ] 테스트 통화 성공
- [ ] STT 결과가 즉시 표시되는지 확인

---

## 🔄 롤백 (기존 방식으로 돌아가기)

`.env` 파일 수정:

```env
STT_MODE=chunk
```

서버 재시작하면 자동으로 기존 방식으로 전환됩니다.

---

## 📊 성능 확인

로그에서 다음 지표 확인:

```
⏱️ 전체 응답 사이클: 1.35초  # 기존 3~7초 → 1~2초로 개선
✅ [STT Final] ... (0.25초)    # 기존 0.5초 → 0.2초로 개선
```

---

## 🆘 문제 해결

### 문제: "STT Mode Streaming 방식 활성화" 메시지가 안 나와요

**해결**:
```bash
# config.py에 설정이 제대로 추가되었는지 확인
grep "STT_MODE" backend/app/config.py

# 출력되어야 할 내용:
# STT_MODE: str = "streaming"
```

### 문제: "Import Error: No module named 'streaming_stt_manager'"

**해결**:
```bash
# 파일 존재 확인
ls backend/app/services/ai_call/streaming_stt_manager.py

# 없다면 다시 생성
```

### 문제: Google Cloud 인증 오류

**해결**:
```bash
# 인증 파일 경로 확인
ls backend/credentials/google-cloud-stt.json

# 환경 변수 확인
echo $GOOGLE_APPLICATION_CREDENTIALS
```

---

## 📖 상세 문서

더 자세한 내용은 [STREAMING_STT_MIGRATION.md](./STREAMING_STT_MIGRATION.md) 참고

---

**작성일**: 2025-01-27
