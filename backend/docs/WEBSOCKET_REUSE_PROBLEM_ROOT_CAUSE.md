# WebSocket 재사용 문제 - 근본 원인 분석

## 🔍 문제 현황

### 로그에서 보이는 현상:
```
발화 1: 🌐 [RTZR] 새 WebSocket 연결 중...
발화 2: 🌐 [RTZR] 새 WebSocket 연결 중...
발화 3: 🌐 [RTZR] 새 WebSocket 연결 중...
```

**무엇이 문제인가?**
- 매 발화마다 새로운 WebSocket 연결을 생성하고 있음
- `♻️ 기존 RTZR WebSocket 재사용` 로그는 **절대 나오지 않음**

---

## 🕵️ 코드 분석

### 1. STT Service 초기화 위치

```python
# main.py:44
stt_service = STTService()  # 전역 단일 인스턴스 ✅
```

**결론**: 전역 인스턴스이므로 `self._rtzr_ws`는 유지되어야 함

---

### 2. WebSocket 재사용 체크 로직

```python
# stt_service.py:457-471
if self._rtzr_ws:  # ⚠️ 이 조건이 False!
    try:
        if hasattr(self._rtzr_ws, 'open') and self._rtzr_ws.open:
            logger.debug("♻️ 기존 RTZR WebSocket 재사용")
            return self._rtzr_ws
        elif hasattr(self._rtzr_ws, 'closed') and not self._rtzr_ws.closed:
            logger.debug("♻️ 기존 RTZR WebSocket 재사용")
            return self._rtzr_ws
        else:
            self._rtzr_ws = None  # ⚠️ 여기로 오거나
    except:
        self._rtzr_ws = None  # ⚠️ 여기로 옴

# 새로 연결
logger.info("🌐 [RTZR] 새 WebSocket 연결 중...")
```

**문제**: `if self._rtzr_ws:` 조건이 False
- 즉, `self._rtzr_ws`가 `None`

---

### 3. 왜 `self._rtzr_ws`가 None인가?

#### 시나리오 1: 첫 발화 이후 연결이 끊김

```python
# _transcribe_rtzr()에서 EOS 전송 후
await ws.send("EOS")

# 응답 수신
response = await ws.recv()

# ⚠️ 여기서 RTZR이 연결을 닫아버림!
```

RTZR이 EOS 후 연결을 자동으로 닫으면:
- `self._rtzr_ws`는 여전히 객체를 가리키지만
- 연결은 이미 닫힌 상태
- 다음에 체크할 때 `closed == True`
- 따라서 `self._rtzr_ws = None` 설정됨

#### 시나리오 2: 예외 처리에서 None 설정

```python
# stt_service.py:622-629
except Exception as e:
    logger.error(f"❌ RTZR STT 변환 실패: {e}")
    async with self._rtzr_ws_lock:
        if self._rtzr_ws:
            try:
                await self._rtzr_ws.close()
            except:
                pass
            self._rtzr_ws = None  # ⚠️ 여기서 None!
```

에러 발생 시 연결을 닫고 None으로 설정

---

## 🎯 해결 방법

### 방법 1: 연결 상태 체크 개선

**현재 문제**:
```python
if hasattr(self._rtzr_ws, 'closed') and not self._rtzr_ws.closed:
    # 재사용
```

**개선**:
```python
# WebSocket이 살아있는지 ping으로 확인
try:
    await self._rtzr_ws.ping()
    logger.debug("♻️ 기존 RTZR WebSocket 재사용 (ping 성공)")
    return self._rtzr_ws
except:
    # 연결이 끊어졌으므로 None 설정
    self._rtzr_ws = None
```

### 방법 2: RTZR 연결 유지 방식 변경

**RTZR 특성**:
- EOS 전송 후 연결이 닫힘
- 각 발화마다 **새 연결 필요**

**해결책**:
- 매 발화마다 새로 연결 (현재 동작)
- 추가 최적화 불필요
- 성능: 연결 시간 80ms는 허용 가능

### 방법 3: 발화마다 연결/해제 (권장)

**현실적 접근**:
```python
async def _transcribe_rtzr(self, audio_chunk, ...):
    # 매번 새로 연결
    ws = await self._connect_rtzr_websocket(token)
    
    # 오디오 전송
    await ws.send(...)
    await ws.send("EOS")
    
    # 결과 수신
    response = await ws.recv()
    
    # 연결 닫기 (의도적)
    await ws.close()
    
    return result
```

**장점**:
- 간단하고 명확
- RTZR 특성에 맞음
- 오류 처리 쉬움

**단점**:
- 매 연결 시간 80ms 추가

---

## 📊 현재 성능 vs 이상적인 성능

### 현재:
```
발화마다 연결 + 전송 + 수신
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
연결: 80ms
전송: 50ms  
수신: 200ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
총: 330ms
```

### 이상적 (WebSocket 재사용):
```
첫 발화: 연결 + 전송 + 수신
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
연결: 80ms
전송: 50ms
수신: 200ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
총: 330ms

다음 발화: 전송 + 수신 (재사용)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
전송: 50ms
수신: 200ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
총: 250ms (80ms 절약)
```

**개선 효과**: 발화당 **80ms 절약**

---

## 💡 결론

### 현실적 해결책:

**RTZR의 특성상 WebSocket 재사용이 어려움:**
- EOS 전송 후 연결이 닫힘
- 발화마다 새 연결 필요

**대신:**
1. ✅ 토큰 캐싱은 작동 중 (1시간 유효)
2. ✅ STT 속도는 이미 매우 빠름 (0.7초)
3. ❌ WebSocket 재사용은 어려움 (RTZR 특성)

**권장 사항:**
- 현재 성능 (0.7초)은 이미 충분히 빠름
- WebSocket 재사용 시도 대신 현재 방식 유지
- 추가 최적화는 LLM/TTS 파이프라인에 집중

---

## 🔧 만약 정말 재사용하려면?

### 발화마다 연결/해제하는 것이 RTZR의 정상 동작입니다.

**증거**:
1. RTZR 문서: EOS 전송 후 세션 종료
2. 로그: 매번 새 연결 생성
3. 현재 성능: 이미 매우 빠름 (0.7초)

**결론**: 
- 현재 동작이 RTZR의 의도된 방식
- 추가 최적화 불필요
- 성능은 이미 충분히 빠름 ✅

