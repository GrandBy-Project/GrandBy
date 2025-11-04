#!/bin/bash
# ============================================
# Grandby 서비스 헬스 체크 스크립트
# 모든 서비스의 상태를 확인하는 스크립트
# ============================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ============================================
# Docker 컨테이너 상태 확인
# ============================================
check_docker_containers() {
    log_header "Docker 컨테이너 상태"
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker가 설치되어 있지 않습니다."
        return 1
    fi
    
    if [ -f "docker-compose.yml" ]; then
        echo "컨테이너 상태:"
        docker compose ps
        echo ""
        
        # 각 컨테이너 헬스 체크
        CONTAINERS=("grandby_api" "grandby_postgres" "grandby_redis" "grandby_celery_worker" "grandby_celery_beat")
        
        for container in "${CONTAINERS[@]}"; do
            if docker ps --format "{{.Names}}" | grep -q "^${container}$"; then
                STATUS=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null)
                HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "no-healthcheck")
                
                if [ "$STATUS" = "running" ]; then
                    if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "no-healthcheck" ]; then
                        log_info "$container: 실행 중"
                    else
                        log_warn "$container: 실행 중이지만 헬스 체크 실패 (Status: $HEALTH)"
                    fi
                else
                    log_error "$container: 실행 중이 아님 (Status: $STATUS)"
                fi
            else
                log_warn "$container: 컨테이너가 없습니다"
            fi
        done
    else
        log_warn "docker-compose.yml 파일을 찾을 수 없습니다."
    fi
    
    echo ""
}

# ============================================
# API 헬스 체크
# ============================================
check_api_health() {
    log_header "API 서버 헬스 체크"
    
    API_URL="http://localhost:8000"
    
    # 헬스 체크 엔드포인트
    if curl -f -s "${API_URL}/health" > /dev/null 2>&1; then
        log_info "API 서버가 정상적으로 응답합니다."
        
        # 상세 정보 가져오기
        HEALTH_INFO=$(curl -s "${API_URL}/health" 2>/dev/null || echo "{}")
        if command -v jq &> /dev/null; then
            echo "$HEALTH_INFO" | jq .
        else
            echo "$HEALTH_INFO"
        fi
    else
        log_error "API 서버에 연결할 수 없습니다."
        log_warn "URL: $API_URL"
        return 1
    fi
    
    echo ""
}

# ============================================
# 데이터베이스 연결 확인
# ============================================
check_database() {
    log_header "데이터베이스 연결 확인"
    
    if docker ps --format "{{.Names}}" | grep -q "^grandby_postgres$"; then
        if docker exec grandby_postgres pg_isready -U grandby -d grandby_db > /dev/null 2>&1; then
            log_info "PostgreSQL 데이터베이스 연결 성공"
            
            # 데이터베이스 크기 확인
            DB_SIZE=$(docker exec grandby_postgres psql -U grandby -d grandby_db -t -c "SELECT pg_size_pretty(pg_database_size('grandby_db'));" 2>/dev/null | xargs)
            if [ -n "$DB_SIZE" ]; then
                log_info "데이터베이스 크기: $DB_SIZE"
            fi
        else
            log_error "PostgreSQL 데이터베이스 연결 실패"
            return 1
        fi
    else
        log_warn "PostgreSQL 컨테이너가 실행 중이 아닙니다."
    fi
    
    echo ""
}

# ============================================
# Redis 연결 확인
# ============================================
check_redis() {
    log_header "Redis 연결 확인"
    
    if docker ps --format "{{.Names}}" | grep -q "^grandby_redis$"; then
        if docker exec grandby_redis redis-cli ping > /dev/null 2>&1; then
            log_info "Redis 연결 성공"
            
            # Redis 정보 확인
            REDIS_INFO=$(docker exec grandby_redis redis-cli info server 2>/dev/null | grep "redis_version" || echo "")
            if [ -n "$REDIS_INFO" ]; then
                log_info "$REDIS_INFO"
            fi
        else
            log_error "Redis 연결 실패"
            return 1
        fi
    else
        log_warn "Redis 컨테이너가 실행 중이 아닙니다."
    fi
    
    echo ""
}

# ============================================
# 메인 실행
# ============================================
main() {
    echo ""
    log_header "Grandby 서비스 헬스 체크"
    echo ""
    
    # 프로젝트 루트로 이동
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    cd "$PROJECT_ROOT" || exit 1
    
    # 각 체크 실행
    check_docker_containers
    check_api_health
    check_database
    check_redis
    
    log_header "체크 완료"
    echo ""
}

main "$@"

