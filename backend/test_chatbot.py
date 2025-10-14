"""
AI 챗봇 테스트 스크립트
간단하게 텍스트 기반으로 챗봇을 테스트할 수 있습니다.
"""

import requests
import json

# API 엔드포인트 설정
BASE_URL = "http://localhost:8000"
TEXT_CHATBOT_URL = f"{BASE_URL}/api/chatbot/text"

def test_text_chatbot():
    """텍스트 챗봇 테스트"""
    print("="*80)
    print("🤖 어르신 돌봄 AI 챗봇 테스트")
    print("="*80)
    print()
    
    # 사용자 ID
    user_id = "test_user_1"
    
    # 테스트 대화 목록
    test_messages = [
        "안녕하세요",
        "오늘 점심은 김치찌개 먹었어요",
        "아침 약은 깜빡하고 못 먹었네요",
        "요즘 무릎이 좀 아파요",
        "날씨가 좋아서 기분이 좋아요"
    ]
    
    for i, message in enumerate(test_messages, 1):
        print(f"\n📝 테스트 {i}/{len(test_messages)}")
        print(f"{'='*80}")
        print(f"👤 사용자: {message}")
        
        # API 호출
        response = requests.post(
            TEXT_CHATBOT_URL,
            data={
                "user_id": user_id,
                "message": message,
                "analyze_emotion": True  # 감정 분석 활성화
            }
        )
        
        if response.status_code == 200:
            result = response.json()
            
            if result.get("success"):
                print(f"🤖 AI 응답: {result['ai_response']}")
                print()
                
                # 감정 분석 결과 출력
                if result.get("emotion_analysis"):
                    emotion = result["emotion_analysis"]
                    print(f"😊 감정 분석:")
                    print(f"   - 감정 상태: {emotion.get('emotion', 'N/A')}")
                    print(f"   - 긴급도: {emotion.get('urgency', 'N/A')}")
                    print(f"   - 주요 키워드: {', '.join(emotion.get('keywords', []))}")
                    print(f"   - 요약: {emotion.get('summary', 'N/A')}")
                    print()
                
                # 실행 시간 출력
                timing = result["timing"]
                print(f"⏱️  실행 시간:")
                print(f"   - 감정 분석: {timing['emotion_analysis_time']:.2f}초")
                print(f"   - LLM 응답: {timing['llm_time']:.2f}초")
                print(f"   ⭐ 총 시간: {timing['total_time']:.2f}초")
                print()
                print(f"💬 총 대화 횟수: {result['conversation_count']}회")
            else:
                print(f"❌ 오류: {result.get('error', 'Unknown error')}")
        else:
            print(f"❌ HTTP 오류: {response.status_code}")
            print(response.text)
        
        print(f"{'='*80}")
        
        # 다음 대화를 위한 간격
        if i < len(test_messages):
            input("\n[Enter 키를 눌러 다음 대화 진행...]")
    
    print("\n✅ 모든 테스트 완료!")


def test_conversation_history():
    """대화 기록 조회 테스트"""
    user_id = "test_user_1"
    url = f"{BASE_URL}/api/chatbot/session/{user_id}"
    
    print(f"\n📚 대화 기록 조회 중...")
    response = requests.get(url)
    
    if response.status_code == 200:
        result = response.json()
        print(f"\n👤 사용자: {result['user_id']}")
        print(f"💬 대화 횟수: {result['conversation_count']}회")
        print(f"\n대화 내용:")
        for msg in result['messages']:
            role = "👤 사용자" if msg['role'] == 'user' else "🤖 AI"
            print(f"{role}: {msg['content']}")
    else:
        print(f"❌ 오류: {response.status_code}")


if __name__ == "__main__":
    try:
        # 서버 연결 확인
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ 서버 연결 성공!")
            print()
            
            # 챗봇 테스트 실행
            test_text_chatbot()
            
            # 대화 기록 조회
            test_conversation_history()
        else:
            print("❌ 서버 연결 실패. 서버가 실행 중인지 확인하세요.")
            print(f"URL: {BASE_URL}")
    except requests.exceptions.ConnectionError:
        print("❌ 서버에 연결할 수 없습니다.")
        print(f"다음 명령으로 서버를 시작하세요:")
        print(f"  cd backend")
        print(f"  uvicorn app.main:app --reload")
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

