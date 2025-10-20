# 실시간 음성 대화 서비스 가이드

## 📋 개요

Twilio Media Streams와 OpenAI API를 활용한 실시간 양방향 음성 대화 시스템입니다.
`stt_service.py`, `tts_service.py`, `llm_service.py`를 통합하여 구현되었습니다.

## 🎯 주요 기능

### 1. 실시간 음성 대화 파이프라인
```
사용자 음성 (Twilio) 
  → STT (Whisper API) 
  → LLM (GPT-4o-mini) 
  → TTS (OpenAI TTS) 
  → 음성 응답 (Twilio)
```

### 2. 구현된 기능
- ✅ **실시간 음성 인식** (STT): OpenAI Whisper API
- ✅ **자연스러운 대화 생성** (LLM): GPT-4o-mini with 어르신 케어 프롬프트
- ✅ **음성 합성** (TTS): OpenAI TTS (nova 보이스)
- ✅ **침묵 감지**: 사용자 발화 종료 자동 감지
- ✅ **대화 히스토리 관리**: 최근 10개 메시지 유지
- ✅ **종료 키워드 인식**: "종료", "끝", "그만", "안녕" 등

## 🏗️ 아키텍처

### 서비스 구조
```
backend/app/
├── main.py                          # WebSocket 핸들러 및 통합
├── services/
│   └── ai_call/
│       ├── stt_service.py          # 음성 → 텍스트 (STT)
│       ├── llm_service.py          # 대화 생성 (LLM)
│       ├── tts_service.py          # 텍스트 → 음성 (TTS)
│       └── twilio_service.py       # 전화 발신/관리
```

### main.py 주요 함수

#### 1. `media_stream_handler()` (806~920라인)
```python
@app.websocket("/api/twilio/media-stream")
async def media_stream_handler(websocket: WebSocket):
    """
    Twilio Media Streams WebSocket 핸들러
    실시간 오디오 데이터 양방향 처리
    """
```

**역할**:
- Twilio WebSocket 연결 수락 및 관리
- 실시간 오디오 스트림 수신
- STT → LLM → TTS 파이프라인 실행
- 대화 세션 관리

**이벤트 처리**:
- `start`: 스트림 시작, 환영 메시지 전송
- `media`: 오디오 데이터 수신 및 처리
- `stop`: 스트림 종료, 대화 내용 저장

#### 2. `transcribe_audio_realtime()` (212~260라인)
```python
async def transcribe_audio_realtime(audio_data: bytes) -> str:
    """
    실시간 오디오를 텍스트로 변환 (STT Service 사용)
    """
```

**역할**:
- Twilio mulaw 오디오 → WAV 변환
- `stt_service.transcribe_audio()` 호출
- 한국어 음성 인식

**처리 과정**:
1. mulaw → 16-bit PCM 변환
2. WAV 파일 생성 (8kHz, Mono)
3. STT Service 호출
4. 임시 파일 삭제

#### 3. `send_audio_to_twilio_with_tts()` (263~341라인)
```python
async def send_audio_to_twilio_with_tts(websocket: WebSocket, stream_sid: str, text: str):
    """
    TTS Service를 사용하여 텍스트를 음성으로 변환 후 Twilio로 전송
    """
```

**역할**:
- `tts_service.text_to_speech()` 호출
- MP3 → WAV → mulaw 변환
- Twilio WebSocket으로 전송

**처리 과정**:
1. TTS Service로 MP3 생성
2. pydub로 MP3 → WAV 변환
3. WAV → mulaw 변환 (8kHz, Mono)
4. Base64 인코딩 후 청크 단위 전송

## 🔧 설정 및 실행

### 1. 환경 변수 설정 (.env)
```bash
# OpenAI API
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_TTS_MODEL=tts-1
OPENAI_TTS_VOICE=nova

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1234567890

# API Base URL (ngrok 또는 도메인)
API_BASE_URL=your-domain.ngrok-free.app

# 테스트용 전화번호 (+821012345678 형식)
TEST_PHONE_NUMBER=+821012345678
```

### 2. 의존성 설치
```bash
cd backend
pip install -r requirements.txt
```

**추가된 패키지**:
- `pydub==0.25.1`: 오디오 포맷 변환

**시스템 요구사항**:
- `ffmpeg`: pydub가 MP3를 처리하기 위해 필요
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Windows
# https://ffmpeg.org/download.html 에서 다운로드
```

### 3. 서버 실행
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. ngrok으로 외부 노출 (로컬 개발 시)
```bash
ngrok http 8000
```

ngrok URL을 `.env`의 `API_BASE_URL`에 설정:
```bash
API_BASE_URL=abc123.ngrok-free.app
```

### 5. 전화 테스트
```bash
# API 호출로 자동 발신
curl -X POST http://localhost:8000/api/twilio/call

# 또는 브라우저에서 Swagger UI 사용
# http://localhost:8000/docs
```

## 📞 사용 흐름

### 전화 수신 시 프로세스

1. **전화 발신**
   ```
   POST /api/twilio/call
   → Twilio가 TEST_PHONE_NUMBER로 전화 발신
   ```

2. **전화 연결**
   ```
   POST /api/twilio/voice (Twilio 콜백)
   → TwiML 응답 생성
   → WebSocket 연결 지시
   ```

3. **WebSocket 스트림 시작**
   ```
   WS /api/twilio/media-stream
   → 실시간 오디오 스트리밍 시작
   → "안녕하세요! 무엇을 도와드릴까요?" (환영 메시지)
   ```

4. **실시간 대화 사이클**
   ```
   [사용자 말함]
   → AudioProcessor가 침묵 감지
   → STT: 음성 → 텍스트
   → LLM: 응답 생성
   → TTS: 텍스트 → 음성
   → Twilio로 전송
   → [AI 음성 재생]
   ```

5. **대화 종료**
   - 사용자가 "종료", "끝", "그만", "안녕" 등 발화
   - 또는 전화 끊기

## 🎨 커스터마이징

### 1. 시스템 프롬프트 변경
`llm_service.py`의 `elderly_care_prompt` 수정:
```python
self.elderly_care_prompt = """당신은 어르신들의 외로움을 달래주는 따뜻한 AI 친구입니다.
다음 역할을 수행합니다:
1. 친근하고 존댓말을 사용하여 대화합니다
2. 어르신의 감정을 이해하고 공감합니다
...
"""
```

### 2. 음성 변경
`tts_service.py`의 `voice` 속성 변경:
```python
self.voice = "nova"  # alloy, echo, fable, onyx, nova, shimmer
```

### 3. 침묵 감지 조정
`main.py`의 `AudioProcessor` 클래스:
```python
self.silence_threshold = 500  # RMS 임계값 (낮을수록 민감)
self.max_silence = 1.5  # 침묵 시간 (초)
```

### 4. 대화 히스토리 크기
`media_stream_handler()`에서:
```python
if len(conversation_sessions[call_sid]) > 10:  # 10개에서 원하는 수로 변경
    conversation_sessions[call_sid] = conversation_sessions[call_sid][-10:]
```

## 📊 모니터링 및 로깅

### 로그 포맷
```
============================================================
🔄 실시간 대화 사이클 시작
🎤 STT 변환 시작: /tmp/audio_xyz.wav
✅ STT 변환 완료 (소요 시간: 0.85초)
📝 변환 결과: 안녕하세요 오늘 날씨가 좋네요...
👤 사용자: 안녕하세요 오늘 날씨가 좋네요
🤖 LLM 응답 생성 시작
✅ LLM 응답 생성 완료 (소요 시간: 1.23초)
📤 AI 응답: 네, 정말 날씨가 좋네요! 산책하시기 좋은 날씨예요.
🔊 TTS 변환 시작
✅ TTS 변환 완료 (소요 시간: 0.92초)
💾 저장 경로: /backend/audio_files/tts/tts_1234567890.mp3
📤 오디오 전송 시작: 12345 bytes (mulaw 8kHz)
✅ 음성 전송 완료
⏱️  전체 사이클 완료: 3.15초
============================================================
```

### 성능 메트릭
- **STT 시간**: 일반적으로 0.5~1.5초
- **LLM 시간**: 일반적으로 1~2초
- **TTS 시간**: 일반적으로 0.8~1.5초
- **전체 사이클**: 일반적으로 3~5초

## 🔮 향후 개발 (TODO)

### 1. 일기 자동 생성
```python
# media_stream_handler()의 stop 이벤트에서
if call_sid in conversation_sessions:
    conversation_text = "\n".join([
        f"{msg['role']}: {msg['content']}" 
        for msg in conversation_sessions[call_sid]
    ])
    
    # LLM Service 사용
    diary = llm_service.summarize_conversation_to_diary(conversation_text)
    
    # DB에 저장
    # save_diary_to_db(elderly_id, diary)
```

### 2. 일정 자동 추출
```python
# 대화 종료 시
schedule = llm_service.extract_schedule_from_conversation(conversation_text)

# 일정이 있으면 TODO 생성
if schedule:
    # create_todo_from_schedule(elderly_id, schedule)
```

### 3. 감정 분석 및 알림
```python
# 사용자 발화 시 감정 분석
emotion_result, _ = llm_service.analyze_emotion(user_text)

if emotion_result['urgency'] == 'high':
    # 보호자에게 긴급 알림 전송
    # send_notification_to_guardian(elderly_id, emotion_result)
```

### 4. 스트리밍 TTS (지연 시간 단축)
```python
# tts_service.py에 구현
async def text_to_speech_streaming(self, text: str):
    """실시간 스트리밍 TTS"""
    # OpenAI Streaming API 사용
    pass
```

## 🐛 문제 해결

### 1. 음성이 들리지 않을 때
- pydub 및 ffmpeg 설치 확인
- 로그에서 "❌ 오디오 변환 오류" 확인
- Twilio Media Stream 포맷 확인 (mulaw 8kHz)

### 2. 음성 인식이 안 될 때
- 침묵 감지 임계값 조정 (`AudioProcessor.silence_threshold`)
- 오디오 품질 확인 (최소 1초 이상 발화)
- OpenAI API 키 및 할당량 확인

### 3. 응답이 느릴 때
- 네트워크 지연 확인
- OpenAI API 서버 상태 확인
- 대화 히스토리 크기 줄이기

### 4. WebSocket 연결 끊김
- ngrok 타임아웃 (무료 플랜: 2시간)
- API_BASE_URL 올바른지 확인
- Twilio 콜백 URL 확인

## 📚 참고 자료

- [OpenAI Whisper API](https://platform.openai.com/docs/guides/speech-to-text)
- [OpenAI TTS API](https://platform.openai.com/docs/guides/text-to-speech)
- [OpenAI Chat API](https://platform.openai.com/docs/guides/chat)
- [Twilio Media Streams](https://www.twilio.com/docs/voice/media-streams)
- [pydub 문서](https://github.com/jiaaro/pydub)

## 💡 팁

1. **로컬 테스트**: ngrok 사용 시 무료 플랜은 동시 연결 1개 제한
2. **비용 절감**: OpenAI API 호출 최소화, 대화 히스토리 제한
3. **품질 향상**: TTS 모델을 `tts-1-hd`로 변경 (느리지만 고품질)
4. **다국어 지원**: `stt_service.transcribe_audio(language="en")` 언어 변경

---

**구현 완료일**: 2025-10-14  
**버전**: 1.0  
**작성자**: AI Assistant

