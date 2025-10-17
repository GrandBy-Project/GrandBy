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
from openai import OpenAI

from app.routers import auth, users, calls, diaries, todos, notifications, dashboard
from app.config import settings, is_development
from app.database import test_db_connection, get_db
from app.services.ai_call.stt_service import STTService
from app.services.ai_call.tts_service import TTSService
from app.services.ai_call.llm_service import LLMService
from app.services.ai_call.twilio_service import TwilioService

# 로거 설정
logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

# OpenAI 클라이언트 및 서비스 초기화
openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
stt_service = STTService()
tts_service = TTSService()
llm_service = LLMService()

# WebSocket 연결 및 대화 세션 관리
active_connections: Dict[str, WebSocket] = {}
conversation_sessions: Dict[str, list] = {}


# ==================== AudioProcessor ====================

class AudioProcessor:
    """오디오 처리 클래스 - 실시간 오디오 버퍼링 및 침묵 감지"""
    
    def __init__(self, call_sid: str):
        self.call_sid = call_sid
        self.audio_buffer = []
        self.is_speaking = False
        self.silence_threshold = 500  # 침묵 감지 임계값
        self.silence_duration = 0
        self.max_silence = 1.5  # 1.5초 침묵 후 처리
        
    def add_audio_chunk(self, audio_data: bytes):
        """오디오 청크 추가"""
        self.audio_buffer.append(audio_data)
        
        # 음성 활동 감지 (RMS - Root Mean Square)
        rms = audioop.rms(audio_data, 2)  # 16-bit audio
        
        if rms > self.silence_threshold:
            self.is_speaking = True
            self.silence_duration = 0
        else:
            if self.is_speaking:
                self.silence_duration += 0.02  # 20ms per chunk
                
    def should_process(self) -> bool:
        """오디오 처리가 필요한지 확인 (사용자가 말을 멈췄는지)"""
        return (self.is_speaking and 
                self.silence_duration >= self.max_silence and 
                len(self.audio_buffer) > 0)
    
    def get_audio(self) -> bytes:
        """버퍼링된 오디오 가져오기 및 초기화"""
        audio = b''.join(self.audio_buffer)
        self.audio_buffer = []
        self.is_speaking = False
        self.silence_duration = 0
        return audio


# ==================== Helper Functions ====================

def transcribe_audio(audio_data: bytes) -> str:
    """
    Whisper API를 사용하여 오디오를 텍스트로 변환
    Twilio mulaw 포맷 → WAV 변환 후 전송
    """
    try:
        import wave
        
        # Twilio는 mulaw (G.711 μ-law) 포맷으로 전송
        # mulaw를 16-bit PCM으로 변환
        try:
            pcm_data = audioop.ulaw2lin(audio_data, 2)
        except Exception as conv_error:
            logger.error(f"mulaw 변환 오류: {conv_error}")
            return ""
        
        # 임시 WAV 파일 생성
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio:
            temp_audio_path = temp_audio.name
        
        # PCM 데이터를 WAV 파일로 저장
        try:
            with wave.open(temp_audio_path, 'wb') as wav_file:
                wav_file.setnchannels(1)      # Mono
                wav_file.setsampwidth(2)      # 16-bit (2 bytes)
                wav_file.setframerate(8000)   # 8kHz (Twilio 샘플레이트)
                wav_file.writeframes(pcm_data)
        except Exception as wav_error:
            logger.error(f"WAV 파일 생성 오류: {wav_error}")
            if os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)
            return ""
        
        # Whisper API 호출
        try:
            with open(temp_audio_path, 'rb') as audio_file:
                transcript = openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    language="ko"
                )
            
            logger.info(f"✅ 음성 인식 성공: {transcript.text[:50]}...")
            return transcript.text
            
        except Exception as whisper_error:
            logger.error(f"Whisper API 오류: {whisper_error}")
            return ""
        
        finally:
            # 임시 파일 삭제
            if os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)
    
    except Exception as e:
        logger.error(f"음성 인식 전체 오류: {str(e)}")
        return ""


def get_gpt_response(user_message: str, call_sid: str) -> str:
    """GPT를 사용한 대화 응답 생성"""
    try:
        # 대화 세션 초기화 (첫 메시지인 경우)
        if call_sid not in conversation_sessions:
            conversation_sessions[call_sid] = [
                {
                    "role": "system",
                    "content": """당신은 친절하고 따뜻한 한국어 AI 어시스턴트입니다.
                    어르신과 전화 통화를 하며 일상 대화를 나누고 있습니다.
                    간결하고 명확하게 답변하며, 전화 통화에 적합한 짧은 문장으로 대답하세요.
                    어르신의 안부를 묻고, 오늘 하루 어떻게 지냈는지, 건강은 어떤지 관심을 가져주세요."""
                }
            ]
        
        # 사용자 메시지 추가
        conversation_sessions[call_sid].append({
            "role": "user",
            "content": user_message
        })
        
        # GPT API 호출
        response = openai_client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=conversation_sessions[call_sid],
            max_tokens=150,
            temperature=0.7
        )
        
        assistant_message = response.choices[0].message.content
        
        # AI 응답 저장
        conversation_sessions[call_sid].append({
            "role": "assistant",
            "content": assistant_message
        })
        
        return assistant_message
    except Exception as e:
        logger.error(f"GPT API 오류: {str(e)}")
        return "죄송합니다. 응답을 생성하는 중 오류가 발생했습니다."


def text_to_speech(text: str) -> bytes:
    """
    OpenAI TTS API를 사용하여 텍스트를 음성으로 변환
    """
    try:
        # 임시 파일로 저장 (더 안정적인 방법)
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            temp_path = temp_file.name
        
        # TTS 생성
        response = openai_client.audio.speech.create(
            model=settings.OPENAI_TTS_MODEL,
            voice=settings.OPENAI_TTS_VOICE,  # alloy, echo, fable, onyx, nova, shimmer
            input=text,
            response_format="wav"
        )
        
        # 파일로 저장 (stream_to_file이 더 안정적)
        response.stream_to_file(temp_path)
        
        # 파일 읽기
        with open(temp_path, 'rb') as f:
            audio_data = f.read()
        
        # 임시 파일 삭제
        os.unlink(temp_path)
        
        if not audio_data:
            logger.error(f"TTS: 응답은 성공했지만 데이터가 비어있음 (텍스트 길이: {len(text)})")
            return b""
        
        logger.info(f"✅ TTS 성공: {len(audio_data)} bytes, 텍스트 길이: {len(text)}")
        return audio_data
        
    except Exception as e:
        logger.error(f"TTS 오류: {str(e)}, 텍스트: {text[:50]}...")
        import traceback
        logger.error(traceback.format_exc())
        return b""


async def transcribe_audio_realtime(audio_data: bytes) -> str:
    """
    실시간 오디오를 텍스트로 변환 (STT Service 사용)
    Twilio mulaw 포맷 → WAV 변환 후 Whisper API 전송
    
    Args:
        audio_data: Twilio에서 받은 mulaw 오디오 데이터
    
    Returns:
        str: 변환된 텍스트
    """
    try:
        import wave
        
        # mulaw를 16-bit PCM으로 변환
        try:
            pcm_data = audioop.ulaw2lin(audio_data, 2)
        except Exception as conv_error:
            logger.error(f"❌ mulaw 변환 오류: {conv_error}")
            return ""
        
        # 임시 WAV 파일 생성
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_audio:
            temp_audio_path = temp_audio.name
        
        try:
            # PCM 데이터를 WAV 파일로 저장
            with wave.open(temp_audio_path, 'wb') as wav_file:
                wav_file.setnchannels(1)      # Mono
                wav_file.setsampwidth(2)      # 16-bit (2 bytes)
                wav_file.setframerate(8000)   # 8kHz (Twilio 샘플레이트)
                wav_file.writeframes(pcm_data)
            
            # STT Service를 사용하여 변환
            transcript, stt_time = stt_service.transcribe_audio(temp_audio_path, language="ko")
            logger.info(f"✅ STT 완료 ({stt_time:.2f}초): {transcript[:50]}...")
            return transcript
            
        except Exception as e:
            logger.error(f"❌ STT 변환 실패: {e}")
            return ""
        finally:
            # 임시 파일 삭제
            if os.path.exists(temp_audio_path):
                os.unlink(temp_audio_path)
    
    except Exception as e:
        logger.error(f"❌ 실시간 음성 인식 오류: {str(e)}")
        return ""


async def send_audio_to_twilio_with_tts(websocket: WebSocket, stream_sid: str, text: str):
    """
    TTS Service를 사용하여 텍스트를 음성으로 변환 후 Twilio WebSocket으로 전송
    WAV → mulaw 변환 포함
    
    Args:
        websocket: Twilio WebSocket 연결
        stream_sid: Twilio Stream SID
        text: 변환할 텍스트
    """
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


async def send_audio_to_twilio(websocket: WebSocket, stream_sid: str, text: str):
    """
    텍스트를 음성으로 변환하여 Twilio WebSocket으로 전송
    WAV → mulaw 변환 포함 (기존 함수 - 호환성 유지)
    """
    try:
        import wave
        import io
        
        # TTS로 음성 생성 (WAV 포맷)
        audio_data = text_to_speech(text)
        
        if not audio_data:
            logger.error("TTS 음성 생성 실패")
            return
        
        # WAV 데이터를 mulaw로 변환
        try:
            # WAV 파일을 메모리에서 읽기
            wav_io = io.BytesIO(audio_data)
            with wave.open(wav_io, 'rb') as wav_file:
                # WAV 파라미터 확인
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                framerate = wav_file.getframerate()
                frames = wav_file.readframes(wav_file.getnframes())
                
                logger.info(f"🎵 TTS WAV: {channels}ch, {sample_width*8}bit, {framerate}Hz")
                
                # Stereo → Mono 변환 (필요시)
                if channels == 2:
                    frames = audioop.tomono(frames, sample_width, 1, 1)
                
                # 샘플레이트 변환 (Twilio는 8kHz 요구)
                if framerate != 8000:
                    frames, _ = audioop.ratecv(frames, sample_width, 1, framerate, 8000, None)
                
                # 16-bit → 8-bit mulaw 변환
                if sample_width == 2:  # 16-bit
                    mulaw_data = audioop.lin2ulaw(frames, 2)
                elif sample_width == 1:  # 8-bit
                    # 8-bit PCM → 16-bit PCM → mulaw
                    frames_16 = audioop.lin2lin(frames, 1, 2)
                    mulaw_data = audioop.lin2ulaw(frames_16, 2)
                else:
                    logger.error(f"지원하지 않는 샘플 너비: {sample_width}")
                    return
                
        except Exception as conv_error:
            logger.error(f"오디오 변환 오류: {conv_error}")
            return
        
        # mulaw 데이터를 Base64로 인코딩
        audio_base64 = base64.b64encode(mulaw_data).decode('utf-8')
        
        logger.info(f"📤 오디오 전송: {len(mulaw_data)} bytes (mulaw 8kHz)")
        
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
# STT, LLM, TTS 서비스 import

# 대화 기록 저장 (간단한 인메모리 저장소, 실제로는 DB 사용 권장)
conversation_sessions = {}

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
    response.say(
        "안녕하세요. AI 어시스턴트에 연결되었습니다.",
        language='ko-KR'
    )
    
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
    Twilio Media Streams WebSocket 핸들러
    실시간 오디오 데이터 양방향 처리
    
    STT → LLM → TTS 파이프라인을 통한 실시간 음성 대화
    """
    await websocket.accept()
    logger.info("📞 Twilio WebSocket 연결됨")
    
    call_sid = None
    stream_sid = None
    audio_processor = None
    
    try:
        async for message in websocket.iter_text():
            data = json.loads(message)
            event_type = data.get('event')
            
            if event_type == 'start':
                # 스트림 시작
                call_sid = data['start']['callSid']
                stream_sid = data['start']['streamSid']
                audio_processor = AudioProcessor(call_sid)
                active_connections[call_sid] = websocket
                
                # 대화 세션 초기화 (LLM 대화 히스토리 관리)
                if call_sid not in conversation_sessions:
                    conversation_sessions[call_sid] = []
                
                logger.info(f"🎙️ 스트림 시작 - Call: {call_sid}, Stream: {stream_sid}")
                
                # 시작 안내 메시지 (TTS 서비스 사용)
                welcome_text = "안녕하세요! 무엇을 도와드릴까요?"
                await send_audio_to_twilio_with_tts(websocket, stream_sid, welcome_text)
                
            elif event_type == 'media':
                # 오디오 데이터 수신 (실시간 스트리밍)
                if audio_processor:
                    # Base64 디코딩 (Twilio는 mulaw 8kHz로 전송)
                    audio_payload = base64.b64decode(data['media']['payload'])
                    audio_processor.add_audio_chunk(audio_payload)
                    
                    # 사용자가 말을 멈췄는지 확인 (침묵 감지)
                    if audio_processor.should_process():
                        cycle_start = time.time()
                        logger.info(f"\n{'='*60}")
                        logger.info(f"🔄 실시간 대화 사이클 시작")
                        
                        # 1️⃣ STT: 오디오 → 텍스트 변환
                        audio_data = audio_processor.get_audio()
                        user_text = await transcribe_audio_realtime(audio_data)
                        
                        if user_text:
                            logger.info(f"👤 사용자: {user_text}")
                            
                            # 종료 키워드 확인
                            if any(keyword in user_text.lower() 
                                   for keyword in ['종료', '끝', '그만', 'goodbye', '끊어', '안녕']):
                                goodbye_text = "대화를 종료합니다. 감사합니다. 좋은 하루 보내세요!"
                                await send_audio_to_twilio_with_tts(websocket, stream_sid, goodbye_text)
                                await asyncio.sleep(2)  # 마지막 메시지 재생 대기
                                await websocket.close()
                                break
                            
                            # 2️⃣ LLM: 응답 생성
                            conversation_history = conversation_sessions.get(call_sid, [])
                            ai_response, llm_time = llm_service.generate_response(
                                user_message=user_text,
                                conversation_history=conversation_history
                            )
                            logger.info(f"🤖 AI: {ai_response}")
                            
                            # 대화 히스토리 저장 (최근 10개만)
                            conversation_sessions[call_sid].append({"role": "user", "content": user_text})
                            conversation_sessions[call_sid].append({"role": "assistant", "content": ai_response})
                            if len(conversation_sessions[call_sid]) > 10:
                                conversation_sessions[call_sid] = conversation_sessions[call_sid][-10:]
                            
                            # 3️⃣ TTS: 텍스트 → 음성 → Twilio 전송
                            await send_audio_to_twilio_with_tts(websocket, stream_sid, ai_response)
                            
                            total_cycle_time = time.time() - cycle_start
                            logger.info(f"⏱️  전체 사이클 완료: {total_cycle_time:.2f}초")
                            logger.info(f"{'='*60}\n")
                        
            elif event_type == 'stop':
                # 스트림 종료
                logger.info(f"📞 스트림 종료 - Call: {call_sid}")
                
                # 대화 내용 DB에 저장
                if call_sid and call_sid in conversation_sessions:
                    conversation = conversation_sessions[call_sid]
                    logger.info(f"대화 내용 저장 가능: {len(conversation)}개 메시지")
                    del conversation_sessions[call_sid]
                if call_sid in active_connections:
                    del active_connections[call_sid]
                break
                
    except WebSocketDisconnect:
        logger.info("📞 Twilio WebSocket 연결 해제")
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
