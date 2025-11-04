#!/bin/bash
# ============================================
# EC2에서 백엔드 배포 스크립트
# 프로덕션 환경용 (RDS 연결)
# ============================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# ============================================
# 설정 확인
# ============================================
log_info "🚀 Grandby Backend EC2 배포 시작..."

# 프로젝트 디렉토리 확인
PROJECT_DIR="${HOME}/grandby"
if [ ! -d "$PROJECT_DIR" ]; then
    log_error "프로젝트 디렉토리를 찾을 수 없습니다: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# .env 파일 확인
if [ ! -f "backend/.env" ]; then
    log_error "backend/.env 파일이 없습니다!"
    log_warn "환경 변수를 설정해야 합니다."
    exit 1
fi

# ============================================
# 백업 생성 (선택사항)
# ============================================
log_step "1. 기존 컨테이너 백업 확인..."
if docker compose ps | grep -q "Up"; then
    log_info "기존 컨테이너가 실행 중입니다."
    read -p "백업을 생성하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        BACKUP_DIR="${HOME}/backups/$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        log_info "백업 디렉토리 생성: $BACKUP_DIR"
        # 필요한 파일 백업
        cp -r backend "$BACKUP_DIR/" 2>/dev/null || true
        log_info "✅ 백업 완료: $BACKUP_DIR"
    fi
fi

# ============================================
# Git에서 최신 코드 가져오기
# ============================================
log_step "2. Git에서 최신 코드 가져오기..."
git fetch origin
CURRENT_BRANCH=$(git branch --show-current)
log_info "현재 브랜치: $CURRENT_BRANCH"

read -p "최신 코드를 가져오시겠습니까? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git pull origin "$CURRENT_BRANCH"
    log_info "✅ Git 업데이트 완료"
fi

# ============================================
# Docker 이미지 빌드
# ============================================
log_step "3. Docker 이미지 빌드..."
docker compose -f docker-compose.prod.yml build --no-cache api celery_worker celery_beat
log_info "✅ 빌드 완료"

# ============================================
# 기존 컨테이너 중지
# ============================================
log_step "4. 기존 컨테이너 중지..."
docker compose -f docker-compose.prod.yml down
log_info "✅ 컨테이너 중지 완료"

# ============================================
# 새 컨테이너 시작
# ============================================
log_step "5. 새 컨테이너 시작..."
docker compose -f docker-compose.prod.yml up -d
log_info "✅ 컨테이너 시작 완료"

# ============================================
# 헬스 체크
# ============================================
log_step "6. 헬스 체크 대기..."
sleep 10

MAX_RETRIES=30
RETRY_COUNT=0
HEALTH_CHECK_URL="http://localhost:8000/health"

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        log_info "✅ API 서버가 정상적으로 응답합니다!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    log_info "⏳ API 서버 응답 대기 중... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "❌ API 서버가 응답하지 않습니다!"
    log_error "로그를 확인하세요:"
    docker compose -f docker-compose.prod.yml logs api
    exit 1
fi

# ============================================
# 데이터베이스 마이그레이션 확인
# ============================================
log_step "7. 데이터베이스 마이그레이션 확인..."
docker compose -f docker-compose.prod.yml exec -T api alembic current
log_info "✅ 마이그레이션 확인 완료"

# ============================================
# 컨테이너 상태 확인
# ============================================
log_step "8. 컨테이너 상태 확인..."
docker compose -f docker-compose.prod.yml ps

# ============================================
# 배포 완료
# ============================================
log_info ""
log_info "🎉 배포 완료!"
log_info ""
log_info "📝 유용한 명령어:"
log_info "   로그 확인: docker compose -f docker-compose.prod.yml logs -f api"
log_info "   상태 확인: docker compose -f docker-compose.prod.yml ps"
log_info "   컨테이너 재시작: docker compose -f docker-compose.prod.yml restart api"
log_info ""
log_info "🔗 API 엔드포인트 확인:"
curl -s "$HEALTH_CHECK_URL" | jq . || curl -s "$HEALTH_CHECK_URL"

