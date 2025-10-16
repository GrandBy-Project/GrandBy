#!/bin/bash
# Docker 컨테이너 시작 시 실행되는 엔트리포인트 스크립트

set -e

echo "🚀 Grandby Backend 시작 중..."

# DB가 준비될 때까지 대기
echo "⏳ 데이터베이스 연결 대기 중..."
while ! nc -z db 5432; do
  sleep 1
done
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

