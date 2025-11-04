#!/bin/bash
# ============================================
# Grandby Backend 배포 스크립트
# EC2에서 백엔드를 배포할 때 사용하는 스크립트
# ============================================

set -e  # 에러 발생 시 즉시 종료

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ============================================
# 배포 전 확인
# ============================================
log_info "🚀 Grandby Backend 배포 시작..."

# 현재 디렉토리 확인
if [ ! -f "docker-compose.yml" ]; then
    log_error "docker-compose.yml 파일을 찾을 수 없습니다."
    log_error "프로젝트 루트 디렉토리에서 실행해주세요."
    exit 1
fi

# .env 파일 확인
if [ ! -f "backend/.env" ]; then
    log_warn ".env 파일이 없습니다. 환경 변수를 확인하세요."
fi

# ============================================
# Git에서 최신 코드 가져오기 (선택사항)
# ============================================
read -p "Git에서 최신 코드를 가져오시겠습니까? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "📥 Git에서 최신 코드 가져오는 중..."
    git pull origin main || git pull origin master
    log_info "✅ Git 업데이트 완료"
fi

# ============================================
# Docker 이미지 빌드
# ============================================
log_info "🔨 Docker 이미지 빌드 중..."
docker compose build --no-cache api celery_worker celery_beat flower
log_info "✅ Docker 이미지 빌드 완료"

# ============================================
# 기존 컨테이너 중지 및 제거
# ============================================
log_info "🛑 기존 컨테이너 중지 중..."
docker compose down
log_info "✅ 컨테이너 중지 완료"

# ============================================
# 새 컨테이너 시작
# ============================================
log_info "🚀 새 컨테이너 시작 중..."
docker compose up -d

# ============================================
# 헬스 체크 대기
# ============================================
log_info "⏳ 서비스 헬스 체크 대기 중..."
sleep 5

# API 헬스 체크
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        log_info "✅ API 서버가 정상적으로 응답합니다!"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    log_info "⏳ API 서버 응답 대기 중... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    log_error "❌ API 서버가 응답하지 않습니다. 로그를 확인하세요."
    docker compose logs api
    exit 1
fi

# ============================================
# 데이터베이스 마이그레이션 확인
# ============================================
log_info "🔄 데이터베이스 마이그레이션 확인 중..."
docker compose exec -T api alembic current
log_info "✅ 마이그레이션 확인 완료"

# ============================================
# 컨테이너 상태 확인
# ============================================
log_info "📊 컨테이너 상태 확인..."
docker compose ps

# ============================================
# 배포 완료
# ============================================
log_info "🎉 배포 완료!"
log_info "📝 다음 명령어로 로그를 확인할 수 있습니다:"
log_info "   docker compose logs -f api"
log_info ""
log_info "🔗 API 엔드포인트: http://localhost:8000"
log_info "📚 API 문서: http://localhost:8000/docs"

