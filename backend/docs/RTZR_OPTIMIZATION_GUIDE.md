# RTZR STT 최적화 가이드

## 🎯 개선 가능한 두 가지 핵심 문제

### 1️⃣ WebSocket 연결 매번 새로 생성 (불필요)
### 2️⃣ 발화 종료 감지로 인한 지연 (RTZR은 스트리밍이 가능!)

---

## ❌ 현재 문제점

### 문제 1: WebSocket 매번 새 연결

**현재 코드 흐름:**
```
발화 1:
  → 토큰 발급 (120ms)
  → WebSocket 연결 (80ms)
  → 데이터 전송
  → 결과 수신
  → 연결 종료

발화 2:
  → 토큰 발급 (120ms) ❌ 다시!
  → WebSocket 연결 (80ms) ❌ 다시!
  → 데이터 전송
  → 결과 수신
  → 연결 종료
```

**문제**: 각 발화마다 200ms를 낭비

---

### 문제 2: 발화 종료 감지로 인한 지연

**현재 코드:**
```python
# main.py:1418
if audio_processor.should_process():  # 침묵 0.5초 대기!
    user_text, stt_time = await transcribe_audio_realtime(...)
```

**문제점:**
- `max_silence = 0.5` (AudioProcessor line 170)
- 사용자가 말을 멈춘 후 **0.5초를 대기**해야 STT 호출
- RTZR WebSocket은 **실시간 스트리밍**이 가능한데 대기를 함!

---

## ✅ 해결 방안

### 개선 1: WebSocket 연결 재사용

**목표**: 한 번 연결해서 통화 전체에서 재사용

#### 1-1. STT 서비스에 전역 WebSocket 풀 추가

```python
# stt_service.py
class STTService:
    def __init__(self):
        self.provider = getattr(settings, 'STT_PROVIDER', 'google').lower()
        
        # ⭐ WebSocket 연결 풀 추가
        self._rtzr_ws = None
        self._rtzr_ws_lock = asyncio.Lock()
        
        if self.provider == "rtzr":
            self._init_rtzr_stt()
    
    async def _get_rtzr_websocket(self, token: str):
        """WebSocket 연결 가져오기 (재사용)"""
        async with self._rtzr_ws_lock:
            # 이미 연결되어 있고 열려있으면 재사용
            if self._rtzr_ws and not self._rtzr_ws.closed:
                logger.debug("♻️ 기존 WebSocket 재사용")
                return self._rtzr_ws
            
            # 새로 연결
            logger.info("🌐 새 RTZR WebSocket 연결 중...")
            
            ws_url = "wss://openapi.vito.ai/v1/transcribe:streaming"
            params = {
                "sample_rate": "8000",
                "encoding": "LINEAR16",
                "use_itn": str(settings.RTZR_USE_ITN).lower(),
                "use_disfluency_filter": str(settings.RTZR_USE_DISFLUENCY_FILTER).lower(),
                "use_profanity_filter": str(settings.RTZR_USE_PROFANITY_FILTER).lower()
            }
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            
            headers = {"Authorization": f"Bearer {token}"}
            
            self._rtzr_ws = await websockets.connect(
                f"{ws_url}?{query_string}",
                additional_headers=headers,
                ping_interval=None
            )
            
            logger.info("✅ WebSocket 연결 완료 (캐시)")
            return self._rtzr_ws
    
    async def _transcribe_rtzr(self, audio_chunk: bytes, language: str = "ko"):
        """RTZR WebSocket STT로 변환 (연결 재사용)"""
        try:
            start_time = time.time()
            logger.info(f"🔍 [RTZR STT] 시작")
            
            # WAV 헤더 제거
            pcm_data = audio_chunk
            if audio_chunk[:4] == b'RIFF':
                logger.info("🔍 [RTZR STT] WAV 헤더 제거 중...")
                wav_io = io.BytesIO(audio_chunk)
                with wave.open(wav_io, 'rb') as wav_file:
                    pcm_data = wav_file.readframes(wav_file.getnframes())
                    logger.info(f"✅ WAV 헤더 제거: {len(pcm_data)} bytes")
            
            # ⭐ 토큰 가져오기 (캐시 가능)
            token = await self._get_rtzr_token()
            
            # ⭐ WebSocket 가져오기 (재사용)
            ws = await self._get_rtzr_websocket(token)
            
            # 오디오 데이터 전송
            logger.info(f"📤 [RTZR STT] 오디오 전송 중... ({len(pcm_data)} bytes)")
            
            # 청크 단위로 전송
            chunk_size = 16000
            for i in range(0, len(pcm_data), chunk_size):
                chunk = pcm_data[i:i + chunk_size]
                await ws.send(chunk)
                await asyncio.sleep(0.01)
            
            await ws.send("EOS")
            logger.info("📤 [RTZR STT] EOS 전송 완료")
            
            # 결과 수신
            result_text = ""
            results_received = []
            
            try:
                while True:
                    response = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    if isinstance(response, bytes):
                        continue
                    
                    result = json.loads(response)
                    results_received.append(result)
                    
                    if "alternatives" in result and len(result["alternatives"]) > 0:
                        text = result["alternatives"][0].get("text", "")
                        is_final = result.get("final", False)
                        
                        if is_final:
                            result_text = text
                            logger.info(f"✅ [RTZR STT] 최종 결과: '{text}'")
                            break
                        
            except asyncio.TimeoutError:
                logger.warning("⚠️ 응답 타임아웃")
                if results_received:
                    last_result = results_received[-1]
                    if "alternatives" in last_result and len(last_result["alternatives"]) > 0:
                        result_text = last_result["alternatives"][0].get("text", "")
            except Exception as close_error:
                logger.debug(f"WebSocket 종료: {close_error}")
                if results_received:
                    for r in reversed(results_received):
                        if "alternatives" in r and len(r["alternatives"]) > 0:
                            result_text = r["alternatives"][0].get("text", "")
                            if r.get("final", False):
                                break
            
            # ⭐ WebSocket 종료하지 않음! (다음 발화를 위해 재사용)
            elapsed_time = time.time() - start_time
            logger.info(f"✅ [RTZR STT] 완료 ({elapsed_time:.2f}초): '{result_text}'")
            
            return result_text, elapsed_time
            
        except Exception as e:
            logger.error(f"❌ RTZR STT 변환 실패: {e}")
            # 에러 발생 시 연결 닫기
            if self._rtzr_ws:
                try:
                    await self._rtzr_ws.close()
                except:
                    pass
                self._rtzr_ws = None
            import traceback
            logger.error(traceback.format_exc())
            return "", 0
    
    def close_rtzr_websocket(self):
        """통화 종료 시 WebSocket 닫기"""
        if self._rtzr_ws:
            try:
                asyncio.create_task(self._rtzr_ws.close())
            except:
                pass
            self._rtzr_ws = None
```

**예상 개선**: 약 200ms 단축 (연결 오버헤드 제거)

---

### 개선 2: 실시간 스트리밍 (발화 종료 감지 제거)

**목표**: RTZR의 스트리밍 기능 활용 - 침묵 대기 없이 즉시 전송

#### 2-1. AudioProcessor 수정

```python
# main.py의 AudioProcessor 클래스

# 현재
class AudioProcessor:
    def __init__(self, call_sid: str):
        self.max_silence = 0.5  # ❌ 0.5초 대기!
        # ...

# 개선
class AudioProcessor:
    def __init__(self, call_sid: str, use_realtime_stt: bool = True):
        # ⭐ RTZR 사용 시 실시간 STT 모드
        self.use_realtime_stt = use_realtime_stt
        self.max_silence = 0.0 if use_realtime_stt else 0.5  # ✅ 즉시!
        # ...
```

#### 2-2. WebSocket 핸들러 수정

```python
# main.py의 media_stream_handler

# 현재
@app.websocket("/api/twilio/media-stream")
async def media_stream_handler(websocket: WebSocket, db: Session = Depends(get_db)):
    # ...
    
    # STT 서비스 초기화
    stt_service = STTService()
    
    # ⭐ RTZR 사용 시 실시간 모드
    use_realtime_stt = stt_service.provider == "rtzr"
    
    audio_processor = AudioProcessor(call_sid=call_sid, use_realtime_stt=use_realtime_stt)
    
    # ...

            elif event_type == 'media':
                if audio_processor:
                    audio_payload = base64.b64decode(data['media']['payload'])
                    audio_processor.add_audio_chunk(audio_payload)
                    
                    # ⭐ 실시간 모드: 발화 종료 감지 없이 즉시 처리
                    if use_realtime_stt:
                        # 청크마다 즉시 STT 호출
                        # (RTZR이 스트리밍으로 처리)
                        if len(audio_processor.audio_buffer) >= 50:  # 최소 1초
                            user_text, stt_time = await stt_service.transcribe_audio_chunk(
                                audio_processor.get_recent_audio(), "ko"
                            )
                            # 중간 결과 처리
                            if user_text and user_text not in processed_texts:
                                # 누적 또는 즉시 응답
                                pass
                    
                    # 기존 로직 (침묵 감지)
                    elif audio_processor.should_process():
                        audio_data = audio_processor.get_audio()
                        user_text, stt_time = await transcribe_audio_realtime(audio_data, audio_processor)
```

**예상 개선**: 약 500ms 단축 (침묵 대기 제거)

---

## 📊 성능 개선 예상치

### 현재 성능
```
발화 감지: 0ms
침묵 대기: 500ms ❌
토큰 발급: 120ms ❌
WebSocket 연결: 80ms ❌
STT 처리: 1,950ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
총: 2,650ms
```

### 개선 1 적용 (WebSocket 재사용)
```
발화 감지: 0ms
침묵 대기: 500ms ❌
토큰 발급: 120ms ❌ (첫 호출만, 이후 0ms)
WebSocket 연결: 80ms ❌ (첫 호출만, 이후 0ms)
STT 처리: 1,950ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
총: 2,450ms (첫 호출: 2,650ms, 이후: 2,450ms)
개선: 200ms
```

### 개선 1 + 2 적용 (실시간 스트리밍)
```
발화 감지: 0ms
침묵 대기: 0ms ✅
토큰 발급: 0ms ✅ (캐시)
WebSocket 연결: 0ms ✅ (재사용)
STT 처리: 1,950ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
총: 1,950ms
개선: 700ms (26% 빠름!) 🚀
```

---

## 🎯 단계별 적용 방법

### Step 1: 토큰 캐싱만 구현 (가장 쉬움, 즉시 적용 가능)

**파일**: `backend/app/services/ai_call/stt_service.py`

추가할 코드:
```python
class STTService:
    def __init__(self):
        # ...
        # ⭐ 토큰 캐싱 변수 추가
        self._cached_token = None
        self._token_expires_at = 0
    
    async def _get_rtzr_token(self):
        """RTZR 토큰 가져오기 (캐싱)"""
        # 캐시 유효성 검사
        if self._cached_token and self._token_expires_at > time.time():
            logger.debug("♻️ 캐시된 토큰 재사용")
            return self._cached_token
        
        # 새 토큰 발급
        logger.info("🔐 새 RTZR 토큰 발급 중...")
        auth_response = requests.post(
            f"{self.rtzr_api_base}/v1/authenticate",
            data={
                "client_id": self.rtzr_client_id,
                "client_secret": self.rtzr_client_secret
            }
        )
        
        if auth_response.status_code != 200:
            raise Exception(f"RTZR 인증 실패: {auth_response.status_code}")
        
        token = auth_response.json()["access_token"]
        
        # 캐시 (1시간 유효)
        self._cached_token = token
        self._token_expires_at = time.time() + 3600
        
        logger.info("✅ 토큰 발급 및 캐시 완료")
        return token
    
    async def _transcribe_rtzr(self, audio_chunk: bytes, language: str = "ko"):
        # 기존 코드...
        
        # ⭐ 이 부분 수정
        # auth_response = requests.post(...)
        # token = auth_response.json()["access_token"]
        
        token = await self._get_rtzr_token()  # ✅ 캐시된 토큰 사용
        
        # 나머지 코드는 동일
```

**예상 개선**: 100ms × N (N번 발화) → 첫 호출 후 0ms

---

### Step 2: WebSocket 연결 재사용 (중간 난이도)

**파일**: `backend/app/services/ai_call/stt_service.py`

위의 "개선 1" 코드 전체 적용

**예상 개선**: 200ms × N → 첫 호출 후 0ms

---

### Step 3: 실시간 스트리밍 (고급, 가장 효과적)

**파일**: `backend/app/main.py`

1. AudioProcessor에 `use_realtime_stt` 파라미터 추가
2. `max_silence`를 조건부로 설정
3. WebSocket 핸들러에서 실시간 처리 로직 추가

**예상 개선**: 500ms × N (모든 발화)

---

## 🎉 최종 예상 성능

### 최적화 전
- 발화 1: 2,650ms
- 발화 2: 2,650ms
- 발화 3: 2,650ms
- **평균: 2,650ms**

### 최적화 후 (모든 개선 적용)
- 발화 1: 2,650ms (첫 호출에만 연결 비용)
- 발화 2: 1,950ms ✅
- 발화 3: 1,950ms ✅
- **평균: 2,183ms**

**총 개선: 467ms (18% 빠름!)**

### Google STT 비교
- Google: 1,150ms (500ms 침묵 + 650ms STT)
- RTZR 최적화: 1,950ms
- **차이: 800ms (하지만 침묵 대기 제거로 사용자 체감은 더 빠름)**

---

## 💡 즉시 적용 추천

**Step 1만 적용해도 즉시 100-200ms 개선!**

가장 쉽고 효과적입니다. 빠른 테스트를 원하면 Step 1부터 시작하세요.

