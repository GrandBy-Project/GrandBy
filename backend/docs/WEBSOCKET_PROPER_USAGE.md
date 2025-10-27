# WebSocket 올바른 사용 방식 - RTZR STT

## 📌 일반적인 STT WebSocket 사용 방식

### ✅ 통상적인 방식 (권장)

```
통화 시작
  ↓
WebSocket 연결 (1회만)
  ↓
발화 1:
  → 오디오 데이터 전송
  → EOS 전송
  → 결과 수신
  → 연결 유지 ⚠️
  ↓
발화 2:
  → 같은 WebSocket 사용 ⚠️
  → 오디오 데이터 전송
  → EOS 전송
  → 결과 수신
  → 연결 유지 ⚠️
  ↓
발화 3:
  → 같은 WebSocket 사용 ⚠️
  ...
  ↓
통화 종료
  → WebSocket 연결 종료
```

**핵심**: **하나의 통화 세션에서 WebSocket 하나를 계속 재사용!**

---

## ❌ 현재 우리 방식 (잘못됨)

```
통화 시작
  ↓
발화 1:
  → WebSocket 연결
  → 오디오 전송
  → EOS 전송
  → 결과 수신
  → WebSocket 종료 ❌
  ↓
발화 2:
  → WebSocket 연결 ❌ 새로!
  → 오디오 전송
  → EOS 전송
  → 결과 수신
  → WebSocket 종료 ❌
  ↓
발화 3:
  → WebSocket 연결 ❌ 또 새로!
  ...
  ↓
통화 종료
```

**문제**: 매 발화마다 연결/종료 반복 → **매우 비효율적!**

---

## 🔍 RTZR 문서에 따르면

### RTZR WebSocket은 이렇게 동작해야 함:

#### 발화별 처리 (각 발화가 독립적인 세션)
```
발화 시작:
  WebSocket에 오디오 전송 (계속 스트리밍)
  ↓
발화 종료:
  "EOS" 전송
  ↓
결과 수신 (중간 + 최종)
```

**중요**: 
- **RTZR은 "EOS"를 보내면 그 세션만 종료**
- WebSocket 연결 자체는 **여전히 살아있음** ⚠️
- 같은 연결로 다음 발화 처리 가능!

---

## 🔧 올바른 구현 방법

### 1. 통화 시작 시 WebSocket 연결

```python
# 통화 시작 시 1회만 연결
if event_type == 'start':
    if use_rtzr:
        # WebSocket 연결 (1회만)
        await stt_service._init_rtzr_websocket()
        logger.info("✅ RTZR WebSocket 연결: 통화 전체에서 재사용")
```

### 2. 각 발화마다 재사용

```python
# 발화 처리
async def transcribe_audio_chunk(self, audio_chunk):
    # 기존 WebSocket 사용 (재사용!)
    ws = await self._get_rtzr_websocket()  # 새로 연결 안 함!
    
    # 오디오 전송
    await ws.send(pcm_data)
    await ws.send("EOS")
    
    # 결과 수신
    response = await ws.recv()
    
    # ⚠️ WebSocket 종료 안 함! (재사용 위해)
    return result
```

### 3. 통화 종료 시 연결 종료

```python
# 통화 종료 시
finally:
    if stt_service.provider == "rtzr":
        await stt_service.close_rtzr_websocket()  # 통화 끝날 때만!
```

---

## 📊 성능 비교

### ❌ 현재 방식 (매 발화마다 재연결)
```
발화 1: 연결(80ms) + 전송 + 수신 = 250ms
발화 2: 연결(80ms) + 전송 + 수신 = 250ms ❌ 불필요!
발화 3: 연결(80ms) + 전송 + 수신 = 250ms ❌ 불필요!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
총: 750ms + 낭비 160ms = 910ms
```

### ✅ 올바른 방식 (재사용)
```
발화 1: 연결(80ms) + 전송 + 수신 = 250ms
발화 2:        0ms + 전송 + 수신 = 170ms ✅
발화 3:        0ms + 전송 + 수신 = 170ms ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
총: 590ms
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
개선: 320ms 단축 (35% 빠름!)
```

---

## ⚠️ RTZR 특수 사항

### RTZR WebSocket은 발화 단위로 동작

```python
# RTZR은 이렇게 작동:
발화 1:
  WebSocket에 데이터 전송
  "EOS" 전송 → 세션 종료 (WebSocket은 살아있음)
  
발화 2:
  같은 WebSocket에 데이터 전송
  "EOS" 전송 → 세션 종료 (WebSocket은 살아있음)
```

**중요**: 
- WebSocket **연결은 유지**
- **세션만** EOS로 종료
- 다음 발화도 **같은 연결 사용 가능**

---

## 🎯 정리

### 질문: 매 발화마다 열고 닫는 방식이 맞나?

**답변**: **아니요! 틀렸습니다.** ❌

### 통상적인 방식:

**✅ 올바른 방식:**
1. 통화 시작 시 WebSocket 연결 (1회)
2. 각 발화마다 같은 WebSocket 재사용
3. 통화 종료 시 WebSocket 종료 (1회)

**❌ 현재 우리 방식 (잘못됨):**
1. 매 발화마다 WebSocket 연결/종료 반복
2. 불필요한 오버헤드 발생

### 결론

RTZR WebSocket은:
- **통화당 1개**로 시작해서 계속 재사용
- 각 발화는 **세션 단위**로 처리 (EOS로 세션만 종료)
- 통화가 끝날 때까지 연결 유지

**매 발화마다 열고 닫으면 안 됩니다!** ❌

