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
                call_params["status_callback_event"] = ["initiated", "ringing", "answered", "completed"]
            
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
    
    def add_verified_caller_id(self, phone_number: str, friendly_name: str = None):
        """
        Verified Caller ID 등록 (ARS 인증 방식)
        
        Twilio가 해당 번호로 전화를 걸어 6자리 코드를 입력받아 인증
        한국 전화번호는 ARS 인증만 가능
        
        Args:
            phone_number: 등록할 전화번호 (+821012345678 형식)
            friendly_name: 전화번호의 별칭 (선택)
        
        Returns:
            dict: {
                "sid": str,              # Validation Request SID
                "phone_number": str,     # 등록된 전화번호
                "validation_code": str,  # 사용자가 입력할 6자리 코드
                "call_sid": str         # 인증 통화 SID
            }
        """
        try:
            # validation_requests API 사용 (올바른 방법)
            validation_request = self.client.validation_requests.create(
                phone_number=phone_number,
                friendly_name=friendly_name or phone_number
            )
            
            logger.info(f"✅ Validation Request created")
            logger.info(f"📞 Phone: {validation_request.phone_number}")
            logger.info(f"🔐 Validation Code: {validation_request.validation_code}")
            logger.info(f"📞 Call SID: {validation_request.call_sid}")
            
            return {
                "sid": validation_request.call_sid,
                "phone_number": validation_request.phone_number,
                "validation_code": validation_request.validation_code,
                "call_sid": validation_request.call_sid
            }
        except Exception as e:
            logger.error(f"❌ Failed to add verified caller ID: {e}")
            raise
    
    def check_caller_id_verified(self, phone_number: str) -> bool:
        """
        전화번호가 이미 Verified Caller IDs에 등록되어 있는지 확인
        
        Args:
            phone_number: 확인할 전화번호 (+821012345678 형식)
        
        Returns:
            bool: 등록 여부
        """
        try:
            caller_ids = self.client.outgoing_caller_ids.list(
                phone_number=phone_number
            )
            
            is_verified = len(caller_ids) > 0
            logger.info(f"📞 {phone_number} verified status: {is_verified}")
            return is_verified
        except Exception as e:
            logger.error(f"❌ Failed to check caller ID: {e}")
            return False
    
    def get_verified_caller_ids(self):
        """
        등록된 Verified Caller IDs 목록 조회
        
        Returns:
            list: Verified Caller IDs 목록
        """
        try:
            caller_ids = self.client.outgoing_caller_ids.list()
            
            result = []
            for caller_id in caller_ids:
                result.append({
                    "sid": caller_id.sid,
                    "phone_number": caller_id.phone_number,
                    "friendly_name": caller_id.friendly_name,
                    "date_created": caller_id.date_created
                })
            
            logger.info(f"✅ Retrieved {len(result)} verified caller IDs")
            return result
        except Exception as e:
            logger.error(f"❌ Failed to get verified caller IDs: {e}")
            raise
    
    def delete_verified_caller_id(self, caller_id_sid: str):
        """
        Verified Caller ID 삭제
        
        Args:
            caller_id_sid: 삭제할 Caller ID의 SID
        """
        try:
            self.client.outgoing_caller_ids(caller_id_sid).delete()
            logger.info(f"✅ Verified Caller ID deleted: {caller_id_sid}")
        except Exception as e:
            logger.error(f"❌ Failed to delete verified caller ID: {e}")
            raise
    
    # TODO: TwiML 생성, 음성 스트리밍 처리 등 추가 구현 필요

