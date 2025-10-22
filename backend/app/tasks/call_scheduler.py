"""
AI 자동 전화 스케줄링 작업 (Celery Beat)
"""

from app.tasks.celery_app import celery_app
from app.database import SessionLocal
from app.models.call import CallLog, CallStatus , CallSettings
from app.models.user import User
from app.services.ai_call.twilio_service import TwilioService
from app.config import settings
from app.utils.phone import normalize_phone_number
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.call_scheduler.check_and_make_calls")
def check_and_make_calls():
    """
    현재 시간에 전화를 걸어야 하는 어르신 확인 후 전화 발신
    
    main.py의 /api/twilio/call 엔드포인트와 동일한 로직으로 실시간 AI 대화 통화 발신
    통화 상태 변화(answered, completed)는 /api/twilio/call-status 콜백이 자동 처리
    """
    logger.info("📞 자동 통화 스케줄러 시작...")
    
    db = SessionLocal()
    try:
        # 현재 시간
        current_datetime = datetime.now()
        current_hour = current_datetime.hour
        current_minute = current_datetime.minute
        
        logger.info(f"⏰ 현재 시간: {current_hour:02d}:{current_minute:02d}")
        
        # 자동 통화가 활성화된 설정 조회
        settings_list = db.query(CallSettings).filter(
            CallSettings.is_active == True,
            CallSettings.call_time != None
        ).all()
        
        if not settings_list:
            logger.info("활성화된 통화 설정이 없습니다")
            return {"calls_made": 0, "message": "No active settings"}
        
        logger.info(f"📋 활성화된 통화 설정: {len(settings_list)}개")
        
        # 현재 시간에 전화해야 하는 설정 필터링
        settings_to_call = []
        
        for setting in settings_list:
            try:
                call_hour = setting.call_time.hour
                call_minute = setting.call_time.minute
            except (ValueError, AttributeError, IndexError) as e:
                logger.warning(f"⚠️  잘못된 시간 형식 (사용자: {setting.elderly_id}): {setting.call_time}")
                continue
            
            # 시간 차이 계산 (분 단위)
            time_diff = abs((call_hour * 60 + call_minute) - (current_hour * 60 + current_minute))
            
            # 정확히 설정한 시간에만 전화 (0분 차이)
            if time_diff == 0:
                # 오늘 이미 전화했는지 확인 (중복 방지)
                today_start = current_datetime.replace(hour=0, minute=0, second=0, microsecond=0)
                existing_call = db.query(CallLog).filter(
                    CallLog.elderly_id == setting.elderly_id,
                    CallLog.created_at >= today_start,
                    CallLog.call_status.in_([CallStatus.INITIATED, CallStatus.ANSWERED, CallStatus.COMPLETED])
                ).first()
                
                if existing_call:
                    logger.info(f"⏭️  오늘 이미 통화함: {setting.elderly_id}")
                    continue
                
                settings_to_call.append(setting)
                logger.info(f"📞 예약 통화 대상: {setting.elderly_id} ({call_hour:02d}:{call_minute:02d})")
        
        if not settings_to_call:
            logger.info("이번 시간에 전화할 대상이 없습니다")
            return {"calls_made": 0, "message": "No calls scheduled at this time"}
        
        # API Base URL 확인 (Twilio 콜백용)
        if not settings.API_BASE_URL:
            logger.error("❌ API_BASE_URL이 환경 변수에 설정되지 않았습니다")
            return {"calls_made": 0, "error": "API_BASE_URL not configured"}
        
        # Twilio 서비스 초기화
        twilio_service = TwilioService()
        calls_made = 0
        failed_calls = 0
        
        # 실제로 전화 걸 설정들을 순회
        for setting in settings_to_call:
            try:
                # 사용자 정보 조회
                elderly = db.query(User).filter(User.user_id == setting.elderly_id).first()
                
                if not elderly:
                    logger.warning(f"⚠️  사용자를 찾을 수 없음: {setting.elderly_id}")
                    failed_calls += 1
                    continue
                
                if not elderly.phone_number:
                    logger.warning(f"⚠️  전화번호 없음 (사용자: {elderly.name})")
                    failed_calls += 1
                    continue

                # 전화번호 국제 형식으로 변환
                normalized_phone = normalize_phone_number(elderly.phone_number)
                
                # TwiML URL 생성 (실시간 AI 대화 WebSocket)
                api_base_url = settings.API_BASE_URL
                voice_url = f"https://{api_base_url}/api/twilio/voice"
                status_callback_url = f"https://{api_base_url}/api/twilio/call-status"
                
                logger.info(f"┌{'─'*58}┐")
                logger.info(f"│ 📞 실시간 AI 대화 통화 발신                             │")
                logger.info(f"│ 이름: {elderly.name:47} │")
                logger.info(f"│ 전화번호: {elderly.phone_number:43} │")
                logger.info(f"│ 정규화: {normalized_phone:45} │")
                logger.info(f"│ 사용자 ID: {elderly.user_id:42} │")
                logger.info(f"└{'─'*58}┘")
                logger.info(f"🔗 Voice URL (WebSocket): {voice_url}")
                logger.info(f"🔗 Status Callback: {status_callback_url}")
                
                # 전화 발신 (main.py /api/twilio/call과 동일한 로직)
                call_sid = twilio_service.make_call(
                    to_number=normalized_phone,
                    voice_url=voice_url,
                    status_callback_url=status_callback_url
                )
                
                # ✅ main.py와 동일한 CallLog 생성 (call_id 필드 포함)
                new_call = CallLog(
                    call_id=call_sid,  # ⭐ 필수: main.py와 동일
                    elderly_id=elderly.user_id,
                    call_status=CallStatus.INITIATED,
                    twilio_call_sid=call_sid,
                    created_at=datetime.utcnow()
                )
                db.add(new_call)
                db.commit()
                db.refresh(new_call)
                
                calls_made += 1
                logger.info(f"✅ 통화 발신 성공: {elderly.name} (Call SID: {call_sid})")
                logger.info(f"💾 통화 기록 저장 완료 (ID: {new_call.id})")
                logger.info("")
                
            except Exception as e:
                failed_calls += 1
                logger.error(f"❌ 통화 발신 실패 (사용자: {setting.elderly_id}): {str(e)}")
                import traceback
                logger.error(traceback.format_exc())
                db.rollback()
                continue
        
        result = {
            "calls_made": calls_made,
            "failed_calls": failed_calls,
            "timestamp": f"{current_hour:02d}:{current_minute:02d}",
            "datetime": current_datetime.isoformat()
        }
        
        logger.info(f"┌{'─'*58}┐")
        logger.info(f"│ ✅ 자동 통화 스케줄러 완료                               │")
        logger.info(f"│ 성공: {calls_made:2}건 / 실패: {failed_calls:2}건                                  │")
        logger.info(f"│ 시간: {current_hour:02d}:{current_minute:02d}                                          │")
        logger.info(f"└{'─'*58}┘")
        
        return result
    
    except Exception as e:
        logger.error(f"❌ 자동 통화 스케줄러 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {"calls_made": 0, "error": str(e)}
    
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

