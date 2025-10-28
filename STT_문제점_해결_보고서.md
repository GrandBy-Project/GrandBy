# STT 실시간 음성 처리 문제점 및 해결 방안

## 📌 발견된 문제점

### 1. 통화 종료 후 백그라운드 태스크 계속 실행
**증상**: 통화가 종료되어도 이전에 말한 내용의 처리가 계속되어 로그가 계속 생성됨

**로그 예시**:
```
2025-10-28 07:04:28.383 - 📞 Twilio 통화 종료 - Call: CA4f0f69ba4899af17a50ab0c7c8c1c6d8
2025-10-28 07:04:32.621 - ✅ [RTZR 최종 인식] 여보세요 제 말 안 들리세요
2025-10-28 07:04:42.808 - ✅ [RTZR 최종 인식] 그냥 일기 쓰고 싶다구요
```

### 2. AI 응답 중 사용자 음성 인식 문제
**증상**: AI가 말하는 중에 사용자가 말하면 계속 음성이 감지되어 대화가 자꾸 밀리는 현상 발생

**원인**: AI 응답 중 사용자 입력을 차단하는 로직이 없음

---

## ✅ 해결 방안

### 수정 1: AI 응답 중 사용자 입력 차단 플래그 추가

**파일**: `backend/app/services/ai_call/rtzr_stt_realtime.py`

```python
class RTZRRealtimeSTT:
    def __init__(self):
        # ... 기존 코드 ...
        
        # ✅ AI 응답 중 사용자 입력 차단 플래그
        self.is_bot_speaking = False
        self.bot_silence_delay = 0  # AI 응답 종료 후 1초 대기
        
    def start_bot_speaking(self):
        """AI 응답 시작 - 사용자 입력 차단"""
        self.is_bot_speaking = True
        self.bot_silence_delay = 0
        logger.debug("🤖 [에코 방지] AI 응답 중 - 사용자 입력 차단")
    
    def stop_bot_speaking(self):
        """AI 응답 종료 - 1초 후 사용자 입력 재개"""
        self.is_bot_speaking = False
        self.bot_silence_delay = 50  # 50개 청크 = 1초 대기
        logger.debug("🤖 [에코 방지] AI 응답 종료 - 1초 후 사용자 입력 재개")
```

### 수정 2: 스트리밍 처리에서 AI 응답 중 입력 무시

**파일**: `backend/app/services/ai_call/rtzr_stt_realtime.py`

```python
async def start_streaming(self) -> AsyncGenerator[dict, None]:
    try:
        async for result in self.rtzr_service.transcribe_streaming(self.audio_queue):
            # ✅ AI 응답 중이면 사용자 입력 무시
            if self.is_bot_speaking:
                continue
            
            # ✅ AI 응답 종료 후 1초 대기 중이면 무시
            if self.bot_silence_delay > 0:
                self.bot_silence_delay -= 1
                continue
            
            # ... 기존 처리 로직 ...
```

### 수정 3: main.py에서 AI 응답 시작/종료 플래그 설정

**파일**: `backend/app/main.py`

```python
# 최종 결과 처리
if is_final and text:
    # ... 기존 코드 ...
    
    # ✅ AI 응답 시작 (사용자 입력 차단)
    rtzr_stt.start_bot_speaking()
    
    # LLM 응답 생성
    ai_response = await process_streaming_response(...)
    
    # ✅ AI 응답 종료 (1초 후 사용자 입력 재개)
    rtzr_stt.stop_bot_speaking()
```

### 수정 4: 오디오 수신에서도 차단 처리

**파일**: `backend/app/main.py`

```python
elif event_type == 'media':
    if rtzr_stt and rtzr_stt.is_active:
        # ✅ AI 응답 중이면 오디오 무시 (에코 방지)
        if rtzr_stt.is_bot_speaking:
            continue
        
        # ✅ AI 응답 종료 후 1초 대기 중이면 무시
        if rtzr_stt.bot_silence_delay > 0:
            rtzr_stt.bot_silence_delay -= 1
            continue
        
        # 오디오 전송
        await rtzr_stt.add_audio_chunk(audio_payload)
```

### 수정 5: 통화 종료 시 백그라운드 태스크 안전하게 취소

**파일**: `backend/app/main.py`

```python
elif event_type == 'stop':
    # ... 기존 코드 ...
    
    # ✅ RTZR 백그라운드 태스크 취소
    if 'rtzr_task' in locals() and rtzr_task:
        logger.info("🛑 RTZR 백그라운드 태스크 취소 중...")
        rtzr_task.cancel()
        try:
            await asyncio.wait_for(rtzr_task, timeout=2.0)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            logger.info("✅ RTZR 백그라운드 태스크 종료 완료")
```

### 수정 6: 통화 종료 체크를 루프 내에서 실행

**파일**: `backend/app/main.py`

```python
async def process_rtzr_results():
    """RTZR 인식 결과 처리"""
    nonlocal last_partial_time, call_sid
    try:
        async for result in rtzr_stt.start_streaming():
            # ✅ 통화 종료 체크
            if call_sid not in conversation_sessions:
                logger.info("⚠️ 통화 종료로 인한 RTZR 처리 중단")
                break
            
            # ... 기존 처리 로직 ...
            
            # 최종 결과 처리
            if is_final and text:
                # ✅ 통화 종료 체크
                if call_sid not in conversation_sessions:
                    logger.info("⚠️ 통화 종료로 인한 최종 처리 중단")
                    break
                
                # ... 기존 처리 로직 ...
```

---

## 🎯 개선 효과

### 1. AI 응답 중 사용자 입력 차단
- AI가 말하는 중 사용자 음성 무시
- 대화 밀림 현상 제거
- 1초 대기로 에코 방지

### 2. 통화 종료 후 안전한 정리
- 백그라운드 태스크 즉시 취소
- 로그 계속 생성 문제 해결
- 메모리 누수 방지

### 3. 안정성 향상
- 세션 삭제 후 접근 방지
- KeyError 예외 방지
- 안전한 리소스 정리

---

## 📝 수정된 파일 목록

1. `backend/app/services/ai_call/rtzr_stt_realtime.py`
   - AI 응답 중 사용자 입력 차단 플래그 추가
   - 스트리밍 처리 시 입력 무시 로직 추가

2. `backend/app/main.py`
   - AI 응답 시작/종료 플래그 설정
   - 오디오 수신 시 차단 처리
   - 통화 종료 시 태스크 취소
   - 통화 종료 체크 추가

---

## 🧪 테스트 방법

### 테스트 시나리오 1: AI 응답 중 사용자 음성 차단
1. 사용자: "안녕하세요"
2. AI: "안녕하세요! 무엇을 도와드릴까요?" (응답 중)
3. 사용자: "테스트 테스트" (AI가 말하는 중에 말함)
4. **기대 결과**: "테스트 테스트"는 무시됨
5. AI 응답 완료 후 1초 대기
6. 사용자: "일기 쓰고 싶어요"
7. **기대 결과**: 정상 인식 및 처리

### 테스트 시나리오 2: 통화 종료 후 로그 중단
1. 사용자: "안녕하세요"
2. AI: 응답 중...
3. 사용자가 통화 종료
4. **기대 결과**: 통화 종료 후 로그 생성 중단
5. **기대 결과**: 백그라운드 태스크 즉시 취소

---

## ✅ 최종 상태

- AI 응답 중 사용자 입력 차단 ✅
- 통화 종료 후 백그라운드 태스크 안전하게 취소 ✅
- 세션 삭제 후 접근 방지 ✅
- 안정적인 리소스 정리 ✅

---

**작성일**: 2025-10-28  
**작성자**: AI Assistant

