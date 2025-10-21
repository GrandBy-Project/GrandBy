"""
priority 컬럼을 올바른 enum 타입으로 변경
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal
from sqlalchemy import text

if __name__ == "__main__":
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("Priority Enum 타입 수정")
        print("=" * 60)
        
        # 1. 기존 enum 타입 확인
        print("\n1. 기존 enum 타입 확인...")
        result = db.execute(text("SELECT typname FROM pg_type WHERE typname = 'todopriority'"))
        existing_enum = result.fetchone()
        
        if existing_enum:
            print(f"   ✅ todopriority enum 타입이 이미 존재합니다.")
            
            # enum 값들 확인
            result = db.execute(text("""
                SELECT e.enumlabel 
                FROM pg_enum e 
                JOIN pg_type t ON e.enumtypid = t.oid 
                WHERE t.typname = 'todopriority'
                ORDER BY e.enumsortorder
            """))
            enum_values = [row[0] for row in result.fetchall()]
            print(f"   Enum 값: {enum_values}")
        else:
            print("   ⚠️ todopriority enum 타입이 없습니다. 생성합니다...")
            
            # enum 타입 생성
            db.execute(text("CREATE TYPE todopriority AS ENUM ('high', 'medium', 'low')"))
            db.commit()
            print("   ✅ todopriority enum 타입 생성 완료")
        
        # 2. 현재 컬럼 타입 확인
        print("\n2. 현재 priority 컬럼 타입 확인...")
        result = db.execute(text("""
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'todos' AND column_name = 'priority'
        """))
        col_info = result.fetchone()
        
        if col_info:
            print(f"   Column: {col_info[0]}")
            print(f"   Data Type: {col_info[1]}")
            print(f"   UDT Name: {col_info[2]}")
            
            if col_info[2] != 'todopriority':
                print("\n3. 컬럼 타입을 enum으로 변경...")
                
                # 기존 데이터 업데이트 (대소문자 정리)
                db.execute(text("""
                    UPDATE todos 
                    SET priority = LOWER(priority)
                    WHERE priority IS NOT NULL
                """))
                db.commit()
                print("   ✅ 기존 데이터 정리 완료")
                
                # 기본값 제거
                db.execute(text("""
                    ALTER TABLE todos 
                    ALTER COLUMN priority DROP DEFAULT
                """))
                db.commit()
                print("   ✅ 기본값 제거 완료")
                
                # 컬럼 타입 변경
                db.execute(text("""
                    ALTER TABLE todos 
                    ALTER COLUMN priority TYPE todopriority 
                    USING priority::todopriority
                """))
                db.commit()
                print("   ✅ 컬럼 타입 변경 완료 (VARCHAR → todopriority enum)")
                
                # 기본값 다시 설정
                db.execute(text("""
                    ALTER TABLE todos 
                    ALTER COLUMN priority SET DEFAULT 'medium'::todopriority
                """))
                db.commit()
                print("   ✅ 기본값 재설정 완료")
            else:
                print("   ✅ 이미 enum 타입입니다!")
        else:
            print("   ❌ priority 컬럼을 찾을 수 없습니다.")
        
        # 4. 최종 확인
        print("\n4. 최종 확인...")
        result = db.execute(text("""
            SELECT column_name, data_type, udt_name, column_default
            FROM information_schema.columns 
            WHERE table_name = 'todos' AND column_name = 'priority'
        """))
        col_info = result.fetchone()
        
        if col_info:
            print(f"   Column Name: {col_info[0]}")
            print(f"   Data Type: {col_info[1]}")
            print(f"   UDT Name: {col_info[2]}")
            print(f"   Default: {col_info[3]}")
        
        # 5. 기존 TODO의 priority 값 확인
        print("\n5. 기존 TODO의 priority 값 확인...")
        result = db.execute(text("SELECT priority, COUNT(*) FROM todos GROUP BY priority"))
        for row in result.fetchall():
            print(f"   {row[0]}: {row[1]}개")
        
        print("\n" + "=" * 60)
        print("✅ 모든 작업 완료!")
        print("=" * 60)
    
    except Exception as e:
        print(f"\n❌ 에러: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    
    finally:
        db.close()

