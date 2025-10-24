"""
푸시 토큰이 포함된 테스트 사용자 시드 데이터 생성
"""
import sys
from pathlib import Path

# 프로젝트 루트를 파이썬 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.user import User, UserRole, AuthProvider
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_users_with_push_tokens():
    """푸시 토큰이 포함된 테스트 사용자 생성"""
    db = SessionLocal()
    try:
        # 기존 테스트 계정 확인
        existing = db.query(User).filter(
            User.email.in_(["test1@test.com", "test2@test.com"])
        ).first()
        
        if existing:
            print("⚠️  테스트 계정이 이미 존재합니다. 푸시 토큰만 업데이트합니다.")
            
            # test1@test.com 업데이트 (실제 디바이스)
            user1 = db.query(User).filter(User.email == "test1@test.com").first()
            if user1:
                user1.push_token = "ExponentPushToken[1X5NEvNNXOJFdCsT5tBSmS]"
                print(f"✅ {user1.email} 푸시 토큰 업데이트: {user1.push_token}")
            
            # test2@test.com 업데이트 (에뮬레이터)
            user2 = db.query(User).filter(User.email == "test2@test.com").first()
            if user2:
                user2.push_token = "ExponentPushToken[pmdee5BnuxedN63DUI7Wo6]"
                print(f"✅ {user2.email} 푸시 토큰 업데이트: {user2.push_token}")
            
            db.commit()
            return
        
        # 테스트 사용자 1: 어르신 (실제 디바이스)
        user1 = User(
            email="test1@test.com",
            password_hash=pwd_context.hash("1234"),
            name="테르신",
            role=UserRole.ELDERLY,
            phone_number="01012345678",
            auth_provider=AuthProvider.EMAIL,
            is_verified=True,
            push_token="ExponentPushToken[1X5NEvNNXOJFdCsT5tBSmS]"  # 실제 디바이스 토큰
        )
        db.add(user1)
        
        # 테스트 사용자 2: 보호자 (에뮬레이터)
        user2 = User(
            email="test2@test.com",
            password_hash=pwd_context.hash("1234"),
            name="테호자",
            role=UserRole.CAREGIVER,
            phone_number="01087654321",
            auth_provider=AuthProvider.EMAIL,
            is_verified=True,
            push_token="ExponentPushToken[pmdee5BnuxedN63DUI7Wo6]"  # 에뮬레이터 토큰
        )
        db.add(user2)
        
        db.commit()
        
        print("✅ 푸시 토큰이 포함된 테스트 사용자 생성 완료!")
        print("\n계정 1 (어르신 - 실제 디바이스):")
        print("  - 이메일: test1@test.com")
        print("  - 비밀번호: 1234")
        print("  - 이름: 테르신")
        print("  - 역할: 어르신")
        print(f"  - 푸시 토큰: {user1.push_token}")
        
        print("\n계정 2 (보호자 - 에뮬레이터):")
        print("  - 이메일: test2@test.com")
        print("  - 비밀번호: 1234")
        print("  - 이름: 테호자")
        print("  - 역할: 보호자")
        print(f"  - 푸시 토큰: {user2.push_token}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 오류 발생: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_users_with_push_tokens()
