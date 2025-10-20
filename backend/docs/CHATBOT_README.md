# 🤖 어르신 돌봄 AI 챗봇 서비스

어르신들의 외로움을 달래고 약 복용 등 상황을 파악하기 위한 음성 챗봇 서비스입니다.

## 🎯 주요 기능

### 1. **STT (Speech-to-Text)**
- **모델**: OpenAI Whisper (`whisper-1`)
- **기능**: 음성을 텍스트로 변환
- **언어**: 한국어 지원

### 2. **LLM (대화 생성 및 감정 분석)**
- **모델**: OpenAI GPT-4o-mini
- **기능**:
  - 어르신과의 자연스러운 대화 생성
  - 감정 상태 분석 (긍정/부정/중립/걱정)
  - 건강 상태 확인 (약 복용, 식사, 운동 등)
  - 긴급도 판단

### 3. **TTS (Text-to-Speech)**
- **모델**: OpenAI TTS-1
- **음성**: Nova (따뜻한 여성 목소리)
- **기능**: 텍스트를 음성으로 변환

## 📡 API 엔드포인트

### 1. 텍스트 챗봇 (테스트용)
```
POST /api/chatbot/text
```

**파라미터**:
- `user_id` (string): 사용자 ID
- `message` (string): 사용자 메시지
- `analyze_emotion` (boolean): 감정 분석 여부 (기본값: false)

**응답**:
```json
{
  "success": true,
  "user_message": "오늘 점심은 김치찌개 먹었어요",
  "ai_response": "김치찌개 드셨군요! 맛있게 드셨어요? 오늘 약은 챙겨 드셨나요?",
  "emotion_analysis": {
    "emotion": "positive",
    "urgency": "low",
    "keywords": ["점심", "김치찌개"],
    "summary": "식사를 즐겁게 하신 것 같습니다"
  },
  "timing": {
    "emotion_analysis_time": 1.23,
    "llm_time": 2.45,
    "total_time": 3.68
  },
  "conversation_count": 1
}
```

### 2. 음성 챗봇 (전체 파이프라인)
```
POST /api/chatbot/voice
```

**파라미터**:
- `user_id` (string): 사용자 ID
- `audio_file` (file): 음성 파일 (mp3, wav, m4a 등)
- `return_audio` (boolean): 음성 응답 생성 여부 (기본값: true)

**응답**:
```json
{
  "success": true,
  "user_message": "안녕하세요",
  "ai_response": "안녕하세요! 오늘은 어떻게 지내셨어요?",
  "audio_file_path": "/tmp/tts_1697123456789.mp3",
  "timing": {
    "stt_time": 1.5,
    "llm_time": 2.3,
    "tts_time": 1.8,
    "total_time": 5.6
  },
  "conversation_count": 1
}
```

### 3. 대화 기록 조회
```
GET /api/chatbot/session/{user_id}
```

### 4. 대화 기록 초기화
```
DELETE /api/chatbot/session/{user_id}
```

## 🚀 실행 방법

### 1. 환경 설정

`.env` 파일에 OpenAI API 키 설정:
```bash
OPENAI_API_KEY=sk-your-api-key-here
```

### 2. 서버 실행

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. API 문서 확인

브라우저에서 열기:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 테스트 스크립트 실행

```bash
cd backend
python test_chatbot.py
```

## 💡 테스트 예시

### cURL로 텍스트 챗봇 테스트

```bash
curl -X POST "http://localhost:8000/api/chatbot/text" \
  -F "user_id=test_user_1" \
  -F "message=안녕하세요" \
  -F "analyze_emotion=true"
```

### Python으로 음성 챗봇 테스트

```python
import requests

# 음성 파일 업로드
with open("voice.mp3", "rb") as f:
    response = requests.post(
        "http://localhost:8000/api/chatbot/voice",
        data={"user_id": "test_user_1", "return_audio": True},
        files={"audio_file": f}
    )
    
result = response.json()
print(f"사용자: {result['user_message']}")
print(f"AI: {result['ai_response']}")
print(f"총 시간: {result['timing']['total_time']}초")
```

## ⏱️ 성능 측정

모든 API는 각 단계별 실행 시간을 측정하여 반환합니다:

- **STT 시간**: 음성 → 텍스트 변환 시간
- **LLM 시간**: AI 응답 생성 시간
- **TTS 시간**: 텍스트 → 음성 변환 시간
- **감정 분석 시간**: 감정 분석 시간 (옵션)
- **총 시간**: 전체 사이클 완료 시간

## 📊 로그 출력 예시

```
================================================================================
💬 텍스트 챗봇 대화 시작 (사용자: test_user_1)
================================================================================
🤖 LLM 응답 생성 시작
📥 사용자 입력: 오늘 점심은 김치찌개 먹었어요
✅ LLM 응답 생성 완료 (소요 시간: 2.34초)
📤 AI 응답: 김치찌개 드셨군요! 맛있게 드셨어요? 오늘 약은 챙겨 드셨나요?

================================================================================
⏱️  전체 대화 사이클 완료!
  - 감정 분석: 1.23초
  - LLM 응답 생성: 2.34초
  ⭐ 총 소요 시간: 3.57초
================================================================================
```

## 🔧 설정 커스터마이징

### 음성 선택 변경 (TTS)

`backend/app/services/ai_call/tts_service.py`:
```python
self.voice = "nova"  # alloy, echo, fable, onyx, nova, shimmer
```

### 대화 스타일 변경 (LLM)

`backend/app/services/ai_call/llm_service.py`:
```python
self.elderly_care_prompt = """당신만의 프롬프트"""
```

### 모델 변경

- STT: `whisper-1` (고정)
- LLM: `gpt-4o-mini` (빠르고 경제적) → `gpt-4o` (더 정확함)
- TTS: `tts-1` (빠름) → `tts-1-hd` (고품질)

## 📝 주의사항

1. **OpenAI API 키 필수**: `.env` 파일에 유효한 API 키 설정 필요
2. **대화 기록**: 현재는 메모리에 저장 (서버 재시작 시 초기화)
3. **파일 정리**: 임시 음성 파일은 자동으로 삭제됨
4. **동시 사용자**: 여러 사용자의 대화 세션을 `user_id`로 구분 관리

## 🎯 다음 단계

- [ ] 데이터베이스에 대화 기록 저장
- [ ] WebSocket으로 실시간 스트리밍 구현
- [ ] 일정 추출 및 알림 기능 연동
- [ ] 감정 분석 기반 보호자 알림
- [ ] 음성 품질 개선 (노이즈 제거 등)

