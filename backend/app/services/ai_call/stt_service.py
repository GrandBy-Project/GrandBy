"""
STT (Speech-to-Text) 서비스
OpenAI Whisper API 사용
"""

from openai import OpenAI
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class STTService:
    """음성을 텍스트로 변환하는 서비스"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_WHISPER_MODEL
    
    def transcribe_audio(self, audio_file_path: str, language: str = "ko"):
        """
        음성 파일을 텍스트로 변환
        
        Args:
            audio_file_path: 음성 파일 경로 (local or URL)
            language: 언어 코드 (기본: ko)
        
        Returns:
            str: 변환된 텍스트
        """
        try:
            with open(audio_file_path, "rb") as audio_file:
                transcript = self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    language=language,
                    response_format="text"
                )
            logger.info(f"Transcribed audio: {audio_file_path}")
            return transcript
        except Exception as e:
            logger.error(f"Failed to transcribe audio: {e}")
            raise
    
    def transcribe_audio_with_timestamps(self, audio_file_path: str):
        """
        타임스탬프 포함 변환
        
        Args:
            audio_file_path: 음성 파일 경로
        
        Returns:
            dict: segments와 타임스탬프 정보
        """
        try:
            with open(audio_file_path, "rb") as audio_file:
                transcript = self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"]
                )
            return transcript
        except Exception as e:
            logger.error(f"Failed to transcribe with timestamps: {e}")
            raise

