"""
STT (Speech-to-Text) 서비스
Google Cloud Speech-to-Text + OpenAI Whisper + RTZR WebSocket STT 지원
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
import json
import requests
import base64

logger = logging.getLogger(__name__)


class STTService:
    """음성을 텍스트로 변환하는 서비스 (Google, OpenAI, RTZR 지원)"""
    
    def __init__(self):
        # STT 제공자 설정 (환경 변수에서 읽기, 기본값: google)
        self.provider = getattr(settings, 'STT_PROVIDER', 'google').lower()
        logger.info(f"🔍 [STT Service] 초기화 시작 - 제공자: {self.provider}")
        
        if self.provider == "google":
            logger.info(f"🔍 [STT Service] Google Cloud STT 초기화 중...")
            self._init_google_stt()
        elif self.provider == "rtzr":
            logger.info(f"🔍 [STT Service] RTZR 스트리밍 STT 초기화 중...")
            self._init_rtzr_stt()
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
    
    def _init_rtzr_stt(self):
        """RTZR 스트리밍 STT 초기화"""
        try:
            self.rtzr_client_id = settings.RTZR_CLIENT_ID
            self.rtzr_client_secret = settings.RTZR_CLIENT_SECRET
            self.rtzr_api_base = settings.RTZR_API_BASE
            
            if not self.rtzr_client_id or not self.rtzr_client_secret:
                raise ValueError("RTZR_CLIENT_ID와 RTZR_CLIENT_SECRET이 설정되지 않았습니다")
            
            # ⭐ 토큰 캐싱 변수 초기화
            self._cached_token = None
            self._token_expires_at = 0
            
            # ⭐ WebSocket 연결 풀 초기화
            self._rtzr_ws = None
            self._rtzr_ws_lock = asyncio.Lock()
            
            logger.info(f"✅ RTZR STT 초기화 완료")
            logger.info(f"   - API Base: {self.rtzr_api_base}")
        except Exception as e:
            logger.error(f"❌ RTZR STT 초기화 실패: {e}")
            raise
    
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
    
    async def transcribe_audio_chunk(self, audio_chunk: bytes, language: str = "ko", intermediate_callback=None):
        """
        오디오 청크를 실시간으로 텍스트 변환 (비동기 처리)
        
        제공자에 따라 Google Cloud, OpenAI Whisper, 또는 RTZR 사용
        RTZR 사용 시 중간 결과 콜백 지원
        
        Args:
            audio_chunk: 오디오 데이터 청크 (바이트 형식, WAV 권장)
            language: 언어 코드 (기본값: "ko" - 한국어)
            intermediate_callback: 중간 결과 콜백 (RTZR 전용, optional)
        
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
        elif self.provider == "rtzr":
            logger.info(f"🔍 [STT Service] RTZR WebSocket STT로 라우팅")
            return await self._transcribe_rtzr(audio_chunk, language, intermediate_callback)
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
    
    async def _get_rtzr_token(self):
        """RTZR 토큰 가져오기 (캐싱)"""
        # 캐시된 토큰 유효성 검사
        if self._cached_token and self._token_expires_at > time.time():
            logger.debug("♻️ 캐시된 토큰 재사용")
            return self._cached_token
        
        # 새 토큰 발급
        logger.info("🔐 [RTZR] 새 토큰 발급 중...")
        auth_response = requests.post(
            f"{self.rtzr_api_base}/v1/authenticate",
            data={
                "client_id": self.rtzr_client_id,
                "client_secret": self.rtzr_client_secret
            }
        )
        
        if auth_response.status_code != 200:
            raise Exception(f"RTZR 인증 실패: {auth_response.status_code}")
        
        token = auth_response.json()["access_token"]
        
        # 캐시 (1시간 유효)
        self._cached_token = token
        self._token_expires_at = time.time() + 3600
        
        logger.info("✅ [RTZR] 토큰 발급 및 캐시 완료")
        return token
    
    async def _get_rtzr_websocket(self, token: str):
        """WebSocket 연결 가져오기 - RTZR은 발화마다 새 연결 필요"""
        async with self._rtzr_ws_lock:
            # RTZR 특성상 EOS 전송 시 연결이 종료되므로 매번 새로 연결
            if self._rtzr_ws:
                try:
                    await self._rtzr_ws.close()
                except:
                    pass
                self._rtzr_ws = None
            
            # 새로 연결
            logger.info("🌐 [RTZR] 새 WebSocket 연결 중...")
            import websockets
            
            ws_url = "wss://openapi.vito.ai/v1/transcribe:streaming"
            params = {
                "sample_rate": "8000",
                "encoding": "LINEAR16",
                "use_itn": str(settings.RTZR_USE_ITN).lower(),
                "use_disfluency_filter": str(settings.RTZR_USE_DISFLUENCY_FILTER).lower(),
                "use_profanity_filter": str(settings.RTZR_USE_PROFANITY_FILTER).lower()
            }
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            
            headers = {"Authorization": f"Bearer {token}"}
            
            self._rtzr_ws = await websockets.connect(
                f"{ws_url}?{query_string}",
                additional_headers=headers,
                ping_interval=None
            )
            
            logger.info("✅ [RTZR] WebSocket 연결 완료 (재사용 가능)")
            return self._rtzr_ws
    
    async def close_rtzr_websocket(self):
        """통화 종료 시 WebSocket 연결 닫기"""
        async with self._rtzr_ws_lock:
            if self._rtzr_ws:
                try:
                    await self._rtzr_ws.close()
                    logger.info("🔄 [RTZR] WebSocket 연결 종료")
                except:
                    pass
                self._rtzr_ws = None
    
    async def _transcribe_rtzr(self, audio_chunk: bytes, language: str = "ko", intermediate_callback=None):
        """
        RTZR WebSocket STT로 변환 (토큰 캐싱 + 연결 재사용 + 중간 결과 활용)
        
        Args:
            audio_chunk: 오디오 데이터
            language: 언어 코드
            intermediate_callback: 중간 결과 콜백 함수 (optional)
        """
        try:
            start_time = time.time()
            logger.info(f"🔍 [RTZR STT] 시작 - 청크 크기: {len(audio_chunk)} bytes")
            
            # WAV 헤더 제거 및 PCM 추출
            import wave
            pcm_data = audio_chunk
            
            if audio_chunk[:4] == b'RIFF':
                logger.info("🔍 [RTZR STT] WAV 헤더 제거 중...")
                wav_io = io.BytesIO(audio_chunk)
                with wave.open(wav_io, 'rb') as wav_file:
                    pcm_data = wav_file.readframes(wav_file.getnframes())
                    logger.info(f"✅ WAV 헤더 제거: {len(pcm_data)} bytes")
            
            # ⭐ 토큰 가져오기 (캐시)
            token = await self._get_rtzr_token()
            
            # ⭐ WebSocket 가져오기 (재사용)
            ws = await self._get_rtzr_websocket(token)
            
            # 오디오 데이터 전송
            logger.info(f"📤 [RTZR STT] 오디오 데이터 전송 중... ({len(pcm_data)} bytes)")
            
            # 청크 단위로 전송
            chunk_size = 16000  # 1초 분량
            for i in range(0, len(pcm_data), chunk_size):
                chunk = pcm_data[i:i + chunk_size]
                await ws.send(chunk)
                await asyncio.sleep(0.01)
            
            # 종료 신호 전송
            await ws.send("EOS")
            logger.info("📤 [RTZR STT] EOS 전송 완료")
            
            # 결과 수신
            result_text = ""
            results_received = []
            intermediate_text = ""
            final_received = False
            
            try:
                # ⭐ 여러 응답 수신 (최종 결과까지)
                max_attempts = 3  # 최대 3번까지 응답 받기
                for attempt in range(max_attempts):
                    try:
                        response = await asyncio.wait_for(ws.recv(), timeout=2.0)
                        if isinstance(response, bytes):
                            continue
                        
                        result = json.loads(response)
                        results_received.append(result)
                        logger.info(f"📥 [RTZR STT] 응답 수신 [{attempt+1}]: {json.dumps(result, ensure_ascii=False)}")
                        
                        # alternatives에서 텍스트 추출
                        if "alternatives" in result and len(result["alternatives"]) > 0:
                            text = result["alternatives"][0].get("text", "")
                            is_final = result.get("final", False)
                            
                            if is_final:
                                result_text = text
                                final_received = True
                                logger.info(f"✅ [RTZR STT] 최종 결과: '{text}'")
                                break  # 최종 결과 받았으므로 종료
                            else:
                                # ⭐ 중간 결과 활용
                                intermediate_text = text
                                logger.info(f"🔄 [RTZR STT] 중간 결과: '{text}'")
                                
                                # ⭐ 콜백이 있으면 중간 결과를 즉시 전달 (병렬 처리 가능)
                                if intermediate_callback and text and text.strip():
                                    try:
                                        await intermediate_callback(text)
                                        logger.info(f"📤 [RTZR STT] 중간 결과 콜백 실행: '{text}'")
                                    except Exception as callback_error:
                                        logger.error(f"❌ 중간 결과 콜백 오류: {callback_error}")
                            
                            # 중간 결과로도 최종 결과 설정 (final이 없을 수 있음)
                            if not final_received and text:
                                result_text = text
                                
                    except asyncio.TimeoutError:
                        logger.debug(f"🔄 [RTZR STT] 응답 타임아웃 [{attempt+1}]")
                        if result_text:  # 이미 결과가 있으면 종료
                            break
                        continue
                            
            except Exception as close_error:
                logger.debug(f"WebSocket 종료: {close_error}")
                if results_received:
                    for r in reversed(results_received):
                        if "alternatives" in r and len(r["alternatives"]) > 0:
                            result_text = r["alternatives"][0].get("text", "")
                            if r.get("final", False):
                                break
            
            # ⭐ WebSocket 종료하지 않음! (다음 발화를 위해 재사용)
            elapsed_time = time.time() - start_time
            logger.info(f"✅ [RTZR STT] 완료 ({elapsed_time:.2f}초): '{result_text}'")
            
            return result_text, elapsed_time
            
        except Exception as e:
            logger.error(f"❌ RTZR STT 변환 실패: {e}")
            # 에러 발생 시 연결 초기화
            async with self._rtzr_ws_lock:
                if self._rtzr_ws:
                    try:
                        await self._rtzr_ws.close()
                    except:
                        pass
                    self._rtzr_ws = None
            import traceback
            logger.error(traceback.format_exc())
            return "", 0

