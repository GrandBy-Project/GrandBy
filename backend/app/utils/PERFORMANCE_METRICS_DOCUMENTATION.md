# 📊 성능 메트릭 상세 문서

AI 전화 통화의 성능 지표 수집 및 분석에 대한 상세 설명입니다.

---

## 📋 전체 메트릭 구조

각 통화는 JSON 파일로 저장되며, 다음 구조를 가집니다:

```json
{
  "call_sid": "통화 ID",
  "call_start_time": "통화 시작 시각 (YYYYMMDD_HHMMSS)",
  "turns": [ /* 각 대화 턴별 메트릭 */ ],
  "summary": { /* 통화 전체 통계 */ }
}
```

---

## 🎯 각 메트릭의 의미 및 측정 시점

### 1️⃣ STT (Speech-to-Text) 메트릭

#### `user_speech_start_time`
- **의미**: 사용자가 실제로 말하기 시작한 시점 (첫 부분 인식이 발생한 시점)
- **측정 시점**: RTZR STT에서 첫 부분 인식 결과를 받은 순간
- **기록 위치**: `rtzr_stt_realtime.py`의 `streaming_start_time`
- **용도**: 모든 STT 지연시간의 기준 시점

#### `first_partial_time`
- **의미**: STT가 첫 부분 인식 결과를 반환한 시간
- **측정 시점**: `user_speech_start_time`과 동일 (첫 부분 인식 발생 시)
- **용도**: 부분 인식 지연시간 계산의 종료 시점

#### `final_recognition_time`
- **의미**: STT가 최종 인식 결과를 반환한 시간
- **측정 시점**: RTZR에서 `is_final=true`인 결과를 받은 순간
- **용도**: STT 전체 지연시간 계산의 종료 시점

#### `partial_latency`
- **의미**: 사용자 발화 시작부터 첫 부분 인식까지의 시간
- **계산식**: `first_partial_time - user_speech_start_time`
- **목표치**: p50 ≤ 0.3초, p95 ≤ 0.5초, p99 ≤ 0.7초
- **의미**: 사용자가 말하기 시작한 후 얼마나 빨리 STT가 반응하는지 측정

#### `latency` (STT Latency)
- **의미**: 사용자 발화 시작부터 최종 인식까지의 시간
- **계산식**: `final_recognition_time - user_speech_start_time`
- **목표치**: p50 ≤ 1.0초, p95 ≤ 1.5초, p99 ≤ 2.0초
- **의미**: 사용자가 말을 끝내고 STT가 최종 결과를 내는 데 걸리는 총 시간

---

### 2️⃣ LLM (Large Language Model) 메트릭

#### `first_token_time`
- **의미**: LLM이 첫 번째 토큰을 생성한 시간
- **측정 시점**: OpenAI API 스트리밍에서 첫 번째 chunk를 받은 순간
- **용도**: LLM 응답 시작 지연시간 측정

#### `completion_time`
- **의미**: LLM이 전체 응답 생성을 완료한 시간
- **측정 시점**: OpenAI API 스트리밍이 종료된 순간 (`[DONE]` 수신)
- **용도**: LLM 전체 생성 시간 측정

#### `first_token_latency`
- **의미**: STT 최종 인식부터 LLM 첫 토큰 생성까지의 시간 (TTFT - Time To First Token)
- **계산식**: `first_token_time - final_recognition_time`
- **목표치**: p50 ≤ 1.0초, p95 ≤ 1.5초, p99 ≤ 2.0초
- **의미**: 사용자 발화를 이해하고 응답을 시작하는 속도

#### `completion_latency`
- **의미**: LLM 첫 토큰 생성부터 전체 응답 완료까지의 시간
- **계산식**: `completion_time - first_token_time`
- **목표치**: p50 ≤ 2.0초, p95 ≤ 3.0초, p99 ≤ 4.0초
- **의미**: LLM이 응답을 생성하는 속도

---

### 3️⃣ TTS (Text-to-Speech) 메트릭

#### `start_time`
- **의미**: TTS 변환 작업을 시작한 시간
- **측정 시점**: 첫 번째 문장의 TTS API 호출 시작 시점
- **용도**: TTS 지연시간 계산의 시작 시점

#### `first_completion_time`
- **의미**: 첫 번째 문장의 TTS 변환이 완료된 시간
- **측정 시점**: 첫 번째 문장의 TTS API 응답을 받은 순간
- **용도**: 첫 TTS 완료 지연시간 계산의 종료 시점

#### `completion_time`
- **의미**: 전체 TTS 변환이 완료된 시간 (마지막 문장까지)
- **측정 시점**: 마지막 문장의 TTS API 응답을 받은 순간
- **용도**: 전체 TTS 완료 시간 계산

#### `latency` (TTS Latency)
- **의미**: TTS 시작부터 완료까지의 시간
- **계산식**: `completion_time - start_time`
- **목표치**: p50 ≤ 0.5초, p95 ≤ 0.8초, p99 ≤ 1.0초
- **의미**: 텍스트를 음성으로 변환하는 속도

#### `first_token_to_first_tts_completion_latency`
- **의미**: LLM 첫 토큰 생성부터 첫 TTS 완료까지의 시간
- **계산식**: `first_completion_time - first_token_time`
- **목표치**: p50 ≤ 0.5초, p95 ≤ 0.8초, p99 ≤ 1.0초
- **의미**: LLM이 문장을 생성하고 즉시 TTS로 변환하는 파이프라인 지연시간
- **중요**: 실시간 응답성의 핵심 지표 (사용자가 음성을 들기 시작하는 시점)

---

### 4️⃣ E2E (End-to-End) 메트릭

#### `turn_start_time`
- **의미**: 대화 턴이 시작된 시간 (STT 최종 인식 시점과 동일)
- **측정 시점**: STT가 최종 인식 결과를 반환한 순간
- **용도**: 전체 턴 지연시간 계산의 시작 시점

#### `turn_end_time`
- **의미**: 대화 턴이 완료된 시간 (LLM 응답 생성 완료 시점)
- **측정 시점**: LLM이 전체 응답 생성을 완료한 순간
- **용도**: 전체 턴 지연시간 계산의 종료 시점

#### `latency` (E2E Latency)
- **의미**: 사용자 발화 완료부터 AI 응답 생성 완료까지의 전체 시간
- **계산식**: `turn_end_time - turn_start_time`
- **목표치**: p50 ≤ 2.5초, p95 ≤ 3.5초, p99 ≤ 5.0초
- **의미**: 전체 시스템의 응답 속도 (STT + LLM 처리 시간)

---

## 📈 통계 메트릭 (Statistics)

각 턴마다 현재까지의 누적 통계가 계산되어 기록됩니다.

### 포함되는 통계 값:
- **count**: 측정 횟수
- **avg**: 평균값
- **min**: 최소값
- **max**: 최대값
- **p50**: 50번째 백분위수 (중앙값)
- **p95**: 95번째 백분위수 (95%의 요청이 이 시간 내에 완료)
- **p99**: 99번째 백분위수 (99%의 요청이 이 시간 내에 완료)

### 계산되는 메트릭:
1. `stt_latency` - STT 전체 지연시간 통계
2. `stt_partial_latency` - STT 부분 인식 지연시간 통계
3. `llm_first_token_latency` - LLM 첫 토큰 생성 지연시간 통계
4. `llm_completion_latency` - LLM 완료 지연시간 통계
5. `tts_latency` - TTS 변환 지연시간 통계
6. `first_token_to_first_tts_completion_latency` - LLM→TTS 파이프라인 지연시간 통계
7. `e2e_latency` - 전체 턴 지연시간 통계

---

## 🔄 시간 흐름도

```
사용자 발화 시작
    ↓
[user_speech_start_time] ───┐
    ↓                        │
첫 부분 인식                 │ partial_latency
    ↓                        │
[first_partial_time]         │
    ↓                        │
최종 인식                    │ latency (STT)
    ↓                        │
[final_recognition_time] ←───┘
    ↓
[turn_start_time] (동일)
    ↓
LLM 처리 시작
    ↓
[first_token_time] ─────────┐ first_token_latency
    ↓                        │
[TTS start_time] (첫 문장)    │
    ↓                        │
[first_completion_time] ←────┼─ first_token_to_first_tts_completion_latency
    ↓                        │
[TTS completion_time]         │ completion_latency
    ↓                        │
[completion_time] ←───────────┘
    ↓
[turn_end_time] (동일)
    ↓
E2E latency 계산
```

---

## 📁 파일 저장 위치

- **디렉토리**: `backend/performance_metrics/`
- **파일명 형식**: `call_metrics_YYYYMMDD_HHMMSS_{call_sid}.json`
- **예시**: `call_metrics_20251103_063805_CA06c4f6.json`

---

## 🔍 주요 개선 사항 (2025-11-03)

1. ✅ **시간 동기화 문제 해결**: `turn_start_time`과 `stt_complete_time`을 동일한 시점으로 설정
2. ✅ **정확한 STT 지연시간 계산**: `user_speech_start_time`을 기준으로 측정
3. ✅ **부분 인식 지연시간 정확성 향상**: 사용자 발화 시작 시점부터 측정

---

## 📝 참고사항

- 모든 시간은 Unix timestamp (초 단위, 소수점 포함)로 기록됩니다
- 지연시간(latency)은 항상 양수여야 합니다 (음수 값이 나타나면 측정 오류)
- p50, p95, p99 값은 데이터 개수가 적을 때(10개 미만) 비슷할 수 있습니다 (정상)
- 통계는 각 턴 완료 시점에 실시간으로 업데이트됩니다

