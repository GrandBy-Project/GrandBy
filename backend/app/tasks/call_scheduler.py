"""
AI 자동 전화 스케줄링 작업
"""

from app.tasks.celery_app import celery_app
from app.database import SessionLocal
from app.models.call import CallSettings, CallLog
from app.models.user import User
from app.services.ai_call import TwilioService
from app.config import settings
from datetime import datetime, time
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.call_scheduler.check_and_make_calls")
def check_and_make_calls():
    """
    현재 시간에 전화를 걸어야 하는 어르신 확인 후 전화 발신
    """
    logger.info("Checking for scheduled calls...")
    
    db = SessionLocal()
    try:
        current_time = datetime.now().time()
        
        # 현재 시간에 전화해야 하는 설정 조회
        settings_list = db.query(CallSettings).filter(
            CallSettings.is_active == True,
            # TODO: 시간 비교 로직 개선 필요
        ).all()
        
        twilio_service = TwilioService()
        
        for setting in settings_list:
            try:
                # 어르신 정보 조회
                elderly = db.query(User).filter(User.user_id == setting.elderly_id).first()
                
                if not elderly or not elderly.phone_number:
                    logger.warning(f"No phone number for user {setting.elderly_id}")
                    continue
                
                # 전화 발신
                # API Base URL 확인
                if not settings.API_BASE_URL:
                    logger.error("API_BASE_URL not set in settings")
                    continue
                
                api_base_url = settings.API_BASE_URL
                voice_url = f"https://{api_base_url}/api/twilio/voice"
                status_callback_url = f"https://{api_base_url}/api/twilio/call-status"
                
                call_sid = twilio_service.make_call(
                    to_number=elderly.phone_number,
                    voice_url=voice_url,
                    status_callback_url=status_callback_url
                )
                
                # 통화 기록 생성
                new_call = CallLog(
                    elderly_id=elderly.user_id,
                    call_status="initiated",
                    twilio_call_sid=call_sid,
                    created_at=datetime.utcnow()
                )
                db.add(new_call)
                db.commit()
                
                logger.info(f"Call initiated for {elderly.name}: {call_sid}")
                
            except Exception as e:
                logger.error(f"Failed to make call for {setting.elderly_id}: {e}")
                db.rollback()
                continue
    
    finally:
        db.close()


@celery_app.task(name="app.tasks.call_scheduler.process_call_result")
def process_call_result(call_id: str):
    """
    통화 종료 후 처리 (STT, 감정 분석, 일기 생성 등)
    
    Args:
        call_id: 통화 ID
    """
    logger.info(f"Processing call result: {call_id}")
    
    # TODO: 
    # 1. 통화 음성 파일 S3에서 다운로드
    # 2. STT로 텍스트 변환
    # 3. 감정 분석
    # 4. TODO 추출
    # 5. 일기 자동 생성
    # 6. 알림 발송
    
    pass

