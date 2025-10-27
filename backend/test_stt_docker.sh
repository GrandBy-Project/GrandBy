#!/bin/bash
# STT 성능 테스트 실행 스크립트 (Docker 환경용)

echo "==================================="
echo "🎤 STT 성능 테스트 (Docker)"
echo "==================================="
echo ""

# 1. Docker 컨테이너 확인
echo "📋 Docker 컨테이너 확인..."
CONTAINER_NAME="grandby_api"

# 컨테이너 존재 확인
if ! docker ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ 백엔드 컨테이너를 찾을 수 없습니다: $CONTAINER_NAME"
    echo ""
    echo "실행 중인 컨테이너:"
    docker ps
    exit 1
fi

echo "✅ 컨테이너 발견: $CONTAINER_NAME"
echo ""

# 2. 테스트 스크립트 실행
echo "🚀 STT 성능 테스트 시작..."
echo ""

docker exec -it $CONTAINER_NAME python /app/test_stt_performance.py

echo ""
echo "==================================="
echo "✅ 테스트 완료"
echo "==================================="

