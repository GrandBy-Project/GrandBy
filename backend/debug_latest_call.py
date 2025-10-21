"""최근 통화의 전체 파이프라인 추적"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.call import CallLog, CallTranscript
from app.models.diary import Diary
from app.models.user import User
from sqlalchemy import desc
import json

db = SessionLocal()

try:
    print("=" * 80)
    print("DEBUG: 최근 통화 전체 파이프라인 추적")
    print("=" * 80)
    
    # 1. 가장 최근 통화 찾기
    recent_call = db.query(CallLog).order_by(desc(CallLog.call_start_time)).first()
    
    if not recent_call:
        print("ERROR: 통화 기록이 없습니다.")
        sys.exit(1)
    
    print(f"\n1. CALL LOG")
    print("-" * 80)
    print(f"Call ID: {recent_call.call_id}")
    print(f"Elderly ID: {recent_call.elderly_id}")
    print(f"시작 시간: {recent_call.call_start_time}")
    print(f"종료 시간: {recent_call.call_end_time}")
    print(f"통화 시간: {recent_call.call_duration}초")
    print(f"상태: {recent_call.call_status}")
    
    print(f"\nConversation Summary (간단 요약):")
    print("-" * 80)
    print(recent_call.conversation_summary)
    print("-" * 80)
    
    # 2. 통화 내용 (Transcript) 확인
    transcripts = db.query(CallTranscript).filter(
        CallTranscript.call_id == recent_call.call_id
    ).order_by(CallTranscript.timestamp).all()
    
    print(f"\n2. CALL TRANSCRIPT ({len(transcripts)}개 발화)")
    print("-" * 80)
    for i, t in enumerate(transcripts, 1):
        print(f"[{i}] [{int(t.timestamp)}초] {t.speaker}: {t.text}")
    print("-" * 80)
    
    # 대화에서 실제 언급된 키워드 추출
    print(f"\n실제 대화에서 어르신이 언급한 키워드:")
    elderly_words = []
    for t in transcripts:
        if t.speaker == "ELDERLY":
            elderly_words.extend(t.text.split())
    print(", ".join(set(elderly_words)))
    
    # 3. 어르신 정보
    elderly = db.query(User).filter(User.user_id == recent_call.elderly_id).first()
    print(f"\n3. USER INFO")
    print("-" * 80)
    print(f"이름: {elderly.name}")
    print(f"생년월일: {elderly.birth_date}")
    print(f"성별: {elderly.gender}")
    
    # 4. 생성된 일기 확인
    diaries = db.query(Diary).filter(
        Diary.call_id == recent_call.call_id
    ).all()
    
    print(f"\n4. GENERATED DIARY ({len(diaries)}개)")
    print("-" * 80)
    
    if not diaries:
        print("WARNING: 아직 일기가 생성되지 않았습니다.")
        print("Celery 태스크가 실행 중이거나 실패했을 수 있습니다.")
    else:
        for diary in diaries:
            print(f"\nDiary ID: {diary.diary_id}")
            print(f"Date: {diary.date}")
            print(f"Author Type: {diary.author_type}")
            print(f"Auto Generated: {diary.is_auto_generated}")
            print(f"Status: {diary.status}")
            print(f"길이: {len(diary.content)}자")
            print(f"\n내용:")
            print("-" * 80)
            print(diary.content)
            print("-" * 80)
    
    # 5. 할루시네이션 검사
    if diaries:
        print(f"\n5. HALLUCINATION CHECK")
        print("-" * 80)
        
        diary_content = diaries[0].content
        
        # 대화에서 언급된 단어들
        conversation_text = " ".join([t.text for t in transcripts])
        
        # 일반적인 할루시네이션 키워드
        hallucination_keywords = [
            "따뜻한", "햇살", "날씨가 좋아", "산책을 가고 싶었다",
            "좋더라", "고민해봐야겠다", "평온한", "기분 전환",
            "상쾌한", "선선해", "기분이 좋았다"
        ]
        
        found_hallucinations = []
        for keyword in hallucination_keywords:
            if keyword in diary_content and keyword not in conversation_text:
                found_hallucinations.append(keyword)
        
        if found_hallucinations:
            print("FOUND HALLUCINATIONS:")
            for h in found_hallucinations:
                print(f"  - '{h}' (대화에 없음)")
        else:
            print("No hallucinations detected.")
        
        # 실제 언급된 내용 확인
        print(f"\n실제 대화에 있는 키워드:")
        if "눈" in conversation_text:
            print("  - '눈' (날씨)")
        if "옷" in conversation_text:
            print("  - '옷' (쇼핑)")
        
    # 6. Celery 로그 확인 (파일이 있다면)
    print(f"\n6. CELERY TASK STATUS")
    print("-" * 80)
    print("Celery 로그를 확인하려면:")
    print(f"  docker logs grandby_worker --tail 100 | grep {recent_call.call_id}")
    
    print("\n" + "=" * 80)
    print("DEBUG 완료")
    print("=" * 80)
    
except Exception as e:
    print(f"\nERROR: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()

