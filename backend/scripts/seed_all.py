"""
모든 시드 데이터 실행
"""
import sys
from pathlib import Path

# 프로젝트 루트를 파이썬 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from seed_users import seed_users
# 나중에 추가할 시드 스크립트들:
# from seed_todos import seed_todos
# from seed_diaries import seed_diaries
# from seed_calls import seed_calls

def seed_all():
    """모든 시드 데이터 생성"""
    print("🌱 시드 데이터 생성 시작...\n")
    
    # 1. 사용자 시드
    print("1️⃣ 사용자 데이터 생성")
    print("-" * 50)
    seed_users()
    
    # 나중에 추가:
    # print("\n2️⃣ 할일 데이터 생성")
    # print("-" * 50)
    # seed_todos()
    
    # print("\n3️⃣ 일기 데이터 생성")
    # print("-" * 50)
    # seed_diaries()
    
    # print("\n4️⃣ 전화 데이터 생성")
    # print("-" * 50)
    # seed_calls()
    
    print("\n" + "=" * 50)
    print("✨ 모든 시드 데이터 생성 완료!")
    print("=" * 50)

if __name__ == "__main__":
    seed_all()

