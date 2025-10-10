# 🏠 Grandby - AI 기반 어르신 케어 플랫폼

> AI 자동 전화를 통한 어르신 음성 챗봇과 통화 내역 기반 자동 일기 작성 및 보호자 모니터링 멀티플랫폼 앱

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.0-green.svg)](https://fastapi.tiangolo.com/)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-61DAFB.svg)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-52.0-000020.svg)](https://expo.dev/)

---

## 📋 목차

- [프로젝트 소개](#-프로젝트-소개)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [프로젝트 구조](#-프로젝트-구조)
- [시작하기](#-시작하기)
- [개발 가이드](#-개발-가이드)
- [API 문서](#-api-문서)
- [배포](#-배포)
- [트러블슈팅](#-트러블슈팅)
- [기여하기](#-기여하기)

---

## 🎯 프로젝트 소개

**Grandby**는 독거 어르신과 바쁜 자녀들을 위한 AI 기반 케어 솔루션입니다.

### 페르소나
- **어르신 (70~80세)**: 자식들이 바빠서 연락이 소홀하고, 스마트폰 사용이 어려운 분
- **보호자 (30~50대)**: 사회생활로 인해 부모님을 자주 찾아뵙지 못하는 자녀

### 핵심 가치
1. **AI 자동 전화**: 매일 정해진 시간에 AI가 어르신께 전화를 걸어 안부를 확인
2. **자동 일기 작성**: 통화 내용을 기반으로 1인칭 시점의 일기를 자동 생성
3. **보호자 모니터링**: 부모님의 일상을 자연스럽게 확인하고 정서적 유대감 강화

---

## ✨ 주요 기능

### 🎤 AI 전화 시스템 (MVP)
- **자동 안부 전화**: 매일 1회 정해진 시간에 AI가 자동으로 전화
- **실시간 대화**: STT → LLM → TTS 파이프라인으로 자연스러운 대화
- **통화 기록 저장**: 음성 파일 및 텍스트 변환 내용 저장

### 📒 다이어리 시스템
- **자동 요약 다이어리**: 통화 내용을 LLM으로 요약하여 1인칭 일기 생성
- **수동 작성/수정**: 어르신과 보호자 모두 일기 작성 가능
- **사진 첨부**: 일기에 사진 추가
- **댓글 기능**: 보호자와 어르신 간 소통

### 📝 TODO 관리
- **자동 일정 추출**: 통화 내용에서 일정 정보 자동 감지
- **보호자 맞춤 TODO**: 보호자가 어르신을 위한 할 일 등록
- **이행 여부 확인**: TODO 완료 체크 및 모니터링

### 👥 사용자 관리
- **이메일 회원가입/로그인**: 기본 인증
- **소셜 로그인**: Google, Kakao OAuth2 (Phase 2)
- **보호자-어르신 연결**: 다대다 관계 지원

### 🔔 알림 시스템
- **다이어리 생성 알림**: 통화 종료 후 일기 생성 완료 알림
- **TODO 리마인더**: 일정 시간에 TODO 알림
- **감정 분석 알림**: 부정적 감정 지속 시 보호자에게 알림

### 📊 보호자 모니터링
- **대시보드**: 어르신의 통화 횟수, 감정 상태, TODO 이행률 한눈에 확인
- **통화 기록 조회**: 전체 통화 내용 및 텍스트 확인
- **일기 열람**: 어르신의 일상 모니터링

---

## 🛠️ 기술 스택

### Backend
```
- Language: Python 3.12
- Framework: FastAPI 0.115.0
- Database: PostgreSQL 15
- Cache/Queue: Redis 7
- ORM: SQLAlchemy 2.0.35
- Migration: Alembic 1.13.2
- Task Queue: Celery 5.4.0
- Authentication: JWT (python-jose)
```

### Frontend
```
- Framework: React Native 0.76 with Expo 52.0
- Language: TypeScript 5.3.3
- Routing: Expo Router 4.0
- State Management: Zustand 5.0
- UI Library: React Native Paper 5.12
- HTTP Client: Axios 1.7.7
```

### AI/ML
```
- STT: OpenAI Whisper API
- LLM: OpenAI GPT-4 API
- TTS: OpenAI TTS API
- Emotion Analysis: Custom Prompt Engineering
```

### Infrastructure
```
- Containerization: Docker & Docker Compose
- CI/CD: GitHub Actions
- Cloud: AWS (ECS, RDS, S3, ElastiCache)
- Telephony: Twilio Voice API
- Monitoring: Sentry, CloudWatch
```

---

## 📁 프로젝트 구조

```
grandby_proj/
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── main.py            # FastAPI 앱 진입점
│   │   ├── config.py          # 환경 설정
│   │   ├── database.py        # DB 연결
│   │   ├── models/            # SQLAlchemy 모델
│   │   ├── schemas/           # Pydantic 스키마
│   │   ├── routers/           # API 엔드포인트
│   │   ├── services/          # 비즈니스 로직
│   │   │   ├── ai_call/       # AI 통화 모듈
│   │   │   ├── diary/         # 일기 모듈
│   │   │   ├── todo/          # TODO 모듈
│   │   │   └── common/        # 공통 서비스
│   │   ├── tasks/             # Celery 작업
│   │   └── utils/             # 유틸리티
│   ├── migrations/            # Alembic 마이그레이션
│   ├── tests/                 # 테스트
│   ├── requirements.txt       # Python 패키지
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                   # React Native Frontend
│   ├── app/                   # Expo Router
│   │   ├── (auth)/            # 인증 화면
│   │   ├── (elderly)/         # 어르신용 앱
│   │   └── (caregiver)/       # 보호자용 앱
│   ├── components/            # 재사용 컴포넌트
│   ├── services/              # API 서비스
│   ├── stores/                # Zustand 상태 관리
│   ├── types/                 # TypeScript 타입
│   ├── package.json
│   └── .env.example
│
├── .github/
│   └── workflows/             # GitHub Actions
│       ├── ci.yml             # CI 파이프라인
│       └── deploy.yml         # 배포 파이프라인
│
├── docs/                      # 문서
├── docker-compose.yml         # Docker Compose 설정
├── .gitignore
└── README.md
```

---

## 🚀 시작하기

### 사전 요구사항

다음 프로그램들이 설치되어 있어야 합니다:

- **Git**: 버전 관리
- **Docker Desktop**: 컨테이너 실행 (Windows/Mac)
- **Node.js**: v18 이상 (Frontend용)
- **Python**: 3.12 (로컬 개발 시)
- **코드 에디터**: VSCode 권장

### 외부 서비스 계정 생성 (필수)

1. **OpenAI API Key** 
   - https://platform.openai.com/api-keys
   - STT, LLM, TTS에 사용

2. **Twilio Account**
   - https://www.twilio.com/console
   - 전화 통화에 사용
   - 한국 전화번호 구매 필요

3. **AWS Account** (옵션, 배포 시 필요)
   - https://aws.amazon.com/
   - S3 버킷 생성 (음성 파일 저장용)

---

## 📦 설치 및 실행 가이드

### 1️⃣ 저장소 클론

```bash
git clone https://github.com/your-team/grandby_proj.git
cd grandby_proj
```

### 2️⃣ 환경 변수 설정

#### Backend 환경 변수

```bash
# backend/.env.example을 복사
cp backend/.env.example backend/.env

# backend/.env 파일을 열어서 실제 값으로 변경
# - OPENAI_API_KEY
# - TWILIO_ACCOUNT_SID
# - TWILIO_AUTH_TOKEN
# - TWILIO_PHONE_NUMBER
# - AWS 정보 (S3 사용 시)
```

**backend/.env 예시**:
```env
DATABASE_URL=postgresql://grandby:grandby_secret_password@db:5432/grandby_db
REDIS_URL=redis://redis:6379/0

SECRET_KEY=your-super-secret-jwt-key-change-in-production
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+821012345678

AWS_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxx
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=grandby-audio-files
```

### 3️⃣ Backend 실행 (Docker Compose)

```bash
# 모든 서비스 시작 (PostgreSQL, Redis, FastAPI, Celery)
docker-compose up -d

# 로그 확인
docker-compose logs -f api

# 서비스 상태 확인
docker-compose ps
```

**실행되는 서비스**:
- `db`: PostgreSQL (포트 5432)
- `redis`: Redis (포트 6379)
- `api`: FastAPI 서버 (포트 8000)
- `celery_worker`: 비동기 작업 처리
- `celery_beat`: 스케줄러 (AI 자동 전화)
- `flower`: Celery 모니터링 (포트 5555)

### 4️⃣ 데이터베이스 마이그레이션

```bash
# API 컨테이너 내부로 접속
docker-compose exec api bash

# 마이그레이션 실행
alembic upgrade head

# 컨테이너 나가기
exit
```

### 5️⃣ Backend API 테스트

브라우저에서 다음 URL 접속:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

### 6️⃣ Frontend 실행

#### Frontend 디렉토리로 이동
```bash
cd frontend
```

#### Expo 프로젝트 초기화 (최초 1회만)

```bash
# Expo 프로젝트 생성
npx create-expo-app@latest . --template blank-typescript

# 필요한 패키지 설치
npm install expo-router react-native-paper react-native-vector-icons zustand axios
npm install expo-av expo-notifications expo-image-picker expo-secure-store
npm install @react-native-async-storage/async-storage react-native-calendars
npm install react-hook-form zod

# 개발 의존성
npm install --save-dev @types/react @types/react-native
```

#### 환경 변수 설정

```bash
# frontend/.env.example 복사
cp .env.example .env

# .env 파일 수정
# API_URL=http://localhost:8000
```

#### Expo 개발 서버 실행

```bash
npm start
```

**실행 옵션**:
- `a`: Android 에뮬레이터 실행
- `i`: iOS 시뮬레이터 실행 (Mac만 가능)
- `w`: 웹 브라우저 실행

**물리적 디바이스 테스트**:
1. 스마트폰에 **Expo Go** 앱 설치
2. QR 코드 스캔

---

## 🔧 개발 가이드

### 로컬 개발 환경

#### Backend 로컬 실행 (Docker 없이)

```bash
cd backend

# 가상 환경 생성
python -m venv venv

# 가상 환경 활성화
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# 패키지 설치
pip install -r requirements.txt

# 개발 서버 실행
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Celery Worker 실행 (별도 터미널)
celery -A app.tasks.celery_app worker --loglevel=info

# Celery Beat 실행 (별도 터미널)
celery -A app.tasks.celery_app beat --loglevel=info
```

### 새로운 API 엔드포인트 추가

1. **모델 정의** (`backend/app/models/`)
2. **스키마 정의** (`backend/app/schemas/`)
3. **라우터 생성** (`backend/app/routers/`)
4. **서비스 로직** (`backend/app/services/`)
5. **main.py에 라우터 등록**

### 데이터베이스 마이그레이션

```bash
# 새로운 마이그레이션 생성
docker-compose exec api alembic revision --autogenerate -m "Add new table"

# 마이그레이션 적용
docker-compose exec api alembic upgrade head

# 마이그레이션 롤백
docker-compose exec api alembic downgrade -1
```

### Git 브랜치 전략

```
main
  ├── develop (개발 통합)
      ├── feature/auth (인증)
      ├── feature/ai-call (AI 통화)
      ├── feature/diary (일기)
      ├── feature/todo (TODO)
      └── feature/dashboard (대시보드)
```

**브랜치 생성 예시**:
```bash
git checkout develop
git checkout -b feature/your-feature-name
# ... 작업 ...
git add .
git commit -m "feat: Add new feature"
git push origin feature/your-feature-name
# Pull Request 생성
```

---

## 📚 API 문서

### API 베이스 URL

- **로컬**: `http://localhost:8000`
- **프로덕션**: `https://api.grandby.com`

### 주요 엔드포인트

#### 인증
```
POST   /api/auth/register          # 회원가입
POST   /api/auth/login             # 로그인
POST   /api/auth/refresh           # 토큰 갱신
GET    /api/auth/me                # 현재 사용자 정보
```

#### 사용자 관리
```
GET    /api/users/connections      # 연결된 사용자 목록
POST   /api/users/connections      # 연결 요청
PUT    /api/users/connections/{id} # 연결 수락/거절
DELETE /api/users/connections/{id} # 연결 해제
```

#### AI 통화
```
GET    /api/calls                  # 통화 기록 목록
GET    /api/calls/{id}             # 통화 상세 정보
POST   /api/calls/{id}/transcript  # 통화 텍스트 조회
GET    /api/calls/settings         # 통화 설정 조회
PUT    /api/calls/settings         # 통화 설정 변경
```

#### 다이어리
```
GET    /api/diaries                # 일기 목록
POST   /api/diaries                # 일기 작성
GET    /api/diaries/{id}           # 일기 상세
PUT    /api/diaries/{id}           # 일기 수정
DELETE /api/diaries/{id}           # 일기 삭제
POST   /api/diaries/{id}/comments  # 댓글 작성
POST   /api/diaries/{id}/photos    # 사진 업로드
```

#### TODO
```
GET    /api/todos                  # TODO 목록
POST   /api/todos                  # TODO 생성
PUT    /api/todos/{id}             # TODO 수정
DELETE /api/todos/{id}             # TODO 삭제
PATCH  /api/todos/{id}/complete    # TODO 완료 처리
```

#### 대시보드 (보호자)
```
GET    /api/dashboard/{elderly_id} # 어르신 종합 정보
GET    /api/dashboard/{elderly_id}/emotions # 감정 분석
GET    /api/dashboard/{elderly_id}/stats    # 통계
```

자세한 API 문서는 **http://localhost:8000/docs** 참조

---

## 🧪 테스트

### Backend 테스트

```bash
# 모든 테스트 실행
docker-compose exec api pytest

# 커버리지와 함께 실행
docker-compose exec api pytest --cov=app --cov-report=html

# 특정 테스트만 실행
docker-compose exec api pytest tests/test_auth.py

# 테스트 결과 상세 출력
docker-compose exec api pytest -v
```

### Frontend 테스트

```bash
cd frontend

# Jest 테스트 실행
npm test

# E2E 테스트 (Detox)
npm run test:e2e
```

---

## 🚢 배포

### Docker 이미지 빌드

```bash
# Backend 이미지 빌드
docker build -t grandby-api:latest ./backend

# 이미지를 ECR에 푸시 (AWS)
docker tag grandby-api:latest 123456789.dkr.ecr.ap-northeast-2.amazonaws.com/grandby-api:latest
docker push 123456789.dkr.ecr.ap-northeast-2.amazonaws.com/grandby-api:latest
```

### AWS ECS 배포

1. **ECS 클러스터 생성**
2. **Task Definition 생성** (docker-compose.yml 참조)
3. **서비스 생성** (로드 밸런서 연결)
4. **RDS PostgreSQL 생성**
5. **ElastiCache Redis 생성**
6. **S3 버킷 생성**

자세한 배포 가이드는 `docs/deployment.md` 참조

---

## 🐛 트러블슈팅

### 문제: Docker 컨테이너가 시작되지 않음

```bash
# 모든 컨테이너 중지
docker-compose down

# 볼륨까지 삭제
docker-compose down -v

# 다시 시작
docker-compose up -d
```

### 문제: 데이터베이스 연결 실패

```bash
# PostgreSQL 컨테이너 로그 확인
docker-compose logs db

# 데이터베이스 직접 접속 테스트
docker-compose exec db psql -U grandby -d grandby_db
```

### 문제: Celery 작업이 실행되지 않음

```bash
# Celery Worker 로그 확인
docker-compose logs celery_worker

# Redis 연결 확인
docker-compose exec redis redis-cli ping
```

### 문제: Frontend에서 API 호출 실패

1. Backend가 실행 중인지 확인: http://localhost:8000/docs
2. CORS 설정 확인 (backend/.env의 CORS_ORIGINS)
3. 네트워크 탭에서 요청 URL 확인

---

## 🤝 기여하기

### 기여 프로세스

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### 커밋 메시지 컨벤션

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅, 세미콜론 누락 등
refactor: 코드 리팩토링
test: 테스트 추가
chore: 빌드 업무 수정, 패키지 매니저 수정
```

---

## 📞 연락처

- **프로젝트 저장소**: https://github.com/your-team/grandby_proj
- **이슈 트래커**: https://github.com/your-team/grandby_proj/issues
- **Wiki**: https://github.com/your-team/grandby_proj/wiki

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 🙏 감사의 말

- [FastAPI](https://fastapi.tiangolo.com/)
- [Expo](https://expo.dev/)
- [OpenAI](https://openai.com/)
- [Twilio](https://www.twilio.com/)

---

**Made with ❤️ by Grandby Team**

