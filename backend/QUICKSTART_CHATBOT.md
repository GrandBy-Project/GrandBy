# 🚀 AI 챗봇 빠른 시작 가이드

## 1단계: 환경 설정 ⚙️

### OpenAI API 키 설정

`backend/.env` 파일 생성 (없다면):

```bash
# OpenAI API 설정
OPENAI_API_KEY=sk-your-api-key-here

# 기타 필요한 설정들...
APP_NAME=Grandby
ENVIRONMENT=development
DEBUG=True
```

### 필요한 패키지 확인

`requirements.txt`에 다음이 포함되어 있는지 확인:
```
fastapi
uvicorn[standard]
openai
python-multipart
```

설치:
```bash
cd backend
pip install -r requirements.txt
```

## 2단계: 서버 실행 🖥️

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

서버가 시작되면:
```
🚀 Starting Grandby API Server...
Environment: development
Debug Mode: True
✅ Database connection successful
```

## 3단계: 테스트 실행 ✅

### 방법 1: Python 테스트 스크립트

**새 터미널에서**:
```bash
cd backend
python test_chatbot.py
```

### 방법 2: Swagger UI (웹 브라우저)

1. 브라우저에서 열기: http://localhost:8000/docs
2. "AI Chatbot" 섹션 펼치기
3. `POST /api/chatbot/text` 선택
4. "Try it out" 클릭
5. 다음 입력:
   - `user_id`: test_user_1
   - `message`: 안녕하세요
   - `analyze_emotion`: true
6. "Execute" 클릭

### 방법 3: cURL 커맨드

```bash
curl -X POST "http://localhost:8000/api/chatbot/text" \
  -F "user_id=test_user_1" \
  -F "message=안녕하세요" \
  -F "analyze_emotion=true"
```

## 예상 응답 📤

```json
{
  "success": true,
  "user_message": "안녕하세요",
  "ai_response": "안녕하세요! 오늘은 어떻게 지내셨어요?",
  "emotion_analysis": {
    "emotion": "neutral",
    "urgency": "low",
    "keywords": ["인사"],
    "summary": "일반적인 인사"
  },
  "timing": {
    "emotion_analysis_time": 1.23,
    "llm_time": 2.45,
    "total_time": 3.68
  },
  "conversation_count": 1
}
```

## 테스트 대화 예시 💬

### 1. 일반적인 인사
```
사용자: "안녕하세요"
AI: "안녕하세요! 오늘은 어떻게 지내셨어요?"
```

### 2. 식사 확인
```
사용자: "오늘 점심은 김치찌개 먹었어요"
AI: "김치찌개 드셨군요! 맛있게 드셨어요? 저녁은 뭘 드실 계획이세요?"
```

### 3. 약 복용 확인
```
사용자: "아침 약은 깜빡하고 못 먹었네요"
AI: "아, 아침 약을 드시지 못하셨군요. 지금이라도 드시는 게 좋을까요? 언제 드셔야 하는지 알려주실 수 있나요?"
```

### 4. 건강 상태
```
사용자: "요즘 무릎이 좀 아파요"
AI: "무릎이 아프시다니 걱정이네요. 언제부터 아프셨어요? 병원에는 다녀오셨나요?"
```

## 로그 확인 📊

서버 터미널에서 실시간 로그 확인:

```
================================================================================
💬 텍스트 챗봇 대화 시작 (사용자: test_user_1)
================================================================================
😊 감정 분석 시작
✅ 감정 분석 완료 (소요 시간: 1.23초)
📊 분석 결과: {'emotion': 'neutral', 'urgency': 'low', ...}
🤖 LLM 응답 생성 시작
📥 사용자 입력: 안녕하세요
✅ LLM 응답 생성 완료 (소요 시간: 2.45초)
📤 AI 응답: 안녕하세요! 오늘은 어떻게 지내셨어요?

================================================================================
⏱️  전체 대화 사이클 완료!
  - 감정 분석: 1.23초
  - LLM 응답 생성: 2.45초
  ⭐ 총 소요 시간: 3.68초
================================================================================
```

## 음성 테스트 (선택사항) 🎤

음성 파일이 있다면:

```bash
curl -X POST "http://localhost:8000/api/chatbot/voice" \
  -F "user_id=test_user_1" \
  -F "audio_file=@voice.mp3" \
  -F "return_audio=true"
```

응답에 `audio_file_path`가 포함되며, 해당 경로의 MP3 파일을 재생할 수 있습니다.

## API 엔드포인트 정리 📡

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/api/chatbot/text` | POST | 텍스트 챗봇 (테스트용) |
| `/api/chatbot/voice` | POST | 음성 챗봇 (전체 파이프라인) |
| `/api/chatbot/session/{user_id}` | GET | 대화 기록 조회 |
| `/api/chatbot/session/{user_id}` | DELETE | 대화 기록 초기화 |

## 문제 해결 🔧

### 1. OpenAI API 키 오류
```
Error: Invalid API key
```
→ `.env` 파일에 유효한 OpenAI API 키가 설정되어 있는지 확인

### 2. 서버 연결 오류
```
ConnectionError: Cannot connect to server
```
→ 서버가 실행 중인지 확인 (http://localhost:8000/health)

### 3. 대화 기록이 안 보임
→ 서버를 재시작하면 메모리의 대화 기록이 초기화됨 (정상 동작)

## 다음 단계 🎯

1. ✅ 텍스트 챗봇으로 기본 동작 확인
2. ✅ 감정 분석 기능 테스트
3. 🎤 음성 파일로 전체 파이프라인 테스트
4. 📊 대화 기록 확인
5. 🔄 지속적인 대화로 컨텍스트 유지 테스트

## 참고 자료 📚

- 상세 문서: `backend/CHATBOT_README.md`
- API 문서: http://localhost:8000/docs
- 전체 프로젝트: `backend/README.md`

