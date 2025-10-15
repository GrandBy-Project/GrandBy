"""
Twilio Voice API 라우터
REST API를 통한 전화 발신 및 AI 통화 핸들러
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.ai_call.twilio_service import TwilioService
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()
twilio_service = TwilioService()


class MakeCallRequest(BaseModel):
    """전화 발신 요청"""
    to_number: str  # 수신자 전화번호 (+821012345678 형식)
    user_id: str  # 사용자 ID


class MakeCallResponse(BaseModel):
    """전화 발신 응답"""
    call_sid: str
    status: str
    to_number: str
    message: str


@router.post("/make-call", response_model=MakeCallResponse)
async def make_outbound_call(
    request: MakeCallRequest,
    db: Session = Depends(get_db)
):
    """
    REST API를 통한 전화 발신
    
    사용자가 앱에서 버튼을 누르면 백엔드가 Twilio API를 호출하여
    사용자의 전화번호로 전화를 걸고, AI 비서와 연결합니다.
    
    플로우:
    1. 앱에서 이 API 호출
    2. Twilio가 사용자 전화번호로 전화 발신
    3. 사용자가 전화 받음
    4. /ai-voice-twiml 엔드포인트에서 AI 비서 TwiML 제공
    5. AI와 통화 시작
    """
    try:
        from app.config import settings
        
        # TwiML URL 생성 (AI 비서 응답)
        voice_url = f"https://{settings.API_BASE_URL}/api/twilio/ai-voice-twiml"
        
        # 통화 상태 콜백 URL (선택사항)
        status_callback_url = f"https://{settings.API_BASE_URL}/api/twilio/call-status"
        
        # Twilio를 통해 전화 발신
        call_sid = twilio_service.make_call(
            to_number=request.to_number,
            voice_url=voice_url,
            status_callback_url=status_callback_url
        )
        
        logger.info(f"📞 Call initiated for user {request.user_id} to {request.to_number}")
        
        return MakeCallResponse(
            call_sid=call_sid,
            status="initiated",
            to_number=request.to_number,
            message="전화 연결 중입니다. 잠시 후 전화를 받아주세요."
        )
        
    except Exception as e:
        logger.error(f"❌ Failed to make call: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"전화 발신 실패: {str(e)}"
        )


@router.post("/ai-voice-twiml", response_class=PlainTextResponse)
async def ai_voice_twiml(request: Request):
    """
    AI 비서 통화용 TwiML 응답
    
    사용자가 전화를 받으면 이 TwiML이 실행되어 AI 비서와 연결됩니다.
    """
    try:
        # 요청 파라미터 파싱
        form_data = await request.form()
        call_sid = form_data.get("CallSid", "Unknown")
        from_number = form_data.get("From", "Unknown")
        
        logger.info(f"🤖 AI voice call started: {call_sid} from {from_number}")
        
        # TODO: 실제 AI 대화 시스템과 연결
        # 현재는 간단한 TTS 응답만 제공
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Seoyeon" language="ko-KR">
        안녕하세요! 그랜비 AI 비서입니다.
    </Say>
    <Pause length="1"/>
    <Say voice="Polly.Seoyeon" language="ko-KR">
        오늘 하루는 어떠셨나요? 무엇을 도와드릴까요?
    </Say>
    <Pause length="3"/>
    <Say voice="Polly.Seoyeon" language="ko-KR">
        오늘 할 일을 확인하시겠어요? 아니면 일기를 작성하시겠어요?
    </Say>
    <Pause length="5"/>
    <Say voice="Polly.Seoyeon" language="ko-KR">
        언제든지 다시 전화주세요. 안녕히 계세요!
    </Say>
</Response>"""
        
        return PlainTextResponse(content=twiml, media_type="application/xml")
        
    except Exception as e:
        logger.error(f"❌ Error in AI voice TwiML: {e}")
        error_twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Seoyeon" language="ko-KR">
        죄송합니다. 통화 연결에 문제가 발생했습니다. 나중에 다시 시도해주세요.
    </Say>
    <Hangup/>
</Response>"""
        return PlainTextResponse(content=error_twiml, media_type="application/xml")


@router.post("/call-status")
async def handle_call_status(request: Request):
    """
    통화 상태 콜백 핸들러
    
    Twilio가 통화 상태 변경 시 이 엔드포인트로 알림을 보냅니다.
    """
    try:
        form_data = await request.form()
        call_sid = form_data.get("CallSid", "Unknown")
        call_status = form_data.get("CallStatus", "Unknown")
        duration = form_data.get("CallDuration", "0")
        
        logger.info(f"📊 Call status update: {call_sid} - {call_status} (duration: {duration}s)")
        
        # TODO: 데이터베이스에 통화 기록 저장
        
        return {"status": "received"}
        
    except Exception as e:
        logger.error(f"❌ Error handling call status: {e}")
        return {"status": "error", "message": str(e)}


@router.get("/voice-status")
async def check_voice_service_status():
    """
    Voice 서비스 상태 확인
    """
    from app.config import settings
    
    return {
        "status": "ok",
        "configured": bool(
            settings.TWILIO_ACCOUNT_SID and 
            settings.TWILIO_AUTH_TOKEN and 
            settings.TWILIO_PHONE_NUMBER
        ),
        "message": "Twilio Voice REST API service is ready" if (
            settings.TWILIO_ACCOUNT_SID and 
            settings.TWILIO_AUTH_TOKEN and 
            settings.TWILIO_PHONE_NUMBER
        ) else "Twilio credentials not configured"
    }

