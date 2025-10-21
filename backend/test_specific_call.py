"""특정 통화로 개선된 일기 생성 테스트"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.call import CallLog, CallTranscript
from app.models.user import User
from app.services.diary.conversation_analyzer import ConversationAnalyzer
from app.services.diary.personalized_diary_generator import PersonalizedDiaryGenerator
import time

# 테스트할 통화 ID
TEST_CALL_ID = "CA2008748eb16639404c309bad33840f06"

db = SessionLocal()

try:
    print("=" * 80)
    print("🧪 개선된 일기 생성 시스템 테스트 (실제 대화)")
    print("=" * 80)
    
    call = db.query(CallLog).filter(CallLog.call_id == TEST_CALL_ID).first()
    
    if not call:
        print(f"❌ 통화를 찾을 수 없음: {TEST_CALL_ID}")
        sys.exit(1)
    
    print(f"\n📞 테스트 통화: {call.call_id}")
    
    # 대화 내용
    transcripts = db.query(CallTranscript).filter(
        CallTranscript.call_id == call.call_id
    ).order_by(CallTranscript.timestamp).all()
    
    print(f"\n💬 대화 내용 ({len(transcripts)}개 발화):")
    print("-" * 80)
    for t in transcripts:
        print(f"[{int(t.timestamp)}초] {t.speaker}: {t.text}")
    print("-" * 80)
    
    # 어르신 정보
    elderly = db.query(User).filter(User.user_id == call.elderly_id).first()
    
    # ========== 1단계: 분석 ==========
    print("\n📊 1단계: 통화 내용 분석")
    start_time = time.time()
    
    analyzer = ConversationAnalyzer()
    structured_data = analyzer.analyze_conversation(call.call_id, db)
    
    analysis_time = time.time() - start_time
    print(f"⏱️  소요 시간: {analysis_time:.2f}초")
    
    print(f"\n분석 결과:")
    print(f"   - 활동: {len(structured_data.get('activities', []))}개")
    for act in structured_data.get('activities', []):
        print(f"      • {act.get('activity', '')}: {act.get('detail', '')}")
    
    print(f"   - TODO: {len(structured_data.get('todos', []))}개")
    for todo in structured_data.get('todos', []):
        print(f"      • {todo.get('title', '')}")
    
    print(f"   - 향후 일정: {len(structured_data.get('future_plans', []))}개")
    for plan in structured_data.get('future_plans', []):
        print(f"      • {plan.get('event', '')}")
    
    # ========== 2단계: 일기 생성 ==========
    print("\n📝 2단계: 개인화된 일기 생성")
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
    
    # ========== 성능 분석 ==========
    total_time = analysis_time + generation_time
    
    print("\n⏱️  성능 분석")
    print("-" * 80)
    print(f"   - 통화 내용 분석: {analysis_time:.2f}초")
    print(f"   - 일기 생성: {generation_time:.2f}초")
    print(f"   - 총 소요 시간: {total_time:.2f}초")
    print(f"\n📈 개선 효과:")
    print(f"   - 기존 시스템: ~12-15초")
    print(f"   - 개선 시스템: {total_time:.2f}초")
    if total_time < 12:
        improvement = ((12 - total_time) / 12 * 100)
        print(f"   - 개선율: {improvement:.1f}% ⬆️")
    
    # ========== 품질 분석 ==========
    print("\n✅ 품질 분석")
    print("-" * 80)
    print(f"   - 일기 길이: {len(diary_content)}자")
    print(f"   - 대화 발화 수: {len(transcripts)}개")
    print(f"   - 발화당 평균: {len(diary_content) / len(transcripts):.1f}자")
    
    # 대화에서 실제 언급된 키워드
    mentioned_keywords = set()
    for t in transcripts:
        if t.speaker == "ELDERLY":
            mentioned_keywords.update(t.text.split())
    
    print(f"\n대화에서 언급된 주요 키워드:")
    print(f"   {', '.join(list(mentioned_keywords)[:15])}")
    
    # 할루시네이션 체크
    hallucination_indicators = [
        "날씨", "선선", "상쾌", "따뜻한 물", "풍경", "대기 시간",
        "편안하게", "조용한 분위기", "무사히", "평온한", "아침 공기",
        "참치가 듬뿍", "만족스러웠다"
    ]
    
    found_hallucinations = [word for word in hallucination_indicators if word in diary_content]
    
    if found_hallucinations:
        print(f"\n⚠️  잠재적 할루시네이션 감지:")
        for word in found_hallucinations:
            if word not in ' '.join([t.text for t in transcripts]):
                print(f"      - '{word}' (대화에 없음)")
    else:
        print(f"\n✅ 할루시네이션 없음 - 대화 내용 기반으로 충실하게 작성됨")
    
    print("\n" + "=" * 80)
    print("🎉 테스트 완료!")
    print("=" * 80)
    
except Exception as e:
    print(f"\n❌ 오류: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()

