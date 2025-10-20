"""
일기의 소유자 확인
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.diary import Diary
from app.models.user import User

if __name__ == "__main__":
    diary_id = "7b3f8fdc-7dde-4eb2-8e77-111f0f5e63b2"
    
    db = SessionLocal()
    try:
        # 일기 조회
        diary = db.query(Diary).filter(Diary.diary_id == diary_id).first()
        
        if not diary:
            print("일기를 찾을 수 없습니다.")
            exit(1)
        
        print("=" * 60)
        print("일기 정보")
        print("=" * 60)
        print(f"Diary ID: {diary.diary_id}")
        print(f"User ID: {diary.user_id}")
        print(f"Author ID: {diary.author_id}")
        
        # 소유자 조회
        owner = db.query(User).filter(User.user_id == diary.user_id).first()
        if owner:
            print(f"Owner: {owner.name} ({owner.email})")
        
        # 테스트 사용자 조회
        test_user = db.query(User).filter(User.email == "elderly1@test.com").first()
        if test_user:
            print(f"\nTest User: {test_user.name} ({test_user.email})")
            print(f"Test User ID: {test_user.user_id}")
            
            if diary.user_id == test_user.user_id:
                print("\n✅ 일기 소유자와 테스트 사용자가 일치합니다!")
            else:
                print("\n❌ 일기 소유자와 테스트 사용자가 다릅니다!")
                print(f"   Diary User ID: {diary.user_id}")
                print(f"   Test User ID: {test_user.user_id}")
    
    finally:
        db.close()

