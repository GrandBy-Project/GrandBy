# Grandby 프로덕션 배포 가이드

## 📋 목차
1. [개요](#개요)
2. [사전 준비사항](#사전-준비사항)
3. [RDS 설정](#rds-설정)
4. [EC2 설정](#ec2-설정)
5. [Docker Compose 프로덕션 배포](#docker-compose-프로덕션-배포)
6. [도메인 및 SSL 설정](#도메인-및-ssl-설정)
7. [모니터링 및 로깅](#모니터링-및-로깅)
8. [트러블슈팅](#트러블슈팅)

---

## 개요

이 문서는 Grandby 백엔드를 AWS EC2에서 프로덕션 환경으로 배포하는 방법을 설명합니다.

### 아키텍처
```
[사용자] 
    ↓ HTTPS
[Nginx] (SSL/TLS)
    ↓
[EC2] 
    ├─ [FastAPI Container] (포트 8000)
    ├─ [Redis Container] (포트 6379)
    ├─ [Celery Worker]
    ├─ [Celery Beat]
    └─ [Flower] (포트 5555)
    ↓
[RDS PostgreSQL] (외부)
```

---

## 사전 준비사항

### 1. AWS 계정 및 서비스
- ✅ AWS 계정 생성
- ✅ EC2 인스턴스 생성 (t3.medium 이상 권장)
- ✅ RDS PostgreSQL 인스턴스 생성
- ✅ Route 53 또는 도메인 등록
- ✅ S3 버킷 생성 (음성 파일 저장용)

### 2. 필요한 정보
- RDS 엔드포인트
- RDS 사용자명 및 비밀번호
- 도메인 이름 (예: api.grandby.com)
- 모든 API 키 (OpenAI, Twilio, Naver Clova 등)

---

## RDS 설정

### 1. RDS 인스턴스 생성

```bash
# AWS Console에서:
# - PostgreSQL 15 선택
# - 인스턴스 클래스: db.t3.small 이상
# - 스토리지: 20GB 이상 (자동 증가)
# - 마스터 사용자명: grandby
# - 마스터 비밀번호: 강력한 비밀번호 설정
# - 가용성 영역: ap-northeast-2a (서울)
```

### 2. 보안 그룹 설정

RDS 보안 그룹에서:
- **인바운드 규칙 추가**
  - 타입: PostgreSQL
  - 포트: 5432
  - 소스: EC2 보안 그룹 ID

### 3. 데이터 마이그레이션

로컬 DB → RDS 마이그레이션:

```bash
# 마이그레이션 스크립트 사용
./scripts/migrate-db-to-rds.sh

# 또는 수동으로:
docker exec grandby_postgres pg_dump -U grandby grandby_db > backup.sql
psql -h your-rds-endpoint.amazonaws.com -U grandby -d grandby_db < backup.sql
```

---

## EC2 설정

### 1. EC2 인스턴스 준비

**인스턴스 타입**: t3.medium 이상 (메모리 4GB+)

**보안 그룹 설정**:
- SSH (22): 본인 IP만
- HTTP (80): 0.0.0.0/0
- HTTPS (443): 0.0.0.0/0
- Custom TCP (8000): 127.0.0.1/32 (Nginx용)

### 2. 초기 설정

```bash
# EC2에 SSH 접속
ssh -i your-key.pem ubuntu@your-ec2-ip

# 시스템 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 설치
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu

# Git 설치
sudo apt install -y git

# 로그아웃 후 재로그인 (그룹 권한 적용)
exit
```

### 3. 프로젝트 클론

```bash
# EC2에 재접속 후
cd ~
git clone https://github.com/GrandBy-Project/GrandBy.git
cd GrandBy
```

### 4. 환경 변수 설정

```bash
# 프로덕션 환경 변수 파일 생성
cd backend
cp env.prod.example .env
nano .env  # 또는 vim .env
```

**필수 환경 변수 설정**:
```bash
# RDS 연결
DATABASE_URL=postgresql://grandby:password@your-rds-endpoint.amazonaws.com:5432/grandby_db

# API 도메인 (HTTPS 필수)
API_BASE_URL=api.grandby.com

# 프로덕션 설정
ENVIRONMENT=production
DEBUG=false
AUTO_SEED=false

# 모든 API 키 설정
```

---

## Docker Compose 프로덕션 배포

### 1. 프로덕션 Compose 파일 확인

```bash
# 프로덕션용 docker-compose.prod.yml 파일 사용
ls -la docker-compose.prod.yml
```

### 2. 배포 스크립트 실행

```bash
# 배포 스크립트 실행
./scripts/deploy-backend-ec2.sh

# 또는 수동으로:
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### 3. 헬스 체크

```bash
# 서비스 상태 확인
./scripts/check-health.sh

# 또는 수동으로:
docker compose -f docker-compose.prod.yml ps
curl http://localhost:8000/health
```

### 4. 로그 확인

```bash
# API 로그
docker compose -f docker-compose.prod.yml logs -f api

# 모든 서비스 로그
docker compose -f docker-compose.prod.yml logs -f
```

---

## 도메인 및 SSL 설정

### 1. Nginx 설치

```bash
sudo apt install -y nginx
```

### 2. Nginx 설정

```bash
sudo nano /etc/nginx/sites-available/grandby
```

**설정 내용**:
```nginx
server {
    listen 80;
    server_name api.grandby.com;

    # HTTP → HTTPS 리다이렉트
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.grandby.com;

    # SSL 인증서 (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.grandby.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.grandby.com/privkey.pem;

    # SSL 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 프록시 설정
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket 지원 (Twilio용)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # 타임아웃 설정
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 3. SSL 인증서 발급 (Let's Encrypt)

```bash
# Certbot 설치
sudo apt install -y certbot python3-certbot-nginx

# SSL 인증서 발급
sudo certbot --nginx -d api.grandby.com

# 자동 갱신 설정
sudo certbot renew --dry-run
```

### 4. Nginx 활성화

```bash
sudo ln -s /etc/nginx/sites-available/grandby /etc/nginx/sites-enabled/
sudo nginx -t  # 설정 테스트
sudo systemctl restart nginx
sudo systemctl enable nginx
```

---

## 모니터링 및 로깅

### 1. CloudWatch 로그 설정

```bash
# AWS CLI 설치
sudo apt install -y awscli

# 로그 그룹 생성
aws logs create-log-group --log-group-name /ec2/grandby-api
```

### 2. 로그 수집 스크립트 (선택사항)

```bash
# Docker 로그를 CloudWatch로 전송하는 스크립트 생성
# (별도 설정 필요)
```

### 3. 헬스 체크 모니터링

```bash
# cron으로 정기 헬스 체크
crontab -e
# 추가:
*/5 * * * * curl -f http://localhost:8000/health || echo "Health check failed" | mail -s "API Down" admin@example.com
```

---

## 트러블슈팅

### 문제 1: RDS 연결 실패

**증상**: `Connection refused` 또는 `timeout`

**해결**:
1. RDS 보안 그룹에서 EC2 보안 그룹 허용 확인
2. RDS 엔드포인트 확인
3. DATABASE_URL 환경 변수 확인

```bash
# 연결 테스트
psql -h your-rds-endpoint.amazonaws.com -U grandby -d grandby_db
```

### 문제 2: API가 응답하지 않음

**증상**: `curl http://localhost:8000/health` 실패

**해결**:
1. 컨테이너 상태 확인
```bash
docker compose -f docker-compose.prod.yml ps
```

2. 로그 확인
```bash
docker compose -f docker-compose.prod.yml logs api
```

3. 컨테이너 재시작
```bash
docker compose -f docker-compose.prod.yml restart api
```

### 문제 3: Twilio WebSocket 연결 실패

**증상**: 통화 연결은 되지만 WebSocket 실패

**해결**:
1. API_BASE_URL이 HTTPS인지 확인
2. Nginx WebSocket 설정 확인
3. SSL 인증서 확인

```bash
# SSL 인증서 확인
sudo certbot certificates
```

### 문제 4: 메모리 부족

**증상**: 컨테이너가 자주 재시작됨

**해결**:
1. EC2 인스턴스 타입 업그레이드
2. Docker 리소스 제한 확인
3. 불필요한 컨테이너 중지

```bash
# 메모리 사용량 확인
docker stats
```

---

## 유지보수

### 정기 작업

1. **주간**: 로그 확인 및 정리
2. **월간**: 보안 업데이트 적용
3. **분기**: 데이터베이스 백업 확인

### 업데이트 프로세스

```bash
# 1. Git에서 최신 코드 가져오기
git pull origin main

# 2. 배포 스크립트 실행
./scripts/deploy-backend-ec2.sh

# 3. 헬스 체크
./scripts/check-health.sh
```

---

## 보안 체크리스트

- [ ] `.env` 파일이 Git에 커밋되지 않았는지 확인
- [ ] RDS 보안 그룹이 EC2만 허용하는지 확인
- [ ] SSL 인증서가 유효한지 확인
- [ ] Swagger UI가 비활성화되었는지 확인 (프로덕션)
- [ ] CORS가 필요한 도메인만 허용하는지 확인
- [ ] Flower에 인증이 설정되었는지 확인
- [ ] 모든 API 키가 안전하게 관리되는지 확인

---

## 참고 자료

- [Docker Compose 공식 문서](https://docs.docker.com/compose/)
- [AWS RDS 문서](https://docs.aws.amazon.com/rds/)
- [Let's Encrypt 문서](https://letsencrypt.org/docs/)
- [Nginx 문서](https://nginx.org/en/docs/)

