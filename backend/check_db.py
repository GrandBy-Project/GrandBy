# -*- coding: utf-8 -*-
"""
DB 상태 확인 스크립트 (간단 버전)
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.call import CallLog, CallTranscript
from app.models.diary import Diary
from sqlalchemy import desc

db = SessionLocal()

print("="* 80)
print("DB 상태 확인")
print("="* 80)

# 최근 통화
print("\n[1] 최근 통화:")
calls = db.query(CallLog).order_by(desc(CallLog.created_at)).limit(3).all()
for call in calls:
    print(f"\nCall ID: {call.call_id}")
    print(f"  Status: {call.call_status}")
    print(f"  Created: {call.created_at}")
    
    # Transcript 개수
    t_count = db.query(CallTranscript).filter(CallTranscript.call_id == call.call_id).count()
    print(f"  Transcripts: {t_count}개")
    
    # 연결된 일기
    diary = db.query(Diary).filter(Diary.call_id == call.call_id).first()
    if diary:
        print(f"  [OK] 일기 있음: {diary.diary_id}")
    else:
        print(f"  [PROBLEM] 일기 없음!")

# 최근 일기
print("\n\n[2] 최근 일기:")
diaries = db.query(Diary).order_by(desc(Diary.created_at)).limit(3).all()
for diary in diaries:
    print(f"\nDiary ID: {diary.diary_id}")
    print(f"  Call ID: {diary.call_id}")
    print(f"  AI생성: {diary.is_auto_generated}")
    print(f"  Created: {diary.created_at}")
    print(f"  내용: {diary.content[:100]}...")

print("\n" + "="*80)
print("완료")

db.close()

