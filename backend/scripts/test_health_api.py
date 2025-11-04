"""
건강 데이터 API 테스트 스크립트
백엔드 API가 제대로 동작하는지 확인
"""

import requests
import json
from datetime import date, timedelta

BASE_URL = "http://localhost:8000"

def test_health_api():
    """건강 데이터 API 테스트"""
    
    print("=" * 60)
    print("🧪 건강 데이터 API 테스트 시작")
    print("=" * 60)
    
    # 1. 로그인 (테스트 계정 필요)
    print("\n1️⃣ 로그인 테스트")
    print("-" * 60)
    
    # 테스트 계정 정보 (어르신 계정 사용)
    login_data = {
        "email": "elderly1@test.com",  # 김영희
        "password": "1234"
    }
    
    try:
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        if login_response.status_code != 200:
            print(f"❌ 로그인 실패: {login_response.status_code}")
            print(f"   응답: {login_response.text}")
            print("\n⚠️  테스트 계정이 없거나 비밀번호가 다를 수 있습니다.")
            print("   시드 데이터를 확인하거나 새 계정을 만들어주세요.")
            return
        
        tokens = login_response.json()
        access_token = tokens.get("access_token")
        print(f"✅ 로그인 성공")
        print(f"   Access Token: {access_token[:20]}...")
        
    except Exception as e:
        print(f"❌ 로그인 중 오류: {e}")
        return
    
    # 헤더 설정
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    # 2. 건강 데이터 생성
    print("\n2️⃣ 건강 데이터 생성 테스트")
    print("-" * 60)
    
    health_data = {
        "step_count": 5000,
        "distance": 3500.5  # 미터
    }
    
    try:
        create_response = requests.post(
            f"{BASE_URL}/api/health/",
            json=health_data,
            headers=headers
        )
        
        if create_response.status_code == 201:
            result = create_response.json()
            print(f"✅ 건강 데이터 생성 성공")
            print(f"   Health ID: {result.get('health_id')}")
            print(f"   걸음 수: {result.get('step_count')}걸음")
            print(f"   거리: {result.get('distance')}m")
            print(f"   날짜: {result.get('date')}")
        else:
            print(f"❌ 생성 실패: {create_response.status_code}")
            print(f"   응답: {create_response.text}")
            
    except Exception as e:
        print(f"❌ 생성 중 오류: {e}")
    
    # 3. 오늘의 건강 데이터 조회
    print("\n3️⃣ 오늘의 건강 데이터 조회 테스트")
    print("-" * 60)
    
    try:
        today_response = requests.get(
            f"{BASE_URL}/api/health/today",
            headers=headers
        )
        
        if today_response.status_code == 200:
            result = today_response.json()
            if result:
                print(f"✅ 오늘의 건강 데이터 조회 성공")
                print(f"   걸음 수: {result.get('step_count')}걸음")
                print(f"   거리: {result.get('distance')}m")
            else:
                print(f"⚠️  오늘의 건강 데이터가 없습니다 (정상)")
        else:
            print(f"❌ 조회 실패: {today_response.status_code}")
            print(f"   응답: {today_response.text}")
            
    except Exception as e:
        print(f"❌ 조회 중 오류: {e}")
    
    # 4. 특정 날짜 건강 데이터 조회
    print("\n4️⃣ 특정 날짜 건강 데이터 조회 테스트")
    print("-" * 60)
    
    target_date = date.today().isoformat()
    
    try:
        date_response = requests.get(
            f"{BASE_URL}/api/health/",
            params={"target_date": target_date},
            headers=headers
        )
        
        if date_response.status_code == 200:
            result = date_response.json()
            if result:
                print(f"✅ 특정 날짜 건강 데이터 조회 성공")
                print(f"   날짜: {result.get('date')}")
                print(f"   걸음 수: {result.get('step_count')}걸음")
                print(f"   거리: {result.get('distance')}m")
            else:
                print(f"⚠️  해당 날짜의 건강 데이터가 없습니다")
        else:
            print(f"❌ 조회 실패: {date_response.status_code}")
            print(f"   응답: {date_response.text}")
            
    except Exception as e:
        print(f"❌ 조회 중 오류: {e}")
    
    # 5. 기간별 건강 데이터 조회 (통계)
    print("\n5️⃣ 기간별 건강 데이터 통계 조회 테스트")
    print("-" * 60)
    
    start_date = (date.today() - timedelta(days=7)).isoformat()
    end_date = date.today().isoformat()
    
    try:
        range_response = requests.get(
            f"{BASE_URL}/api/health/range",
            params={
                "start_date": start_date,
                "end_date": end_date
            },
            headers=headers
        )
        
        if range_response.status_code == 200:
            result = range_response.json()
            print(f"✅ 기간별 건강 데이터 통계 조회 성공")
            print(f"   기간: {result.get('start_date')} ~ {result.get('end_date')}")
            print(f"   총 걸음 수: {result.get('total_steps')}걸음")
            print(f"   총 거리: {result.get('total_distance')}m")
            print(f"   평균 걸음 수: {result.get('average_steps')}걸음/일")
            print(f"   평균 거리: {result.get('average_distance')}m/일")
            print(f"   일별 데이터 수: {len(result.get('daily_data', []))}일")
        else:
            print(f"❌ 조회 실패: {range_response.status_code}")
            print(f"   응답: {range_response.text}")
            
    except Exception as e:
        print(f"❌ 조회 중 오류: {e}")
    
    # 6. 건강 데이터 업데이트
    print("\n6️⃣ 건강 데이터 업데이트 테스트")
    print("-" * 60)
    
    update_data = {
        "step_count": 8000,
        "distance": 5500.0
    }
    
    try:
        update_response = requests.put(
            f"{BASE_URL}/api/health/",
            json=update_data,
            headers=headers
        )
        
        if update_response.status_code == 200:
            result = update_response.json()
            print(f"✅ 건강 데이터 업데이트 성공")
            print(f"   걸음 수: {result.get('step_count')}걸음 (업데이트됨)")
            print(f"   거리: {result.get('distance')}m (업데이트됨)")
        else:
            print(f"❌ 업데이트 실패: {update_response.status_code}")
            print(f"   응답: {update_response.text}")
            
    except Exception as e:
        print(f"❌ 업데이트 중 오류: {e}")
    
    print("\n" + "=" * 60)
    print("✅ 건강 데이터 API 테스트 완료")
    print("=" * 60)
    print("\n💡 Swagger UI에서도 테스트할 수 있습니다:")
    print(f"   http://localhost:8000/docs")
    print(f"   → /api/health 태그 확인")


if __name__ == "__main__":
    test_health_api()

