"""
TODO 목록 API 테스트
"""
import requests
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.user import User
from app.routers.auth import create_access_token

BASE_URL = "http://localhost:8000"

def get_test_token():
    """테스트용 토큰 생성"""
    db = SessionLocal()
    try:
        # 어르신 사용자 조회
        user = db.query(User).filter(User.email == "yuko327@naver.com").first()
        if not user:
            print("테스트 사용자를 찾을 수 없습니다.")
            return None
        
        # 액세스 토큰 생성
        token = create_access_token(data={"sub": user.user_id})
        return token
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("TODO 목록 API 테스트")
    print("=" * 60)
    
    # 1. 토큰 생성
    print("\n1. 테스트 토큰 생성 중...")
    token = get_test_token()
    if not token:
        print("토큰 생성 실패")
        exit(1)
    
    print(f"   Token: {token[:50]}...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # 2. GET /api/todos/?date_filter=today
    print(f"\n2. GET /api/todos/?date_filter=today")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/todos/?date_filter=today",
            headers=headers
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   TODO 개수: {len(data)}개")
            
            if data:
                print("\n   첫 5개 TODO:")
                for todo in data[:5]:
                    print(f"     - {todo['title']}")
                    print(f"       우선순위: {todo.get('priority', 'N/A')}")
                    print(f"       상태: {todo['status']}")
                    print(f"       기한: {todo['due_date']}")
        else:
            print(f"   Error: {response.text}")
    
    except Exception as e:
        print(f"   Error: {e}")
    
    # 3. GET /api/todos/ (전체)
    print(f"\n3. GET /api/todos/ (전체)")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/todos/",
            headers=headers
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   전체 TODO 개수: {len(data)}개")
            
            # priority별 통계
            from collections import Counter
            priorities = Counter([todo.get('priority') for todo in data])
            print(f"\n   Priority 통계:")
            for priority, count in priorities.items():
                print(f"     {priority}: {count}개")
        else:
            print(f"   Error: {response.text}")
    
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n" + "=" * 60)
    print("테스트 완료")
    print("=" * 60)

