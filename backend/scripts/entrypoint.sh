#!/bin/bash
# Docker 컨테이너 시작 시 실행되는 엔트리포인트 스크립트

set -e

echo "🚀 Grandby Backend 시작 중..."

# DB가 준비될 때까지 대기
echo "⏳ 데이터베이스 연결 대기 중..."

# DATABASE_URL에서 호스트 추출
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p' || echo "")

if [ -n "$DB_HOST" ] && [ "$DB_HOST" != "db" ]; then
    # RDS 또는 외부 DB인 경우 (호스트가 db가 아님)
    echo "🔗 외부 데이터베이스 연결 확인 중: $DB_HOST"
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p' || echo "5432")
    
    # Python으로 실제 연결 테스트 (더 안정적)
    python -c "
import os
import sys
import time
from urllib.parse import urlparse

database_url = os.getenv('DATABASE_URL', '')
if not database_url:
    sys.exit(1)

parsed = urlparse(database_url)
host = parsed.hostname
port = parsed.port or 5432

# psycopg2로 연결 시도
try:
    import psycopg2
    max_retries = 30
    for i in range(max_retries):
        try:
            conn = psycopg2.connect(
                host=host,
                port=port,
                user=parsed.username,
                password=parsed.password,
                database=parsed.path[1:],
                connect_timeout=5
            )
            conn.close()
            sys.exit(0)
        except psycopg2.OperationalError:
            if i < max_retries - 1:
                time.sleep(1)
            else:
                sys.exit(1)
except ImportError:
    # psycopg2가 없으면 간단히 호스트 연결만 확인
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    result = sock.connect_ex((host, port))
    sock.close()
    sys.exit(0 if result == 0 else 1)
" || {
        echo "⚠️ 데이터베이스 연결 확인 실패 (계속 진행)..."
    }
else
    # 로컬 Docker Compose DB인 경우
    while ! nc -z db 5432; do
        sleep 1
    done
fi

echo "✅ 데이터베이스 연결 완료!"

# Alembic 마이그레이션 실행
echo "🔄 데이터베이스 마이그레이션 실행 중..."
alembic upgrade head
echo "✅ 마이그레이션 완료!"

# 시드 데이터 확인 및 생성 (선택사항)
if [ "$AUTO_SEED" = "true" ]; then
    echo "🌱 시드 데이터 확인 중..."
    
    # Python으로 사용자 수 확인
    USER_EXISTS=$(python -c "
import sys
try:
    from app.database import SessionLocal
    from app.models.user import User
    db = SessionLocal()
    count = db.query(User).count()
    db.close()
    print('yes' if count > 0 else 'no')
except Exception as e:
    print('no')
    sys.exit(0)
" 2>/dev/null || echo "no")

    if [ "$USER_EXISTS" = "no" ]; then
        echo "📝 시드 데이터 생성 중..."
        python scripts/seed_users.py || echo "⚠️ 사용자 시드 실패"
        echo "✅ 시드 데이터 생성 완료!"
    else
        echo "ℹ️  시드 데이터가 이미 존재합니다."
    fi
fi

echo "🎉 초기화 완료! 서버 시작..."
echo ""

# 전달된 명령어 실행 (uvicorn 등)
exec "$@"


