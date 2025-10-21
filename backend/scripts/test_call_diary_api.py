"""
통화 ID로 일기 조회 테스트
"""
import requests
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.user import User
from app.routers.auth import create_access_token

BASE_URL = "http://localhost:8000"
CALL_ID = "CA0b3a772af06381c69587da74c4dd61f5"

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
    print("통화 ID로 일기 조회 테스트")
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
    
    # 2. GET /api/diaries/by-call/{call_id}
    print(f"\n2. GET /api/diaries/by-call/{CALL_ID}")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/diaries/by-call/{CALL_ID}",
            headers=headers
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Diary ID: {data['diary_id']}")
            print(f"   Author Type: {data['author_type']}")
            print(f"   Auto Generated: {data['is_auto_generated']}")
            print(f"   Content Length: {len(data['content'])}자")
            print(f"\n   일기 내용 미리보기:")
            print(f"   {data['content'][:100]}...")
        else:
            print(f"   Error: {response.text}")
    
    except Exception as e:
        print(f"   Error: {e}")
    
    # 3. 해당 일기의 TODO 조회
    if response.status_code == 200:
        diary_id = response.json()['diary_id']
        print(f"\n3. GET /api/diaries/{diary_id}/suggested-todos")
        
        try:
            response = requests.get(
                f"{BASE_URL}/api/diaries/{diary_id}/suggested-todos",
                headers=headers
            )
            
            print(f"   Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Suggested TODOs: {len(data['suggested_todos'])}개")
                
                if data['suggested_todos']:
                    print("\n   감지된 TODO:")
                    for i, todo in enumerate(data['suggested_todos']):
                        print(f"     {i}. {todo['title']} (기한: {todo['due_date']}, 우선순위: {todo['priority']})")
            else:
                print(f"   Error: {response.text}")
        
        except Exception as e:
            print(f"   Error: {e}")
    
    print("\n" + "=" * 60)
    print("테스트 완료")
    print("=" * 60)

