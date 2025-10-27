#!/bin/bash
# DB 초기화 및 시드 데이터 생성 스크립트

set -e

echo "🔄 Alembic 마이그레이션 실행 중..."
alembic upgrade head

echo "🌱 시드 데이터 확인 중..."
# 사용자가 이미 있는지 확인
USER_COUNT=$(python -c "
from app.database import SessionLocal
from app.models.user import User
db = SessionLocal()
count = db.query(User).count()
db.close()
print(count)
")

if [ "$USER_COUNT" -eq "0" ]; then
    echo "📝 시드 데이터 생성 중..."
    python scripts/seed_all.py
    echo "✅ 시드 데이터 생성 완료!"
else
    echo "ℹ️  시드 데이터가 이미 존재합니다. (사용자 ${USER_COUNT}명)"
fi

echo "🎉 DB 초기화 완료!"


