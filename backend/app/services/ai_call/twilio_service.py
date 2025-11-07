"""
Twilio 음성 통화 서비스
"""

from twilio.rest import Client
from twilio.jwt.access_token import AccessToken
from twilio.jwt.access_token.grants import VoiceGrant
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class TwilioService:
    """Twilio API를 사용한 음성 통화 서비스"""
    
    def __init__(self):
        self.client = Client(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN
        )
        self.phone_number = settings.TWILIO_PHONE_NUMBER
    
    def make_call(self, to_number: str, voice_url: str, status_callback_url: str = None):
        """
        전화 걸기
        
        Args:
            to_number: 수신자 전화번호 (+821012345678 형식)
            voice_url: TwiML 응답 URL (전화 연결 시 실행) - 필수!
            status_callback_url: 통화 상태 콜백 URL (선택)
        
        Returns:
            call_sid: Twilio Call SID
        """
        try:
            if not voice_url:
                raise ValueError("voice_url is required")
            
            call_params = {
                "to": to_number,
                "from_": self.phone_number,
                "url": voice_url,  # 전화 연결 시 TwiML 가져올 URL
            }
            
            # status_callback은 선택사항
            if status_callback_url:
                call_params["status_callback"] = status_callback_url
                call_params["status_callback_event"] = [
                    "initiated", "ringing", "answered", "completed",
                    # "no-answer", "busy", "failed", "canceled"
                ]
            
            call = self.client.calls.create(**call_params)
            
            logger.info(f"✅ Call initiated: {call.sid} to {to_number}")
            logger.info(f"📞 Voice URL: {voice_url}")
            if status_callback_url:
                logger.info(f"📊 Status Callback URL: {status_callback_url}")
            
            return call.sid
        except Exception as e:
            logger.error(f"❌ Failed to make call: {e}")
            raise
    
    def get_call_status(self, call_sid: str):
        """
        통화 상태 조회
        
        Args:
            call_sid: Twilio Call SID
        
        Returns:
            dict: 통화 상태 정보
        """
        try:
            call = self.client.calls(call_sid).fetch()
            return {
                "sid": call.sid,
                "status": call.status,
                "duration": call.duration,
                "start_time": call.start_time,
                "end_time": call.end_time,
            }
        except Exception as e:
            logger.error(f"Failed to fetch call status: {e}")
            raise
    
    def generate_voice_access_token(self, identity: str, ttl: int = 3600):
        """
        Twilio Voice SDK용 Access Token 생성
        
        Args:
            identity: 사용자 식별자 (예: user_id)
            ttl: 토큰 유효 시간(초), 기본 1시간
        
        Returns:
            str: JWT Access Token
        """
        try:
            if not settings.TWILIO_API_KEY_SID or not settings.TWILIO_API_KEY_SECRET:
                raise ValueError("Twilio API Key credentials are not configured")
            
            if not settings.TWILIO_TWIML_APP_SID:
                raise ValueError("Twilio TwiML App SID is not configured")
            
            # Access Token 생성
            token = AccessToken(
                settings.TWILIO_ACCOUNT_SID,
                settings.TWILIO_API_KEY_SID,
                settings.TWILIO_API_KEY_SECRET,
                identity=identity,
                ttl=ttl
            )
            
            # Voice Grant 추가
            voice_grant = VoiceGrant(
                outgoing_application_sid=settings.TWILIO_TWIML_APP_SID,
                incoming_allow=True  # 수신 전화 허용
            )
            token.add_grant(voice_grant)
            
            jwt_token = token.to_jwt()
            
            logger.info(f"✅ Voice access token generated for identity: {identity}")
            return jwt_token.decode('utf-8') if isinstance(jwt_token, bytes) else jwt_token
            
        except Exception as e:
            logger.error(f"❌ Failed to generate voice access token: {e}")
            raise
    
    
    # TODO: TwiML 생성, 음성 스트리밍 처리 등 추가 구현 필요

