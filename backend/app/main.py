"""
Grandby FastAPI Application
메인 애플리케이션 진입점
"""

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from contextlib import asynccontextmanager
import logging
import json
import base64
import asyncio
import os
import tempfile
from typing import Dict
import audioop
from datetime import datetime
from sqlalchemy.orm import Session

from twilio.twiml.voice_response import VoiceResponse, Connect, Stream
from openai import OpenAI

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
        response = openai_client.audio.speech.create(
            model=settings.OPENAI_TTS_MODEL,
            voice=settings.OPENAI_TTS_VOICE,  # alloy, echo, fable, onyx, nova, shimmer
            input=text,
            response_format="wav"
        )
        
        return response.content
    except Exception as e:
        logger.error(f"TTS 오류: {str(e)}")
        return b""


async def send_audio_to_twilio(websocket: WebSocket, stream_sid: str, text: str):
    """
    텍스트를 음성으로 변환하여 Twilio WebSocket으로 전송
    WAV → mulaw 변환 포함
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

from app.routers import auth, users, calls, diaries, todos, notifications, dashboard

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


# ==================== Twilio WebSocket Endpoints ====================

@app.post("/api/twilio/call", tags=["Twilio"])
async def initiate_test_call(db: Session = Depends(get_db)):
    """
    테스트 전화 발신 (TEST_PHONE_NUMBER로 자동 발신)
    
    환경 변수 TEST_PHONE_NUMBER에 설정된 번호로 자동으로 전화를 겁니다.
    """
    try:
        # TEST_PHONE_NUMBER 확인
        if not settings.TEST_PHONE_NUMBER:
            raise HTTPException(
                status_code=400,
                detail="TEST_PHONE_NUMBER가 환경 변수에 설정되지 않았습니다."
            )
        
        # API Base URL 확인
        if not settings.API_BASE_URL:
            raise HTTPException(
                status_code=400,
                detail="API_BASE_URL이 환경 변수에 설정되지 않았습니다. (ngrok 또는 도메인 필요)"
            )
        
        # Twilio 서비스 초기화
        twilio_service = TwilioService()
        
        # Callback URL 설정
        api_base_url = settings.API_BASE_URL
        voice_url = f"https://{api_base_url}/api/twilio/voice"
        status_callback_url = f"https://{api_base_url}/api/twilio/call-status"
        
        logger.info(f"📞 전화 발신 시작: {settings.TEST_PHONE_NUMBER}")
        logger.info(f"🔗 Voice URL: {voice_url}")
        
        # 전화 걸기
        call_sid = twilio_service.make_call(
            to_number=settings.TEST_PHONE_NUMBER,
            voice_url=voice_url,
            status_callback_url=status_callback_url
        )
        
        # 통화 기록 저장 (선택사항)
        try:
            from app.models.call import CallLog
            new_call = CallLog(
                call_id=call_sid,
                elderly_id="test-user",  # 테스트용
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
        
        logger.info(f"✅ 전화 발신 성공: {call_sid}")
        
        return {
            "success": True,
            "call_sid": call_sid,
            "to_number": settings.TEST_PHONE_NUMBER,
            "status": "initiated",
            "message": f"전화가 {settings.TEST_PHONE_NUMBER}로 발신되었습니다.",
            "voice_url": voice_url,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 전화 발신 실패: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"전화 발신 중 오류 발생: {str(e)}"
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
async def media_stream_handler(websocket: WebSocket):
    """
    Twilio Media Streams WebSocket 핸들러
    실시간 오디오 데이터 양방향 처리
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
                
                logger.info(f"🎙️ 스트림 시작 - Call: {call_sid}, Stream: {stream_sid}")
                
                # 시작 안내 메시지
                welcome_text = "무엇을 도와드릴까요?"
                await send_audio_to_twilio(websocket, stream_sid, welcome_text)
                
            elif event_type == 'media':
                # 오디오 데이터 수신 (실시간 스트리밍)
                if audio_processor:
                    # Base64 디코딩 (Twilio는 mulaw 8kHz로 전송)
                    audio_payload = base64.b64decode(data['media']['payload'])
                    audio_processor.add_audio_chunk(audio_payload)
                    
                    # 사용자가 말을 멈췄는지 확인
                    if audio_processor.should_process():
                        # 오디오 → 텍스트 변환 (STT)
                        audio_data = audio_processor.get_audio()
                        user_text = transcribe_audio(audio_data)
                        
                        if user_text:
                            logger.info(f"👤 사용자: {user_text}")
                            
                            # 종료 키워드 확인
                            if any(keyword in user_text.lower() 
                                   for keyword in ['종료', '끝', '그만', 'goodbye', '끊어']):
                                goodbye_text = "대화를 종료합니다. 감사합니다. 좋은 하루 보내세요!"
                                await send_audio_to_twilio(websocket, stream_sid, goodbye_text)
                                await asyncio.sleep(2)  # 마지막 메시지 재생 대기
                                await websocket.close()
                                break
                            
                            # GPT 응답 생성
                            gpt_response = get_gpt_response(user_text, call_sid)
                            logger.info(f"🤖 AI: {gpt_response}")
                            
                            # 텍스트 → 음성 → Twilio로 전송
                            await send_audio_to_twilio(websocket, stream_sid, gpt_response)
                        
            elif event_type == 'stop':
                # 스트림 종료
                logger.info(f"📞 스트림 종료 - Call: {call_sid}")
                if call_sid in conversation_sessions:
                    # 통화 내용 저장 가능 (향후 일기 생성 등에 활용)
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
    finally:
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

