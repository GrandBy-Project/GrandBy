"""
생성된 일기를 확인하는 스크립트
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal
from app.models.diary import Diary

if __name__ == "__main__":
    diary_id = "7b3f8fdc-7dde-4eb2-8e77-111f0f5e63b2"
    
    db = SessionLocal()
    try:
        diary = db.query(Diary).filter(Diary.diary_id == diary_id).first()
        
        if diary:
            print("=" * 60)
            print("일기 내용:")
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

