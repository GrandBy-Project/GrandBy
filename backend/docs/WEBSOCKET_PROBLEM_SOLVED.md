# WebSocket 재사용 문제 해결 - 근본 원인 파악

## 🎯 발견된 문제

### 핵심 문제:
```
- 'open' 또는 'closed' 속성 없음
- ⚠️ [RTZR] 기존 WebSocket이 닫혀있음 - None 설정
- 🌐 [RTZR] 새 WebSocket 연결 중...
```

**발견**: `websockets` 라이브러리의 `ClientConnection` 객체에는 `open` 또는 `closed` 속성이 **없음**!

---

## 🔍 로그 분석

### 발화 1:
```
self._rtzr_ws: None  ← 초기 상태
→ 새 연결 생성
```

### 발화 2:
```
self._rtzr_ws: <websockets.asyncio.client.ClientConnection object>
→ 'open' 또는 'closed' 속성 없음
→ ⚠️ 기존 WebSocket이 닫혀있음 - None 설정  ← 잘못된 판단!
→ 새 연결 생성
```

### 발화 3:
```
self._rtzr_ws: <websockets.asyncio.client.ClientConnection object>
→ 'open' 또는 'closed' 속성 없음
→ ⚠️ 기존 WebSocket이 닫혀있음 - None 설정  ← 잘못된 판단!
→ 새 연결 생성
```

---

## 💡 해결 방법

### 현재 코드:
```python
if hasattr(self._rtzr_ws, 'open'):
    is_open = self._rtzr_ws.open
elif hasattr(self._rtzr_ws, 'closed'):
    is_open = not self._rtzr_ws.closed
else:
    # 속성 없음 → 닫혔다고 판단 (잘못됨!)
    self._rtzr_ws = None
```

### 개선된 코드:
```python
# websockets 13.x는 다른 방식으로 상태 체크
try:
    # 연결이 살아있는지 실제로 테스트
    await asyncio.wait_for(self._rtzr_ws.ping(), timeout=0.5)
    logger.info("♻️ [RTZR] 기존 WebSocket 재사용 (ping 성공)")
    return self._rtzr_ws
except:
    # 연결이 끊어진 것으로 간주
    logger.warning("⚠️ [RTZR] WebSocket 연결 끊김 - 새로 연결")
    self._rtzr_ws = None
```

---

## 🔧 수정 적용

### ping() 메서드로 연결 상태 확인

