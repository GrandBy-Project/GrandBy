"""
테스트 연결 요청 시드 데이터 생성
"""
import sys
from pathlib import Path

# 프로젝트 루트를 파이썬 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.user import User, UserConnection, UserRole, ConnectionStatus
from app.models.notification import Notification, NotificationType
import uuid


def seed_connections():
    """테스트 연결 요청 생성"""
    db = SessionLocal()
    try:
        # 어르신과 보호자 찾기
        elderly = db.query(User).filter(User.role == UserRole.ELDERLY).first()
        caregiver = db.query(User).filter(User.role == UserRole.CAREGIVER).first()
        
        if not elderly or not caregiver:
            print("⚠️  사용자 데이터를 먼저 생성해주세요. (seed_users.py)")
            return
        
        # 기존 연결 확인
        existing = db.query(UserConnection).first()
        if existing:
            print("⚠️  연결 데이터가 이미 존재합니다. 건너뜁니다.")
            return
        
        # 시나리오 1: 대기 중인 연결 요청 (보호자 → 어르신)
        pending_connection = UserConnection(
            connection_id=str(uuid.uuid4()),
            caregiver_id=caregiver.user_id,
            elderly_id=elderly.user_id,
            status=ConnectionStatus.PENDING
        )
        db.add(pending_connection)
        db.flush()
        
        # 어르신에게 알림 생성
        pending_notification = Notification(
            notification_id=str(uuid.uuid4()),
            user_id=elderly.user_id,
            type=NotificationType.CONNECTION_REQUEST,
            title="새로운 연결 요청",
            message=f"{caregiver.name}님({caregiver.email})이 보호자 연결을 요청했습니다.",
            related_id=pending_connection.connection_id,
            is_read=False,
            is_pushed=False
        )
        db.add(pending_notification)
        
        db.commit()
        
        print("✅ 연결 요청 데이터 생성 완료!")
        print(f"   - 대기 중인 연결: 1개")
        print(f"   - 알림: 1개 (어르신에게)")
        print(f"\n   📝 테스트 시나리오:")
        print(f"   1. 어르신(test1@test.com)으로 로그인")
        print(f"   2. 알림 확인 → 연결 요청 보임")
        print(f"   3. 수락하면 → 보호자와 연결 완료!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    seed_connections()


