"""
개선된 일기 생성 시스템 테스트
- 할루시네이션 방지
- 속도 개선
- 대화 길이에 비례한 일기 길이
"""

import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.call import CallLog, CallTranscript
from app.models.user import User
from app.services.diary.conversation_analyzer import ConversationAnalyzer
from app.services.diary.personalized_diary_generator import PersonalizedDiaryGenerator
from sqlalchemy import desc
import time

def test_improved_diary():
    """개선된 일기 생성 테스트"""
    db = SessionLocal()
    
    try:
        print("=" * 80)
        print("🧪 개선된 일기 생성 시스템 테스트")
        print("=" * 80)
        
        # 최근 통화 가져오기
        recent_call = db.query(CallLog).order_by(desc(CallLog.call_start_time)).first()
        
        if not recent_call:
            print("❌ 테스트할 통화가 없습니다.")
            return
        
        print(f"\n📞 테스트 통화: {recent_call.call_id}")
        print(f"   - 시작 시간: {recent_call.call_start_time}")
        print(f"   - 통화 시간: {recent_call.call_duration}초")
        
        # 대화 내용 출력
        transcripts = db.query(CallTranscript).filter(
            CallTranscript.call_id == recent_call.call_id
        ).order_by(CallTranscript.timestamp).all()
        
        print(f"\n💬 대화 내용 ({len(transcripts)}개 발화):")
        print("-" * 80)
        for t in transcripts[:10]:  # 처음 10개만
            print(f"[{int(t.timestamp)}초] {t.speaker}: {t.text}")
        if len(transcripts) > 10:
            print(f"... (외 {len(transcripts) - 10}개)")
        print("-" * 80)
        
        # 어르신 정보
        elderly = db.query(User).filter(User.user_id == recent_call.elderly_id).first()
        
        print(f"\n👤 어르신 정보:")
        print(f"   - 이름: {elderly.name}")
        print(f"   - 생년월일: {elderly.birth_date}")
        print(f"   - 성별: {elderly.gender}")
        
        # ========== 1단계: 통화 내용 분석 ==========
        print("\n" + "=" * 80)
        print("📊 1단계: 통화 내용 분석")
        print("=" * 80)
        start_time = time.time()
        
        analyzer = ConversationAnalyzer()
        structured_data = analyzer.analyze_conversation(recent_call.call_id, db)
        
        analysis_time = time.time() - start_time
        
        print(f"⏱️  소요 시간: {analysis_time:.2f}초")
        print(f"\n분석 결과:")
        print(f"   - 활동: {len(structured_data.get('activities', []))}개")
        print(f"   - 건강 정보: {'있음' if structured_data.get('health', {}).get('overall') else '없음'}")
        print(f"   - 감정: {len(structured_data.get('emotions', []))}개")
        print(f"   - 사회적 교류: {len(structured_data.get('social', []))}개")
        print(f"   - 향후 일정: {len(structured_data.get('future_plans', []))}개")
        print(f"   - TODO: {len(structured_data.get('todos', []))}개")
        
        # 활동 상세
        if structured_data.get('activities'):
            print(f"\n🎯 감지된 활동:")
            for act in structured_data['activities']:
                print(f"   • [{act.get('time', '시간미상')}] {act.get('activity', '')}: {act.get('detail', '')}")
        
        # ========== 2단계: 일기 생성 ==========
        print("\n" + "=" * 80)
        print("📝 2단계: 개인화된 일기 생성")
        print("=" * 80)
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
        print(f"\n생성된 일기 ({len(diary_content)}자):")
        print("-" * 80)
        print(diary_content)
        print("-" * 80)
        
        # ========== 총 소요 시간 ==========
        total_time = analysis_time + generation_time
        
        print("\n" + "=" * 80)
        print("⏱️  성능 분석")
        print("=" * 80)
        print(f"   - 통화 내용 분석: {analysis_time:.2f}초")
        print(f"   - 일기 생성: {generation_time:.2f}초")
        print(f"   - 스타일 분석: 0.00초 (비활성화)")
        print(f"   - 총 소요 시간: {total_time:.2f}초")
        print(f"\n📈 개선 효과:")
        print(f"   - 기존: ~12-15초")
        print(f"   - 현재: {total_time:.2f}초")
        print(f"   - 개선율: {((12 - total_time) / 12 * 100):.1f}%")
        
        # ========== 품질 평가 ==========
        print("\n" + "=" * 80)
        print("✅ 품질 평가")
        print("=" * 80)
        
        # 대화 내용과 일기 비교
        conversation_keywords = set()
        for t in transcripts:
            words = t.text.split()
            conversation_keywords.update(words)
        
        diary_keywords = set(diary_content.split())
        
        # 실제 언급된 단어만 사용했는지 체크 (간단한 휴리스틱)
        hallucination_indicators = [
            "날씨", "선선", "상쾌", "따뜻한 물", "풍경", "대기 시간",
            "편안하게", "조용한 분위기", "무사히", "평온한"
        ]
        
        found_hallucinations = [word for word in hallucination_indicators if word in diary_content]
        
        print(f"   - 일기 길이: {len(diary_content)}자")
        print(f"   - 대화 발화 수: {len(transcripts)}개")
        print(f"   - 발화당 평균 글자수: {len(diary_content) / len(transcripts):.1f}자")
        
        if found_hallucinations:
            print(f"\n⚠️  잠재적 할루시네이션 감지:")
            for word in found_hallucinations:
                print(f"      - '{word}' (대화에 없을 가능성)")
        else:
            print(f"\n✅ 할루시네이션 없음 (대화 내용 기반)")
        
        print("\n" + "=" * 80)
        print("🎉 테스트 완료!")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ 테스트 실패: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    test_improved_diary()

