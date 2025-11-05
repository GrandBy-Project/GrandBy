# GrandBy 백엔드 배포 가이드

이 문서는 GrandBy 프로젝트의 백엔드를 AWS EC2와 RDS에 배포하는 전체 과정을 상세히 설명합니다.

## 📋 목차

1. [사전 준비사항](#사전-준비사항)
2. [AWS 리소스 생성](#aws-리소스-생성)
3. [EC2 서버 설정](#ec2-서버-설정)
4. [백엔드 배포](#백엔드-배포)
5. [환경 변수 설정](#환경-변수-설정)
6. [시드 데이터 생성](#시드-데이터-생성)
7. [유지보수](#유지보수)

---

## 🎯 사전 준비사항

### 필요한 AWS 서비스
- AWS 계정 (활성화된 상태)
- 도메인 (가비아에서 구매: `grandby-app.store`)
- Route53 호스팅존
- EC2 인스턴스
- RDS PostgreSQL 인스턴스
- S3 버킷
- IAM 사용자 (S3 접근용)

### 필요한 정보
- Twilio 계정 정보 (Account SID, Auth Token, Phone Number)
- OpenAI API 키
- RTZR 클라이언트 ID/Secret
- Naver Clova TTS 클라이언트 ID/Secret
- Gmail 앱 비밀번호 (SMTP용)

---

## 🌐 AWS 리소스 생성

### 1. 도메인 및 Route53 설정

#### 1-1. 도메인 구매 (가비아)
1. 가비아에서 `grandby-app.store` 구매
2. 네임서버 설정: **"타사 네임서버 사용"** 선택

#### 1-2. Route53 Public Hosted Zone 생성
1. AWS 콘솔 → Route53 → Hosted zones
2. **Create hosted zone** 클릭
3. 설정:
   - Domain name: `grandby-app.store`
   - Type: **Public hosted zone**
4. 생성 후 **NS 레코드 4개 복사** (예시):
   ```
   ns-1746.awsdns-26.co.uk
   ns-1006.awsdns-61.net
   ns-46.awsdns-05.com
   ns-1249.awsdns-28.org
   ```

#### 1-3. 가비아 네임서버 변경
1. 가비아 → 내 도메인 관리 → 네임서버 설정
2. **"타사 네임서버 사용"** 선택
3. Route53의 NS 레코드 4개 입력 (끝의 점(.) 제거)
4. 저장

#### 1-4. 전파 확인
```bash
# Windows PowerShell
nslookup -type=ns grandby-app.store 1.1.1.1
```
Route53 NS 레코드가 표시되면 성공!

#### 1-5. API 서브도메인 A 레코드 생성 (EC2 생성 후)
1. Route53 → grandby-app.store 호스팅존
2. **Create record** 클릭
3. 설정:
   - Record name: `api`
   - Record type: **A – IPv4**
   - Value: [EC2 탄력적 IP]
   - TTL: **60**
   - Routing policy: **Simple**
4. 생성

---

### 2. RDS PostgreSQL 생성

#### 2-1. 데이터베이스 생성
1. AWS 콘솔 → RDS → Databases → Create database
2. 설정:
   - Engine: **PostgreSQL**
   - Version: **PostgreSQL 15.14-R2**
   - Template: **Free tier** (또는 Production)
3. 설정 탭:
   - DB instance identifier: `grandby-prod-db`
   - Master username: `grandby`
   - Master password: **[강한 비밀번호 입력 및 메모]**
4. 스토리지:
   - Storage type: **General Purpose SSD (gp3)**
   - Allocated storage: **20 GB** (프리 티어) 또는 **30 GB** (프로덕션)
   - Storage autoscaling: **Enable**

#### 2-2. 연결 정보
- Network & Security:
  - VPC: **Default VPC** (또는 운영용 VPC)
  - DB subnet group: 기본값
  - Public access: **No**
  - VPC security group: **새로 생성** → 이름: `rds-grandby-sg`
  - Availability Zone: 기본 설정 없음

#### 2-3. 추가 구성
- Database options:
  - Initial database name: **`grandby_db`** (필수!)
- Backup:
  - Enable automatic backups: **Yes**
  - Backup retention period: **7 days**
  - Backup window: 기본 설정 없음
- Encryption: **Enable** (기본 KMS 키)
- Maintenance:
  - Enable auto minor version upgrade: **Yes**
- Deletion protection: **Enable** (실수 삭제 방지)

#### 2-4. 생성 완료 후 확인
- RDS 엔드포인트 복사 (예: `grandby-prod-db.c12ouuauoclw.ap-northeast-2.rds.amazonaws.com`)
- 마스터 비밀번호 확인

---

### 3. S3 버킷 생성

#### 3-1. 버킷 생성
1. AWS 콘솔 → S3 → Create bucket
2. 설정:
   - Bucket name: `grandby-s3-v1` (전역적으로 고유해야 함)
   - AWS Region: **ap-northeast-2** (서울)
3. 객체 소유권:
   - **ACL 비활성화됨(권장)**
4. 퍼블릭 액세스 차단:
   - **모든 퍼블릭 액세스 차단** 활성화
5. 버킷 버전 관리:
   - **비활성화** (초기 비용 절감)
6. 기본 암호화:
   - **Amazon S3 관리형 키(SSE-S3)** 선택
7. 생성

---

### 4. IAM 사용자 생성 (S3 접근용)

#### 4-1. 사용자 생성
1. AWS 콘솔 → IAM → Users → Create user
2. 설정:
   - User name: `grandby-s3-user`
   - AWS credential type: **Access key - Programmatic access** 선택
3. 권한 설정:
   - **정책 직접 연결** 선택
   - `AmazonS3FullAccess` 검색 후 선택
4. 사용자 생성 완료

#### 4-2. 액세스 키 생성
1. 생성된 사용자 클릭
2. **Security credentials** 탭
3. **Create access key** 클릭
4. Use case: **로컬 코드** 선택
5. **액세스 키 ID**와 **비밀 액세스 키** 복사 (한 번만 표시!)
   - 액세스 키 ID: `AKIA...`
   - 비밀 액세스 키: `xxxxx...`

---

### 5. EC2 인스턴스 생성

#### 5-1. 인스턴스 시작
1. AWS 콘솔 → EC2 → Launch instance
2. 설정:
   - Name: `grandby-ec2-prod`
   - AMI: **Ubuntu Server 22.04 LTS**
   - Instance type: **t3.small** (또는 t2.micro 프리 티어)
   - Key pair: **새로 생성** 또는 기존 키 선택 (PEM 파일 안전 보관!)
3. Network settings:
   - VPC: 기본 VPC
   - Subnet: 기본 서브넷
   - Public IP: **자동 할당 활성화**
4. Configure storage:
   - Size: **20 GiB**
   - Volume type: **gp3**

#### 5-2. 보안 그룹 생성
1. **Create security group** 클릭
2. 설정:
   - Security group name: `ec2-grandby-sg`
   - Description: `EC2 for Grandby API (SSH/HTTP/HTTPS)`
3. Inbound rules:
   - SSH (22): **내 IP** (또는 특정 IP)
   - HTTP (80): **0.0.0.0/0**
   - HTTPS (443): **0.0.0.0/0**
4. Outbound rules: **All traffic** (기본값)

#### 5-3. 인스턴스 시작 및 탄력적 IP 할당
1. 인스턴스 생성 완료 후
2. EC2 → Network & Security → Elastic IPs
3. **Allocate Elastic IP address** 클릭
4. 생성된 EIP를 방금 만든 EC2 인스턴스에 **연결**
5. EIP 주소 메모 (예: `54.116.7.17`)

#### 5-4. Route53 A 레코드 생성
1. Route53 → grandby-app.store 호스팅존
2. **Create record** 클릭
3. 설정:
   - Record name: `api`
   - Record type: **A – IPv4**
   - Value: **[EC2 탄력적 IP]**
   - TTL: **60**
4. 생성 후 확인:
```bash
nslookup api.grandby-app.store 1.1.1.1
```

---

### 6. RDS 보안 그룹 설정

#### 6-1. 인바운드 규칙 추가
1. AWS 콘솔 → EC2 → Security Groups
2. `rds-grandby-sg` 선택
3. **Inbound rules** → **Edit inbound rules**
4. **Add rule** 클릭:
   - Type: **PostgreSQL**
   - Port: **5432**
   - Source: **보안 그룹** 선택 → `ec2-grandby-sg` 선택
5. **Save rules**

---

## 🖥️ EC2 서버 설정

### 1. SSH 접속

```bash
# Windows PowerShell
ssh -i C:\path\to\your-key.pem ubuntu@[EC2_탄력적_IP]
```

### 2. 시스템 업데이트 및 기본 설정

```bash
# 시스템 업데이트
sudo apt update && sudo apt -y upgrade

# 시간대 설정
sudo timedatectl set-timezone Asia/Seoul

# 필수 패키지 설치
sudo apt -y install ca-certificates curl gnupg nginx
```

### 3. Docker 설치

```bash
# Docker 설치
curl -fsSL https://get.docker.com | sudo sh

# Docker 그룹에 사용자 추가
sudo usermod -aG docker $USER
newgrp docker

# Docker 버전 확인
docker --version
```

### 4. Docker Compose 설치

```bash
# Docker Compose 설치
sudo curl -SL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 버전 확인
docker compose version
```

### 5. Nginx 설정

#### 5-1. Nginx 설정 파일 생성

```bash
sudo nano /etc/nginx/sites-available/grandby.conf
```

아래 내용 입력:

```nginx
server {
  listen 80;
  server_name api.grandby-app.store;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name api.grandby-app.store;

  ssl_certificate     /etc/letsencrypt/live/api.grandby-app.store/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.grandby-app.store/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 600s;
    proxy_connect_timeout 60s;
  }
}
```

#### 5-2. 심볼릭 링크 생성 및 기본 설정 제거

```bash
sudo ln -s /etc/nginx/sites-available/grandby.conf /etc/nginx/sites-enabled/grandby.conf
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 6. SSL 인증서 발급 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt -y install certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d api.grandby-app.store --agree-tos -m your-email@example.com -n
```

**성공 시:**
```
Congratulations! You have successfully enabled HTTPS on https://api.grandby-app.store
```

**확인:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

브라우저에서 `https://api.grandby-app.store` 접속 테스트

---

## 🚀 백엔드 배포

### 1. 코드 업로드

#### 방법 1: Git 사용 (권장)

```bash
cd /home/ubuntu
git clone https://github.com/GrandBy-Project/GrandBy.git grandby
cd grandby
ls -la
```

#### 방법 2: SCP 사용

```bash
# 로컬 Windows PowerShell에서
scp -i C:\path\to\your-key.pem -r C:\MyWorkSpace\grandby\GrandBy ubuntu@[EC2_IP]:/home/ubuntu/grandby
```

### 2. 프로덕션 .env 파일 생성

```bash
cd /home/ubuntu/grandby/backend
nano .env
```

아래 내용을 실제 값으로 채워서 입력:

```bash
# ==================== App Settings ====================
ENVIRONMENT=production
DEBUG=false
APP_NAME=Grandby
APP_VERSION=1.0.0
LOG_LEVEL=INFO

# ==================== Database (RDS) ====================
DATABASE_URL=postgresql://grandby:[RDS_비밀번호]@[RDS_엔드포인트]:5432/grandby_db
DB_ECHO=false

# ==================== Redis ====================
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# ==================== JWT ====================
SECRET_KEY=[openssl rand -hex 32로 생성한 값]
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# ==================== OpenAI ====================
OPENAI_API_KEY=[실제_키]
OPENAI_MODEL=gpt-4o-mini
OPENAI_WHISPER_MODEL=whisper-1
OPENAI_TTS_MODEL=tts-1
OPENAI_TTS_VOICE=nova

# ==================== Twilio ====================
TWILIO_ACCOUNT_SID=[실제_SID]
TWILIO_AUTH_TOKEN=[실제_토큰]
TWILIO_PHONE_NUMBER=[실제_번호]
TEST_PHONE_NUMBER=[테스트_번호]
API_BASE_URL=api.grandby-app.store

# ==================== AWS S3 ====================
AWS_ACCESS_KEY_ID=[IAM_액세스_키]
AWS_SECRET_ACCESS_KEY=[IAM_비밀_키]
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=grandby-s3-v1

# ==================== CORS ====================
CORS_ORIGINS=https://api.grandby-app.store

# ==================== STT ====================
STT_PROVIDER=rtzr
RTZR_CLIENT_ID=[실제_ID]
RTZR_CLIENT_SECRET=[실제_Secret]
RTZR_MODEL_NAME=sommers_ko
RTZR_DOMAIN=CALL
RTZR_SAMPLE_RATE=8000
RTZR_ENCODING=LINEAR16

# ==================== Naver Clova TTS ====================
NAVER_CLOVA_CLIENT_ID=[실제_ID]
NAVER_CLOVA_CLIENT_SECRET=[실제_Secret]
NAVER_CLOVA_TTS_SPEAKER=nara
NAVER_CLOVA_TTS_SPEED=-1
NAVER_CLOVA_TTS_PITCH=1
NAVER_CLOVA_TTS_VOLUME=0
NAVER_CLOVA_TTS_ALPHA=-1
NAVER_CLOVA_TTS_EMOTION=2

# ==================== Email ====================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=[Gmail_주소]
SMTP_PASSWORD=[Gmail_앱_비밀번호]
SMTP_FROM_EMAIL=[Gmail_주소]
SMTP_FROM_NAME=그랜비 Grandby
ENABLE_EMAIL=true

# ==================== Feature Flags ====================
ENABLE_AUTO_DIARY=true
ENABLE_TODO_EXTRACTION=true
ENABLE_EMOTION_ANALYSIS=true
ENABLE_NOTIFICATIONS=true

# ==================== Seeding ====================
AUTO_SEED=false
```

**저장:** `Ctrl+O`, `Enter`, `Ctrl+X`

### 3. Docker 컨테이너 실행

```bash
cd /home/ubuntu/grandby
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. 배포 확인

#### 4-1. 컨테이너 상태 확인

```bash
docker compose -f docker-compose.prod.yml ps
```

모든 컨테이너가 "Up" 상태여야 합니다.

#### 4-2. 로그 확인

```bash
docker compose -f docker-compose.prod.yml logs -f api
```

**정상 실행 시:**
- ✅ 데이터베이스 연결 완료!
- ✅ 마이그레이션 완료!
- Uvicorn running on http://0.0.0.0:8000

#### 4-3. 헬스체크

```bash
# EC2에서
curl http://127.0.0.1:8000/health

# 또는 브라우저에서
https://api.grandby-app.store/health
```

**정상 응답:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "environment": "production",
  "database": "healthy"
}
```

---

## 🌱 시드 데이터 생성

### 방법 1: 전체 시드 데이터 생성 (권장)

```bash
cd /home/ubuntu/grandby
docker compose -f docker-compose.prod.yml exec api python scripts/seed_all.py
```

### 방법 2: 개별 시드 데이터 생성

```bash
# 사용자만 생성
docker compose -f docker-compose.prod.yml exec api python scripts/seed_users.py

# TODO 데이터 생성
docker compose -f docker-compose.prod.yml exec api python scripts/seed_todos.py

# 연결 데이터 생성
docker compose -f docker-compose.prod.yml exec api python scripts/seed_connections.py
```

### 방법 3: AUTO_SEED 활성화

```bash
# .env 파일 수정
cd /home/ubuntu/grandby/backend
nano .env
# AUTO_SEED=true로 변경

# 컨테이너 재시작
cd /home/ubuntu/grandby
docker compose -f docker-compose.prod.yml restart api
```

### 시드 데이터 확인

```bash
# 사용자 수 확인
docker compose -f docker-compose.prod.yml exec api python -c "
from app.database import SessionLocal
from app.models.user import User
db = SessionLocal()
count = db.query(User).count()
print(f'총 사용자 수: {count}')
db.close()
"
```

---

## 🔧 유지보수

### 1. 코드 업데이트

#### 1-1. 로컬에서 수정 후 배포

```bash
# 로컬에서
git add .
git commit -m "fix: 버그 수정"
git push origin main

# EC2에서
cd /home/ubuntu/grandby
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### 2. 환경 변수 수정

```bash
# .env 파일 수정
cd /home/ubuntu/grandby/backend
nano .env
# 수정 후 저장

# 컨테이너 재시작
cd /home/ubuntu/grandby
docker compose -f docker-compose.prod.yml restart api celery_worker celery_beat
```

### 3. 데이터베이스 마이그레이션

```bash
# 로컬에서 새 마이그레이션 생성
docker compose exec api alembic revision --autogenerate -m "Add new table"
git add .
git commit -m "feat: Add migration"
git push

# EC2에서
cd /home/ubuntu/grandby
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
# entrypoint.sh가 자동으로 마이그레이션 실행
```

### 4. 로그 확인

```bash
# API 로그
docker compose -f docker-compose.prod.yml logs --tail=100 api

# Celery Worker 로그
docker compose -f docker-compose.prod.yml logs --tail=100 celery_worker

# Celery Beat 로그
docker compose -f docker-compose.prod.yml logs --tail=100 celery_beat

# 실시간 로그 모니터링
docker compose -f docker-compose.prod.yml logs -f api
```

### 5. 컨테이너 관리

#### 재시작

```bash
# 특정 컨테이너만 재시작
docker compose -f docker-compose.prod.yml restart api

# 모든 컨테이너 재시작
docker compose -f docker-compose.prod.yml restart
```

#### 중지 및 시작

```bash
# 중지
docker compose -f docker-compose.prod.yml stop

# 시작
docker compose -f docker-compose.prod.yml start

# 중지 및 삭제 (주의!)
docker compose -f docker-compose.prod.yml down
```

### 6. EC2 재시작 시 자동 실행

#### 현재 상태
`docker-compose.prod.yml`에 `restart: unless-stopped` 설정이 있어서 EC2 재시작 시 자동으로 컨테이너가 시작됩니다.

#### 확인 방법

```bash
# EC2 재시작 후
docker compose -f docker-compose.prod.yml ps
# 모든 컨테이너가 "Up" 상태면 정상
```

#### 자동 시작이 안 될 경우: systemd 서비스 설정

```bash
# 서비스 파일 생성
sudo nano /etc/systemd/system/grandby.service
```

아래 내용 추가:

```ini
[Unit]
Description=Grandby Backend Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/grandby
ExecStart=/usr/local/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker compose -f docker-compose.prod.yml down
User=ubuntu

[Install]
WantedBy=multi-user.target
```

활성화:

```bash
sudo systemctl daemon-reload
sudo systemctl enable grandby.service
sudo systemctl start grandby.service
```

### 7. 모니터링

#### 일상적인 체크

```bash
# 1. 컨테이너 상태
docker compose -f docker-compose.prod.yml ps

# 2. 리소스 사용량
docker stats

# 3. 디스크 사용량
df -h

# 4. 헬스체크
curl https://api.grandby-app.store/health
```

#### 주기적인 작업

**1주일마다:**
- 로그 확인 (에러 체크)
- 디스크 공간 확인
- RDS 백업 확인

**1개월마다:**
- 보안 업데이트 적용
- Docker 이미지 정리:
```bash
docker system prune -a
```

---

## 🐛 트러블슈팅

### 문제 1: 502 Bad Gateway

**원인:** 백엔드 컨테이너가 실행되지 않음

**해결:**
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs api
docker compose -f docker-compose.prod.yml up -d
```

### 문제 2: 데이터베이스 연결 실패

**원인:** RDS 보안 그룹 설정 문제

**해결:**
1. RDS 보안 그룹 확인
2. 인바운드 규칙에 EC2 보안 그룹 추가 확인
3. 연결 테스트:
```bash
nc -zv [RDS_엔드포인트] 5432
```

### 문제 3: SSL 인증서 오류

**원인:** Nginx 설정 파일에 인증서 경로가 잘못됨

**해결:**
```bash
sudo certbot --nginx -d api.grandby-app.store --force-renewal
sudo nginx -t
sudo systemctl reload nginx
```

### 문제 4: 컨테이너가 자동 시작 안 됨

**해결:**
```bash
# systemd 서비스 설정 (위 "EC2 재시작 시 자동 실행" 참조)
```

---

## 📝 체크리스트

### 배포 전 확인사항

- [ ] 도메인 구매 및 Route53 설정 완료
- [ ] RDS 인스턴스 생성 및 보안 그룹 설정
- [ ] S3 버킷 생성
- [ ] IAM 사용자 생성 및 액세스 키 발급
- [ ] EC2 인스턴스 생성 및 탄력적 IP 할당
- [ ] Route53 A 레코드 생성
- [ ] .env 파일에 모든 실제 값 입력
- [ ] SSL 인증서 발급 완료

### 배포 후 확인사항

- [ ] `https://api.grandby-app.store/health` 정상 응답
- [ ] 모든 Docker 컨테이너 "Up" 상태
- [ ] 시드 데이터 생성 완료
- [ ] 로그에 에러 없음

---

## 📞 참고

- **프로젝트 저장소:** https://github.com/GrandBy-Project/GrandBy
- **API 문서:** https://api.grandby-app.store/docs (개발 환경에서만)
- **헬스체크:** https://api.grandby-app.store/health

---

**배포 완료! 🎉**

