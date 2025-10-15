"""
STT (Speech-to-Text) 서비스
OpenAI Whisper API 사용 + 실시간 청크 기반 처리 지원
"""

from openai import OpenAI
from app.config import settings
import logging
import time
import tempfile
import os
import asyncio

logger = logging.getLogger(__name__)


class STTService:
    """음성을 텍스트로 변환하는 서비스"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        # Whisper medium 모델 사용 (정확도와 속도의 균형)
        self.model = "whisper-1"  # OpenAI API는 whisper-1으로 통일
        # 실시간 처리를 위한 설정 (Twilio는 8kHz 사용)
        self.min_chunk_size = 8000 * 2 * 0.5  # 8kHz, 16bit, 최소 0.5초
    
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
    
    async def transcribe_audio_chunk(self, audio_chunk: bytes, language: str = "ko"):
        """
        오디오 청크를 실시간으로 텍스트 변환 (비동기 처리)
        
        Twilio mulaw 오디오를 실시간으로 변환하는 메서드입니다.
        작은 청크는 자동으로 필터링되어 불필요한 API 호출을 방지합니다.
        
        Args:
            audio_chunk: 오디오 데이터 청크 (바이트 형식, WAV 권장)
            language: 언어 코드 (기본값: "ko" - 한국어)
        
        Returns:
            tuple: (변환된 텍스트, 실행 시간)
            - 청크가 너무 작으면 ("", 0) 반환
        """
        try:
            start_time = time.time()
            
            # 청크 크기 검증: 최소 0.5초 이상의 오디오만 처리
            if len(audio_chunk) < self.min_chunk_size:
                logger.debug(f"⏭️  청크가 너무 작아 건너뜀: {len(audio_chunk)} bytes (최소: {self.min_chunk_size})")
                return "", 0
            
            # 임시 파일 생성 (Whisper API는 파일 입력만 지원)
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
                temp_file.write(audio_chunk)
            
            try:
                # 비동기로 변환 실행 (이벤트 루프 블로킹 방지)
                loop = asyncio.get_event_loop()
                transcript = await loop.run_in_executor(
                    None,
                    self._transcribe_file_sync,
                    temp_path,
                    language
                )
                
                elapsed_time = time.time() - start_time
                
                # 변환 결과가 있을 때만 로그 출력
                if transcript and transcript.strip():
                    logger.info(f"🎤 [실시간 STT] {transcript[:80]}... ({elapsed_time:.2f}초)")
                
                return transcript, elapsed_time
                
            finally:
                # 임시 파일 삭제
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    
        except Exception as e:
            logger.error(f"❌ 실시간 STT 변환 실패: {e}")
            return "", 0
    
    def _transcribe_file_sync(self, file_path: str, language: str) -> str:
        """
        동기 방식 파일 변환 (executor에서 실행용)
        
        이 메서드는 직접 호출하지 마세요. 
        transcribe_audio_chunk()에서 내부적으로 사용됩니다.
        
        Args:
            file_path: 변환할 음성 파일 경로
            language: 언어 코드
        
        Returns:
            str: 변환된 텍스트
        """
        with open(file_path, "rb") as audio_file:
            transcript = self.client.audio.transcriptions.create(
                model=self.model,
                file=audio_file,
                language=language,
                response_format="text"
            )
        return transcript
    
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

