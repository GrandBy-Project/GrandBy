"""
테스트용 다양한 사용자 시드 데이터 생성
"""
import sys
from pathlib import Path

# 프로젝트 루트를 파이썬 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.user import User, UserRole, AuthProvider
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def seed_many_users():
    """다양한 테스트 사용자 생성"""
    db = SessionLocal()
    try:
        # 어르신 목록 (10명)
        elderly_users = [
            {"email": "elderly1@test.com", "name": "김영희", "phone": "01011111111"},
            {"email": "elderly2@test.com", "name": "박철수", "phone": "01022222222"},
            {"email": "elderly3@test.com", "name": "이순자", "phone": "01033333333"},
            {"email": "elderly4@test.com", "name": "최영수", "phone": "01044444444"},
            {"email": "elderly5@test.com", "name": "정민호", "phone": "01055555555"},
            {"email": "elderly6@test.com", "name": "강미숙", "phone": "01066666666"},
            {"email": "elderly7@test.com", "name": "윤동진", "phone": "01077777777"},
            {"email": "elderly8@test.com", "name": "한명숙", "phone": "01088888888"},
            {"email": "elderly9@test.com", "name": "서정호", "phone": "01099999999"},
            {"email": "elderly10@test.com", "name": "임미자", "phone": "01000000000"},
        ]
        
        # 보호자 목록 (5명)
        caregiver_users = [
            {"email": "caregiver1@test.com", "name": "김지훈", "phone": "01012340001"},
            {"email": "caregiver2@test.com", "name": "이민정", "phone": "01012340002"},
            {"email": "caregiver3@test.com", "name": "박상현", "phone": "01012340003"},
            {"email": "caregiver4@test.com", "name": "최수연", "phone": "01012340004"},
            {"email": "caregiver5@test.com", "name": "정다은", "phone": "01012340005"},
        ]
        
        created_users = []
        
        # 어르신 생성
        for idx, user_data in enumerate(elderly_users, 1):
            # 중복 체크
            existing = db.query(User).filter(User.email == user_data["email"]).first()
            if existing:
                print(f"  ⏭️  {user_data['name']} (이미 존재)")
                continue
            
            user = User(
                email=user_data["email"],
                password_hash=pwd_context.hash("1234"),  # 간단한 비밀번호
                name=user_data["name"],
                role=UserRole.ELDERLY,
                phone_number=user_data["phone"],
                auth_provider=AuthProvider.EMAIL,
                is_verified=True,
                is_active=True
            )
            db.add(user)
            created_users.append(user)
            print(f"  ✅ 어르신 {idx}: {user_data['name']} ({user_data['email']})")
        
        # 보호자 생성
        for idx, user_data in enumerate(caregiver_users, 1):
            # 중복 체크
            existing = db.query(User).filter(User.email == user_data["email"]).first()
            if existing:
                print(f"  ⏭️  {user_data['name']} (이미 존재)")
                continue
            
            user = User(
                email=user_data["email"],
                password_hash=pwd_context.hash("1234"),  # 간단한 비밀번호
                name=user_data["name"],
                role=UserRole.CAREGIVER,
                phone_number=user_data["phone"],
                auth_provider=AuthProvider.EMAIL,
                is_verified=True,
                is_active=True
            )
            db.add(user)
            created_users.append(user)
            print(f"  ✅ 보호자 {idx}: {user_data['name']} ({user_data['email']})")
        
        db.commit()
        
        print("\n" + "=" * 60)
        print(f"✨ 총 {len(created_users)}명의 사용자가 생성되었습니다!")
        print("=" * 60)
        
        print("\n📝 테스트 계정 정보:")
        print("-" * 60)
        print("비밀번호: 1234 (모든 계정 공통)")
        print("\n어르신 계정:")
        for user in elderly_users:
            print(f"  • {user['email']:<25} - {user['name']}")
        print("\n보호자 계정:")
        for user in caregiver_users:
            print(f"  • {user['email']:<25} - {user['name']}")
        print("-" * 60)
        
    except Exception as e:
        db.rollback()
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    print("🌱 다양한 테스트 사용자 생성 중...\n")
    seed_many_users()

