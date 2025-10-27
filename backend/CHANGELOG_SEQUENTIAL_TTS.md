# 🔧 AI 통화 시스템 - 음성 순서 문제 해결

## 📅 날짜: 2025.10.22

## 🎯 문제 상황

### 증상
- LLM 스트리밍 + TTS 병렬 처리 시 음성이 생성 순서와 무관하게 뒤섞여서 출력됨
- 사용자가 대화 내용을 이해할 수 없는 심각한 UX 문제 발생

### 예시
```
생성 순서:
1. "안녕하세요!"
2. "오늘 날씨가 정말 좋은데 산책하러 나가시는 건 어떠세요?"
3. "기분이 좋아질 거예요!"

실제 출력:
1. "안녕하세요!" ✅
2. "기분이 좋아질 거예요!" ❌ (3번이 먼저)
3. "오늘 날씨가..." ❌ (2번이 나중에)
```

---

## 🔍 원인 분석

### 1. 병렬 처리의 부작용
```python
# 문제 코드
task = asyncio.create_task(
    convert_and_send_audio(websocket, stream_sid, sentence)
)
sentence_tasks.append(task)
```

- `asyncio.create_task()`로 모든 문장을 **동시에 백그라운드 실행**
- 각 태스크가 독립적으로 TTS API 호출
- **완료 순서 = TTS API 응답 속도** (짧은 문장이 먼저 완료)

### 2. asyncio.gather()의 한계
```python
playback_durations = await asyncio.gather(*sentence_tasks, return_exceptions=True)
```

- 모든 태스크 완료만 대기할 뿐 **순서 보장하지 않음**
- 각 태스크가 완료되는 즉시 Twilio로 전송

### 3. TTS API 응답 시간의 가변성
- 짧은 문장: 0.3~0.6초
- 긴 문장: 1.0~2.0초  
- 네트워크 지연: 랜덤

**결과**: 짧은 문장이 긴 문장보다 먼저 완료되어 순서 역전

---

## ✅ 해결 방법

### 선택한 방법: 순차 처리 방식

**전략**: "수집 → 처리" 2단계 분리

#### Before (병렬 처리)
```
LLM 스트리밍 중...
  문장1 완성 → 즉시 TTS 시작 (비동기)
  문장2 완성 → 즉시 TTS 시작 (비동기)
  문장3 완성 → 즉시 TTS 시작 (비동기)
  ↓
모든 TTS 완료 대기 (순서 무관)
```

#### After (순차 처리)
```
LLM 스트리밍 중...
  문장1 완성 → 리스트에 저장
  문장2 완성 → 리스트에 저장
  문장3 완성 → 리스트에 저장
  ↓
LLM 스트리밍 완료 후
  ↓
문장1 → TTS → 전송 → 완료 대기
  ↓
문장2 → TTS → 전송 → 완료 대기
  ↓
문장3 → TTS → 전송 → 완료 대기
```

---

## 📝 변경 사항

### 파일: `backend/app/main.py`

#### 함수: `process_streaming_response()`

**주요 변경 내역**:

1. **데이터 구조 변경**
   ```python
   # Before
   sentence_tasks = []  # 태스크 리스트
   
   # After
   sentence_list = []  # 문장 리스트
   ```

2. **문장 수집 단계 (LLM 스트리밍)**
   ```python
   # Before
   task = asyncio.create_task(
       convert_and_send_audio(websocket, stream_sid, sentence)
   )
   sentence_tasks.append(task)
   
   # After
   sentence_list.append(sentence)  # 수집만
   ```

3. **순차 TTS 처리 단계**
   ```python
   # After (새로 추가)
   for idx, sentence in enumerate(sentence_list, 1):
       logger.info(f"[{idx}/{len(sentence_list)}] 🎵 TTS 처리...")
       
       # await로 완료 대기 (순차 실행)
       playback_duration = await convert_and_send_audio(
           websocket, stream_sid, sentence
       )
       
       total_playback_duration += playback_duration
       logger.info(f"[{idx}/{len(sentence_list)}] ✅ 전송 완료")
   ```

4. **로그 메시지 개선**
   - "스트리밍 응답 파이프라인 시작" → "스트리밍 응답 파이프라인 시작 (순차 처리)"
   - 단계별 로그 추가 (단계 1: LLM 스트리밍, 단계 2: TTS 처리, 단계 3: 완료)
   - 문장별 진행 상황 표시 `[1/3]`, `[2/3]`, `[3/3]`

---

## 📊 성능 영향 분석

### 예상 성능 변화

| 지표 | 병렬 처리 (기존) | 순차 처리 (수정) | 변화 |
|------|------------------|------------------|------|
| **첫 문장 출력** | ~3.7초 | ~4.0초 | +0.3초 |
| **문장당 평균** | 동시 처리 | ~1.0초 | - |
| **3문장 총 시간** | ~4.5초 | ~5.5초 | +1.0초 |
| **5문장 총 시간** | ~6.0초 | ~7.5초 | +1.5초 |
| **순서 정확도** | 60-70% | **100%** | +30-40% |

### 트레이드오프 분석

**손실**:
- 응답 시간 약 0.5~1.5초 증가 (문장 수에 비례)
- 병렬 처리의 속도 이점 상실

**이득**:
- ✅ 순서 100% 보장 → UX 개선
- ✅ 예측 가능한 동작 → 디버깅 용이
- ✅ 코드 단순화 → 유지보수성 향상

**결론**: 약간의 성능 감소는 정확한 대화 순서 보장이라는 핵심 가치에 비해 수용 가능한 수준

---

## 🧪 테스트 시나리오

### 시나리오 1: 짧은 대화 (3문장)
```
사용자: "안녕하세요"
예상 응답:
1. "안녕하세요!"
2. "오늘 기분이 어떠세요?"
3. "무엇을 도와드릴까요?"

검증 항목:
✅ 순서: 1 → 2 → 3
✅ 내용 완전성: 모든 문장 전송
✅ 로그: [1/3], [2/3], [3/3] 순서대로 출력
```

### 시나리오 2: 긴 대화 (5+ 문장)
```
사용자: "오늘 날씨가 참 좋은데 산책하러 나가고 싶어요"

검증 항목:
✅ 5개 이상 문장 순서 보장
✅ 각 문장 간 일정한 간격
✅ 총 시간 예상 범위 내 (< 10초)
```

### 시나리오 3: 예외 상황
```
1. TTS 변환 실패
   - 해당 문장 건너뛰고 다음 문장 진행
   
2. WebSocket 연결 끊김
   - 에러 로그 + finally 블록 실행
   
3. 빈 문장 처리
   - 무시하고 다음 문장 진행
```

---

## 🔍 확인 방법

### 로그 확인 포인트
```
✅ 정상 동작 시 출력되는 로그:
1. "🚀 스트리밍 응답 파이프라인 시작 (순차 처리)"
2. "🤖 LLM 스트리밍 시작 (문장 수집 단계)"
3. "📝 문장 완성: [문장 내용]"
4. "✅ LLM 스트리밍 완료"
5. "📊 수집된 문장: X개"
6. "🔊 TTS 순차 처리 시작"
7. "[1/X] 🎵 TTS 처리: ..."
8. "[1/X] ✅ 전송 완료 (재생: X.XX초)"
9. "[2/X] 🎵 TTS 처리: ..."
10. "[2/X] ✅ 전송 완료 (재생: X.XX초)"
... (반복)
11. "✅ 스트리밍 파이프라인 완료"
```

### 성능 측정
```bash
# 백엔드 로그에서 시간 측정
grep "총 소요 시간" backend/logs/*.log
grep "총 재생 시간" backend/logs/*.log
```

---

## 🔄 롤백 계획

### 롤백이 필요한 경우
1. 응답 시간이 허용 불가능한 수준 (> 10초)
2. 문장 누락 또는 중복 전송 발생
3. WebSocket timeout 빈번 발생

### 롤백 방법
```bash
# 방법 1: Git revert
git revert <이 커밋 해시>

# 방법 2: 백업 브랜치로 복원
git checkout backup/before-sequential-tts
git checkout -b hotfix/revert-sequential-tts
```

---

## 📌 향후 개선 방향

### Phase 2: 하이브리드 방식 (필요 시)
성능이 중요해지면 다음 방법 고려:
- TTS는 병렬로 실행
- 완료된 결과를 순서대로 전송
- 복잡도 증가하지만 속도와 순서 모두 보장

### Phase 3: 예측 TTS
- 자주 사용하는 응답 미리 캐싱
- LLM 다음 문장 예측 시도
- 긴 문장 우선 TTS 시작

---

## 👥 관련 인원
- **개발자**: [이름]
- **리뷰어**: [이름]
- **승인자**: [이름]

---

## 📚 참고 문서
- `backend/docs/STREAMING_OPTIMIZATION_GUIDE.md`
- `backend/test_streaming_chat.py`
- Python asyncio 공식 문서: https://docs.python.org/3/library/asyncio.html

---

## ✅ 체크리스트

- [x] 코드 수정 완료
- [x] 주석 및 docstring 업데이트
- [x] 변경 로그 작성
- [ ] 로컬 테스트 수행
- [ ] Twilio 실제 통화 테스트
- [ ] 성능 측정 및 기록
- [ ] 코드 리뷰 요청
- [ ] Staging 배포
- [ ] Production 배포
- [ ] 모니터링 (1일)

---

**작성일**: 2025.10.22  
**버전**: 1.0  
**상태**: ✅ 수정 완료 (테스트 대기 중)

