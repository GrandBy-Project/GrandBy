# RTZR 최적화 변경 사항

## 🎯 목표
토큰 캐싱과 WebSocket 재사용을 통한 응답 시간 개선

## ✅ 완료된 작업

### 1. 토큰 캐싱 구현
- **파일**: `backend/app/services/ai_call/stt_service.py`
- **변경**: `_init_rtzr_stt()` 메서드에 캐싱 변수 추가
- **효과**: 매번 토큰 발급하던 것을 1시간 캐시로 변경

### 2. WebSocket 연결 재사용
- **파일**: `backend/app/services/ai_call/stt_service.py`
- **변경**: WebSocket을 통화 전체에서 재사용하도록 변경
- **효과**: 매번 새 연결하던 것을 첫 호출만 연결하고 재사용

### 3. 통화 종료 시 WebSocket 정리
- **파일**: `backend/app/main.py`
- **변경**: `finally` 블록에서 RTZR WebSocket 닫기
- **효과**: 메모리 누수 방지

## 📊 개선 예상치

| 발화 순서 | Before | After | 개선 |
|----------|--------|-------|------|
| 1번째 발화 | 2.43초 | 2.43초 | 0ms (첫 호출) |
| 2번째 발화 | 2.43초 | 2.15초 | 280ms ✅ |
| 3번째 발화 | 2.65초 | 2.15초 | 500ms ✅ |

**총 3개 발화 기준**: 약 780ms 개선 (약 10% 빠름)

## 🚀 다음 테스트

실제 AI 통화를 걸어서 성능 개선 확인:
```bash
# 로그 모니터링
docker logs -f grandby_api | Select-String "RTZR"

# 예상되는 로그:
# 첫 발화: "새 토큰 발급", "새 WebSocket 연결"
# 두 번째: "캐시된 토큰 재사용", "기존 WebSocket 재사용"
```

