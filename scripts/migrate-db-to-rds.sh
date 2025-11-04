#!/bin/bash
# ============================================
# 로컬 Docker DB → RDS 마이그레이션 스크립트
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
log_info "🚀 데이터베이스 마이그레이션 시작..."

# RDS 엔드포인트 입력
read -p "RDS 엔드포인트를 입력하세요 (예: your-db.xxxxx.ap-northeast-2.rds.amazonaws.com): " RDS_ENDPOINT

if [ -z "$RDS_ENDPOINT" ]; then
    log_error "RDS 엔드포인트가 입력되지 않았습니다."
    exit 1
fi

read -p "데이터베이스 사용자명 (기본값: grandby): " DB_USER
DB_USER=${DB_USER:-grandby}

read -sp "데이터베이스 비밀번호: " DB_PASSWORD
echo ""

read -p "데이터베이스 이름 (기본값: grandby_db): " DB_NAME
DB_NAME=${DB_NAME:-grandby_db}

# ============================================
# 로컬 DB 백업
# ============================================
log_step "1. 로컬 데이터베이스 백업 생성..."

BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"

if docker ps --format "{{.Names}}" | grep -q "^grandby_postgres$"; then
    log_info "로컬 PostgreSQL에서 덤프 생성 중..."
    docker exec grandby_postgres pg_dump -U grandby -d grandby_db > "$BACKUP_FILE"
    log_info "✅ 백업 파일 생성: $BACKUP_FILE"
else
    log_error "로컬 PostgreSQL 컨테이너가 실행 중이 아닙니다."
    exit 1
fi

# ============================================
# RDS 연결 테스트
# ============================================
log_step "2. RDS 연결 테스트..."

if command -v psql &> /dev/null; then
    export PGPASSWORD="$DB_PASSWORD"
    if psql -h "$RDS_ENDPOINT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        log_info "✅ RDS 연결 성공!"
    else
        log_error "❌ RDS 연결 실패"
        log_warn "보안 그룹 설정을 확인하세요."
        exit 1
    fi
else
    log_warn "psql이 설치되어 있지 않습니다. 연결 테스트를 건너뜁니다."
    log_warn "Docker를 사용하여 연결 테스트를 진행합니다..."
    
    # Docker로 psql 실행
    if docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:15-alpine \
        psql -h "$RDS_ENDPOINT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        log_info "✅ RDS 연결 성공!"
    else
        log_error "❌ RDS 연결 실패"
        exit 1
    fi
fi

# ============================================
# 스키마 생성 확인
# ============================================
log_step "3. RDS 스키마 확인..."

if command -v psql &> /dev/null; then
    TABLE_COUNT=$(psql -h "$RDS_ENDPOINT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
else
    TABLE_COUNT=$(docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:15-alpine \
        psql -h "$RDS_ENDPOINT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | xargs)
fi

if [ "$TABLE_COUNT" = "0" ] || [ -z "$TABLE_COUNT" ]; then
    log_warn "RDS에 테이블이 없습니다. 마이그레이션을 실행해야 합니다."
    read -p "계속 진행하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    log_info "RDS에 $TABLE_COUNT 개의 테이블이 있습니다."
    read -p "기존 데이터를 덮어쓰시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "마이그레이션을 취소했습니다."
        exit 0
    fi
fi

# ============================================
# 데이터 복원
# ============================================
log_step "4. 데이터 복원 중..."

if command -v psql &> /dev/null; then
    log_info "psql을 사용하여 데이터 복원 중..."
    psql -h "$RDS_ENDPOINT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
else
    log_info "Docker를 사용하여 데이터 복원 중..."
    docker run --rm -i -e PGPASSWORD="$DB_PASSWORD" \
        -v "$(pwd)/$BACKUP_FILE:/backup.sql" \
        postgres:15-alpine \
        psql -h "$RDS_ENDPOINT" -U "$DB_USER" -d "$DB_NAME" < "$BACKUP_FILE"
fi

log_info "✅ 데이터 복원 완료!"

# ============================================
# 검증
# ============================================
log_step "5. 데이터 검증..."

if command -v psql &> /dev/null; then
    USER_COUNT=$(psql -h "$RDS_ENDPOINT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs)
else
    USER_COUNT=$(docker run --rm -e PGPASSWORD="$DB_PASSWORD" postgres:15-alpine \
        psql -h "$RDS_ENDPOINT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | xargs)
fi

if [ -n "$USER_COUNT" ] && [ "$USER_COUNT" != "0" ]; then
    log_info "✅ 검증 완료: $USER_COUNT 명의 사용자가 있습니다."
else
    log_warn "⚠️  사용자 데이터가 없습니다. 마이그레이션이 완전하지 않을 수 있습니다."
fi

# ============================================
# 완료
# ============================================
log_info ""
log_info "🎉 마이그레이션 완료!"
log_info ""
log_info "📝 다음 단계:"
log_info "   1. EC2의 backend/.env 파일에서 DATABASE_URL 업데이트:"
log_info "      DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@$RDS_ENDPOINT:5432/$DB_NAME"
log_info ""
log_info "   2. 백업 파일 보관: $BACKUP_FILE"
log_info ""
log_info "   3. 백엔드 재시작: docker compose restart api"

