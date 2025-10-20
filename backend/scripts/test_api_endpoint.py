"""
실제 API 엔드포인트 테스트
"""
import requests
import json

BASE_URL = "http://localhost:8000"
DIARY_ID = "7b3f8fdc-7dde-4eb2-8e77-111f0f5e63b2"

# 임시로 사용자 토큰 생성 (실제로는 로그인 필요)
# 테스트를 위해 직접 DB에서 사용자 정보를 가져와서 토큰 생성
def get_test_token():
    """테스트용 토큰 생성"""
    from app.database import SessionLocal
    from app.models.user import User
    from app.routers.auth import create_access_token
    
    db = SessionLocal()
    try:
        # 어르신 사용자 조회 (일기 소유자)
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
    print("API 엔드포인트 테스트")
    print("=" * 60)
    
    # 1. 토큰 생성
    print("\n1. 테스트 토큰 생성 중...")
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    
    token = get_test_token()
    if not token:
        print("토큰 생성 실패")
        exit(1)
    
    print(f"   Token: {token[:50]}...")
    
    headers = {
        "Authorization": f"Bearer {token}"
    }
    
    # 2. GET /api/diaries/{diary_id}/suggested-todos
    print(f"\n2. GET /api/diaries/{DIARY_ID}/suggested-todos")
    
    try:
        response = requests.get(
            f"{BASE_URL}/api/diaries/{DIARY_ID}/suggested-todos",
            headers=headers
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Diary ID: {data['diary_id']}")
            print(f"   Diary Date: {data['diary_date']}")
            print(f"   Suggested TODOs: {len(data['suggested_todos'])}개")
            
            if data['suggested_todos']:
                print("\n   감지된 TODO:")
                for i, todo in enumerate(data['suggested_todos']):
                    print(f"     {i}. {todo['title']} (기한: {todo['due_date']}, 우선순위: {todo['priority']})")
        else:
            print(f"   Error: {response.text}")
    
    except Exception as e:
        print(f"   Error: {e}")
    
    # 3. POST /api/diaries/{diary_id}/accept-todos
    print(f"\n3. POST /api/diaries/{DIARY_ID}/accept-todos")
    print("   선택한 TODO: [0, 1] (처음 2개)")
    
    try:
        response = requests.post(
            f"{BASE_URL}/api/diaries/{DIARY_ID}/accept-todos",
            headers=headers,
            json=[0, 1]  # 처음 2개 TODO 선택
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   Success: {data['success']}")
            print(f"   Created TODOs: {data['created_todos_count']}개")
            
            if data['created_todos']:
                print("\n   생성된 TODO:")
                for todo in data['created_todos']:
                    print(f"     - {todo['title']} (ID: {todo['todo_id']})")
        else:
            print(f"   Error: {response.text}")
    
    except Exception as e:
        print(f"   Error: {e}")
    
    print("\n" + "=" * 60)
    print("테스트 완료")
    print("=" * 60)

