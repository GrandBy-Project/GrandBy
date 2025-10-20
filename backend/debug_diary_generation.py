"""
일기 생성 디버깅 스크립트
현재 DB 상태와 문제를 파악합니다
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.call import CallLog, CallTranscript
from app.models.diary import Diary
from app.models.user import User
from datetime import datetime, timedelta
from sqlalchemy import desc

def main():
    db = SessionLocal()
    
    print("=" * 80)
    print("[DEBUG] 일기 생성 시스템 디버깅")
    print("=" * 80)
    
    # 1. 최근 통화 기록 확인
    print("\n[1] 최근 통화 기록 (최근 5개):")
    print("-" * 80)
    recent_calls = db.query(CallLog).order_by(desc(CallLog.created_at)).limit(5).all()
    
    if not recent_calls:
        print("[ERROR] 통화 기록이 없습니다!")
        return
    
    for i, call in enumerate(recent_calls, 1):
        print(f"\n{i}. Call ID: {call.call_id}")
        print(f"   Status: {call.call_status}")
        print(f"   Elderly ID: {call.elderly_id}")
        print(f"   Created: {call.created_at}")
        print(f"   Duration: {call.call_duration}초" if call.call_duration else "   Duration: N/A")
        
        # 대화 내용 확인
        transcripts = db.query(CallTranscript).filter(
            CallTranscript.call_id == call.call_id
        ).all()
        print(f"   📝 Transcripts: {len(transcripts)}개")
        
        if transcripts:
            print(f"   대화 샘플:")
            for t in transcripts[:3]:
                print(f"      [{t.speaker}] {t.text[:50]}...")
        
        # 연관된 일기 확인
        diary = db.query(Diary).filter(Diary.call_id == call.call_id).first()
        if diary:
            print(f"   ✅ 연결된 일기 있음: {diary.diary_id}")
            print(f"      내용 미리보기: {diary.content[:100]}...")
        else:
            print(f"   ❌ 연결된 일기 없음")
    
    # 2. 최근 일기 확인
    print("\n\n📔 최근 일기 (최근 5개):")
    print("-" * 80)
    recent_diaries = db.query(Diary).order_by(desc(Diary.created_at)).limit(5).all()
    
    if not recent_diaries:
        print("❌ 일기가 없습니다!")
    else:
        for i, diary in enumerate(recent_diaries, 1):
            print(f"\n{i}. Diary ID: {diary.diary_id}")
            print(f"   User ID: {diary.user_id}")
            print(f"   Author Type: {diary.author_type}")
            print(f"   AI 생성: {diary.is_auto_generated}")
            print(f"   Call ID: {diary.call_id}")
            print(f"   Date: {diary.date}")
            print(f"   Created: {diary.created_at}")
            print(f"   내용 ({len(diary.content)}자):")
            print(f"   {diary.content[:200]}...")
    
    # 3. 문제 진단
    print("\n\n🔍 문제 진단:")
    print("-" * 80)
    
    # 가장 최근 통화
    latest_call = recent_calls[0] if recent_calls else None
    
    if latest_call:
        print(f"\n✅ 가장 최근 통화: {latest_call.call_id}")
        
        # Transcript 확인
        transcripts_count = db.query(CallTranscript).filter(
            CallTranscript.call_id == latest_call.call_id
        ).count()
        
        if transcripts_count == 0:
            print("❌ 문제: 통화 내용(Transcript)이 저장되지 않았습니다!")
            print("   → 통화가 제대로 진행되었는지 확인하세요")
        else:
            print(f"✅ Transcript 저장됨: {transcripts_count}개")
        
        # Diary 확인
        diary = db.query(Diary).filter(Diary.call_id == latest_call.call_id).first()
        
        if not diary:
            print("❌ 문제: 일기가 생성되지 않았습니다!")
            print("\n가능한 원인:")
            print("1. Celery Worker가 실행되지 않았습니다")
            print("   → 실행: celery -A app.tasks.celery_app worker --loglevel=info")
            print("2. 일기 생성 태스크가 실패했습니다")
            print("   → Celery 로그 확인")
            print("3. 통화 내용이 너무 짧습니다")
            print(f"   → 현재 Transcript: {transcripts_count}개")
            
            # 수동 테스트 제안
            print("\n🧪 수동 테스트:")
            print(f"   python -c \"from app.tasks.diary_generator import generate_diary_from_call; generate_diary_from_call('{latest_call.call_id}')\"")
        else:
            print(f"✅ 일기 생성됨: {diary.diary_id}")
    
    # 4. Celery 상태 확인 방법 안내
    print("\n\n📋 Celery Worker 확인 방법:")
    print("-" * 80)
    print("1. Celery Worker 실행:")
    print("   cd backend")
    print("   celery -A app.tasks.celery_app worker --loglevel=info")
    print()
    print("2. Celery 상태 확인:")
    print("   celery -A app.tasks.celery_app inspect active")
    print()
    print("3. 수동으로 일기 생성 테스트:")
    if latest_call:
        print(f"   python -c \"from app.tasks.diary_generator import generate_diary_from_call; generate_diary_from_call('{latest_call.call_id}')\"")
    
    print("\n" + "=" * 80)
    
    db.close()

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

