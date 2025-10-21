"""특정 일기의 전체 파이프라인 추적"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.call import CallLog, CallTranscript
from app.models.diary import Diary

# 사용자가 언급한 일기
DIARY_ID = "d879c16a-f6a7-4d7b-b9d8-6423dcde4167"

db = SessionLocal()

try:
    print("=" * 80)
    print("DEBUG: 특정 일기 추적")
    print("=" * 80)
    
    # 1. 일기 조회
    diary = db.query(Diary).filter(Diary.diary_id == DIARY_ID).first()
    
    print(f"\n1. DIARY INFO")
    print("-" * 80)
    print(f"Diary ID: {diary.diary_id}")
    print(f"Date: {diary.date}")
    print(f"Call ID: {diary.call_id}")
    print(f"Author Type: {diary.author_type}")
    print(f"Auto Generated: {diary.is_auto_generated}")
    print(f"Created At: {diary.created_at}")
    print(f"길이: {len(diary.content)}자")
    
    print(f"\n생성된 일기 내용:")
    print("=" * 80)
    print(diary.content)
    print("=" * 80)
    
    # 2. 통화 기록 조회
    if not diary.call_id:
        print("\nERROR: Call ID가 없습니다. 수동으로 작성된 일기일 수 있습니다.")
        sys.exit(0)
    
    call = db.query(CallLog).filter(CallLog.call_id == diary.call_id).first()
    
    if not call:
        print(f"\nERROR: Call ID {diary.call_id}를 찾을 수 없습니다.")
        sys.exit(1)
    
    print(f"\n2. CALL INFO")
    print("-" * 80)
    print(f"Call ID: {call.call_id}")
    print(f"시작 시간: {call.call_start_time}")
    print(f"종료 시간: {call.call_end_time}")
    print(f"통화 시간: {call.call_duration}초")
    
    # 3. 실제 대화 내용
    transcripts = db.query(CallTranscript).filter(
        CallTranscript.call_id == call.call_id
    ).order_by(CallTranscript.timestamp).all()
    
    print(f"\n3. ACTUAL CONVERSATION ({len(transcripts)}개 발화)")
    print("=" * 80)
    
    if not transcripts:
        print("WARNING: 대화 내용이 없습니다!")
    else:
        for i, t in enumerate(transcripts, 1):
            print(f"[{i}] [{int(t.timestamp)}초] {t.speaker}: {t.text}")
    
    print("=" * 80)
    
    # 4. 실제 대화에서 언급된 키워드 추출
    if transcripts:
        print(f"\n4. KEYWORD ANALYSIS")
        print("-" * 80)
        
        conversation_text = " ".join([t.text for t in transcripts if t.speaker == "ELDERLY"])
        
        print(f"어르신이 실제로 말한 내용:")
        print(f"  '{conversation_text}'")
        
        print(f"\n키워드 체크:")
        keywords_to_check = ["눈", "날씨", "햇살", "따뜻한", "산책", "옷", "사러"]
        for keyword in keywords_to_check:
            in_conversation = "✅" if keyword in conversation_text else "❌"
            in_diary = "✅" if keyword in diary.content else "❌"
            print(f"  '{keyword}': 대화 {in_conversation} | 일기 {in_diary}")
    
    # 5. 할루시네이션 검사
    print(f"\n5. HALLUCINATION CHECK")
    print("-" * 80)
    
    if transcripts:
        conversation_full = " ".join([t.text for t in transcripts])
        
        # 일기에 있지만 대화에 없는 구절들
        diary_phrases = [
            "날씨가 좋아서",
            "따뜻한 햇살",
            "산책을 가고 싶었다",
            "걷는 게 정말 좋더라",
            "고민해봐야겠다"
        ]
        
        hallucinations = []
        for phrase in diary_phrases:
            if phrase in diary.content and phrase not in conversation_full:
                hallucinations.append(phrase)
        
        if hallucinations:
            print("❌ 발견된 할루시네이션:")
            for h in hallucinations:
                print(f"  - '{h}' (대화에 없음)")
        else:
            print("✅ 할루시네이션 없음")
    
    # 6. 문제 진단
    print(f"\n6. DIAGNOSIS")
    print("-" * 80)
    
    if not transcripts or len(transcripts) == 0:
        print("문제: 대화 내용이 DB에 저장되지 않았습니다.")
        print("원인: CallTranscript가 비어있음")
        print("해결: Twilio WebSocket 저장 로직 확인 필요")
    else:
        print(f"대화 발화 수: {len(transcripts)}개")
        print(f"일기 길이: {len(diary.content)}자")
        print(f"발화당 글자수: {len(diary.content) / len(transcripts):.1f}자")
        
        if len(diary.content) > 200 and len(transcripts) < 10:
            print("\n⚠️ 문제: 짧은 대화인데 긴 일기 생성됨")
            print("원인: 개선된 코드가 적용되지 않았을 가능성")
    
    print("\n" + "=" * 80)
    print("DEBUG 완료")
    print("=" * 80)
    
except Exception as e:
    print(f"\nERROR: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()

