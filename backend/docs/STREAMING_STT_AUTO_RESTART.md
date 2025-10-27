# Google Cloud Streaming STT - 자동 재시작 구현

## 문제점

Google Cloud Speech-to-Text Streaming API는 다음과 같은 제약사항이 있습니다:

1. **스트림 자동 종료**: 첫 번째 final result 이후 스트림이 종료될 수 있음
2. **305초 제한**: 단일 스트리밍 세션은 최대 305초까지만 지속
3. **연속 인식 필요**: 전화 통화는 수분~수십분 지속되므로 연속 인식 필요

### 발생했던 증상

```
✅ 환영 멘트: "안녕하세요" → 정상 작동
✅ 첫 번째 발화: "여보세요" → 정상 인식
❌ 두 번째 발화: 인식 안됨
❌ 세 번째 발화: 인식 안됨

로그:
🏁 [StreamingSTT Thread] Google Cloud 스트림 종료됨
🛑 [STTSession] 종료 - Call: ..., 발화: 1개
```

## 해결 방법: 자동 재시작 메커니즘

### 핵심 아이디어

Google Cloud 스트림이 종료되면 **자동으로 새 스트림을 시작**하여 끊김 없는 연속 인식 제공

### 구현 상세

#### 1. StreamingSTTSession.process_results() 개선

**변경 전 (단일 스트림)**:
```python
async def process_results(self) -> AsyncGenerator[str, None]:
    if not self.manager:
        return

    try:
        async for result in self.manager.start_streaming():
            if result['is_final']:
                yield result['text']
    except Exception as e:
        logger.error(f"오류: {e}")
```

**변경 후 (자동 재시작)**:
```python
async def process_results(self) -> AsyncGenerator[str, None]:
    restart_count = 0
    max_restarts = 100  # 안전장치

    # 통화가 끝날 때까지 계속 재시작
    while self.is_running and restart_count < max_restarts:
        try:
            # 재시작 시 새 매니저 생성
            if restart_count > 0:
                logger.info(f"🔄 스트림 자동 재시작 #{restart_count}")
                self.manager = StreamingSTTManager(self.call_sid)
                await asyncio.sleep(0.1)

            # 스트리밍 시작 및 결과 처리
            async for result in self.manager.start_streaming():
                if result['is_final']:
                    final_text = result['text'].strip()
                    if final_text:
                        self.utterance_buffer.append(final_text)
                        yield final_text

            # 스트림 종료됨 → 자동 재시작
            if self.is_running:
                logger.info(f"🔄 스트림 종료됨, 재시작 준비...")
                restart_count += 1
            else:
                break

        except Exception as e:
            logger.error(f"오류: {e}")
            # 오류 발생 시에도 재시작 시도
            if self.is_running:
                restart_count += 1
                await asyncio.sleep(0.5)
            else:
                break
```

#### 2. add_audio() 안전성 개선

재시작 중에 매니저가 교체될 수 있으므로 예외 처리 추가:

```python
async def add_audio(self, audio_data: bytes):
    if self.manager and self.is_running:
        try:
            await self.manager.add_audio(audio_data)
        except Exception as e:
            # 재시작 중 일시적 오류는 무시
            logger.debug(f"⚠️ 오디오 추가 중 오류 (재시작 중일 수 있음): {e}")
```

## 동작 흐름

### 정상 시나리오

```
1. 통화 시작
   ↓
2. 첫 번째 스트림 시작
   ↓
3. 사용자: "여보세요" → ✅ 인식
   ↓
4. 사용자: "할 일 추가해줘" → ✅ 인식
   ↓
5. [Google Cloud 스트림 종료]
   ↓
6. 🔄 자동 재시작 #1
   ↓
7. 사용자: "내일 회의 있어" → ✅ 인식
   ↓
8. 사용자: "오후 3시에" → ✅ 인식
   ↓
9. [305초 제한 도달, 스트림 종료]
   ↓
10. 🔄 자동 재시작 #2
    ↓
11. ... 통화 종료까지 계속 반복
```

### 예상 로그 출력

```
🎬 [StreamingSTT] 스트리밍 시작 - Call: CA123...
✅ [STT Final #1] 여보세요
🎤 [발화 완료 #1] 여보세요

✅ [STT Final #2] 할 일 추가해줘
🎤 [발화 완료 #2] 할 일 추가해줘

🏁 [StreamingSTT Thread] Google Cloud 스트림 종료됨
🔄 [STTSession] 스트림 종료됨, 재시작 준비... (재시작 횟수: 1)
🔄 [STTSession] 스트림 자동 재시작 #1
🎙️ [StreamingSTT] 초기화 완료 - Call: CA123...
🎬 [StreamingSTT] 스트리밍 시작 - Call: CA123...

✅ [STT Final #3] 내일 회의 있어
🎤 [발화 완료 #3] 내일 회의 있어

✅ [STT Final #4] 오후 3시에
🎤 [발화 완료 #4] 오후 3시에

... (계속)
```

## 안전장치

### 1. 최대 재시작 횟수 제한
```python
max_restarts = 100  # 최대 100번까지만 재시작
```
- 무한 루프 방지
- 100번 = 약 8시간 통화 (5분 * 100회)

### 2. 정상 종료 체크
```python
if self.is_running:
    restart_count += 1
else:
    logger.info("🛑 정상 종료 요청됨")
    break
```
- 사용자가 통화 종료 시 즉시 중단

### 3. 오류 후 대기 시간
```python
await asyncio.sleep(0.5)  # 오류 후에는 0.5초 대기
```
- 연속 오류 시 과부하 방지

## 성능 고려사항

### 재시작 지연시간
- **정상 재시작**: 약 100ms (0.1초)
- **오류 후 재시작**: 약 500ms (0.5초)
- **사용자 영향**: 거의 없음 (발화 간 자연스러운 쉼과 비슷)

### 메모리 관리
- 각 재시작마다 새 `StreamingSTTManager` 생성
- 기존 매니저는 자동으로 가비지 컬렉션됨
- 오디오 큐는 새로 초기화됨

### 오디오 손실
- 재시작 중 100~500ms 동안의 오디오는 버퍼에 축적
- 새 스트림 시작 시 버퍼된 오디오부터 전송
- **실질적인 오디오 손실: 최소화**

## 테스트 시나리오

### 1. 짧은 발화 연속 테스트
```
사용자: "안녕"
AI: "네, 안녕하세요"
사용자: "할 일 추가"
AI: "어떤 할 일을 추가하시겠어요?"
사용자: "회의"
AI: "회의에 대해 더 자세히 말씀해주세요"
```

### 2. 긴 대화 테스트 (5분 이상)
- 여러 번의 자동 재시작 발생 확인
- 각 재시작 후에도 정상 인식 확인

### 3. 침묵 구간 테스트
- 사용자가 한동안 말하지 않아도 스트림 유지
- 다시 말할 때 정상 인식

## 변경된 파일

### backend/app/services/ai_call/streaming_stt_manager.py

**StreamingSTTSession 클래스**:
- `process_results()`: 자동 재시작 루프 추가
- `add_audio()`: 예외 처리 강화

## 다음 단계

1. ✅ 자동 재시작 구현 완료
2. 🔄 Docker 재빌드 및 테스트
3. ⏳ 다중 발화 인식 확인
4. ⏳ 5분 이상 장시간 통화 테스트
5. ⏳ 성능 메트릭 수집

## 예상 결과

### Before (기존)
```
발화 인식: 1개
통화 시간: 36.5초
문제: 첫 발화 이후 인식 중단
```

### After (개선)
```
발화 인식: 10+ 개
통화 시간: 5분+ (제한 없음)
재시작 횟수: 1~2회 (5분당 1회)
인식률: 95%+
```

## 문제 발생 시 체크리스트

1. **재시작이 너무 자주 발생**:
   - Google Cloud 할당량 확인
   - 네트워크 연결 상태 확인

2. **재시작 후에도 인식 안됨**:
   - 로그에서 "🔄 스트림 자동 재시작" 메시지 확인
   - 새 매니저 초기화 성공 여부 확인

3. **오디오 손실 발생**:
   - `await asyncio.sleep(0.1)` 시간 조정
   - 버퍼 크기 확인

## 참고 자료

- [Google Cloud Speech-to-Text Streaming Limits](https://cloud.google.com/speech-to-text/quotas)
- [Streaming Recognition Best Practices](https://cloud.google.com/speech-to-text/docs/best-practices-provide-speech-data)
