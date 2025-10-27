# 상세 로깅 추가 완료

## 추가된 로그

### 1. STT 결과 로깅
```python
# streaming_stt_manager.py Line 256-259
if is_final:
    logger.info(f"📝 [STT] FINAL: '{transcript}' (신뢰도: {confidence:.2f})")
else:
    logger.info(f"⏳ [STT] INTERIM: '{transcript}' (안정성: {stability:.2f})")
```

**확인할 내용:**
- INTERIM 결과가 나오는지 (사용자가 말하는 중)
- FINAL 결과가 여러 개 나오는지 (여러 번 발화)

### 2. 오디오 전송 로깅
```python
# streaming_stt_manager.py Line 161-162
if chunk_count % 50 == 0:
    logger.info(f"📤 [Audio] 전송 중: {chunk_count}개 청크 ({chunk_count * 0.02:.1f}초)")
```

**확인할 내용:**
- 오디오가 Google Cloud로 계속 전송되고 있는지
- 전송이 멈추지 않는지

### 3. AudioProcessor 로깅
```python
# streaming_audio_processor.py Line 94-96
if self.total_chunks_processed % 50 == 0:
    logger.info(f"📊 [Audio] STT로 전달: {self.total_chunks_processed}개 ({seconds:.1f}초)")
```

**확인할 내용:**
- WebSocket에서 받은 오디오가 STT로 전달되고 있는지
- Echo Protection이 오디오를 차단하고 있지 않은지

## 테스트 시나리오

1. 통화 시작
2. AI: "안녕하세요! 무엇을 도와드릴까요?"
3. 사용자: "안녕하세요" ← 첫 번째 발화
   **예상 로그:**
   ```
   ⏳ [STT] INTERIM: '안녕'
   ⏳ [STT] INTERIM: '안녕하'
   ⏳ [STT] INTERIM: '안녕하세'
   📝 [STT] FINAL: '안녕하세요' (신뢰도: 0.87)
   ```
4. AI 응답 듣기
5. 사용자: "잘 지내요" ← 두 번째 발화
   **예상 로그:**
   ```
   ⏳ [STT] INTERIM: '잘'
   ⏳ [STT] INTERIM: '잘 지'
   ⏳ [STT] INTERIM: '잘 지내'
   📝 [STT] FINAL: '잘 지내요' (신뢰도: 0.91)
   ```

## 문제 진단 가이드

### 케이스 1: INTERIM은 나오는데 FINAL이 안 나옴
**의미:** Google Cloud가 음성을 인식하고 있지만 final로 확정하지 않음
**원인:**
- 배경 소음이 계속됨
- 침묵이 부족함
- Google Cloud 설정 문제

### 케이스 2: INTERIM도 FINAL도 없음
**의미:** Google Cloud가 음성을 인식하지 못함
**원인:**
- 오디오가 전송되지 않음 (`📤 [Audio] 전송 중` 로그 확인)
- Echo Protection이 차단 중 (`🤖 [EchoProtection]` 로그 확인)
- Google Cloud 연결 문제

### 케이스 3: 첫 FINAL 이후 INTERIM도 없음
**의미:** 스트림이 완전히 멈춤
**원인:**
- Google Cloud 스트림 종료
- `for response in responses:` 루프 종료
- 재시작 메커니즘 필요

## 다음 테스트

통화 후 다음 명령어로 로그 확인:
```bash
docker logs grandby_api 2>&1 | grep -E "(STT|Audio)" | tail -200
```

확인할 패턴:
1. 📊 [Audio] STT로 전달: 계속 나오는지
2. 📤 [Audio] 전송 중: 계속 나오는지
3. ⏳ [STT] INTERIM: 사용자 말할 때 나오는지
4. 📝 [STT] FINAL: 발화 완료 시 나오는지
