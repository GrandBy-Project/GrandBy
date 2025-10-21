"""통화 내용이 있는 통화 찾기"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.call import CallLog, CallTranscript
from sqlalchemy import desc

db = SessionLocal()

calls = db.query(CallLog).order_by(desc(CallLog.call_start_time)).limit(10).all()

print(f"총 {len(calls)}개 통화 확인")
print("=" * 80)

for call in calls:
    transcript_count = db.query(CallTranscript).filter(
        CallTranscript.call_id == call.call_id
    ).count()
    
    if transcript_count > 0:
        transcripts = db.query(CallTranscript).filter(
            CallTranscript.call_id == call.call_id
        ).limit(3).all()
        
        print(f"\n📞 {call.call_id}")
        print(f"   - 발화 수: {transcript_count}개")
        print(f"   - 시작: {call.call_start_time}")
        print(f"   - 샘플:")
        for t in transcripts:
            print(f"      {t.speaker}: {t.text[:50]}")

db.close()

