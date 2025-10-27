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
        logger.info(f"🔍 [STT Service] 초기화 시작 - 제공자: {self.provider}")
        
        if self.provider == "google":
            logger.info(f"🔍 [STT Service] Google Cloud STT 초기화 중...")
            self._init_google_stt()
        else:  # openai
            logger.info(f"🔍 [STT Service] OpenAI Whisper 초기화 중...")
            self._init_openai_whisper()
        
        logger.info(f"✅ [STT Service] 초기화 완료: {self.provider.upper()}")
    
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
                enable_word_time_offsets=True,  # 단어별 시간 정보
                enable_word_confidence=True,    # 단어별 신뢰도
                max_alternatives=1,             # 최대 대안 수
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
        logger.info(f"🎤 [STT Service] transcribe_audio_chunk 시작")
        logger.info(f"   - 제공자: {self.provider}")
        logger.info(f"   - 청크 크기: {len(audio_chunk)} bytes")
        logger.info(f"   - 언어: {language}")
        logger.info(f"   - 청크 헤더: {audio_chunk[:4] if len(audio_chunk) >= 4 else 'N/A'}")
        
        if self.provider == "google":
            logger.info(f"🔍 [STT Service] Google Cloud STT로 라우팅")
            return await self._transcribe_google(audio_chunk, language)
        else:
            logger.info(f"🔍 [STT Service] OpenAI Whisper로 라우팅")
            return await self._transcribe_openai(audio_chunk, language)
    
    async def _transcribe_google(self, audio_chunk: bytes, language: str = "ko"):
        """Google Cloud STT로 변환"""
        try:
            start_time = time.time()
            logger.info(f"🔍 [Google STT 디버그] 시작 - 청크 크기: {len(audio_chunk)} bytes")
            
            # 청크 크기 검증 (0.1초로 줄임)
            min_size = 8000 * 2 * 0.1  # 최소 0.1초 = 1,600 bytes
            logger.info(f"🔍 [Google STT 디버그] 최소 길이 검증: {len(audio_chunk)} bytes (최소: {min_size})")
            
            if len(audio_chunk) < min_size:
                logger.warning(f"⚠️  [Google STT 디버그] 청크가 너무 작아 건너뜀: {len(audio_chunk)} bytes (최소: {min_size})")
                return "", 0
            
            # WAV 헤더 제거 (Google은 raw PCM만 필요)
            logger.info(f"🔍 [Google STT 디버그] WAV 헤더 확인: {audio_chunk[:4]}")
            if audio_chunk[:4] == b'RIFF':
                logger.info("🔍 [Google STT 디버그] WAV 헤더 제거 중...")
                try:
                    import wave
                    wav_io = io.BytesIO(audio_chunk)
                    with wave.open(wav_io, 'rb') as wav_file:
                        # WAV 파일 정보 확인
                        channels = wav_file.getnchannels()
                        sample_width = wav_file.getsampwidth()
                        framerate = wav_file.getframerate()
                        n_frames = wav_file.getnframes()
                        
                        logger.info(f"   - WAV 정보: {channels}ch, {sample_width*8}bit, {framerate}Hz, {n_frames} frames")
                        
                        # PCM 데이터 추출
                        audio_data = wav_file.readframes(n_frames)
                        logger.info(f"✅ [Google STT 디버그] WAV 헤더 제거 완료: {len(audio_data)} bytes")
                        
                        # Google Cloud STT 설정과 일치하는지 확인
                        if sample_width != 2:
                            logger.warning(f"⚠️  [Google STT 디버그] 샘플 폭 불일치: {sample_width*8}bit (예상: 16bit)")
                        if framerate != 8000:
                            logger.warning(f"⚠️  [Google STT 디버그] 샘플레이트 불일치: {framerate}Hz (예상: 8000Hz)")
                        if channels != 1:
                            logger.warning(f"⚠️  [Google STT 디버그] 채널 수 불일치: {channels}ch (예상: 1ch)")
                            
                except Exception as wav_error:
                    logger.error(f"❌ [Google STT 디버그] WAV 파싱 실패: {wav_error}")
                    logger.info("🔍 [Google STT 디버그] 원본 데이터 사용")
                    audio_data = audio_chunk
            else:
                logger.info("🔍 [Google STT 디버그] WAV 헤더 없음, 원본 사용")
                audio_data = audio_chunk
            
            # Google Cloud Speech API 호출
            logger.info(f"🌐 [Google STT 디버그] Google Cloud API 호출 중... (데이터: {len(audio_data)} bytes)")
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
            logger.info(f"✅ [Google STT 디버그] API 응답 받음 ({elapsed_time:.2f}초)")
            
            # 응답 구조 상세 분석
            logger.info(f"🔍 [Google STT 디버그] 응답 분석:")
            logger.info(f"   - response 타입: {type(response)}")
            logger.info(f"   - response.results 존재: {hasattr(response, 'results')}")
            
            if not response.results:
                logger.info("⏭️  STT 결과 없음")
                return "", elapsed_time
            
            logger.info(f"   - results 개수: {len(response.results)}")
            
            if len(response.results) == 0:
                logger.warning("⚠️  [Google STT 디버그] results 배열이 비어있음")
                return "", elapsed_time
            
            try:
                # 첫 번째 결과 상세 분석
                first_result = response.results[0]
                logger.info(f"   - 첫 번째 결과 타입: {type(first_result)}")
                logger.info(f"   - alternatives 존재: {hasattr(first_result, 'alternatives')}")
                
                if not hasattr(first_result, 'alternatives') or not first_result.alternatives:
                    logger.error(f"❌ [Google STT 디버그] alternatives가 없음")
                    return "", elapsed_time
                
                logger.info(f"   - alternatives 개수: {len(first_result.alternatives)}")
                
                # 첫 번째 alternative 상세 분석
                first_alternative = first_result.alternatives[0]
                logger.info(f"   - 첫 번째 alternative 타입: {type(first_alternative)}")
                logger.info(f"   - transcript 속성 존재: {hasattr(first_alternative, 'transcript')}")
                logger.info(f"   - confidence 속성 존재: {hasattr(first_alternative, 'confidence')}")
                
                if not hasattr(first_alternative, 'transcript'):
                    logger.error(f"❌ [Google STT 디버그] transcript 속성이 없음")
                    return "", elapsed_time
                
                transcript = first_alternative.transcript
                confidence = getattr(first_alternative, 'confidence', 0.0)
                
                logger.info(f"   - transcript 값: '{transcript}'")
                logger.info(f"   - transcript 타입: {type(transcript)}")
                logger.info(f"   - transcript 길이: {len(transcript) if transcript else 0}")
                logger.info(f"   - confidence 값: {confidence}")
                
                if transcript and transcript.strip():
                    logger.info(f"🎤 [Google STT] {transcript[:80]}... "
                               f"(신뢰도: {confidence:.2f}, {elapsed_time:.2f}초)")
                else:
                    logger.info(f"🔍 [Google STT 디버그] 빈 결과 반환")
                    
            except Exception as detail_error:
                logger.error(f"❌ [Google STT 디버그] 결과 파싱 중 오류: {detail_error}")
                logger.error(f"   - 오류 타입: {type(detail_error)}")
                import traceback
                logger.error(f"   - 상세 오류: {traceback.format_exc()}")
                return "", elapsed_time
            
            return transcript, elapsed_time
            
        except Exception as e:
            logger.error(f"❌ Google STT 변환 실패: {e}")
            logger.error(f"   - 청크 크기: {len(audio_chunk)}")
            logger.error(f"   - 청크 타입: {type(audio_chunk)}")
            import traceback
            logger.error(f"   - 상세 오류: {traceback.format_exc()}")
            return "", 0
    
    async def _transcribe_openai(self, audio_chunk: bytes, language: str = "ko"):
        """OpenAI Whisper로 변환"""
        try:
            start_time = time.time()
            logger.info(f"🔍 [OpenAI STT 디버그] 시작 - 청크 크기: {len(audio_chunk)} bytes")
            
            # 청크 크기 검증
            if len(audio_chunk) < self.min_chunk_size:
                logger.debug(f"⏭️  청크가 너무 작아 건너뜀: {len(audio_chunk)} bytes (최소: {self.min_chunk_size})")
                return "", 0
            
            # 임시 파일 생성
            logger.info(f"🔍 [OpenAI STT 디버그] 임시 파일 생성 중...")
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_path = temp_file.name
                temp_file.write(audio_chunk)
            logger.info(f"✅ [OpenAI STT 디버그] 임시 파일 생성 완료: {temp_path}")
            
            try:
                logger.info(f"🌐 [OpenAI STT 디버그] OpenAI Whisper API 호출 중...")
                loop = asyncio.get_event_loop()
                transcript = await loop.run_in_executor(
                    None,
                    self._transcribe_file_sync,
                    temp_path,
                    language
                )
                
                elapsed_time = time.time() - start_time
                logger.info(f"✅ [OpenAI STT 디버그] API 응답 받음 ({elapsed_time:.2f}초)")
                
                if transcript and transcript.strip():
                    logger.info(f"🎤 [OpenAI STT] {transcript[:80]}... ({elapsed_time:.2f}초)")
                else:
                    logger.info(f"🔍 [OpenAI STT 디버그] 빈 결과 반환")
                
                return transcript, elapsed_time
                
            finally:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
                    logger.info(f"🗑️  [OpenAI STT 디버그] 임시 파일 삭제: {temp_path}")
                    
        except Exception as e:
            logger.error(f"❌ OpenAI STT 변환 실패: {e}")
            logger.error(f"   - 청크 크기: {len(audio_chunk)}")
            logger.error(f"   - 청크 타입: {type(audio_chunk)}")
            import traceback
            logger.error(f"   - 상세 오류: {traceback.format_exc()}")
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
        try:
            logger.info(f"🔍 [OpenAI STT Sync 디버그] 파일 변환 시작: {file_path}")
            
            # 파일 크기 확인
            file_size = os.path.getsize(file_path)
            logger.info(f"🔍 [OpenAI STT Sync 디버그] 파일 크기: {file_size} bytes")
            
            with open(file_path, "rb") as audio_file:
                logger.info(f"🌐 [OpenAI STT Sync 디버그] OpenAI API 호출 중... (모델: {self.model})")
                transcript = self.client.audio.transcriptions.create(
                    model=self.model,
                    file=audio_file,
                    language=language,
                    response_format="text",
                    temperature=0.0,  # 랜덤성 최소화
                    prompt="이 입력은 전화 대화의 한 부분입니다. 말이 없으면 아무것도 출력하지 마세요."
                )
            
            logger.info(f"✅ [OpenAI STT Sync 디버그] API 응답 받음: '{transcript[:50]}...'")
            return transcript
            
        except Exception as e:
            logger.error(f"❌ [OpenAI STT Sync 디버그] 파일 변환 실패: {e}")
            logger.error(f"   - 파일 경로: {file_path}")
            logger.error(f"   - 파일 크기: {os.path.getsize(file_path) if os.path.exists(file_path) else 'N/A'}")
            import traceback
            logger.error(f"   - 상세 오류: {traceback.format_exc()}")
            return ""
    
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

