"""
다이어리 자동 생성 작업
"""

from app.tasks.celery_app import celery_app
from app.database import SessionLocal
from app.models.call import CallLog
from app.models.diary import Diary, AuthorType, DiaryStatus
from app.services.ai_call import LLMService
from datetime import date
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.diary_generator.generate_diary_from_call")
def generate_diary_from_call(call_id: str):
    """
    통화 내용으로부터 일기 자동 생성
    
    Args:
        call_id: 통화 ID
    """
    logger.info(f"Generating diary from call: {call_id}")
    
    db = SessionLocal()
    try:
        # 통화 기록 조회
        call = db.query(CallLog).filter(CallLog.call_id == call_id).first()
        
        if not call:
            logger.error(f"Call not found: {call_id}")
            return
        
        # 통화 텍스트 조합 (CallTranscript에서)
        transcripts = call.transcripts
        conversation_text = "\n".join([
            f"{t.speaker}: {t.text}"
            for t in transcripts
        ])
        
        if not conversation_text:
            logger.warning(f"No transcript for call: {call_id}")
            return
        
        # LLM으로 일기 생성
        llm_service = LLMService()
        diary_content = llm_service.summarize_conversation_to_diary(conversation_text)
        
        # 다이어리 저장 (Draft 상태)
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
        
        logger.info(f"Diary generated: {new_diary.diary_id}")
        
        # TODO: 어르신에게 일기 생성 알림 발송
        
    except Exception as e:
        logger.error(f"Failed to generate diary: {e}")
        db.rollback()
    finally:
        db.close()

