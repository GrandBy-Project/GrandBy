"""
TTS (Text-to-Speech) 서비스
OpenAI TTS API 사용
"""

from openai import OpenAI
from app.config import settings
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


class TTSService:
    """텍스트를 음성으로 변환하는 서비스"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_TTS_MODEL
        self.voice = settings.OPENAI_TTS_VOICE  # alloy, echo, fable, onyx, nova, shimmer
    
    def text_to_speech(self, text: str, output_path: str = None):
        """
        텍스트를 음성으로 변환
        
        Args:
            text: 변환할 텍스트
            output_path: 저장할 파일 경로 (None이면 임시 파일)
        
        Returns:
            str: 저장된 파일 경로
        """
        try:
            if output_path is None:
                output_path = f"/tmp/tts_{hash(text)}.mp3"
            
            response = self.client.audio.speech.create(
                model=self.model,
                voice=self.voice,
                input=text
            )
            
            # 파일로 저장
            response.stream_to_file(output_path)
            
            logger.info(f"Generated TTS audio: {output_path}")
            return output_path
        except Exception as e:
            logger.error(f"Failed to generate TTS: {e}")
            raise
    
    def text_to_speech_streaming(self, text: str):
        """
        실시간 스트리밍 TTS
        (향후 구현 - Twilio와 통합)
        
        Args:
            text: 변환할 텍스트
        
        Returns:
            audio stream
        """
        # TODO: 실시간 스트리밍 구현
        pass

