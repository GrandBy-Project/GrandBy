"""
특정 통화에 대해 일기 생성을 테스트하는 스크립트
"""
import sys
import os

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.tasks.diary_generator import generate_diary_from_call

if __name__ == "__main__":
    call_id = "CA0f2322a50afb67b68a0b8eb79bdcb0e6"
    
    print(f"========== 일기 생성 테스트 시작 ==========")
    print(f"Call ID: {call_id}")
    print(f"=" * 50)
    
    try:
        result = generate_diary_from_call(call_id)
        
        print(f"\n========== 결과 ==========")
        print(f"Success: {result.get('success')}")
        
        if result.get('success'):
            print(f"Diary ID: {result.get('diary_id')}")
            print(f"Diary Date: {result.get('diary_date')}")
            print(f"Diary Length: {result.get('diary_length')}")
            print(f"Suggested TODOs: {result.get('suggested_todos_count')}")
            
            if result.get('suggested_todos'):
                print(f"\n감지된 TODO 목록:")
                for i, todo in enumerate(result.get('suggested_todos', [])):
                    print(f"  {i+1}. {todo['title']}")
                    print(f"     - 날짜: {todo['due_date']}")
                    print(f"     - 설명: {todo['description']}")
        else:
            print(f"Error: {result.get('error')}")
    
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()

