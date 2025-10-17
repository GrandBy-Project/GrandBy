"""
Grandby FastAPI Application
메인 애플리케이션 진입점
"""

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Form, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from pydantic import BaseModel
from contextlib import asynccontextmanager
import logging
import json
import base64
import asyncio
import os
import tempfile
from typing import Dict, Optional
import audioop
from datetime import datetime
from sqlalchemy.orm import Session
import time

from twilio.twiml.voice_response import VoiceResponse, Connect, Stream

from app.routers import auth, users, calls, diaries, todos, notifications, dashboard
from app.config import settings, is_development
from app.database import test_db_connection, get_db
from app.services.ai_call.stt_service import STTService
from app.services.ai_call.tts_service import TTSService
from app.services.ai_call.llm_service import LLMService
from app.services.ai_call.twilio_service import TwilioService

# 로거 설정 (시간 포함)
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# OpenAI 클라이언트 및 서비스 초기화
stt_service = STTService()
tts_service = TTSService()
llm_service = LLMService()

# WebSocket 연결 및 대화 세션 관리
active_connections: Dict[str, WebSocket] = {}
conversation_sessions: Dict[str, list] = {}


# ==================== AudioProcessor ====================

class AudioProcessor:
    """
    오디오 처리 클래스 - 실시간 오디오 버퍼링 및 침묵 감지
    
    Twilio에서 수신한 mulaw 오디오를 버퍼링하고,
    침묵을 감지하여 STT 처리 시점을 결정합니다.
    """
    
    def __init__(self, call_sid: str):
        self.call_sid = call_sid
        self.audio_buffer = []  # 오디오 청크 버퍼
        self.transcript_buffer = []  # 실시간 STT 결과 버퍼
        self.is_speaking = False  # 사용자가 말하고 있는지 여부
        # mulaw RMS 범위에 맞게 임계값 조정 (0~127)
        self.silence_threshold = 20  # 침묵 감지 임계값 (RMS)
        self.silence_duration = 0  # 현재 침묵 지속 시간
        self.max_silence = 1.0  # ⭐ 1초 침묵 후 STT 처리 (응답 속도 최적화)

        # 초기 노이즈 필터링
        self.warmup_chunks = 0  # 받은 청크 수
        self.warmup_threshold = 25  # 처음 0.5초 무시
        
        # 연속 음성 감지
        self.voice_chunks = 0  # 연속 음성 감지 카운터
        self.voice_threshold = 3  # 최소 3번 연속 감지
        
        # TTS 재생 상태 (에코 방지)
        self.is_bot_speaking = False
        self.bot_silence_delay = 0
        
    # def add_audio_chunk(self, audio_data: bytes):
    #     """오디오 청크 추가"""
    #     self.audio_buffer.append(audio_data)
        
    #     # 음성 활동 감지 (RMS - Root Mean Square)
    #     rms = audioop.rms(audio_data, 2)  # 16-bit audio
        
    #     if rms > self.silence_threshold:
    #         self.is_speaking = True
    #         self.silence_duration = 0
    #     else:
    #         if self.is_speaking:
    #             self.silence_duration += 0.02  # 20ms per chunk

    def add_audio_chunk(self, audio_data: bytes):
        """오디오 청크 추가 및 음성 활동 감지"""
        self.audio_buffer.append(audio_data)
        
        # 워밍업: 초기 청크 무시 (연결 노이즈 방지)
        self.warmup_chunks += 1
        if self.warmup_chunks <= self.warmup_threshold:
            if self.warmup_chunks == 1:
                logger.info("⏳ 오디오 초기화 중...")
            return
        
        # AI가 말하는 동안 + 종료 후 1초간 사용자 입력 무시 (에코 방지)
        if self.is_bot_speaking or self.bot_silence_delay > 0:
            if self.bot_silence_delay > 0:
                self.bot_silence_delay -= 1
                if self.bot_silence_delay == 0:
                    logger.info("✅ AI 응답 종료 후 대기 완료, 사용자 입력 재개")
            return
        
        # RMS 계산 (음량 측정)
        rms = audioop.rms(audio_data, 1)
        
        # 비정상적으로 큰 RMS 값 필터링 (연결음, 에러 등)
        if rms > 100:
            logger.warning(f"⚠️  비정상적인 RMS 무시: {rms}")
            self.voice_chunks = 0
            return
        
        # 음성 활동 감지
        if rms > self.silence_threshold:
            self.voice_chunks += 1
            
            # 연속으로 여러 번 감지되어야 음성으로 인정
            if self.voice_chunks >= self.voice_threshold:
                if not self.is_speaking:
                    logger.info(f"🎤 [음성 감지] 말하기 시작 (RMS: {rms})")
                self.is_speaking = True
                self.silence_duration = 0
        else:
            # 조용하면 음성 카운터 리셋
            self.voice_chunks = 0
            
            # 이전에 말하고 있었다면 침묵 카운터 증가
            if self.is_speaking:
                if self.silence_duration == 0:
                    logger.info(f"🔇 [침묵 감지] 말을 멈춤")
                
                self.silence_duration += 0.02  # 20ms per chunk
                
                # 침묵 진행 상황 (0.5초마다)
                if int(self.silence_duration * 10) % 5 == 0:
                    logger.debug(f"⏱️  침묵: {self.silence_duration:.1f}초 / {self.max_silence}초")
                
    def should_process(self) -> bool:
        """오디오 처리가 필요한지 확인 (사용자가 말을 멈췄는지)"""
        return (self.is_speaking and
                self.silence_duration >= self.max_silence and 
                len(self.audio_buffer) > 0)
    
    def get_audio(self) -> bytes:
        """
        버퍼링된 오디오 가져오기 및 초기화
        
        Returns:
            bytes: 병합된 오디오 데이터 (mulaw 포맷)
        """
        audio = b''.join(self.audio_buffer)
        self.audio_buffer = []
        self.is_speaking = False
        self.silence_duration = 0
        return audio
    
    def add_transcript(self, text: str):
        """
        실시간 변환된 텍스트를 버퍼에 추가
        
        Args:
            text: 변환된 텍스트
        """
        if text and text.strip():
            self.transcript_buffer.append(text)
            logger.debug(f"📝 텍스트 버퍼 추가: {len(self.transcript_buffer)}개 문장")
    
    def get_full_transcript(self) -> str:
        """
        전체 대화 내용 가져오기
        
        Returns:
            str: 공백으로 결합된 전체 대화 텍스트
        """
        return " ".join(self.transcript_buffer)
    
    def start_bot_speaking(self):
        """AI 응답 시작 - 사용자 입력 차단 (에코 방지)"""
        logger.info("🤖 [에코 방지] AI 응답 중 - 사용자 입력 차단")
        self.is_bot_speaking = True
        # 기존 상태 초기화
        self.is_speaking = False
        self.voice_chunks = 0
        self.silence_duration = 0
    
    def stop_bot_speaking(self):
        """AI 응답 종료 - 1초 대기 후 사용자 입력 재개"""
        self.is_bot_speaking = False
        self.bot_silence_delay = 50  # 50개 청크 = 1초 대기
        logger.info("🤖 [에코 방지] AI 응답 종료 - 1초 후 사용자 입력 재개")


# ==================== Helper Functions ====================

async def transcribe_audio_realtime(audio_data: bytes) -> tuple[str, float]:
    """
    실시간 오디오를 텍스트로 변환 (실시간 청크 기반 STT)
    
    Twilio mulaw 포맷을 WAV로 변환 후 실시간 STT 처리합니다.
    새로운 transcribe_audio_chunk() 메서드를 사용하여 비동기로 처리합니다.
    
    Args:
        audio_data: Twilio에서 받은 mulaw 오디오 데이터
    
    Returns:
        tuple: (변환된 텍스트, 실행 시간)
    """
    try:
        import wave
        import io
        
        # mulaw를 16-bit PCM으로 변환
        try:
            pcm_data = audioop.ulaw2lin(audio_data, 2)
        except Exception as conv_error:
            logger.error(f"❌ mulaw 변환 오류: {conv_error}")
            return "", 0
        
        # PCM 데이터를 WAV 포맷으로 변환 (메모리 내)
        wav_io = io.BytesIO()
        with wave.open(wav_io, 'wb') as wav_file:
            wav_file.setnchannels(1)      # Mono
            wav_file.setsampwidth(2)      # 16-bit (2 bytes)
            wav_file.setframerate(8000)   # 8kHz (Twilio 샘플레이트)
            wav_file.writeframes(pcm_data)
        
        wav_data = wav_io.getvalue()
        logger.debug(f"📝 WAV 변환 완료: {len(wav_data)} bytes")
        
        # 실시간 STT 변환 (비동기 처리)
        transcript, stt_time = await stt_service.transcribe_audio_chunk(
            wav_data,
            language="ko"
        )
        
        return transcript, stt_time
        
    except Exception as e:
        logger.error(f"❌ 실시간 음성 인식 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return "", 0


async def convert_and_send_audio(websocket: WebSocket, stream_sid: str, text: str):
    """
    단일 문장을 TTS 변환하고 Twilio로 즉시 전송 (병렬 처리용)
    
    이 함수는 LLM 스트리밍 중 문장이 완성될 때마다 호출됩니다.
    사용자는 AI가 말하는 것을 거의 실시간으로 들을 수 있습니다.
    
    처리 플로우:
    1. 문장 TTS 변환 (비동기)
    2. WAV → mulaw 변환
    3. Base64 인코딩
    4. Twilio WebSocket으로 전송
    
    Args:
        websocket: Twilio WebSocket 연결
        stream_sid: Twilio Stream SID
        text: 변환할 문장
    """
    try:
        import wave
        import io
        
        # 1. TTS 변환 (문장 단위, 비동기)
        audio_data, tts_time = await tts_service.text_to_speech_sentence(text)
        
        if not audio_data:
            logger.warning(f"⚠️ TTS 변환 실패, 건너뜀: {text[:30]}...")
            return
        
        # 2. WAV → mulaw 변환 (Twilio 호환)
        wav_io = io.BytesIO(audio_data)
        with wave.open(wav_io, 'rb') as wav_file:
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            framerate = wav_file.getframerate()
            pcm_data = wav_file.readframes(wav_file.getnframes())
        
        # Stereo → Mono 변환 (필요 시)
        if channels == 2:
            pcm_data = audioop.tomono(pcm_data, sample_width, 1, 1)
        
        # 샘플레이트 변환: Twilio는 8kHz 요구
        if framerate != 8000:
            pcm_data, _ = audioop.ratecv(pcm_data, sample_width, 1, framerate, 8000, None)
        
        # PCM → mulaw 변환
        mulaw_data = audioop.lin2ulaw(pcm_data, 2)
        
        # 3. Base64 인코딩
        audio_base64 = base64.b64encode(mulaw_data).decode('utf-8')
        
        # 4. Twilio로 청크 단위 전송
        chunk_size = 8000  # 8KB 청크
        for i in range(0, len(audio_base64), chunk_size):
            chunk = audio_base64[i:i + chunk_size]
            
            message = {
                "event": "media",
                "streamSid": stream_sid,
                "media": {
                    "payload": chunk
                }
            }
            
            await websocket.send_text(json.dumps(message))
            await asyncio.sleep(0.02)  # 부드러운 재생을 위한 작은 지연
        
        logger.info(f"✅ 문장 전송 완료 ({tts_time:.2f}초): {text[:30]}...")
        
    except Exception as e:
        logger.error(f"❌ 오디오 변환/전송 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())


async def process_streaming_response(
    websocket: WebSocket,
    stream_sid: str,
    user_text: str,
    conversation_history: list,
    audio_processor=None
) -> str:
    """
    스트리밍 방식으로 LLM → TTS → Twilio 전송을 병렬 처리
    
    이것이 핵심 최적화 함수입니다!
    
    동작 방식:
    1. LLM이 단어/구를 생성하면 즉시 받기 시작
    2. 문장이 완성되면 (. ! ? 감지) 즉시 TTS 변환
    3. TTS 변환과 동시에 다음 문장 LLM 생성 진행
    4. 변환된 음성을 바로 Twilio로 전송
    
    결과: 사용자는 AI가 생각하는 것처럼 자연스럽게 느낌
    
    Args:
        websocket: Twilio WebSocket 연결
        stream_sid: Twilio Stream SID  
        user_text: 사용자 발화 전체 텍스트
        conversation_history: 대화 기록
    
    Returns:
        str: 생성된 전체 AI 응답
    """
    import re
    
    # TTS 시작 알림 (에코 방지)
    if audio_processor:
        audio_processor.start_bot_speaking()
    
    try:
        logger.info(f"\n{'='*60}")
        logger.info(f"🚀 스트리밍 응답 파이프라인 시작")
        logger.info(f"{'='*60}")
        
        pipeline_start = time.time()
        
        # 문장 버퍼 및 전체 응답 저장
        sentence_buffer = ""
        full_response = []
        sentence_tasks = []  # 병렬 TTS 태스크 추적
        
        # LLM 스트리밍 시작 (비동기 생성기)
        async for chunk in llm_service.generate_response_streaming(
            user_text,
            conversation_history
        ):
            sentence_buffer += chunk
            full_response.append(chunk)
            
            # 문장 종료 감지: 마침표, 느낌표, 물음표
            if re.search(r'[.!?\n]', chunk):
                # 완성된 문장 추출
                sentences = re.split(r'([.!?\n]+)', sentence_buffer)
                
                # 문장과 구두점을 쌍으로 처리
                for i in range(0, len(sentences)-1, 2):
                    sentence = sentences[i] + (sentences[i+1] if i+1 < len(sentences) else "")
                    sentence = sentence.strip()
                    
                    if sentence:
                        logger.info(f"📝 문장 완성: {sentence}")
                        
                        # 즉시 TTS 변환 및 전송 (비동기 태스크로 실행)
                        # 여러 문장이 동시에 처리될 수 있음 (병렬 처리)
                        task = asyncio.create_task(
                            convert_and_send_audio(websocket, stream_sid, sentence)
                        )
                        sentence_tasks.append(task)
                
                # 마지막 불완전한 문장은 버퍼에 유지
                sentence_buffer = sentences[-1] if len(sentences) % 2 == 1 else ""
        
        # 남은 버퍼 처리 (마지막 문장)
        if sentence_buffer.strip():
            logger.info(f"📝 마지막 문장: {sentence_buffer}")
            task = asyncio.create_task(
                convert_and_send_audio(websocket, stream_sid, sentence_buffer)
            )
            sentence_tasks.append(task)
        
        # 모든 TTS 변환/전송이 완료될 때까지 대기
        if sentence_tasks:
            await asyncio.gather(*sentence_tasks, return_exceptions=True)
        
        pipeline_time = time.time() - pipeline_start
        final_text = "".join(full_response)
        
        logger.info(f"\n{'='*60}")
        logger.info(f"✅ 스트리밍 파이프라인 완료")
        logger.info(f"⏱️  총 소요 시간: {pipeline_time:.2f}초")
        logger.info(f"📤 전체 응답: {final_text}")
        logger.info(f"{'='*60}\n")
        
        return final_text
        
    except Exception as e:
        logger.error(f"❌ 스트리밍 파이프라인 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return ""
    finally:
        # TTS 종료 알림 (에코 방지)
        if audio_processor:
            audio_processor.stop_bot_speaking()


async def send_audio_to_twilio_with_tts(websocket: WebSocket, stream_sid: str, text: str, audio_processor=None):
    """
    TTS Service를 사용하여 텍스트를 음성으로 변환 후 Twilio WebSocket으로 전송
    WAV → mulaw 변환 포함
    
    Args:
        websocket: Twilio WebSocket 연결
        stream_sid: Twilio Stream SID
        text: 변환할 텍스트
        audio_processor: AudioProcessor 인스턴스 (에코 방지용)
    """
    # TTS 시작 알림 (에코 방지)
    if audio_processor:
        audio_processor.start_bot_speaking()
    
    try:
        import wave
        import io
        
        # TTS Service로 음성 생성 (WAV 파일로 저장됨)
        audio_file_path, tts_time = tts_service.text_to_speech(text)
        
        # TTS 실패 체크
        if not audio_file_path or tts_time == 0:
            logger.error("❌ TTS 변환 실패 - 응답이 None이거나 시간이 0초")
            return
        
        logger.info(f"✅ TTS 완료 ({tts_time:.2f}초): {audio_file_path}")
        
        # 파일 존재 확인
        if not os.path.exists(audio_file_path):
            logger.error(f"❌ TTS 파일이 존재하지 않음: {audio_file_path}")
            return
        
        # 파일 크기 확인
        file_size = os.path.getsize(audio_file_path)
        logger.info(f"📁 생성된 파일 크기: {file_size} bytes")
        
        if file_size == 0:
            logger.error("❌ 파일이 비어있습니다! TTS API 문제 가능성")
            return
        
        try:
            # 파일 헤더 확인
            with open(audio_file_path, 'rb') as f:
                header = f.read(12)
                logger.info(f"📄 파일 헤더: {header.hex() if header else 'EMPTY'}")
                
                if len(header) == 0:
                    logger.error("❌ 헤더를 읽을 수 없습니다!")
                    return
                
                # WAV 파일 검증
                if header[:4] == b'RIFF' and header[8:12] == b'WAVE':
                    logger.info("✅ 정상 WAV 파일 확인")
                elif header[:3] == b'ID3' or header[:2] == b'\xff\xfb':
                    logger.error("❌ MP3 파일입니다! response_format이 wav로 설정되지 않았습니다.")
                    return
                else:
                    logger.error(f"❌ 알 수 없는 파일 형식: {header[:4]}")
                    return

            # WAV 파일 읽기 (wave 모듈만 사용)
            with wave.open(audio_file_path, 'rb') as wav_file:
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                framerate = wav_file.getframerate()
                n_frames = wav_file.getnframes()
                
                logger.info(f"🎵 TTS WAV 정보:")
                logger.info(f"  - 채널: {channels}ch")
                logger.info(f"  - 비트: {sample_width*8}bit")
                logger.info(f"  - 샘플레이트: {framerate}Hz")
                logger.info(f"  - 프레임 수: {n_frames}")
                
                pcm_data = wav_file.readframes(n_frames)
                logger.info(f"  - PCM 데이터: {len(pcm_data)} bytes")

            # Stereo → Mono 변환 (필요시)
            if channels == 2:
                logger.info("🔄 Stereo → Mono 변환 중...")
                pcm_data = audioop.tomono(pcm_data, sample_width, 1, 1)
                logger.info(f"✅ Mono 변환 완료: {len(pcm_data)} bytes")

            # 샘플레이트 변환 (Twilio는 8kHz 요구)
            if framerate != 8000:
                logger.info(f"🔄 샘플레이트 변환: {framerate}Hz → 8000Hz")
                pcm_data, _ = audioop.ratecv(pcm_data, sample_width, 1, framerate, 8000, None)
                logger.info(f"✅ 샘플레이트 변환 완료: {len(pcm_data)} bytes")

            # PCM → mulaw 변환
            logger.info("🔄 PCM → mulaw 변환 중...")
            mulaw_data = audioop.lin2ulaw(pcm_data, 2)
            logger.info(f"✅ mulaw 변환 완료: {len(mulaw_data)} bytes")
            
        except wave.Error as wave_err:
            logger.error(f"❌ WAV 파일 읽기 오류: {wave_err}")
            import traceback
            logger.error(traceback.format_exc())
            return
        except Exception as conv_error:
            logger.error(f"❌ 오디오 변환 오류: {type(conv_error).__name__}: {conv_error}")
            import traceback
            logger.error(traceback.format_exc())
            return
        finally:
            # TTS로 생성된 임시 MP3 파일 삭제
            if os.path.exists(audio_file_path):
                os.unlink(audio_file_path)
        
        # mulaw 데이터를 Base64로 인코딩
        audio_base64 = base64.b64encode(mulaw_data).decode('utf-8')
        
        logger.info(f"📤 오디오 전송 시작: {len(mulaw_data)} bytes (mulaw 8kHz)")
        
        # 청크로 나누어 전송 (Twilio 제한 고려)
        chunk_size = 8000  # 8KB chunks
        for i in range(0, len(audio_base64), chunk_size):
            chunk = audio_base64[i:i + chunk_size]
            
            message = {
                "event": "media",
                "streamSid": stream_sid,
                "media": {
                    "payload": chunk
                }
            }
            
            await websocket.send_text(json.dumps(message))
            await asyncio.sleep(0.02)  # 작은 지연으로 부드러운 재생
        
        logger.info("✅ 음성 전송 완료")
        
    except Exception as e:
        logger.error(f"❌ 음성 전송 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        # TTS 종료 알림 (에코 방지)
        if audio_processor:
            audio_processor.stop_bot_speaking()


# Lifespan 이벤트 (startup/shutdown)
@asynccontextmanager
async def lifespan(app: FastAPI):
    """애플리케이션 시작/종료 이벤트"""
    # Startup
    logger.info("🚀 Starting Grandby API Server...")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug Mode: {settings.DEBUG}")
    
    # DB 연결 테스트
    if test_db_connection():
        logger.info("✅ Database connection successful")
    else:
        logger.error("❌ Database connection failed")
    
    # Sentry 초기화 (프로덕션 환경)
    if settings.SENTRY_DSN and not is_development():
        import sentry_sdk
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1,
        )
        logger.info("✅ Sentry initialized")
    
    yield
    
    # Shutdown
    logger.info("👋 Shutting down Grandby API Server...")


# FastAPI 앱 생성
app = FastAPI(
    title=settings.APP_NAME,
    description="AI 기반 어르신 케어 플랫폼 Backend API",
    version=settings.APP_VERSION,
    docs_url="/docs" if is_development() else None,  # 프로덕션에서는 Swagger 비활성화
    redoc_url="/redoc" if is_development() else None,
    lifespan=lifespan,
)


# ==================== Middleware ====================

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 요청 로깅 Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """모든 HTTP 요청 로깅"""
    logger.info(f"📥 {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"📤 {request.method} {request.url.path} - {response.status_code}")
    return response


# ==================== Exception Handlers ====================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """422 Validation Error 상세 정보 로깅"""
    logger.error(f"❌ 422 Validation Error:")
    logger.error(f"❌ URL: {request.url}")
    logger.error(f"❌ Method: {request.method}")
    logger.error(f"❌ Body: {exc.body}")
    logger.error(f"❌ Errors: {exc.errors()}")
    
    # 상세 에러 정보를 JSON으로 반환
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Validation Error",
            "errors": exc.errors(),
            "body": exc.body if isinstance(exc.body, dict) else (exc.body.decode() if exc.body else None)
        }
    )

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """404 에러 핸들러"""
    return JSONResponse(
        status_code=404,
        content={
            "detail": "요청하신 리소스를 찾을 수 없습니다.",
            "path": str(request.url.path)
        }
    )


@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    """500 에러 핸들러"""
    logger.error(f"Internal Server Error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "서버 내부 오류가 발생했습니다.",
            "error": str(exc) if is_development() else "Internal Server Error"
        }
    )


# ==================== Root Endpoints ====================

@app.get("/", tags=["Root"])
async def root():
    """루트 엔드포인트"""
    return {
        "message": "🏠 Welcome to Grandby API",
        "version": settings.APP_VERSION,
        "docs": "/docs" if is_development() else "disabled",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """헬스 체크 엔드포인트 (Docker, Kubernetes용)"""
    db_status = "healthy" if test_db_connection() else "unhealthy"
    
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
    }


# ==================== API Routers ====================
# 각 도메인별 라우터를 여기에 등록

# ==================== AI 챗봇 서비스 ====================

# 인증
app.include_router(
    auth.router,
    prefix="/api/auth",
    tags=["Authentication"]
)

# 사용자 관리
app.include_router(
    users.router,
    prefix="/api/users",
    tags=["Users"]
)

# AI 통화
app.include_router(
    calls.router,
    prefix="/api/calls",
    tags=["AI Calls"]
)

# 다이어리
app.include_router(
    diaries.router,
    prefix="/api/diaries",
    tags=["Diaries"]
)

# TODO 관리
app.include_router(
    todos.router,
    prefix="/api/todos",
    tags=["TODOs"]
)

# 알림
app.include_router(
    notifications.router,
    prefix="/api/notifications",
    tags=["Notifications"]
)

# 보호자 대시보드
app.include_router(
    dashboard.router,
    prefix="/api/dashboard",
    tags=["Dashboard"]
)

# ==================== AI 챗봇 엔드포인트 ====================

@app.post("/api/chatbot/text", tags=["AI Chatbot"])
async def chat_with_text(
    user_id: str = Form(..., description="사용자 ID"),
    message: str = Form(..., description="사용자 메시지 (텍스트)"),
    analyze_emotion: bool = Form(False, description="감정 분석 여부")
):
    """
    텍스트 기반 챗봇 대화
    
    음성 입력이 어려울 때 텍스트로 테스트할 수 있는 간편한 엔드포인트
    
    Args:
        user_id: 사용자 고유 ID (세션 관리용)
        message: 사용자가 입력한 텍스트 메시지
        analyze_emotion: 감정 분석 실행 여부
    
    Returns:
        대화 응답 및 실행 시간 정보
    """
    cycle_start_time = time.time()  # 전체 사이클 시작 시간
    logger.info(f"\n{'='*80}")
    logger.info(f"💬 텍스트 챗봇 대화 시작 (사용자: {user_id})")
    logger.info(f"{'='*80}")
    
    try:
        # 1. 대화 기록 가져오기
        if user_id not in conversation_sessions:
            conversation_sessions[user_id] = []
        
        conversation_history = conversation_sessions[user_id]
        
        # 2. 감정 분석 (옵션)
        emotion_result = None
        emotion_time = 0
        if analyze_emotion:
            emotion_result, emotion_time = llm_service.analyze_emotion(message)
        
        # 3. LLM 응답 생성
        ai_response, llm_time = llm_service.generate_response(
            user_message=message,
            conversation_history=conversation_history
        )
        
        # 4. 대화 기록 저장 (최근 10개까지만 유지)
        conversation_sessions[user_id].append({"role": "user", "content": message})
        conversation_sessions[user_id].append({"role": "assistant", "content": ai_response})
        if len(conversation_sessions[user_id]) > 10:
            conversation_sessions[user_id] = conversation_sessions[user_id][-10:]
        
        # 전체 사이클 완료 시간
        total_time = time.time() - cycle_start_time
        
        logger.info(f"\n{'='*80}")
        logger.info(f"⏱️  전체 대화 사이클 완료!")
        logger.info(f"  - 감정 분석: {emotion_time:.2f}초")
        logger.info(f"  - LLM 응답 생성: {llm_time:.2f}초")
        logger.info(f"  ⭐ 총 소요 시간: {total_time:.2f}초")
        logger.info(f"{'='*80}\n")
        
        return {
            "success": True,
            "user_message": message,
            "ai_response": ai_response,
            "emotion_analysis": emotion_result,
            "timing": {
                "emotion_analysis_time": emotion_time,
                "llm_time": llm_time,
                "total_time": total_time
            },
            "conversation_count": len(conversation_sessions[user_id]) // 2
        }
        
    except Exception as e:
        logger.error(f"❌ 챗봇 대화 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/api/chatbot/voice", tags=["AI Chatbot"])
async def chat_with_voice(
    user_id: str = Form(..., description="사용자 ID"),
    audio_file: UploadFile = File(..., description="음성 파일 (mp3, wav, m4a 등)"),
    return_audio: bool = Form(True, description="음성 응답 생성 여부")
):
    """
    음성 기반 챗봇 대화 (전체 파이프라인)
    
    STT → LLM → TTS 전체 과정을 수행하는 완전한 음성 챗봇
    
    Args:
        user_id: 사용자 고유 ID
        audio_file: 사용자 음성 파일
        return_audio: True면 TTS 음성 파일 생성, False면 텍스트만 반환
    
    Returns:
        대화 응답, 음성 파일 경로, 실행 시간 정보
    """
    cycle_start_time = time.time()  # 전체 사이클 시작 시간
    logger.info(f"\n{'='*80}")
    logger.info(f"🎙️  음성 챗봇 대화 시작 (사용자: {user_id})")
    logger.info(f"{'='*80}")
    
    temp_audio_path = None
    tts_audio_path = None
    
    try:
        # 1. 업로드된 음성 파일 임시 저장
        temp_audio_path = f"/tmp/upload_{user_id}_{int(time.time())}.{audio_file.filename.split('.')[-1]}"
        with open(temp_audio_path, "wb") as f:
            content = await audio_file.read()
            f.write(content)
        logger.info(f"📁 음성 파일 저장: {temp_audio_path}")
        
        # 2. STT: 음성 → 텍스트 변환
        user_message, stt_time = stt_service.transcribe_audio(temp_audio_path)
        
        # 3. 대화 기록 가져오기
        if user_id not in conversation_sessions:
            conversation_sessions[user_id] = []
        conversation_history = conversation_sessions[user_id]
        
        # 4. LLM: 대화 응답 생성
        ai_response, llm_time = llm_service.generate_response(
            user_message=user_message,
            conversation_history=conversation_history
        )
        
        # 5. TTS: 텍스트 → 음성 변환 (옵션)
        tts_time = 0
        if return_audio:
            tts_audio_path, tts_time = tts_service.text_to_speech(ai_response)
        
        # 6. 대화 기록 저장
        conversation_sessions[user_id].append({"role": "user", "content": user_message})
        conversation_sessions[user_id].append({"role": "assistant", "content": ai_response})
        if len(conversation_sessions[user_id]) > 10:
            conversation_sessions[user_id] = conversation_sessions[user_id][-10:]
        
        # 전체 사이클 완료 시간
        total_time = time.time() - cycle_start_time
        
        logger.info(f"\n{'='*80}")
        logger.info(f"⏱️  전체 음성 대화 사이클 완료!")
        logger.info(f"  - STT (음성→텍스트): {stt_time:.2f}초")
        logger.info(f"  - LLM (응답 생성): {llm_time:.2f}초")
        logger.info(f"  - TTS (텍스트→음성): {tts_time:.2f}초")
        logger.info(f"  ⭐ 총 소요 시간: {total_time:.2f}초")
        logger.info(f"{'='*80}\n")
        
        return {
            "success": True,
            "user_message": user_message,
            "ai_response": ai_response,
            "audio_file_path": tts_audio_path if return_audio else None,
            "timing": {
                "stt_time": stt_time,
                "llm_time": llm_time,
                "tts_time": tts_time,
                "total_time": total_time
            },
            "conversation_count": len(conversation_sessions[user_id]) // 2
        }
        
    except Exception as e:
        logger.error(f"❌ 음성 챗봇 대화 실패: {e}")
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        # 임시 파일 정리
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)
            logger.info(f"🗑️  임시 파일 삭제: {temp_audio_path}")


@app.get("/api/chatbot/session/{user_id}", tags=["AI Chatbot"])
async def get_conversation_history(user_id: str):
    """
    사용자의 대화 기록 조회
    
    Args:
        user_id: 사용자 ID
    
    Returns:
        대화 기록 목록
    """
    if user_id not in conversation_sessions:
        return {
            "user_id": user_id,
            "conversation_count": 0,
            "messages": []
        }
    
    return {
        "user_id": user_id,
        "conversation_count": len(conversation_sessions[user_id]) // 2,
        "messages": conversation_sessions[user_id]
    }


@app.delete("/api/chatbot/session/{user_id}", tags=["AI Chatbot"])
async def clear_conversation_history(user_id: str):
    """
    사용자의 대화 기록 초기화
    
    Args:
        user_id: 사용자 ID
    
    Returns:
        초기화 결과
    """
    if user_id in conversation_sessions:
        del conversation_sessions[user_id]
        logger.info(f"🗑️  대화 기록 초기화 완료: {user_id}")
        return {
            "success": True,
            "message": f"사용자 {user_id}의 대화 기록이 초기화되었습니다."
        }
    else:
        return {
            "success": False,
            "message": f"사용자 {user_id}의 대화 기록이 존재하지 않습니다."
        }

# ==================== Twilio WebSocket Endpoints ====================

class RealtimeCallRequest(BaseModel):
    """실시간 AI 대화 통화 요청"""
    to_number: str  # 전화번호 (+821012345678 형식)
    user_id: str = "test-user"  # 사용자 ID (선택)


class RealtimeCallResponse(BaseModel):
    """실시간 AI 대화 통화 응답"""
    success: bool
    call_sid: str
    to_number: str
    status: str
    message: str
    voice_url: str
    timestamp: str


@app.post("/api/twilio/call", response_model=RealtimeCallResponse, tags=["Twilio"])
async def initiate_realtime_call(
    request: RealtimeCallRequest,
    db: Session = Depends(get_db)
):
    """
    실시간 AI 대화 통화 발신 (WebSocket 기반)
    
    사용자가 입력한 전화번호로 전화를 걸고, WebSocket을 통해 실시간 AI 대화를 제공합니다.
    
    플로우:
    1. 앱에서 이 API 호출 (전화번호 전달)
    2. Twilio가 사용자 전화번호로 전화 발신
    3. 사용자가 전화 받음
    4. /api/twilio/voice 엔드포인트에서 WebSocket 연결 시작
    5. 실시간 음성 대화 (STT → LLM → TTS)
    """
    try:
        # API Base URL 확인
        if not settings.API_BASE_URL:
            raise HTTPException(
                status_code=400,
                detail="API_BASE_URL이 환경 변수에 설정되지 않았습니다. (ngrok 또는 도메인 필요)"
            )
        
        # Twilio 서비스 초기화
        twilio_service = TwilioService()
        
        # Callback URL 설정 (WebSocket 연결)
        api_base_url = settings.API_BASE_URL
        voice_url = f"https://{api_base_url}/api/twilio/voice"  # WebSocket 시작 엔드포인트
        status_callback_url = f"https://{api_base_url}/api/twilio/call-status"
        
        logger.info(f"📞 실시간 AI 대화 통화 발신 시작: {request.to_number}")
        logger.info(f"👤 사용자 ID: {request.user_id}")
        logger.info(f"🔗 Voice URL (WebSocket 시작): {voice_url}")
        
        # 전화 걸기
        call_sid = twilio_service.make_call(
            to_number=request.to_number,  # 사용자 입력 전화번호
            voice_url=voice_url,
            status_callback_url=status_callback_url
        )
        
        # 통화 기록 저장 (선택사항)
        try:
            from app.models.call import CallLog
            new_call = CallLog(
                call_id=call_sid,
                elderly_id=request.user_id,
                call_status="initiated",
                twilio_call_sid=call_sid,
                created_at=datetime.utcnow()
            )
            db.add(new_call)
            db.commit()
            logger.info(f"✅ 통화 기록 저장: {call_sid}")
        except Exception as e:
            logger.warning(f"⚠️ 통화 기록 저장 실패 (계속 진행): {str(e)}")
            db.rollback()
        
        logger.info(f"✅ 실시간 AI 대화 통화 발신 성공: {call_sid}")
        
        return RealtimeCallResponse(
            success=True,
            call_sid=call_sid,
            to_number=request.to_number,
            status="initiated",
            message=f"실시간 AI 대화 전화가 {request.to_number}로 발신되었습니다. 전화를 받으시면 AI와 대화하실 수 있습니다.",
            voice_url=voice_url,
            timestamp=datetime.utcnow().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 실시간 AI 대화 통화 발신 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"실시간 AI 대화 통화 발신 중 오류 발생: {str(e)}"
        )


@app.post("/api/twilio/voice", response_class=PlainTextResponse, tags=["Twilio"])
async def voice_handler():
    """
    Twilio 전화 연결 시 WebSocket 스트림 시작
    """
    response = VoiceResponse()
    
    # 환영 메시지
    # response.say(
    #     "안녕하세요. AI 어시스턴트에 연결되었습니다.",
    #     language='ko-KR'
    # )
    
    # WebSocket 스트림 연결 설정
    if not settings.API_BASE_URL:
        logger.error("⚠️ API_BASE_URL이 설정되지 않았습니다!")
        api_base_url = "your-domain.com"  # fallback (작동하지 않음)
    else:
        api_base_url = settings.API_BASE_URL
    
    websocket_url = f"wss://{api_base_url}/api/twilio/media-stream"
    
    connect = Connect()
    stream = Stream(url=websocket_url)
    connect.append(stream)
    response.append(connect)
    
    logger.info(f"🎙️ Twilio WebSocket 스트림 시작: {websocket_url}")
    return str(response)


@app.websocket("/api/twilio/media-stream")
async def media_stream_handler(
    websocket: WebSocket,
    db: Session = Depends(get_db)
):
    """
    Twilio Media Streams WebSocket 핸들러 (실시간 STT 적용)
    
    실시간 오디오 데이터 양방향 처리:
    1. 오디오 청크 수신 및 버퍼링
    2. 침묵 감지 시 실시간 STT 변환
    3. 변환된 텍스트를 실시간으로 누적
    4. 각 발화마다 즉시 AI 응답 생성 및 TTS 재생
    5. 통화 종료 시 전체 대화 내용 저장
    
    실시간 STT → LLM → TTS 파이프라인
    """
    await websocket.accept()
    logger.info("📞 Twilio WebSocket 연결됨")
    
    call_sid = None
    stream_sid = None
    audio_processor = None
    call_log = None  # DB에 저장할 CallLog 객체
    elderly_id = None  # 통화 대상 어르신 ID
    
    try:
        async for message in websocket.iter_text():
            data = json.loads(message)
            event_type = data.get('event')
            
            # ========== 1. 스트림 시작 ==========
            if event_type == 'start':
                call_sid = data['start']['callSid']
                stream_sid = data['start']['streamSid']
                
                # customParameters에서 elderly_id 추출 (Twilio 통화 시작 시 전달)
                custom_params = data['start'].get('customParameters', {})
                elderly_id = custom_params.get('elderly_id', 'unknown')
                
                audio_processor = AudioProcessor(call_sid)
                active_connections[call_sid] = websocket
                
                # 대화 세션 초기화 (LLM 대화 히스토리 관리)
                if call_sid not in conversation_sessions:
                    conversation_sessions[call_sid] = []
                
                # DB에 통화 시작 기록 저장
                try:
                    from app.models.call import CallLog, CallStatus
                    db = next(get_db())
                    
                    call_log = CallLog(
                        call_id=call_sid,
                        elderly_id=elderly_id,
                        call_status=CallStatus.ANSWERED,
                        call_start_time=datetime.utcnow(),
                        twilio_call_sid=call_sid
                    )
                    db.add(call_log)
                    db.commit()
                    db.refresh(call_log)
                    db.close()
                    logger.info(f"✅ DB에 통화 시작 기록 저장: {call_sid}")
                except Exception as e:
                    logger.error(f"❌ 통화 시작 기록 저장 실패: {e}")
                
                logger.info(f"┌{'─'*58}┐")
                logger.info(f"│ 🎙️  Twilio 통화 시작                                   │")
                logger.info(f"│ Call SID: {call_sid:43} │")
                logger.info(f"│ Stream SID: {stream_sid:41} │")
                logger.info(f"│ Elderly ID: {elderly_id:41} │")
                logger.info(f"└{'─'*58}┘")
                
                # 시작 안내 메시지 (TTS 서비스 사용)
                welcome_text = "안녕하세요! 무엇을 도와드릴까요?"
                await send_audio_to_twilio_with_tts(websocket, stream_sid, welcome_text, audio_processor)
                
            # ========== 2. 오디오 데이터 수신 및 실시간 STT 처리 ==========
            elif event_type == 'media':
                if audio_processor:
                    # Base64 디코딩 (Twilio는 mulaw 8kHz로 전송)
                    audio_payload = base64.b64decode(data['media']['payload'])
                    audio_processor.add_audio_chunk(audio_payload)
                    
                    # 사용자가 말을 멈췄는지 확인 (침묵 감지 - 1초로 단축!)
                    if audio_processor.should_process():
                        cycle_start = time.time()
                        logger.info(f"{'='*60}")
                        logger.info(f"🎯 발화 종료 감지 → 즉시 스트리밍 응답")
                        logger.info(f"{'='*60}")
                        
                        # 1️⃣ STT: 오디오 → 텍스트 변환 (실시간 청크 기반)
                        audio_data = audio_processor.get_audio()
                        user_text, stt_time = await transcribe_audio_realtime(audio_data)
                        
                        if user_text and user_text.strip():
                            logger.info(f"✅ STT 완료 ({stt_time:.2f}초)")
                            logger.info(f"👤 [사용자 발화] {user_text}")
                            
                            # 변환된 텍스트를 버퍼에 저장 (전체 대화 추적용)
                            audio_processor.add_transcript(user_text)
                            
                            # 종료 키워드 확인
                            if any(keyword in user_text.lower() 
                                   for keyword in ['종료', '끝', '그만', 'goodbye', '끊어', '안녕']):
                                logger.info(f"🛑 종료 키워드 감지: '{user_text}'")
                                goodbye_text = "대화를 종료합니다. 감사합니다. 좋은 하루 보내세요!"
                                await send_audio_to_twilio_with_tts(websocket, stream_sid, goodbye_text, audio_processor)
                                await asyncio.sleep(2)  # 마지막 메시지 재생 대기
                                await websocket.close()
                                break
                            
                            # 2️⃣+3️⃣ LLM 스트리밍 + TTS 병렬 처리
                            # 이것이 핵심 최적화!
                            # LLM이 문장을 생성하면 즉시 TTS 변환하여 전송
                            conversation_history = conversation_sessions.get(call_sid, [])
                            
                            ai_response = await process_streaming_response(
                                websocket,
                                stream_sid,
                                user_text,
                                conversation_history,
                                audio_processor
                            )
                            
                            # 대화 히스토리 저장 (최근 10개만 유지)
                            conversation_sessions[call_sid].append({"role": "user", "content": user_text})
                            conversation_sessions[call_sid].append({"role": "assistant", "content": ai_response})
                            if len(conversation_sessions[call_sid]) > 10:
                                conversation_sessions[call_sid] = conversation_sessions[call_sid][-10:]
                            
                            total_cycle_time = time.time() - cycle_start
                            logger.info(f"⏱️  전체 응답 사이클: {total_cycle_time:.2f}초")
                            logger.info(f"{'='*60}\n\n")
                        else:
                            logger.debug("⏭️  STT 결과 없음 (침묵 또는 잡음)")
                        
            # ========== 3. 스트림 종료 ==========
            elif event_type == 'stop':
                logger.info(f"\n{'='*60}")
                logger.info(f"📞 Twilio 통화 종료 - Call: {call_sid}")
                logger.info(f"{'='*60}")
                
                # 전체 대화 내용 확인
                if audio_processor:
                    full_transcript = audio_processor.get_full_transcript()
                    if full_transcript:
                        logger.info(f"\n📋 전체 대화 내용:")
                        logger.info(f"─" * 60)
                        logger.info(f"{full_transcript}")
                        logger.info(f"─" * 60)
                
                # 대화 세션을 DB에 저장
                if call_sid in conversation_sessions:
                    conversation = conversation_sessions[call_sid]
                    logger.info(f"💾 대화 기록: {len(conversation)}개 메시지")
                    
                    # DB에 대화 내용 및 요약 저장
                    try:
                        from app.models.call import CallLog, CallTranscript, CallStatus
                        db = next(get_db())
                        
                        # 1. CallLog 업데이트 (통화 종료 시간, 요약)
                        call_log_db = db.query(CallLog).filter(CallLog.call_id == call_sid).first()
                        
                        if call_log_db:
                            call_log_db.call_end_time = datetime.utcnow()
                            call_log_db.call_status = CallStatus.COMPLETED
                            
                            # 통화 시간 계산 (초)
                            if call_log_db.call_start_time:
                                duration = (call_log_db.call_end_time - call_log_db.call_start_time).total_seconds()
                                call_log_db.call_duration = int(duration)
                            
                            # LLM 요약 생성 (대화가 있는 경우에만)
                            if len(conversation) > 0:
                                logger.info("🤖 LLM으로 통화 요약 생성 중...")
                                summary = llm_service.summarize_call_conversation(conversation)
                                call_log_db.conversation_summary = summary
                                logger.info(f"✅ 요약 생성 완료: {summary[:100]}...")
                            
                            db.commit()
                            logger.info(f"✅ CallLog 업데이트 완료")
                        
                        # 2. CallTranscript 저장 (화자별 대화 내용)
                        for idx, message in enumerate(conversation):
                            speaker = "ELDERLY" if message["role"] == "user" else "AI"
                            
                            transcript = CallTranscript(
                                call_id=call_sid,
                                speaker=speaker,
                                text=message["content"],
                                timestamp=idx * 10.0,  # 대략적인 타임스탬프 (10초 간격)
                                created_at=datetime.utcnow()
                            )
                            db.add(transcript)
                        
                        db.commit()
                        logger.info(f"✅ 대화 내용 {len(conversation)}개 저장 완료")
                        
                        db.close()
                        
                    except Exception as e:
                        logger.error(f"❌ DB 저장 실패: {e}")
                        import traceback
                        logger.error(traceback.format_exc())
                        if 'db' in locals():
                            db.rollback()
                            db.close()
                    
                    # 메모리에서 제거
                    del conversation_sessions[call_sid]
                
                if call_sid in active_connections:
                    del active_connections[call_sid]
                
                logger.info(f"┌{'─'*58}┐")
                logger.info(f"│ ✅ Twilio 통화 정리 완료                               │")
                logger.info(f"└{'─'*58}┘\n")
                break
                
    except WebSocketDisconnect:
        logger.info(f"📞 Twilio WebSocket 연결 해제 (Call: {call_sid})")
    except Exception as e:
        logger.error(f"❌ Twilio WebSocket 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        # 정리 작업
        if call_sid and call_sid in active_connections:
            del active_connections[call_sid]
        if call_sid and call_sid in conversation_sessions:
            del conversation_sessions[call_sid]


@app.post("/api/twilio/call-status", tags=["Twilio"])
async def call_status_handler(
    CallSid: str = Form(None),
    CallStatus: str = Form(None)
):
    """
    Twilio 통화 상태 업데이트 콜백
    통화 상태: initiated, ringing, answered, completed
    """
    logger.info(f"📞 통화 상태 업데이트: {CallSid} - {CallStatus}")
    
    if CallStatus == 'completed':
        # 통화 종료 시 정리
        if CallSid in conversation_sessions:
            del conversation_sessions[CallSid]
        if CallSid in active_connections:
            del active_connections[CallSid]
    
    return {"status": "ok", "call_sid": CallSid, "call_status": CallStatus}


# ==================== Startup Message ====================
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=is_development(),
        log_level=settings.LOG_LEVEL.lower(),
    )
