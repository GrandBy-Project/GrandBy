# Streaming STT Auto-Restart Bug Fix

## 문제 (Issue)

자동 재시작 로직을 구현했음에도 불구하고, 첫 번째 발화 후 스트림이 재시작되지 않음.

### 증상
```
✅ 첫 번째 발화: "여보세요" → 정상 인식
❌ 두 번째 발화: 인식 안됨
❌ 재시작 로그 없음
```

### 로그 분석
```
09:15:59.734 - ✅ [STT Final #1] 여보세요!... (신뢰도: 0.87)
09:15:59.734 - 🎤 [발화 완료 #1] 여보세요!
09:16:02.459 - [TTS 완료]

... (이후 아무 로그 없음)
```

## 원인 (Root Cause)

### 문제가 된 코드 (start_streaming() finally 블록)

**변경 전:**
```python
async def start_streaming(self) -> AsyncGenerator[Dict, None]:
    self.is_active = True
    # ... 스트리밍 로직 ...

    try:
        while self.is_active:
            # 결과 처리
            yield result_dict

    finally:
        self.is_active = False  # ← 문제!
        logger.info("세션 종료")
```

### 왜 문제인가?

1. Google Cloud가 스트림을 종료하면 `start_streaming()`의 finally 블록 실행
2. **`self.is_active = False` 설정**
3. `process_results()`의 자동 재시작 로직:
   ```python
   while self.is_running:  # ← Session의 is_running (True)
       async for result in self.manager.start_streaming():
           yield result

       # 여기까지 도달함
       if self.is_running:  # ← True
           restart_count += 1
           # 새 매니저 생성
           self.manager = StreamingSTTManager(...)
           # 다시 start_streaming() 호출
   ```

4. **문제**: 새 매니저의 `start_streaming()`을 호출해도, `is_active`는 `True`로 설정되지만...
5. **실제 문제**: `finally` 블록에서 매번 `is_active = False`로 재설정하는 것 자체는 문제가 아님
6. **진짜 문제**: 제너레이터가 정상 종료되지 않고 있었음

### 실제 버그

재분석 결과, 진짜 문제는:

```python
# start_streaming()의 결과 처리 루프
while self.is_active:  # ← 스트림 종료 시그널 받으면 break
    try:
        result_dict = result_queue.get_nowait()
    except queue.Empty:
        continue

    if result_dict is None:  # ← 종료 시그널
        break

    yield result_dict

# 여기까지 도달해야 제너레이터가 종료됨
logger.info("스트리밍 정상 종료")  # ← 이 로그가 안 나왔음!
```

로그를 보면:
- "🏁 [StreamingSTT Thread] Google Cloud 스트림 종료됨" ← 스레드는 종료
- "🏁 [StreamingSTT] 스트리밍 정상 종료" ← **이 로그가 없음!**

**결론**: `result_queue.put(None)` 종료 시그널이 전달되었지만, 메인 루프가 이를 처리하기 전에 `finally` 블록이 `is_active = False`로 설정하여 루프가 중단됨.

## 해결책 (Solution)

### 수정 사항

**`start_streaming()` finally 블록 수정:**

```python
# Before
finally:
    self.is_active = False  # ← 제거!
    logger.info("세션 종료")

# After
finally:
    # is_active는 여기서 False로 설정하지 않음!
    # stop() 메서드를 통해서만 is_active를 False로 설정
    session_duration = time.time() - self.session_start_time
    logger.info(f"🛑 [StreamingSTT] 세션 정리 완료 - "
               f"시간: {session_duration:.1f}초, "
               f"오디오: {self.total_audio_duration:.1f}초, "
               f"최종: {self.final_count}개, "
               f"오류: {self.error_count}개")
```

### 동작 흐름 (Before vs After)

#### Before (버그 있음)
```
1. start_streaming() 시작
   ↓
2. is_active = True
   ↓
3. Google Cloud 스트림 종료 → result_queue.put(None)
   ↓
4. finally 블록 실행 → is_active = False
   ↓
5. while self.is_active: 루프 종료 (None 처리 전에!)
   ↓
6. 제너레이터 종료
   ↓
7. process_results()로 돌아옴
   ↓
8. if self.is_running: 체크
   ↓
9. 재시작 시도... 하지만 이미 로직이 꼬임
```

#### After (수정됨)
```
1. start_streaming() 시작
   ↓
2. is_active = True
   ↓
3. Google Cloud 스트림 종료 → result_queue.put(None)
   ↓
4. while 루프에서 result_dict = None 받음
   ↓
5. if result_dict is None: break
   ↓
6. logger.info("스트리밍 정상 종료")
   ↓
7. finally 블록 실행 (is_active는 그대로 True)
   ↓
8. 제너레이터 정상 종료
   ↓
9. process_results()로 돌아옴
   ↓
10. if self.is_running: → True
    ↓
11. restart_count += 1
    ↓
12. self.manager = StreamingSTTManager(...)  # 새 매니저
    ↓
13. 다시 async for self.manager.start_streaming():
    ↓
14. 새 스트림 시작! 🎉
```

## 예상 로그 (After Fix)

```
# 첫 번째 스트림
09:15:52.393 - 🎬 [StreamingSTT] 스트리밍 시작 - Call: CA987...
09:15:59.734 - ✅ [STT Final #1] 여보세요!... (신뢰도: 0.87)
09:15:59.734 - 🎤 [발화 완료 #1] 여보세요!

09:16:05.123 - 🏁 [StreamingSTT Thread] Google Cloud 스트림 종료됨
09:16:05.124 - 🏁 [StreamingSTT] 스트림 종료 신호 받음
09:16:05.125 - 🏁 [StreamingSTT] 스트리밍 정상 종료 - 최종: 1개, 중간: 3개
09:16:05.126 - 🛑 [StreamingSTT] 세션 정리 완료 - 시간: 12.7초, 오디오: 10.2초, 최종: 1개

# 자동 재시작!
09:16:05.127 - 🔄 [STTSession] 스트림 종료됨, 재시작 준비... (재시작 횟수: 1)
09:16:05.128 - 🔄 [STTSession] 스트림 자동 재시작 #1
09:16:05.129 - 🎙️ [StreamingSTT] 초기화 완료 - Call: CA987...
09:16:05.130 - 🎬 [StreamingSTT] 스트리밍 시작 - Call: CA987...
09:16:05.431 - 📤 [StreamingSTT] 오디오 스트리밍 시작
09:16:08.255 - ✅ [StreamingSTT Thread] API 연결 성공 - 결과 수신 시작

# 두 번째 발화 인식!
09:16:12.567 - ✅ [STT Final #2] 할 일 추가해줘... (신뢰도: 0.91)
09:16:12.568 - 🎤 [발화 완료 #2] 할 일 추가해줘

# 세 번째 발화 인식!
09:16:18.234 - ✅ [STT Final #3] 내일 회의 있어... (신뢰도: 0.89)
09:16:18.235 - 🎤 [발화 완료 #3] 내일 회의 있어

... (계속)
```

## 변경된 파일

### backend/app/services/ai_call/streaming_stt_manager.py

**Line 325-333** (finally 블록):
```python
finally:
    # is_active는 여기서 False로 설정하지 않음!
    # stop() 메서드를 통해서만 is_active를 False로 설정
    session_duration = time.time() - self.session_start_time
    logger.info(f"🛑 [StreamingSTT] 세션 정리 완료 - "
               f"시간: {session_duration:.1f}초, "
               f"오디오: {self.total_audio_duration:.1f}초, "
               f"최종: {self.final_count}개, "
               f"오류: {self.error_count}개")
```

**추가 로그:**
- Line 300: `🏁 [StreamingSTT] 스트림 종료 신호 받음`
- Line 315-317: `🏁 [StreamingSTT] 스트리밍 정상 종료` + 제너레이터 종료 설명

## 핵심 개념

### is_active vs is_running

- **`StreamingSTTManager.is_active`**:
  - 현재 스트림이 활성 상태인지
  - `start_streaming()` 호출 시 `True`
  - `stop()` 호출 시에만 `False`
  - 스트림 정상 종료 시 `True` 유지 (재시작 가능하도록)

- **`StreamingSTTSession.is_running`**:
  - 전체 통화 세션이 활성 상태인지
  - `initialize()` 시 `True`
  - `close()` 시 `False`
  - 통화 종료 시에만 `False`

### 생명주기

```
통화 시작
  ↓
StreamingSTTSession.initialize()
  → is_running = True
  ↓
  ┌─────────────────────────────────────┐
  │ process_results() 루프 시작        │
  │ while is_running:                   │
  │   ↓                                 │
  │   StreamingSTTManager 생성          │
  │   → is_active = False (초기값)      │
  │   ↓                                 │
  │   start_streaming() 호출            │
  │   → is_active = True                │
  │   ↓                                 │
  │   ... Google Cloud 스트리밍 ...     │
  │   ↓                                 │
  │   스트림 종료 (Google Cloud)        │
  │   → is_active는 True 유지!          │
  │   → 제너레이터만 종료                │
  │   ↓                                 │
  │   if is_running: → True             │
  │   ↓                                 │
  │   재시작 (새 매니저 생성)            │
  │   ↓                                 │
  │   (루프 계속)                        │
  └─────────────────────────────────────┘
  ↓
통화 종료
  ↓
StreamingSTTSession.close()
  → is_running = False
  ↓
manager.stop()
  → is_active = False
```

## 테스트 방법

1. Docker 재빌드:
   ```bash
   cd backend
   docker-compose down
   docker-compose up --build
   ```

2. 통화 테스트:
   - 첫 번째 발화: "여보세요"
   - AI 응답 대기
   - 두 번째 발화: "할 일 추가해줘"
   - 세 번째 발화: "내일 회의 있어"

3. 로그 확인:
   - `🔄 [STTSession] 스트림 자동 재시작` 메시지 확인
   - 모든 발화가 인식되는지 확인
   - 재시작 횟수 확인

## 성공 기준

- ✅ 첫 번째 발화 인식
- ✅ 자동 재시작 로그 출력
- ✅ 두 번째 발화 인식
- ✅ 세 번째 이상 발화 인식
- ✅ 5분 이상 장시간 통화 지원

## 참고

- Google Cloud Streaming limit: 305초 (5분 5초)
- 자동 재시작으로 무제한 통화 지원
- 재시작 지연: ~100ms (사용자 인지 불가)
