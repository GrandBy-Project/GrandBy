"""
STT (Speech-to-Text) 서비스
OpenAI Whisper API 사용
"""

from openai import OpenAI
from app.config import settings
import logging
import time

logger = logging.getLogger(__name__)


class STTService:
    """음성을 텍스트로 변환하는 서비스"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        # Whisper medium 모델 사용 (정확도와 속도의 균형)
        self.model = "whisper-1"  # OpenAI API는 whisper-1으로 통일
    
    def transcribe_audio(self, audio_file_path: str, language: str = "ko"):
        """
        음성 파일을 텍스트로 변환 (실행 시간 측정 포함)
        
        Args:
            audio_file_path: 음성 파일 경로 (local or URL)
            language: 언어 코드 (기본: ko - 한국어)
        
        Returns:
            tuple: (변환된 텍스트, 실행 시간)
        """
        try:
            start_time = time.time()  # 시작 시간 기록
            logger.info(f"🎤 STT 변환 시작: {audio_file_path}")
            
            with open(audio_file_path, "rb") as audio_file:
                transcript = self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    language=language,
                    response_format="text"
                )
            
            elapsed_time = time.time() - start_time  # 소요 시간 계산
            logger.info(f"✅ STT 변환 완료 (소요 시간: {elapsed_time:.2f}초)")
            logger.info(f"📝 변환 결과: {transcript[:100]}...")
            
            return transcript, elapsed_time
        except Exception as e:
            logger.error(f"❌ STT 변환 실패: {e}")
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

