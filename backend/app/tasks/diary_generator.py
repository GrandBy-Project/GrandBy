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
        
        # 🔔 보호자들에게 다이어리 생성 알림 전송
        try:
            from app.models.user import User, UserConnection, ConnectionStatus
            from app.services.notification_service import NotificationService
            import asyncio
            
            def run_async(coro):
                """비동기 함수를 동기적으로 실행"""
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                return loop.run_until_complete(coro)
            
            # 어르신 정보 조회
            elderly = db.query(User).filter(User.user_id == call.elderly_id).first()
            if elderly:
                # 연결된 보호자 조회
                connections = db.query(UserConnection).filter(
                    UserConnection.elderly_id == call.elderly_id,
                    UserConnection.status == ConnectionStatus.ACTIVE
                ).all()
                
                caregiver_ids = [conn.caregiver_id for conn in connections]
                
                if caregiver_ids:
                    # 다이어리 생성 알림
                    run_async(
                        NotificationService.notify_diary_created(
                            db=db,
                            caregiver_ids=caregiver_ids,
                            elderly_name=elderly.name,
                            diary_id=new_diary.diary_id
                        )
                    )
                    logger.info(f"📤 다이어리 생성 알림 전송 완료: {len(caregiver_ids)}명")
                    
                    # AI 전화 완료 알림
                    run_async(
                        NotificationService.notify_call_completed(
                            db=db,
                            caregiver_ids=caregiver_ids,
                            elderly_name=elderly.name,
                            call_id=call.call_id
                        )
                    )
                    logger.info(f"📤 AI 전화 완료 알림 전송 완료: {len(caregiver_ids)}명")
        
        except Exception as notify_error:
            logger.error(f"⚠️ 알림 전송 실패: {str(notify_error)}")
        
    except Exception as e:
        logger.error(f"Failed to generate diary: {e}")
        db.rollback()
    finally:
        db.close()

