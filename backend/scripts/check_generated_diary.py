"""
생성된 일기 내용 확인
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.diary import Diary

if __name__ == "__main__":
    diary_id = "bbc7d4da-2687-4d44-9a26-3dd7f7b03e0f"
    
    db = SessionLocal()
    try:
        diary = db.query(Diary).filter(Diary.diary_id == diary_id).first()
        
        if diary:
            print("=" * 60)
            print("생성된 일기 내용:")
            print("=" * 60)
            print(diary.content)
            print()
            print("=" * 60)
            print(f"작성자 유형: {diary.author_type}")
            print(f"자동 생성 여부: {diary.is_auto_generated}")
            print(f"날짜: {diary.date}")
            print(f"상태: {diary.status}")
            print("=" * 60)
        else:
            print("일기를 찾을 수 없습니다.")
    
    finally:
        db.close()

