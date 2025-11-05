"""
모든 시드 데이터 실행
"""
import sys
from pathlib import Path

# 프로젝트 루트를 파이썬 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from seed_users import seed_users
from seed_todos import seed_todos
from seed_connections import seed_connections
from seed_many_users import seed_many_users
from seed_diaries import seed_diaries
# 나중에 추가할 시드 스크립트들:
# from seed_calls import seed_calls

def seed_all():
    """모든 시드 데이터 생성"""
    print("🌱 시드 데이터 생성 시작...\n")
    
    # 1. 사용자 시드
    print("1️⃣ 사용자 데이터 생성")
    print("-" * 50)
    seed_users()
    
    # 2. 할일 시드
    print("\n2️⃣ 할일 데이터 생성")
    print("-" * 50)
    seed_todos()
    
    # 3. 연결 시드
    print("\n3️⃣ 연결 요청 데이터 생성")
    print("-" * 50)
    seed_connections()
    
    # 4. 다양한 사용자 시드
    print("\n4️⃣ 다양한 사용자 데이터 생성")
    print("-" * 50)
    seed_many_users()
    
    print("\n4️⃣ 일기 데이터 생성")
    print("-" * 50)
    seed_diaries()
    
    # print("\n4️⃣ 전화 데이터 생성")
    # print("-" * 50)
    # seed_calls()
    
    print("\n" + "=" * 50)
    print("✨ 모든 시드 데이터 생성 완료!")
    print("=" * 50)

if __name__ == "__main__":
    seed_all()

