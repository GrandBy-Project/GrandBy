"""
STT (Speech-to-Text) 서비스
Google Cloud Speech-to-Text + OpenAI Whisper API 지원
"""

from openai import OpenAI
from google.cloud import speech
from google.api_core import retry
from app.config import settings
import logging
import time
import tempfile
import os
import asyncio
import io

logger = logging.getLogger(__name__)


class STTService:
    """음성을 텍스트로 변환하는 서비스 (Google Cloud & OpenAI 지원)"""
    
    def __init__(self):
        # STT 제공자 설정 (환경 변수에서 읽기, 기본값: google)
        self.provider = getattr(settings, 'STT_PROVIDER', 'google').lower()
        
        if self.provider == "google":
            self._init_google_stt()
        else:  # openai
            self._init_openai_whisper()
        
        logger.info(f"🎤 STT 서비스 초기화 완료: {self.provider.upper()}")
    
    def _init_google_stt(self):
        """Google Cloud STT 초기화"""
        try:
            # 환경 변수에서 인증 정보 설정
            credentials_path = getattr(settings, 'GOOGLE_APPLICATION_CREDENTIALS', 'credentials/google-cloud-stt.json')
            if os.path.exists(credentials_path):
                os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = credentials_path
                logger.info(f"✅ Google Cloud 인증 파일 로드: {credentials_path}")
            
            self.google_client = speech.SpeechClient()
            
            # 기본 인식 설정
            self.google_config = speech.RecognitionConfig(
                encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
                sample_rate_hertz=8000,
                language_code="ko-KR",
                model="latest_short",  # 전화 통화 최적화
                enable_automatic_punctuation=True,
                use_enhanced=True,
                audio_channel_count=1,
            )
            
            logger.info("✅ Google Cloud STT 초기화 완료")
            
        except Exception as e:
            logger.warning(f"⚠️ Google Cloud STT 초기화 실패, OpenAI로 폴백: {e}")
            self.provider = "openai"
            self._init_openai_whisper()
    
    def _init_openai_whisper(self):
        """OpenAI Whisper 초기화"""
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = "whisper-1"
        self.min_chunk_size = 8000 * 2 * 0.5  # 8kHz, 16bit, 최소 0.5초
        logger.info("✅ OpenAI Whisper 초기화 완료")
    
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
                    response_format="text",
                    temperature=0.0,  # 랜덤성 최소화
                    prompt="이 입력은 전화 대화의 한 부분입니다. 말이 없으면 아무것도 출력하지 마세요."
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
        
        제공자에 따라 Google Cloud 또는 OpenAI Whisper 사용
        
        Args:
            audio_chunk: 오디오 데이터 청크 (바이트 형식, WAV 권장)
            language: 언어 코드 (기본값: "ko" - 한국어)
        
        Returns:
            tuple: (변환된 텍스트, 실행 시간)
        """
        if self.provider == "google":
            return await self._transcribe_google(audio_chunk, language)
        else:
            return await self._transcribe_openai(audio_chunk, language)
    
    async def _transcribe_google(self, audio_chunk: bytes, language: str = "ko"):
        """Google Cloud STT로 변환"""
        try:
            start_time = time.time()
            
            # 청크 크기 검증
            min_size = 8000 * 2 * 0.3  # 최소 0.3초
            if len(audio_chunk) < min_size:
                logger.debug(f"⏭️  청크가 너무 작아 건너뜀: {len(audio_chunk)} bytes")
                return "", 0
            
            # WAV 헤더 제거 (Google은 raw PCM만 필요)
            if audio_chunk[:4] == b'RIFF':
                import wave
                wav_io = io.BytesIO(audio_chunk)
                with wave.open(wav_io, 'rb') as wav_file:
                    audio_data = wav_file.readframes(wav_file.getnframes())
            else:
                audio_data = audio_chunk
            
            # Google Cloud Speech API 호출
            audio = speech.RecognitionAudio(content=audio_data)
            
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.google_client.recognize(
                    config=self.google_config,
                    audio=audio,
                    retry=retry.Retry(deadline=10.0)
                )
            )
            
            elapsed_time = time.time() - start_time
            
            if not response.results:
                logger.debug("⏭️  STT 결과 없음")
                return "", elapsed_time
            
            transcript = response.results[0].alternatives[0].transcript
            confidence = response.results[0].alternatives[0].confidence
            
            if transcript and transcript.strip():
                logger.info(f"🎤 [Google STT] {transcript[:80]}... "
                           f"(신뢰도: {confidence:.2f}, {elapsed_time:.2f}초)")
            
            return transcript, elapsed_time
            
        except Exception as e:
            logger.error(f"❌ Google STT 변환 실패: {e}")
            return "", 0
    
    async def _transcribe_openai(self, audio_chunk: bytes, language: str = "ko"):
        """OpenAI Whisper로 변환"""
        try:
            start_time = time.time()
            
            # 청크 크기 검증
            if len(audio_chunk) < self.min_chunk_size:
                logger.debug(f"⏭️  청크가 너무 작아 건너뜀: {len(audio_chunk)} bytes")
                return "", 0
            
            # 임시 파일 생성
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
                temp_file.write(audio_chunk)
            
            try:
                loop = asyncio.get_event_loop()
                transcript = await loop.run_in_executor(
                    None,
                    self._transcribe_file_sync,
                    temp_path,
                    language
                )
                
                elapsed_time = time.time() - start_time
                
                if transcript and transcript.strip():
                    logger.info(f"🎤 [OpenAI STT] {transcript[:80]}... ({elapsed_time:.2f}초)")
                
                return transcript, elapsed_time
                
            finally:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    
        except Exception as e:
            logger.error(f"❌ OpenAI STT 변환 실패: {e}")
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
                response_format="text",
                temperature=0.0,  # 랜덤성 최소화
                prompt="이 입력은 전화 대화의 한 부분입니다. 말이 없으면 아무것도 출력하지 마세요."
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
                    timestamp_granularities=["segment"],
                    temperature=0.0
                )
            return transcript
        except Exception as e:
            logger.error(f"Failed to transcribe with timestamps: {e}")
            raise

