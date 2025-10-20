"""
todos 테이블에 priority 컬럼 추가
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal
from sqlalchemy import text

if __name__ == "__main__":
    db = SessionLocal()
    
    try:
        # priority 컬럼 추가
        sql_text = """
        ALTER TABLE todos 
        ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'medium';
        """
        
        print("=" * 60)
        print("DB 스키마 업데이트")
        print("=" * 60)
        print(f"\nSQL: {sql_text.strip()}")
        
        db.execute(text(sql_text))
        db.commit()
        
        print("\n✅ priority 컬럼이 추가되었습니다!")
        
        # 확인
        result = db.execute(text("SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'todos' AND column_name = 'priority'"))
        row = result.fetchone()
        
        if row:
            print(f"\n확인:")
            print(f"  Column Name: {row[0]}")
            print(f"  Data Type: {row[1]}")
            print(f"  Default: {row[2]}")
        else:
            print("\n⚠️ priority 컬럼을 확인할 수 없습니다.")
    
    except Exception as e:
        print(f"\n❌ 에러: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    
    finally:
        db.close()

