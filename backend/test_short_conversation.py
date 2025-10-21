"""짧은 대화로 일기 생성 테스트"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.call import CallLog, CallTranscript
from app.models.user import User
from app.services.diary.conversation_analyzer import ConversationAnalyzer
from app.services.diary.personalized_diary_generator import PersonalizedDiaryGenerator
import time

# 짧은 대화 (3개 발화)
TEST_CALL_ID = "CA3f868dd040451524ae12fda7b9f29e62"

db = SessionLocal()

try:
    print("=" * 80)
    print("🧪 짧은 대화 테스트 (3개 발화)")
    print("=" * 80)
    
    call = db.query(CallLog).filter(CallLog.call_id == TEST_CALL_ID).first()
    
    # 대화 내용
    transcripts = db.query(CallTranscript).filter(
        CallTranscript.call_id == call.call_id
    ).order_by(CallTranscript.timestamp).all()
    
    print(f"\n💬 대화 내용 ({len(transcripts)}개 발화):")
    print("-" * 80)
    for t in transcripts:
        print(f"{t.speaker}: {t.text}")
    print("-" * 80)
    
    elderly = db.query(User).filter(User.user_id == call.elderly_id).first()
    
    # ========== 분석 ==========
    print("\n📊 통화 내용 분석")
    start_time = time.time()
    
    analyzer = ConversationAnalyzer()
    structured_data = analyzer.analyze_conversation(call.call_id, db)
    
    analysis_time = time.time() - start_time
    print(f"⏱️  소요 시간: {analysis_time:.2f}초")
    print(f"   - 활동: {len(structured_data.get('activities', []))}개")
    print(f"   - TODO: {len(structured_data.get('todos', []))}개")
    
    # ========== 일기 생성 ==========
    print("\n📝 일기 생성")
    start_time = time.time()
    
    generator = PersonalizedDiaryGenerator()
    diary_content = generator.generate_diary(
        user=elderly,
        structured_data=structured_data,
        recent_diaries=[],
        db=db,
        conversation_length=len(transcripts)
    )
    
    generation_time = time.time() - start_time
    print(f"⏱️  소요 시간: {generation_time:.2f}초")
    
    print(f"\n✅ 생성된 일기 ({len(diary_content)}자):")
    print("=" * 80)
    print(diary_content)
    print("=" * 80)
    
    # ========== 결과 분석 ==========
    total_time = analysis_time + generation_time
    
    print("\n📊 결과 분석:")
    print(f"   - 대화 발화 수: {len(transcripts)}개 (매우 짧음)")
    print(f"   - 일기 길이: {len(diary_content)}자")
    print(f"   - 발화당 평균: {len(diary_content) / len(transcripts):.1f}자")
    print(f"   - 총 소요 시간: {total_time:.2f}초")
    
    print(f"\n✅ 기대 결과:")
    print(f"   - 짧은 대화 → 짧은 일기 ({'✅' if len(diary_content) < 200 else '❌'})")
    print(f"   - 빠른 생성 ({total_time:.1f}초) ({'✅' if total_time < 8 else '❌'})")
    
    print("\n" + "=" * 80)
    print("🎉 테스트 완료!")
    print("=" * 80)
    
except Exception as e:
    print(f"\n❌ 오류: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()

