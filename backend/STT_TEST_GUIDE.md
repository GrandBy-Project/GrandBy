# STT 성능 테스트 가이드

## 🎯 목적
실제 Docker 환경에서 STT 응답 속도를 측정하여 성능 병목을 파악합니다.

---

## 📋 테스트 방법

### 방법 1: 합성 오디오로 테스트 (빠른 테스트)

```bash
# Docker 컨테이너 내부에서 실행
docker exec -it grandby_api python /app/test_stt_performance.py
```

또는 셸 스크립트 사용:
```bash
cd backend
bash test_stt_docker.sh
```

### 방법 2: 실제 오디오 파일로 테스트

1. 테스트용 오디오 파일 준비 (WAV 형식, 8kHz, mono 권장)

2. 테스트 실행:
```bash
docker exec -it grandby_api python /app/test_stt_performance.py --file /app/test_audio.wav
```

---

## 📊 측정 항목

테스트가 측정하는 항목:
1. **STT 서비스 초기화 시간**
2. **각 발화별 STT 처리 시간**
3. **총 소요 시간**
4. **평균/최소/최대 응답 시간**

---

## 🔍 예상 결과

### Google STT (현재 사용)
- **평균 응답 시간**: 300-1000ms
- **최소 시간**: 150-300ms (짧은 발화)
- **최대 시간**: 1000-2000ms (긴 발화 또는 네트워크 지연)

### 주요 병목 요소 (예상)
1. **Google Cloud API 호출**: 200-800ms
2. **오디오 변환 시간**: 10-50ms
3. **네트워크 지연**: 50-200ms

---

## 📝 테스트 결과 분석

테스트 완료 후 확인할 사항:

1. **STT 응답 시간**: 각 발화마다 측정된 시간
2. **일관성**: 시간의 편차 (일관성 있는가?)
3. **평균 시간**: 전체 평균 응답 시간
4. **오류 발생**: 특정 조건에서 오류가 발생하는가?

---

## 🚀 실제 통화 시뮬레이션 테스트

실제 통화 환경을 시뮬레이션하려면:

```bash
# Docker 내부에서 직접 Python 스크립트 실행
docker exec -it grandby_api python

# 그 다음 다음 코드 실행:
```

```python
import asyncio
import time
from app.services.ai_call.stt_service import STTService

async def test_with_real_audio():
    # 실제 오디오 파일 경로로 변경
    with open('/app/test_audio.wav', 'rb') as f:
        audio_data = f.read()
    
    stt_service = STTService()
    
    # 10번 반복 테스트
    times = []
    for i in range(10):
        start = time.time()
        result = await stt_service.transcribe_audio_chunk(audio_data, "ko")
        elapsed = time.time() - start
        times.append(elapsed)
        print(f"Test {i+1}: {elapsed:.3f}초 - '{result[0]}'")
    
    print(f"\n평균: {sum(times)/len(times):.3f}초")
    print(f"최소: {min(times):.3f}초")
    print(f"최대: {max(times):.3f}초")

asyncio.run(test_with_real_audio())
```

---

## 📈 성능 개선 포인트

테스트 결과를 바탕으로 다음 항목들을 개선할 수 있습니다:

1. **침묵 감지 시간**: 현재 0.5초 → 0.3초로 단축
2. **WAV 변환 제거**: Google은 RAW PCM 지원
3. **청크 크기 최적화**: 최소 길이 조정
4. **캐싱**: 유사한 발화 재사용

---

## ⚠️ 주의사항

1. **API 레이트 리밋**: Google STT는 분당 요청 수 제한이 있습니다
2. **비용**: 실제 API 호출이므로 비용이 발생합니다
3. **환경 변수**: `STT_PROVIDER`가 제대로 설정되어 있는지 확인하세요

---

## 🐛 문제 해결

### 문제 1: "STT Service 초기화 실패"
```bash
# 인증 파일 확인
ls -la backend/credentials/google-cloud-stt.json

# Docker 컨테이너 내부에서 확인
docker exec -it <container_name> ls -la /app/credentials/
```

### 문제 2: "Module not found"
```bash
# Python 경로 확인
docker exec -it <container_name> python -c "import sys; print(sys.path)"

# 필요한 패키지 설치 확인
docker exec -it <container_name> pip list | grep speech
```

### 문제 3: "빈 결과 반환"
- 오디오 형식이 올바른지 확인 (WAV, 8kHz, mono, 16-bit)
- 최소 길이가 충분한지 확인 (0.1초 이상)

---

## 📞 도움말

테스트 중 문제가 발생하면:
1. Docker 로그 확인: `docker logs <container_name>`
2. STT 서비스 로그 확인: 로그에 `[STT Service]` 태그 검색
3. 환경 변수 확인: `.env` 파일의 `STT_PROVIDER` 설정

