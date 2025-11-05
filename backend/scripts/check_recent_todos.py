"""
최근 생성된 할일 확인 스크립트
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.todo import Todo
from datetime import date, datetime, timedelta
from sqlalchemy import desc

def check_recent_todos():
    """최근 생성된 할일 확인"""
    db = SessionLocal()
    try:
        # 오늘 날짜
        today = date.today()
        
        # 최근 3일간 생성된 할일 조회
        recent_todos = db.query(Todo).filter(
            Todo.created_at >= datetime.combine(today - timedelta(days=3), datetime.min.time())
        ).order_by(desc(Todo.created_at)).limit(20).all()
        
        print(f"\n{'='*80}")
        print(f"최근 3일간 생성된 할일 ({len(recent_todos)}개)")
        print(f"{'='*80}\n")
        
        if not recent_todos:
            print("❌ 최근 생성된 할일이 없습니다.\n")
            return
        
        for todo in recent_todos:
            print(f"📝 TODO ID: {todo.todo_id}")
            print(f"   제목: {todo.title}")
            print(f"   어르신 ID: {todo.elderly_id}")
            print(f"   생성자 ID: {todo.creator_id}")
            print(f"   생성자 타입: {todo.creator_type}")
            print(f"   날짜: {todo.due_date}")
            print(f"   시간: {todo.due_time}")
            print(f"   상태: {todo.status}")
            print(f"   is_recurring: {todo.is_recurring} (타입: {type(todo.is_recurring)})")
            print(f"   is_shared_with_caregiver: {todo.is_shared_with_caregiver}")
            print(f"   생성일: {todo.created_at}")
            print(f"   -" * 40)
        
        # 오늘 날짜의 할일 조회
        today_todos = db.query(Todo).filter(
            Todo.due_date == today
        ).all()
        
        print(f"\n{'='*80}")
        print(f"오늘 날짜({today})의 할일 ({len(today_todos)}개)")
        print(f"{'='*80}\n")
        
        if not today_todos:
            print("❌ 오늘 날짜의 할일이 없습니다.\n")
        else:
            for todo in today_todos:
                print(f"📝 {todo.title}")
                print(f"   어르신 ID: {todo.elderly_id}")
                print(f"   is_recurring: {todo.is_recurring}")
                print(f"   -" * 40)
        
        # 특정 어르신의 오늘 할일 조회 (테스트용)
        # 테르신 계정 찾기
        from app.models.user import User, UserRole
        elderly = db.query(User).filter(
            User.role == UserRole.ELDERLY
        ).first()
        
        if elderly:
            print(f"\n{'='*80}")
            print(f"어르신 '{elderly.name}' ({elderly.user_id})의 오늘 할일")
            print(f"{'='*80}\n")
            
            elderly_todos = db.query(Todo).filter(
                Todo.elderly_id == elderly.user_id,
                Todo.due_date == today
            ).all()
            
            print(f"총 {len(elderly_todos)}개")
            for todo in elderly_todos:
                print(f"  - {todo.title} (is_recurring={todo.is_recurring}, status={todo.status})")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    check_recent_todos()







