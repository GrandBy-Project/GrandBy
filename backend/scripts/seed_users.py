"""
테스트 사용자 시드 데이터 생성
"""
import sys
from pathlib import Path

# 프로젝트 루트를 파이썬 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.user import User, UserRole, AuthProvider
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_users():
    """테스트 사용자 생성"""
    db = SessionLocal()
    try:
        # 기존 테스트 계정 확인
        existing = db.query(User).filter(
            User.email.in_(["test1@test.com", "test2@test.com"])
        ).first()
        
        if existing:
            print("⚠️  테스트 계정이 이미 존재합니다. 건너뜁니다.")
            return
        
        # 테스트 사용자 1: 어르신
        user1 = User(
            email="test1@test.com",
            password_hash=pwd_context.hash("12341234"),
            name="테르신",
            role=UserRole.ELDERLY,
            phone_number="01012345678",
            auth_provider=AuthProvider.EMAIL,
            is_verified=True
        )
        db.add(user1)
        
        # 테스트 사용자 2: 보호자
        user2 = User(
            email="test2@test.com",
            password_hash=pwd_context.hash("12341234"),
            name="테호자",
            role=UserRole.CAREGIVER,
            phone_number="01087654321",
            auth_provider=AuthProvider.EMAIL,
            is_verified=True
        )
        db.add(user2)
        
        db.commit()
        
        print("✅ 테스트 사용자 생성 완료!")
        print("\n계정 1 (어르신):")
        print("  - 이메일: test1@test.com")
        print("  - 비밀번호: 12341234")
        print("  - 이름: 테르신")
        print("  - 역할: 어르신")
        
        print("\n계정 2 (보호자):")
        print("  - 이메일: test2@test.com")
        print("  - 비밀번호: 12341234")
        print("  - 이름: 테호자")
        print("  - 역할: 보호자")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 오류 발생: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_users()

