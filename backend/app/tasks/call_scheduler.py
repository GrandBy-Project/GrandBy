"""
AI 자동 전화 스케줄링 작업
"""

from app.tasks.celery_app import celery_app
from app.database import SessionLocal
from app.models.call import CallSettings, CallLog, CallStatus
from app.models.user import User
from app.services.ai_call import TwilioService
from app.config import settings
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.call_scheduler.check_and_make_calls")
def check_and_make_calls():
    """
    현재 시간에 전화를 걸어야 하는 어르신 확인 후 전화 발신
    매 분마다 실행되며, 설정된 시간(±5분 이내)에 전화 발신
    """
    logger.info("⏰ Checking for scheduled calls...")
    
    db = SessionLocal()
    try:
        current_datetime = datetime.now()
        current_time = current_datetime.time()
        current_hour = current_time.hour
        current_minute = current_time.minute
        
        logger.info(f"Current time: {current_hour:02d}:{current_minute:02d}")
        
        # 활성화된 모든 통화 설정 조회
        settings_list = db.query(CallSettings).filter(
            CallSettings.is_active == True
        ).all()
        
        if not settings_list:
            logger.info("No active call settings found")
            return
        
        logger.info(f"Found {len(settings_list)} active call settings")
        
        # 현재 시간에 전화해야 하는 설정 필터링
        settings_to_call = []
        
        for setting in settings_list:
            call_hour = setting.call_time.hour
            call_minute = setting.call_time.minute
            
            # 시간 차이 계산 (분 단위)
            time_diff = abs((call_hour * 60 + call_minute) - (current_hour * 60 + current_minute))
            
            # ±5분 이내인지 확인
            if time_diff <= 5:
                # 오늘 이미 전화했는지 확인 (중복 방지)
                today_start = current_datetime.replace(hour=0, minute=0, second=0, microsecond=0)
                existing_call = db.query(CallLog).filter(
                    CallLog.elderly_id == setting.elderly_id,
                    CallLog.created_at >= today_start,
                    CallLog.call_status.in_([CallStatus.INITIATED, CallStatus.ANSWERED, CallStatus.COMPLETED])
                ).first()
                
                if existing_call:
                    logger.info(f"⏭️  Already called today: {setting.elderly_id}")
                    continue
                
                settings_to_call.append(setting)
                logger.info(f"📞 Scheduled call: {setting.elderly_id} at {call_hour:02d}:{call_minute:02d}")
        
        if not settings_to_call:
            logger.info("No calls to make at this time")
            return
        
        # Twilio 서비스 초기화
        twilio_service = TwilioService()
        
        # 전화 발신
        for setting in settings_to_call:
            try:
                # 어르신 정보 조회
                elderly = db.query(User).filter(User.user_id == setting.elderly_id).first()
                
                if not elderly or not elderly.phone_number:
                    logger.warning(f"❌ No phone number for user {setting.elderly_id}")
                    continue
                
                # API Base URL 확인
                if not settings.API_BASE_URL:
                    logger.error("❌ API_BASE_URL not set in settings")
                    continue
                
                api_base_url = settings.API_BASE_URL
                voice_url = f"https://{api_base_url}/api/twilio/voice"
                status_callback_url = f"https://{api_base_url}/api/twilio/call-status"
                
                logger.info(f"📞 Calling {elderly.phone_number}...")
                
                # 전화 발신
                call_sid = twilio_service.make_call(
                    to_number=elderly.phone_number,
                    voice_url=voice_url,
                    status_callback_url=status_callback_url
                )
                
                # 통화 기록 생성
                new_call = CallLog(
                    elderly_id=elderly.user_id,
                    call_status=CallStatus.INITIATED,
                    twilio_call_sid=call_sid,
                    call_start_time=datetime.utcnow(),
                    created_at=datetime.utcnow()
                )
                db.add(new_call)
                db.commit()
                
                logger.info(f"✅ Call initiated for {elderly.email}: {call_sid}")
                
            except Exception as e:
                logger.error(f"❌ Failed to make call for {setting.elderly_id}: {e}")
                import traceback
                logger.error(traceback.format_exc())
                db.rollback()
                continue
    
    except Exception as e:
        logger.error(f"❌ Error in check_and_make_calls: {e}")
        import traceback
        logger.error(traceback.format_exc())
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
    
    # 일기 자동 생성 작업 호출
    from app.tasks.diary_generator import generate_diary_from_call
    generate_diary_from_call.delay(call_id)

