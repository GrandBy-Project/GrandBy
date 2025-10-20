"""
감지된 TODO API 엔드포인트 테스트
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.diary import Diary
from app.models.call import CallLog
from app.services.diary.conversation_analyzer import ConversationAnalyzer
from app.services.diary.todo_extractor import TodoExtractor

if __name__ == "__main__":
    diary_id = "7b3f8fdc-7dde-4eb2-8e77-111f0f5e63b2"
    
    db = SessionLocal()
    try:
        # 1. 일기 조회
        diary = db.query(Diary).filter(Diary.diary_id == diary_id).first()
        
        if not diary:
            print("일기를 찾을 수 없습니다.")
            exit(1)
        
        print(f"일기 ID: {diary.diary_id}")
        print(f"Call ID: {diary.call_id}")
        print(f"자동 생성 여부: {diary.is_auto_generated}")
        print()
        
        if not diary.is_auto_generated:
            print("자동 생성된 일기가 아닙니다.")
            exit(1)
        
        if not diary.call_id:
            print("연결된 통화가 없습니다.")
            exit(1)
        
        # 2. 통화 내용 분석
        print("=" * 60)
        print("통화 내용 분석 중...")
        print("=" * 60)
        
        analyzer = ConversationAnalyzer()
        structured_data = analyzer.analyze_conversation(diary.call_id, db)
        
        print(f"\n분석 결과:")
        print(f"- 활동: {len(structured_data.get('activities', []))}개")
        print(f"- 건강: {len(structured_data.get('health', []))}개")
        print(f"- 감정: {len(structured_data.get('emotions', []))}개")
        print(f"- 향후 일정: {len(structured_data.get('future_plans', []))}개")
        
        # 3. TODO 추출
        print()
        print("=" * 60)
        print("TODO 추출 중...")
        print("=" * 60)
        
        call = db.query(CallLog).filter(CallLog.call_id == diary.call_id).first()
        
        todo_extractor = TodoExtractor()
        suggested_todos = todo_extractor.extract_and_create_todos(
            structured_data=structured_data,
            elderly=diary.user,
            creator=diary.user,
            db=db
        )
        
        print(f"\n감지된 TODO: {len(suggested_todos)}개")
        print()
        
        if suggested_todos:
            for i, todo in enumerate(suggested_todos):
                print(f"{i}. {todo['title']}")
                print(f"   - 날짜: {todo['due_date']}")
                print(f"   - 우선순위: {todo['priority']}")
                print(f"   - 설명: {todo['description']}")
                print()
        
        # 4. API 응답 형식으로 출력
        print("=" * 60)
        print("API 응답 형식:")
        print("=" * 60)
        
        api_response = {
            "diary_id": diary.diary_id,
            "diary_date": diary.date.isoformat(),
            "suggested_todos": suggested_todos
        }
        
        import json
        print(json.dumps(api_response, ensure_ascii=False, indent=2))
    
    finally:
        db.close()

