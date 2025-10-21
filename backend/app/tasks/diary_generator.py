"""
다이어리 자동 생성 작업 (고도화 버전)
통화 내용 분석 → 개인화된 일기 생성 → TODO 추천
"""

from app.tasks.celery_app import celery_app
from app.database import SessionLocal
from app.models.call import CallLog
from app.models.diary import Diary, AuthorType, DiaryStatus
from app.models.user import User
from app.services.diary.conversation_analyzer import ConversationAnalyzer
from app.services.diary.personalized_diary_generator import PersonalizedDiaryGenerator
from app.services.diary.todo_extractor import TodoExtractor
from datetime import date, timedelta
import logging
import json

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.diary_generator.generate_diary_from_call")
def generate_diary_from_call(call_id: str):
    """
    통화 내용으로부터 일기 자동 생성 (고도화 버전)
    
    프로세스:
    1. 통화 내용 구조화 분석 (활동, 건강, 감정, 일정 등)
    2. 어르신의 스타일을 반영한 개인화된 일기 생성
    3. 할 일(TODO) 자동 감지 및 추천
    4. 일기와 TODO 추천을 DB에 저장
    
    Args:
        call_id: 통화 ID
    """
    logger.info(f"{'='*60}")
    logger.info(f"📝 고도화된 일기 생성 시작: {call_id}")
    logger.info(f"{'='*60}")
    
    db = SessionLocal()
    try:
        # ========== 1. 통화 기록 조회 ==========
        call = db.query(CallLog).filter(CallLog.call_id == call_id).first()
        
        if not call:
            logger.error(f"❌ 통화 기록을 찾을 수 없음: {call_id}")
            return {
                "success": False,
                "error": "Call not found"
            }
        
        # 어르신 정보 조회
        elderly = db.query(User).filter(User.user_id == call.elderly_id).first()
        
        if not elderly:
            logger.error(f"❌ 사용자를 찾을 수 없음: {call.elderly_id}")
            return {
                "success": False,
                "error": "User not found"
            }
        
        # 통화 텍스트가 있는지 확인
        transcripts = call.transcripts
        if not transcripts or len(transcripts) == 0:
            logger.warning(f"⚠️ 통화 내용이 없음: {call_id}")
            return {
                "success": False,
                "error": "No transcripts"
            }
        
        logger.info(f"✅ 통화 기록 조회 완료 (발화 수: {len(transcripts)})")
        
        # ========== 2. 통화 내용 구조화 분석 ==========
        analyzer = ConversationAnalyzer()
        structured_data = analyzer.analyze_conversation(call_id, db)
        
        if not structured_data or len(structured_data.get('activities', [])) == 0:
            logger.warning(f"⚠️ 분석된 내용이 부족함, 간단한 일기 생성")
        
        # ========== 3. 최근 일기 가져오기 (스타일 학습용) ==========
        recent_diaries = db.query(Diary).filter(
            Diary.user_id == elderly.user_id,
            Diary.date >= date.today() - timedelta(days=30)  # 최근 30일
        ).order_by(Diary.date.desc()).limit(5).all()
        
        logger.info(f"📚 최근 일기: {len(recent_diaries)}개")
        
        # ========== 4. 개인화된 일기 생성 ==========
        generator = PersonalizedDiaryGenerator()
        diary_content = generator.generate_diary(
            user=elderly,
            structured_data=structured_data,
            recent_diaries=recent_diaries,
            db=db,
            conversation_length=len(transcripts)  # 대화 발화 수 전달
        )
        
        if not diary_content or len(diary_content) < 10:  # 50 → 10 (짧은 대화도 허용)
            logger.error(f"❌ 일기 생성 실패 또는 내용이 너무 짧음")
            return {
                "success": False,
                "error": "Diary generation failed"
            }
        
        logger.info(f"✅ 일기 생성 완료 ({len(diary_content)}자)")
        
        # ========== 5. TODO 자동 감지 ==========
        todo_extractor = TodoExtractor()
        suggested_todos = todo_extractor.extract_and_create_todos(
            structured_data=structured_data,
            elderly=elderly,
            creator=elderly,  # AI가 생성했지만 어르신 명의로
            db=db
        )
        
        logger.info(f"📋 TODO 감지: {len(suggested_todos)}개")
        
        # ========== 6. 일기 DB 저장 ==========
        # structured_data를 JSON으로 저장 (향후 활용을 위해)
        metadata = {
            "structured_data": structured_data,
            "suggested_todos": suggested_todos,
            "analysis_version": "2.0"
        }
        
        new_diary = Diary(
            user_id=call.elderly_id,
            author_id=call.elderly_id,
            call_id=call.call_id,
            date=date.today(),
            content=diary_content,
            author_type=AuthorType.AI,
            is_auto_generated=True,
            status=DiaryStatus.DRAFT,
        )
        db.add(new_diary)
        db.commit()
        db.refresh(new_diary)
        
        logger.info(f"✅ 일기 저장 완료: {new_diary.diary_id}")
        
        # ========== 7. TODO 추천 정보 임시 저장 (캐시 또는 별도 테이블) ==========
        # 실제 구현 시: Redis 또는 별도 SuggestedTodo 테이블 사용
        # 여기서는 로그만 출력
        if suggested_todos:
            logger.info(f"{'='*60}")
            logger.info(f"📌 감지된 TODO 목록:")
            for i, todo in enumerate(suggested_todos):
                logger.info(f"  {i+1}. {todo['title']} (기한: {todo['due_date']})")
            logger.info(f"{'='*60}")
        
        # ========== 8. 결과 반환 ==========
        result = {
            "success": True,
            "diary_id": new_diary.diary_id,
            "diary_date": new_diary.date.isoformat(),
            "diary_length": len(diary_content),
            "suggested_todos_count": len(suggested_todos),
            "suggested_todos": suggested_todos,
            "elderly_id": elderly.user_id,
            "elderly_name": elderly.name
        }
        
        logger.info(f"{'='*60}")
        logger.info(f"✅ 일기 생성 완료!")
        logger.info(f"   - 일기 ID: {new_diary.diary_id}")
        logger.info(f"   - 일기 길이: {len(diary_content)}자")
        logger.info(f"   - TODO 추천: {len(suggested_todos)}개")
        logger.info(f"{'='*60}")
        
        # TODO: 어르신/보호자에게 알림 발송
        # - 일기 생성 완료 알림
        # - TODO 추천이 있으면 함께 알림
        
        return result
        
    except Exception as e:
        logger.error(f"❌ 일기 생성 실패: {e}")
        import traceback
        logger.error(traceback.format_exc())
        db.rollback()
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        db.close()

