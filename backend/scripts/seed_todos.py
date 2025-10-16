"""
테스트 할일 시드 데이터 생성
"""
import sys
from pathlib import Path
from datetime import date, time, datetime, timedelta

# 프로젝트 루트를 파이썬 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal
from app.models.user import User, UserRole
from app.models.todo import Todo, TodoStatus, CreatorType, TodoCategory


def seed_todos():
    """테스트 할일 생성"""
    db = SessionLocal()
    try:
        # 어르신과 보호자 찾기
        elderly = db.query(User).filter(User.role == UserRole.ELDERLY).first()
        caregiver = db.query(User).filter(User.role == UserRole.CAREGIVER).first()
        
        if not elderly or not caregiver:
            print("⚠️  사용자 데이터를 먼저 생성해주세요. (seed_users.py)")
            return
        
        # 기존 할일 확인
        existing = db.query(Todo).first()
        if existing:
            print("⚠️  할일 데이터가 이미 존재합니다. 건너뜁니다.")
            return
        
        # 오늘과 미래 날짜
        today = date.today()
        tomorrow = today + timedelta(days=1)
        next_week = today + timedelta(days=7)
        
        # 할일 목록
        todos = [
            # 보호자가 만든 할일
            Todo(
                elderly_id=elderly.user_id,
                creator_id=caregiver.user_id,
                title="혈압약 복용",
                description="아침 식사 후 혈압약을 복용하세요",
                category=TodoCategory.MEDICINE,
                due_date=today,
                due_time=time(9, 0),
                creator_type=CreatorType.CAREGIVER,
                status=TodoStatus.PENDING,
                is_confirmed=True
            ),
            Todo(
                elderly_id=elderly.user_id,
                creator_id=caregiver.user_id,
                title="산책하기",
                description="공원에서 30분 걷기",
                category=TodoCategory.EXERCISE,
                due_date=tomorrow,
                due_time=time(16, 0),
                creator_type=CreatorType.CAREGIVER,
                status=TodoStatus.PENDING,
                is_confirmed=True
            ),
            Todo(
                elderly_id=elderly.user_id,
                creator_id=caregiver.user_id,
                title="정형외과 진료",
                description="무릎 관절 정기 검진",
                category=TodoCategory.HOSPITAL,
                due_date=next_week,
                due_time=time(14, 0),
                creator_type=CreatorType.CAREGIVER,
                status=TodoStatus.PENDING,
                is_confirmed=True
            ),
        ]
        
        db.add_all(todos)
        db.commit()
        
        print("✅ 할일 데이터 생성 완료!")
        print(f"   총 {len(todos)}개의 할일이 생성되었습니다.")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 오류 발생: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_todos()

