# 워커 수 설정 가이드

## 🤔 워커 수가 필요한 이유

### FastAPI (Uvicorn) 워커

**워커란?**
- 여러 개의 프로세스가 동시에 요청을 처리하는 방식
- 하나의 워커가 하나의 요청을 처리
- 워커가 많을수록 더 많은 요청을 동시에 처리 가능

**왜 필요한가?**
- Python은 GIL(Global Interpreter Lock) 때문에 한 번에 하나의 스레드만 실행
- 여러 워커를 사용하면 멀티프로세싱으로 동시 처리 능력 향상
- 하나의 워커가 블로킹되도 다른 워커가 계속 처리

### Celery 워커 (Concurrency)

**Concurrency란?**
- 하나의 Celery 프로세스가 동시에 처리할 수 있는 작업 수
- 스레드 또는 프로세스 기반으로 동시 처리

**왜 필요한가?**
- 비동기 작업(이메일 발송, TTS 생성 등)을 동시에 처리
- 여러 작업을 병렬로 실행하여 처리 속도 향상

---

## 📊 워커 수 결정 방법

### FastAPI 워커 수

**공식 공식:**
```
워커 수 = (CPU 코어 수 × 2) + 1
```

**실제 권장값:**

| 상황 | 워커 수 | 이유 |
|------|---------|------|
| 초기 배포 (트래픽 적음) | 1-2 | 안정성 우선 |
| 일반적인 프로덕션 | 2-4 | CPU 코어에 따라 |
| 고트래픽 | 4-8+ | CPU 코어 수에 맞춰 |

**현재 설정: 2개**
- ✅ 초기 배포에 적합
- ✅ 메모리 사용량 적음 (워커당 약 500MB)
- ✅ 트래픽 증가 시 4개로 증가 가능

**워커당 처리 능력:**
- 약 100-200 요청/초 (요청 타입에 따라 다름)
- AI 처리 요청은 더 느림 (1-5 요청/초)

### Celery Concurrency

**권장값:**

| 상황 | Concurrency | 이유 |
|------|-------------|------|
| 초기 배포 | 2 | 안정성 우선 |
| 일반적인 프로덕션 | 2-4 | 작업 유형에 따라 |
| 많은 비동기 작업 | 4-8+ | CPU 코어 수에 맞춰 |

**현재 설정: 2개**
- ✅ 초기 배포에 적합
- ✅ 메모리 사용량 적음
- ✅ 트래픽 증가 시 4개로 증가 가능

---

## ⚙️ 워커 수 변경 방법

### FastAPI 워커 수 변경

`docker-compose.prod.yml` 파일에서:

```yaml
command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --log-level info
                                                              ^^^^^^^^
                                                              여기 변경
```

**변경 후:**
```bash
docker compose -f docker-compose.prod.yml up -d --build api
```

### Celery Concurrency 변경

`docker-compose.prod.yml` 파일에서:

```yaml
command: celery -A app.tasks.celery_app:celery_app worker --loglevel=info --concurrency=2 --max-tasks-per-child=1000
                                                                              ^^^^^^^^
                                                                              여기 변경
```

**변경 후:**
```bash
docker compose -f docker-compose.prod.yml up -d --build celery_worker
```

---

## 📈 모니터링 및 최적화

### 워커 수 모니터링

```bash
# 컨테이너 리소스 사용량 확인
docker stats grandby_api grandby_celery_worker

# 프로세스 수 확인 (워커 수 확인)
docker exec grandby_api ps aux | grep uvicorn

# 로그에서 워커 확인
docker compose -f docker-compose.prod.yml logs api | grep "worker"
```

### 워커 수 증가가 필요한 신호

**FastAPI:**
- ✅ CPU 사용률이 지속적으로 높음 (>80%)
- ✅ 요청 처리 시간이 느려짐
- ✅ 503 에러 발생 (서버 과부하)

**Celery:**
- ✅ 작업이 큐에 쌓임
- ✅ 작업 처리 시간이 느려짐
- ✅ 대기 시간이 증가

### 워커 수 감소가 필요한 신호

**공통:**
- ✅ 메모리 부족 (OOM 에러)
- ✅ CPU 사용률이 낮음 (<30%)
- ✅ 리소스 낭비

---

## 💡 최적화 팁

### 1. 초기 배포 전략

```
1단계: 워커 2개로 시작
   ↓
2단계: 모니터링 (1-2주)
   ↓
3단계: 필요시 4개로 증가
   ↓
4단계: 지속적인 모니터링 및 조정
```

### 2. 리소스 계산

**FastAPI 워커:**
- 워커당 메모리: 약 500MB-1GB
- 2개 워커 = 약 1-2GB
- 4개 워커 = 약 2-4GB

**Celery Worker:**
- Concurrency당 메모리: 작업 유형에 따라 다름
- 2개 concurrency = 약 512MB-1GB
- 4개 concurrency = 약 1-2GB

**EC2 인스턴스 권장:**
- t3.medium (4GB RAM): 워커 2개 권장
- t3.large (8GB RAM): 워커 4개 가능
- t3.xlarge (16GB RAM): 워커 8개 가능

### 3. 성능 테스트

```bash
# 부하 테스트 도구 (예: Apache Bench)
ab -n 1000 -c 10 http://localhost:8000/health

# 또는 더 정교한 테스트
# - Locust
# - k6
# - JMeter
```

---

## 🔧 현재 설정 요약

| 서비스 | 워커/Concurrency | 메모리 예상 | 변경 가능 |
|--------|------------------|-------------|-----------|
| FastAPI | 2개 | 1-2GB | ✅ |
| Celery Worker | 2개 | 512MB-1GB | ✅ |
| Celery Beat | 1개 | 256MB | 고정 |

**총 예상 메모리: 약 2-3GB**
- EC2 t3.medium (4GB)에서 충분히 실행 가능

---

## 📚 참고 자료

- [Uvicorn 공식 문서](https://www.uvicorn.org/deployment/)
- [Celery 공식 문서](https://docs.celeryproject.org/)
- [FastAPI 배포 가이드](https://fastapi.tiangolo.com/deployment/)

