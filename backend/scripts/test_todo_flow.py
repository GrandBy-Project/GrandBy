"""
할일 생성 및 조회 플로우 테스트 스크립트
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.todo import Todo, TodoStatus, CreatorType
from app.models.user import User, UserRole
from app.services.todo.todo_service import TodoService
from app.schemas.todo import TodoCreate
from datetime import date, datetime, time
from sqlalchemy import and_

def test_todo_flow():
    """할일 생성 및 조회 테스트"""
    db = SessionLocal()
    try:
        # 어르신과 보호자 찾기
        elderly = db.query(User).filter(User.role == UserRole.ELDERLY).first()
        caregiver = db.query(User).filter(User.role == UserRole.CAREGIVER).first()
        
        if not elderly or not caregiver:
            print("❌ 어르신 또는 보호자를 찾을 수 없습니다.")
            return
        
        print(f"\n{'='*80}")
        print(f"테스트 대상:")
        print(f"  - 어르신: {elderly.name} ({elderly.user_id})")
        print(f"  - 보호자: {caregiver.name} ({caregiver.user_id})")
        print(f"{'='*80}\n")
        
        # 오늘 날짜
        today = date.today()
        
        # 1. 기존 할일 확인
        print(f"1️⃣ 기존 할일 확인 (오늘 날짜: {today})")
        existing_todos = db.query(Todo).filter(
            and_(
                Todo.elderly_id == elderly.user_id,
                Todo.due_date == today
            )
        ).all()
        print(f"   - 기존 할일 개수: {len(existing_todos)}개")
        for todo in existing_todos:
            print(f"      - {todo.title} (is_recurring={todo.is_recurring}, is_shared={todo.is_shared_with_caregiver})")
        
        # 2. 새 할일 생성
        print(f"\n2️⃣ 새 할일 생성")
        new_todo_data = TodoCreate(
            elderly_id=elderly.user_id,
            title="테스트 할일",
            description="테스트용 할일입니다",
            category="MEDICINE",
            due_date=today,
            due_time="10:00",
            is_shared_with_caregiver=True,
            is_recurring=False
        )
        
        created_todo = TodoService.create_todo(
            db=db,
            todo_data=new_todo_data,
            creator_id=caregiver.user_id
        )
        
        print(f"   ✅ 할일 생성 성공:")
        print(f"      - ID: {created_todo.todo_id}")
        print(f"      - 제목: {created_todo.title}")
        print(f"      - 어르신 ID: {created_todo.elderly_id}")
        print(f"      - 생성자 ID: {created_todo.creator_id}")
        print(f"      - 날짜: {created_todo.due_date}")
        print(f"      - 시간: {created_todo.due_time}")
        print(f"      - is_recurring: {created_todo.is_recurring} (타입: {type(created_todo.is_recurring)})")
        print(f"      - is_shared_with_caregiver: {created_todo.is_shared_with_caregiver}")
        
        # 3. DB에서 직접 조회
        print(f"\n3️⃣ DB에서 직접 조회")
        direct_query = db.query(Todo).filter(
            and_(
                Todo.elderly_id == elderly.user_id,
                Todo.due_date == today,
                Todo.todo_id == created_todo.todo_id
            )
        ).first()
        
        if direct_query:
            print(f"   ✅ DB에서 직접 조회 성공:")
            print(f"      - 제목: {direct_query.title}")
            print(f"      - is_recurring: {direct_query.is_recurring}")
            print(f"      - is_shared_with_caregiver: {direct_query.is_shared_with_caregiver}")
        else:
            print(f"   ❌ DB에서 직접 조회 실패!")
        
        # 4. get_todos_by_date로 조회 (어르신용)
        print(f"\n4️⃣ get_todos_by_date로 조회 (어르신용, shared_only=False)")
        todos_elderly = TodoService.get_todos_by_date(
            db=db,
            elderly_id=elderly.user_id,
            target_date=today,
            status_filter=None,
            shared_only=False
        )
        print(f"   - 조회 결과: {len(todos_elderly)}개")
        for todo in todos_elderly:
            print(f"      - {todo.title} (is_recurring={todo.is_recurring}, is_shared={todo.is_shared_with_caregiver})")
        
        # 5. get_todos_by_date로 조회 (보호자용, shared_only=True)
        print(f"\n5️⃣ get_todos_by_date로 조회 (보호자용, shared_only=True)")
        todos_caregiver_shared = TodoService.get_todos_by_date(
            db=db,
            elderly_id=elderly.user_id,
            target_date=today,
            status_filter=None,
            shared_only=True
        )
        print(f"   - 조회 결과: {len(todos_caregiver_shared)}개")
        for todo in todos_caregiver_shared:
            print(f"      - {todo.title} (is_recurring={todo.is_recurring}, is_shared={todo.is_shared_with_caregiver})")
        
        # 6. get_todos_by_date로 조회 (보호자용, shared_only=False)
        print(f"\n6️⃣ get_todos_by_date로 조회 (보호자용, shared_only=False)")
        todos_caregiver_all = TodoService.get_todos_by_date(
            db=db,
            elderly_id=elderly.user_id,
            target_date=today,
            status_filter=None,
            shared_only=False
        )
        print(f"   - 조회 결과: {len(todos_caregiver_all)}개")
        for todo in todos_caregiver_all:
            print(f"      - {todo.title} (is_recurring={todo.is_recurring}, is_shared={todo.is_shared_with_caregiver})")
        
        # 7. 생성한 테스트 할일 삭제
        print(f"\n7️⃣ 테스트 할일 삭제")
        db.query(Todo).filter(Todo.todo_id == created_todo.todo_id).delete()
        db.commit()
        print(f"   ✅ 삭제 완료")
        
        print(f"\n{'='*80}")
        print(f"테스트 완료!")
        print(f"{'='*80}\n")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    test_todo_flow()









