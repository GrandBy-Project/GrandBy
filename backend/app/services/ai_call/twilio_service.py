"""
Twilio 음성 통화 서비스
"""

from twilio.rest import Client
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
    
    def make_call(self, to_number: str, callback_url: str = None):
        """
        전화 걸기
        
        Args:
            to_number: 수신자 전화번호 (+821012345678 형식)
            callback_url: 통화 상태 콜백 URL
        
        Returns:
            call_sid: Twilio Call SID
        """
        try:
            call = self.client.calls.create(
                to=to_number,
                from_=self.phone_number,
                url=callback_url or "https://your-app.com/api/calls/twiml",  # TwiML 응답 URL
                status_callback=callback_url or "https://your-app.com/api/calls/status",
                status_callback_event=["initiated", "ringing", "answered", "completed"]
            )
            logger.info(f"Call initiated: {call.sid} to {to_number}")
            return call.sid
        except Exception as e:
            logger.error(f"Failed to make call: {e}")
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
    
    # TODO: TwiML 생성, 음성 스트리밍 처리 등 추가 구현 필요

