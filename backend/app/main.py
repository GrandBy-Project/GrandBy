"""
Grandby FastAPI Application
메인 애플리케이션 진입점
"""

from fastapi import FastAPI, Request, WebSocket, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from contextlib import asynccontextmanager
import logging
import json
import base64
import asyncio
from typing import Dict
from datetime import datetime
from sqlalchemy.orm import Session
from pathlib import Path
import time
import random
from pytz import timezone

from twilio.twiml.voice_response import VoiceResponse, Connect, Stream

from app.routers import auth, users, calls, diaries, todos, notifications, dashboard
from app.config import settings, is_development
from app.database import test_db_connection, get_db
from app.services.ai_call.llm_service import LLMService
from app.services.ai_call.twilio_service import TwilioService
from app.services.ai_call.rtzr_stt_realtime import RTZRRealtimeSTT, LLMPartialCollector
from app.services.ai_call.naver_clova_tts_service import naver_clova_tts_service

# 로거 설정 (시간 포함)
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format='%(asctime)s.%(msecs)03d - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# OpenAI 클라이언트 및 서비스 초기화
llm_service = LLMService()

# WebSocket 연결 및 대화 세션 관리
active_connections: Dict[str, WebSocket] = {}
conversation_sessions: Dict[str, list] = {}
saved_calls: set = set()  # 중복 저장 방지용 플래그

# TTS 재생 완료 시간 추적 (call_sid -> (completion_time, total_playback_duration))
active_tts_completions: Dict[str, tuple[float, float]] = {}

# ==================== Helper Functions ====================

# 한국 시간대 (KST, UTC+9)
KST = timezone('Asia/Seoul')

def get_time_based_welcome_message() -> str:
    """
    한국 시간대 기준으로 시간대별 환영 메시지 또는 기본 인사말 랜덤 선택
    
    Returns:
        str: 시간대에 맞는 환영 메시지 또는 기본 인사말
    """
    kst_now = datetime.now(KST)
    hour = kst_now.hour
    
    # 기본 인사말 (시간대에 상관없이 사용 가능, 절반에 '하루' 포함)
    default_messages = [
        "안녕하세요 어르신, 하루에요. 반가워요!",
        "어르신 안녕하세요. 하루입니다. 오늘 어떻게 지내세요?",
        "안녕하세요, 오늘도 좋은 하루 보내고 계신가요?",
        "안녕하세요 어르신! 저 하루예요. 기분은 어떠세요?",
        "어르신 안녕하세요. 하루에요. 건강은 어떠신가요?",
        "안녕하세요, 오늘 하루 잘 지내고 계세요?",
        "안녕하세요 어르신! 하루에요. 오늘은 어떻게 지내고 계세요?",
        "어르신 안녕하세요. 하루에요. 오늘은 어떠세요?",
        "안녕하세요, 기분 좋은 하루 보내고 계신가요?",
        "안녕하세요 어르신! 오늘 하루는 어떠세요?",
        "어르신 안녕하세요. 하루입니다. 오늘도 이렇게 뵙게 되어 기뻐요!",
        "어르신 안녕하세요. 오늘 하루는 어떠셨어요?",
        "안녕하세요, 건강하게 지내고 계신가요?",
        "안녕하세요 어르신! 하루에요. 오늘 컨디션 괜찮으신가요?",
        "어르신 안녕하세요. 오늘도 기운차게 보내고 계신가요?",
        "안녕하세요, 오늘 하루 어떠셨나요?",
        "안녕하세요 어르신! 하루입니다. 오늘도 별 탈 없이 잘 지내고 계신가요?",
        "안녕하세요, 오늘 하루 잘 지내셨나요?",
        "어르신 안녕하세요. 하루에요. 오늘 기분은 어떠세요?",
        "안녕하세요, 오늘 하루 잘 보내고 계신가요?",
        "어르신 안녕하세요. 하루입니다. 오늘도 힘차게 보내고 계신가요?",
        "안녕하세요, 오늘 하루 어떠셨는지 궁금해요.",
        "어르신 안녕하세요. 오늘 하루 잘 지내셨나요?"
    ]
    
    # 시간대별 인사말
    time_specific_messages = []
    
    if 0 <= hour < 6:
        # 새벽 (0-6시)
        time_specific_messages = [
            "안녕하세요 어르신, 저 하루에요. 새벽인데 잘 주무시고 계셨나요?",
            "안녕하세요, 하루입니다. 이 새벽에 뵙네요. 잘 주무시고 계셨나요?",
            "어르신, 새벽인데 건강은 어떠세요?",
            "안녕하세요, 새벽 시간에 깨어 계시네요. 편하게 주무시고 계셨나요?"
        ]
    elif 6 <= hour < 12:
        # 아침 (6-12시)
        time_specific_messages = [
            "아침부터 뵈니 정말 기뻐요! 저 하루에요!",
            "안녕하세요 어르신, 하루입니다. 좋은 아침이에요!",
            "아침부터 뵈니 반가워요. 하루예요. 잘 주무셨어요?",
            "안녕하세요, 좋은 아침이네요. 오늘 하루도 기운차게 시작하시는군요!",
            "어르신, 저 하루에요. 아침부터 뵈니 정말 기쁩니다!",
            "안녕하세요, 어젯 밤 잘 주무셨어요?",
            "좋은 아침이에요, 어르신! 하루입니다. 아침 식사는 하셨어요?",
            "안녕하세요, 아침부터 뵈니 정말 반가워요."
        ]
    elif 12 <= hour < 18:
        # 오후 (12-18시)
        time_specific_messages = [
            "안녕하세요 어르신, 하루에요. 좋은 오후네요!",
            "안녕하세요, 오후에 뵈니 반가워요.",
            "어르신, 저 하루입니다. 점심은 드셨어요? 좋은 오후 보내고 계신가요?",
            "안녕하세요, 하루에요. 오후 시간에 뵙네요. 어떻게 지내세요?",
            "좋은 오후예요, 어르신! 오늘 하루 잘 보내고 계세요?",
            "안녕하세요, 오후인데 오늘은 어떻게 지내셨어요?",
            "어르신, 하루예요. 오후에 뵈니 기뻐요. 건강은 어떠세요?",
            "안녕하세요, 좋은 오후네요. 오늘 하루 잘 지내고 계신가요?"
        ]
    elif 18 <= hour < 22:
        # 저녁 (18-22시)
        time_specific_messages = [
            "안녕하세요 어르신, 하루에요. 저녁인데 식사는 하셨어요?",
            "어르신, 저녁 시간에 뵈니 반가워요. 저녁 드셨어요?",
            "안녕하세요, 저 하루입니다. 저녁인데 오늘 하루 잘 보내셨어요?",
            "저녁인데 식사는 하셨나요, 어르신?",
            "안녕하세요, 하루예요. 좋은 저녁이에요. 저녁은 드셨어요?",
            "어르신, 저 하루에요. 저녁 시간에 뵙네요. 저녁 식사는 하셨어요?",
            "안녕하세요, 저녁인데 오늘 하루 어떠셨어요?",
            "저녁에 뵈니 기쁘네요. 하루입니다. 식사는 드셨나요?",
            "안녕하세요 어르신, 저녁 시간에 뵙네요. 저녁은 드셨어요?",
            "어르신, 하루에요. 저녁인데 건강은 어떠세요? 저녁 식사는 하셨어요?"
        ]
    else:
        # 밤 (22-24시)
        time_specific_messages = [
            "안녕하세요 어르신, 하루에요. 밤인데 아직 안 주무시나요?",
            "어르신, 밤 시간에 깨어 계시네요. 잘 주무시고 계셨나요?",
            "안녕하세요, 저 하루입니다. 밤인데 건강은 어떠세요?",
            "밤에 뵈니 반가워요. 오늘 하루 잘 보내셨어요?",
            "안녕하세요, 하루예요. 좋은 밤이네요. 내일도 좋은 하루 되세요.",
            "어르신, 밤인데 오늘 하루 어떠셨어요?",
            "밤 시간에 뵈니 기쁘네요. 하루에요. 편하게 주무시고 계셨나요?"
        ]
    
    # 기본 인사말과 시간대별 인사말을 합쳐서 랜덤 선택
    all_messages = default_messages + time_specific_messages
    
    # 랜덤으로 하나 선택
    return random.choice(all_messages)

# ==================== 대화 내용 DB 저장 함수 ====================

async def save_conversation_to_db(call_sid: str, conversation: list):
    """
    대화 내용을 DB에 저장하는 공통 함수
    
    Args:
        call_sid: Twilio Call SID
        conversation: 대화 내용 리스트 [{"role": "user", "content": "..."}, ...]
    """
    # 이미 저장되었으면 스킵 (중복 방지)
    if call_sid in saved_calls:
        logger.info(f"⏭️  이미 저장된 통화: {call_sid}")
        return
    
    # 저장할 내용이 없으면 스킵
    if not conversation or len(conversation) == 0:
        logger.warning(f"⚠️  저장할 대화 내용이 없음: {call_sid}")
        return
    
    logger.info(f"💾 대화 기록 저장 시작: {len(conversation)}개 메시지")
    
    try:
        from app.models.call import CallLog, CallTranscript, CallStatus
        db = next(get_db())
        
        # 1. CallLog 업데이트 (대화 요약)
        call_log_db = db.query(CallLog).filter(CallLog.call_id == call_sid).first()
        
        if call_log_db:
            # LLM 요약 생성 (대화가 있는 경우에만)
            if len(conversation) > 0:
                logger.info("🤖 LLM으로 통화 요약 생성 중...")
                summary = llm_service.summarize_call_conversation(conversation)
                call_log_db.conversation_summary = summary
                logger.info(f"✅ 요약 생성 완료: {summary[:100]}...")
            
            db.commit()
            logger.info(f"✅ CallLog 업데이트 완료")
        else:
            logger.warning(f"⚠️  CallLog를 찾을 수 없음: {call_sid}")
        
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
        
        # 저장 성공 플래그 설정
        saved_calls.add(call_sid)
        
        db.close()
        
    except Exception as e:
        logger.error(f"❌ DB 저장 실패: {e}")
        import traceback
        logger.error(traceback.format_exc())
        if 'db' in locals():
            db.rollback()
            db.close()

# ==================== Helper Functions ====================

async def process_streaming_response(
    websocket: WebSocket,
    stream_sid: str,
    user_text: str,
    conversation_history: list,
    rtzr_stt=None,
    call_sid=None
) -> str:
    """
    최적화된 스트리밍 응답 처리 - 사전 연결된 WebSocket 사용
    
    핵심 개선:
    - LLM 스트림을 두 갈래로 분리 (텍스트 수집 + TTS)
    - 🚀 첫 TTS 재생 후 LLM 종료 판단 (사용자 경험 최적화)
    """
    import audioop
    
    try:
        pipeline_start = time.time()
        full_response = []
        logger.info("=" * 60)
        logger.info("🚀 실시간 스트리밍 파이프라인 시작 (Naver Clova TTS 사용)")
        logger.info("=" * 60)
        
        # Naver Clova TTS 스트리밍 파이프라인
        playback_duration = await llm_to_clova_tts_pipeline(
            websocket,
            stream_sid,
            user_text,
            conversation_history,
            full_response,
            pipeline_start,
            rtzr_stt=rtzr_stt,
            call_sid=call_sid
        )
        
        pipeline_time = time.time() - pipeline_start
        
        logger.info("=" * 60)
        logger.info(f"✅ 전체 파이프라인 완료: {pipeline_time:.2f}초")
        logger.info(f"   예상 재생 시간: {playback_duration:.2f}초")
        logger.info("=" * 60)
        
        # 재생 완료 대기
        if playback_duration > 0:
            await asyncio.sleep(playback_duration * 1.1)
        
        return "".join(full_response)
        
    except Exception as e:
        logger.error(f"❌ 실시간 스트리밍 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return ""


async def llm_to_clova_tts_pipeline(
    websocket: WebSocket,
    stream_sid: str,
    user_text: str,
    conversation_history: list,
    full_response: list,
    pipeline_start: float,
    rtzr_stt=None,
    call_sid=None
) -> float:
    """
    LLM 텍스트 생성 → Naver Clova TTS → Twilio 전송 파이프라인
    
    핵심:
    - LLM이 문장을 생성하는 즉시 Clova TTS로 변환
    - 변환된 음성을 즉시 Twilio로 전송
    - 실시간 스트리밍 효과
    - 🚀 첫 TTS 재생 후 LLM 종료 판단 수행 (사용자 경험 최적화)
    """
    import re
    import base64
    import audioop

    llm_service = LLMService()
    
    try:
        sentence_buffer = ""
        sentence_count = 0
        first_audio_sent = False
        total_playback_duration = 0.0
        
        logger.info("🤖 [LLM] Naver Clova TTS 스트리밍 시작")
        
        async for chunk in llm_service.generate_response_streaming(user_text, conversation_history):
            sentence_buffer += chunk
            full_response.append(chunk)
            
            # 문장 종료 감지
            should_send = False
            
            # 1. 명확한 문장 종료
            if re.search(r'[.!?\n。！？]', chunk):
                should_send = True
            
            # 2. 쉼표로 자연스럽게 끊기
            elif len(sentence_buffer) > 40 and re.search(r'[,，]', sentence_buffer[-5:]):
                should_send = True
            
            # 3. 너무 긴 문장 강제 분할
            elif len(sentence_buffer) > 80:
                should_send = True
            
            if should_send and sentence_buffer.strip():
                sentence = sentence_buffer.strip()
                sentence_count += 1
                
                elapsed = time.time() - pipeline_start
                
                if not first_audio_sent:
                    logger.info(f"⚡ [첫 문장] +{elapsed:.2f}초에 생성 완료!")
                    first_audio_sent = True
                
                logger.info(f"🔊 [문장 {sentence_count}] TTS 변환 시작: {sentence[:40]}...")
                
                # Naver Clova TTS로 즉시 변환
                audio_data, tts_time = await naver_clova_tts_service.text_to_speech_bytes(sentence)
                
                if audio_data:
                    elapsed_tts = time.time() - pipeline_start
                    logger.info(f"✅ [문장 {sentence_count}] TTS 완료 (+{elapsed_tts:.2f}초, {tts_time:.2f}초)")
                    
                    # WAV → mulaw 변환 및 Twilio 전송
                    playback_duration = await send_clova_audio_to_twilio(
                        websocket,
                        stream_sid,
                        audio_data,
                        sentence_count,
                        pipeline_start
                    )
                    
                    total_playback_duration += playback_duration
                else:
                    logger.warning(f"⚠️ [문장 {sentence_count}] TTS 실패, 건너뜀")
                
                sentence_buffer = ""
        
        # 마지막 문장 처리
        if sentence_buffer.strip():
            sentence_count += 1
            logger.info(f"🔊 [마지막 문장] TTS 변환 시작: {sentence_buffer.strip()[:40]}...")
            
            audio_data, tts_time = await naver_clova_tts_service.text_to_speech_bytes(sentence_buffer.strip())
            
            if audio_data:
                playback_duration = await send_clova_audio_to_twilio(
                    websocket,
                    stream_sid,
                    audio_data,
                    sentence_count,
                    pipeline_start
                )

                total_playback_duration += playback_duration
            else:
                logger.warning("⚠️ 마지막 문장 TTS 실패, 건너뜀")
        
        logger.info(f"✅ [전체] 총 {sentence_count}개 문장 처리 완료")
        
        # ✅ TTS 완료 시점과 재생 시간 기록
        if call_sid:
            completion_time = time.time()
            active_tts_completions[call_sid] = (completion_time, total_playback_duration)
            logger.info(f"📝 [TTS 추적] {call_sid}: 완료 시점={completion_time:.2f}, 재생 시간={total_playback_duration:.2f}초")
           
                
        return total_playback_duration  
        
    except Exception as e:
        logger.error(f"❌ Naver Clova TTS 파이프라인 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 0.0


async def send_clova_audio_to_twilio(
    websocket: WebSocket,
    stream_sid: str,
    audio_data: bytes,
    sentence_index: int,
    pipeline_start: float
) -> float:
    """
    Clova TTS로 생성된 WAV 오디오를 Twilio로 전송
    
    Args:
        websocket: Twilio WebSocket
        stream_sid: Twilio Stream SID
        audio_data: WAV 오디오 데이터
        sentence_index: 문장 번호
        pipeline_start: 파이프라인 시작 시간
    
    Returns:
        float: 재생 시간
    """
    import wave
    import io
    import base64
    import audioop
    
    try:
        # WAV 파일 파싱
        wav_io = io.BytesIO(audio_data)
        with wave.open(wav_io, 'rb') as wav_file:
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            framerate = wav_file.getframerate()
            n_frames = wav_file.getnframes()
            pcm_data = wav_file.readframes(n_frames)
        
        logger.info(f"🎵 [문장 {sentence_index}] 원본: {framerate}Hz, {channels}ch")
        
        # Stereo → Mono 변환
        if channels == 2:
            pcm_data = audioop.tomono(pcm_data, sample_width, 1, 1)
        
        # 샘플레이트 변환: 8kHz (Twilio 요구사항)
        if framerate != 8000:
            pcm_data, _ = audioop.ratecv(pcm_data, sample_width, 1, framerate, 8000, None)
        
        # PCM → mulaw 변환
        mulaw_data = audioop.lin2ulaw(pcm_data, 2)
        
        # 재생 시간 계산
        playback_duration = len(mulaw_data) / 8000.0
        
        # Base64 인코딩
        audio_base64 = base64.b64encode(mulaw_data).decode('utf-8')
        
        # Twilio로 청크 단위 전송
        chunk_size = 8000  # 8KB 청크
        chunk_count = 0
        
        for i in range(0, len(audio_base64), chunk_size):
            chunk = audio_base64[i:i + chunk_size]
            chunk_count += 1
            
            message = {
                "event": "media",
                "streamSid": stream_sid,
                "media": {"payload": chunk}
            }
            
            await websocket.send_text(json.dumps(message))
        
        elapsed = time.time() - pipeline_start
        logger.info(f"📤 [문장 {sentence_index}] Twilio 전송 완료 ({chunk_count} 청크, +{elapsed:.2f}초)")
        
        return playback_duration
        
    except Exception as e:
        logger.error(f"❌ [문장 {sentence_index}] Twilio 전송 오류: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 0.0

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
    """모든 HTTP 요청 로깅 (응답 크기 및 로딩 시간 포함)"""
    start_time = time.perf_counter()
    
    # 요청 시작 로깅
    logger.info(f"📥 {request.method} {request.url.path}")
    
    # 응답 처리
    response = await call_next(request)
    
    # 로딩 시간 계산 (밀리초)
    elapsed_time = (time.perf_counter() - start_time) * 1000
    
    # 응답 크기 측정
    response_size = None
    if "content-length" in response.headers:
        # Content-Length 헤더가 있으면 사용
        try:
            response_size = int(response.headers["content-length"])
        except (ValueError, TypeError):
            response_size = None
    else:
        # Content-Length 헤더가 없으면 응답 본문 읽기 (스트리밍 응답이 아닌 경우에만)
        try:
            body = b""
            async for chunk in response.body_iterator:
                body += chunk
            response_size = len(body)
            
            # 응답 본문을 다시 스트림으로 변환
            from starlette.responses import Response
            response = Response(
                content=body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=getattr(response, 'media_type', None) or response.headers.get('content-type', 'application/json')
            )
        except Exception as e:
            # 응답 본문 읽기 실패 시 크기 측정 건너뛰기
            logger.debug(f"⚠️ 응답 크기 측정 실패 (스트리밍 응답일 수 있음): {e}")
            response_size = None
    
    # 크기를 읽기 쉬운 형식으로 변환
    size_str = ""
    if response_size is not None:
        if response_size < 1024:
            size_str = f"{response_size}B"
        elif response_size < 1024 * 1024:
            size_str = f"{response_size / 1024:.2f}KB"
        else:
            size_str = f"{response_size / (1024 * 1024):.2f}MB"
    
    # 응답 로깅 (상태 코드, 크기, 시간)
    logger.info(
        f"📤 {request.method} {request.url.path} - "
        f"{response.status_code} | "
        f"{size_str} | "
        f"{elapsed_time:.2f}ms"
    )
    
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


# ==================== Static Files (이미지 업로드) ====================
# 업로드 디렉토리 생성
upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)

# 정적 파일 마운트
try:
    app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")
    logger.info(f"✅ 정적 파일 서빙 활성화: /uploads -> {upload_dir}")
except Exception as e:
    logger.warning(f"⚠️ 정적 파일 마운트 실패: {e}")

# ==================== API Routers ====================

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
        voice_url = f"https://{api_base_url}/api/twilio/voice?elderly_id={request.user_id}"  # WebSocket 시작 엔드포인트
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
async def voice_handler(request: Request):
    """
    Twilio 전화 연결 시 WebSocket 스트림 시작
    """
    response = VoiceResponse()
    elderly_id = request.query_params.get("elderly_id", "unknown")
    
    # WebSocket 스트림 연결 설정
    if not settings.API_BASE_URL:
        logger.error("⚠️ API_BASE_URL이 설정되지 않았습니다!")
        api_base_url = "your-domain.com"  # fallback (작동하지 않음)
    else:
        api_base_url = settings.API_BASE_URL
    
    websocket_url = f"wss://{api_base_url}/api/twilio/media-stream"
    
    connect = Connect()
    stream = Stream(url=websocket_url)
    
    if elderly_id and elderly_id != "unknown":
        stream.parameter(name="elderly_id", value=elderly_id)
    
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
    Twilio Media Streams WebSocket 핸들러 (RTZR 실시간 STT 적용)
    
    실시간 오디오 데이터 양방향 처리 (RTZR 기반):
    1. RTZR 실시간 STT 스트리밍 시작
    2. 부분 인식 결과를 LLM에 백그라운드 전송 (대기 상태 유지)
    3. 최종 인식 결과(is_final: true) 감지
    4. 즉시 AI 응답 생성 및 TTS 재생
    5. 통화 종료 시 전체 대화 내용 저장
    
    RTZR 실시간 STT → LLM (백그라운드) → 최종 문장 → 즉시 응답
    """
    await websocket.accept()
    logger.info("📞 Twilio WebSocket 연결됨")
    
    call_sid = None
    stream_sid = None
    rtzr_stt = None  # RTZR 실시간 STT
    llm_collector = None  # LLM 부분 결과 수집기
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
                
                active_connections[call_sid] = websocket
                
                # 대화 세션 초기화 (LLM 대화 히스토리 관리)
                if call_sid not in conversation_sessions:
                    conversation_sessions[call_sid] = []
                
                # RTZR 실시간 STT 초기화
                rtzr_stt = RTZRRealtimeSTT()

                # LLM 부분 결과 수집기 초기화 (백그라운드 전송)
                async def llm_partial_callback(partial_text: str):
                    """부분 인식 결과를 LLM에 백그라운드 전송"""
                    nonlocal call_sid
                    logger.debug(f"💭 [LLM 백그라운드] 부분 결과 업데이트: {partial_text}")
                
                llm_collector = LLMPartialCollector(llm_partial_callback)
                
                # DB에 통화 시작 기록 저장 (status: initiated만)
                try:
                    from app.models.call import CallLog, CallStatus
                    db = next(get_db())
                    
                    # 기존 CallLog가 있는지 확인
                    existing_call = db.query(CallLog).filter(CallLog.call_id == call_sid).first()
                    
                    if not existing_call:
                        call_log = CallLog(
                            call_id=call_sid,
                            elderly_id=elderly_id,
                            call_status=CallStatus.INITIATED,
                            twilio_call_sid=call_sid
                        )
                        db.add(call_log)
                        db.commit()
                        db.refresh(call_log)
                        logger.info(f"✅ DB에 통화 시작 기록 저장: {call_sid}")
                    else:
                        logger.info(f"⏭️  이미 존재하는 통화 기록: {call_sid}")
                    
                    db.close()
                except Exception as e:
                    logger.error(f"❌ 통화 시작 기록 저장 실패: {e}")
                
                logger.info(f"┌{'─'*58}┐")
                logger.info(f"│ 🎙️  Twilio 통화 시작 (RTZR STT)                     │")
                logger.info(f"│ Call SID: {call_sid:43} │")
                logger.info(f"│ Stream SID: {stream_sid:41} │")
                logger.info(f"│ Elderly ID: {elderly_id:41} │")
                logger.info(f"└{'─'*58}┘")
                
                # 🚀 개선: 시간대별 환영 메시지 랜덤 선택
                welcome_text = get_time_based_welcome_message()
                logger.info(f"💬 환영 메시지: {welcome_text}")

                try:
                    # 에코 방지
                    if rtzr_stt:
                        rtzr_stt.start_bot_speaking()

                    audio_data, tts_time = await naver_clova_tts_service.text_to_speech_bytes(welcome_text)

                    if audio_data:
                        playback_duration = await send_clova_audio_to_twilio(
                            websocket=websocket,
                            stream_sid=stream_sid,
                            audio_data=audio_data,
                            sentence_index=0,
                            pipeline_start=time.time()
                        )

                        if playback_duration > 0:
                            await asyncio.sleep(playback_duration * 0.9)
                    else:
                        logger.warning(f" 환영 멘트 TTS 합성 실패, 건너뜀")
                except Exception as e:
                    logger.error(f"❌ 환영 멘트 TTS 합성 오류: {e}")
                finally:
                    if rtzr_stt:
                        rtzr_stt.stop_bot_speaking()
                
                # ========== RTZR 스트리밍 시작 ==========
                logger.info("🎤 RTZR 실시간 STT 스트리밍 시작")
                
                # STT 응답 속도 측정 변수
                last_partial_time = None
                
                async def process_rtzr_results():
                    """RTZR 인식 결과 처리"""
                    nonlocal last_partial_time, call_sid
                    stt_complete_time = None
                    try:
                        logger.info("🔄 [process_rtzr_results 시작] 결과 처리 루프 가동")
                        async for result in rtzr_stt.start_streaming():
                            # ✅ 통화 종료 체크
                            if call_sid not in conversation_sessions:
                                logger.info("⚠️ 통화 종료로 인한 RTZR 처리 중단")
                                break
                            
                            if not result:
                                logger.debug("⚪ [빈 결과] result가 None 또는 빈 값")
                                continue

                            # ====== 종료 판단 이벤트 처리 ======
                            event_name = result.get('event')
                            logger.debug(f"🔍 [결과 수신] event={event_name}, keys={list(result.keys())}")
                            
                            
                            if event_name == 'max_time_warning':
                                logger.info("⚠️ [MAX TIME WARNING] 최대 통화 시간 임박 감지")
                                
                                # 1. AI TTS 출력 중인지 체크
                                if rtzr_stt.is_bot_speaking:
                                    logger.info("⏳ [MAX TIME WARNING] AI 응답 중 - 완료까지 대기")
                                    while rtzr_stt.is_bot_speaking:
                                        await asyncio.sleep(0.1)
                                    # AI 응답 완료 후 추가 대기 (사용자가 응답할 시간)
                                    await asyncio.sleep(2.0)
                                
                                # 2. 사용자 발화 중인지 체크
                                if rtzr_stt.is_user_speaking():
                                    logger.info("⏳ [MAX TIME WARNING] 사용자 발화 중 - 완료까지 대기")
                                    while rtzr_stt.is_user_speaking():
                                        await asyncio.sleep(0.1)
                                    # 사용자 발화 완료 후 추가 대기
                                    await asyncio.sleep(0.5)
                                
                                # 종료 안내 멘트
                                warning_message = "오늘 대화 시간이 다 되었어요. 잠시 후 통화가 마무리됩니다."
                                
                                # 대화 세션에 추가
                                if call_sid in conversation_sessions:
                                    conversation_sessions[call_sid].append({
                                        "role": "assistant",
                                        "content": warning_message
                                    })
                                
                                logger.info(f"🔊 [TTS] 종료 안내 메시지 전송: {warning_message}")
                                
                                # TTS 변환 및 전송
                                audio_data, tts_time = await naver_clova_tts_service.text_to_speech_bytes(warning_message)
                                if audio_data:
                                    playback_duration = await send_clova_audio_to_twilio(
                                        websocket,
                                        stream_sid,
                                        audio_data,
                                        0,
                                        time.time()
                                    )
                                    
                                    # TTS 완료 시간 기록
                                    completion_time = time.time()
                                    active_tts_completions[call_sid] = (completion_time, playback_duration)
                                    logger.info(f"📝 [TTS 추적] 종료 안내 완료: {playback_duration:.2f}초")
                                    
                                    # 재생 완료까지 대기 (20% 여유)
                                    await asyncio.sleep(playback_duration * 1.2)
                                    logger.info("✅ [MAX TIME WARNING] 종료 안내 재생 완료")
                                    
                                    # 종료 안내 후 1초 추가 대기 (사용자가 인지할 시간)
                                    await asyncio.sleep(1.0)
                                    logger.info("⏳ [MAX TIME WARNING] 종료 안내 후 대기 완료, 통화 종료 진행")
                                else:
                                    logger.error("❌ [MAX TIME WARNING] TTS 변환 실패")
                                    await asyncio.sleep(1.0)
                                
                                # 종료 안내 후 즉시 통화 종료
                                try:
                                    await websocket.close()
                                    logger.info("✅ [MAX TIME WARNING] 통화 종료 완료")
                                except Exception as e:
                                    logger.error(f"❌ [MAX TIME WARNING] 통화 종료 오류: {e}")
                                break

                            # ====== 일반 STT 처리 ======
                            if 'text' not in result:
                                continue
                            
                            text = result.get('text', '')
                            is_final = result.get('is_final', False)
                            partial_only = result.get('partial_only', False)
                            
                            current_time = time.time()
                            
                            # 부분 결과는 무시하되 시간 기록
                            if partial_only and text:
                                logger.debug(f"📝 [RTZR 부분 인식] {text}")
                                last_partial_time = current_time
                                continue
                            
                            # 최종 결과 처리
                            if is_final and text:
                                # ✅ 통화 종료 체크
                                if call_sid not in conversation_sessions:
                                    logger.info("⚠️ 통화 종료로 인한 최종 처리 중단")
                                    break
                                # STT 응답 속도 측정
                                # 말이 끝난 시점부터 최종 인식까지의 시간
                                if last_partial_time:
                                    speech_to_final_delay = current_time - last_partial_time
                                    logger.info(f"⏱️ [STT 지연] 말 끝 → 최종 인식: {speech_to_final_delay:.2f}초")
                                
                                # 최종 발화 완료
                                logger.info(f"✅ [RTZR 최종] {text}")
                                
                                # 최종 인식 시점 기록 (LLM 전달 전 시간 측정용)
                                stt_complete_time = current_time

                                
                                # 종료 키워드 확인
                                if '그랜비 통화를 종료합니다' in text:
                                    logger.info(f"🛑 종료 키워드 감지")
                                    
                                    # 대화 세션에 사용자 메시지 추가
                                    if call_sid not in conversation_sessions:
                                        conversation_sessions[call_sid] = []
                                    conversation_sessions[call_sid].append({"role": "user", "content": text})
                                    
                                    goodbye_text = "그랜비 통화를 종료합니다. 감사합니다. 좋은 하루 보내세요!"
                                    conversation_sessions[call_sid].append({"role": "assistant", "content": goodbye_text})
                                    
                                    logger.info("🔊 [TTS] 종료 메시지 전송")
                                    await asyncio.sleep(2)
                                    await websocket.close()
                                    return
                                
                                # 발화 처리 사이클
                                cycle_start = time.time()
                                logger.info(f"{'='*60}")
                                logger.info(f"🎯 발화 완료 → 즉시 응답 생성")
                                logger.info(f"{'='*60}")
                                
                                
                                # 대화 세션에 사용자 메시지 추가
                                if call_sid not in conversation_sessions:
                                    conversation_sessions[call_sid] = []
                                conversation_sessions[call_sid].append({"role": "user", "content": text})
                                
                                conversation_history = conversation_sessions[call_sid]
                                
                                # LLM 전달까지의 시간 측정
                                llm_delivery_start = time.time()
                                if stt_complete_time:
                                    stt_to_llm_delay = llm_delivery_start - stt_complete_time
                                    logger.info(f"⏱️ [지연시간] 최종 인식 → LLM 전달: {stt_to_llm_delay:.2f}초")
                                
                                # ✅ AI 응답 시작 (사용자 입력 차단)
                                rtzr_stt.start_bot_speaking()
                                
                                # LLM 응답 생성
                                logger.info("🤖 [LLM] 응답 생성 시작")
                                llm_start_time = time.time()
                                ai_response = await process_streaming_response(
                                    websocket,
                                    stream_sid,
                                    text,
                                    conversation_history,
                                    rtzr_stt=rtzr_stt,
                                    call_sid=call_sid
                                )
                                llm_end_time = time.time()
                                llm_duration = llm_end_time - llm_start_time
                                
                                # ✅ AI 응답 종료 (1초 후 사용자 입력 재개)
                                rtzr_stt.stop_bot_speaking()
                                
                                logger.info("✅ [LLM] 응답 생성 완료")
                                
                                # 전체 처리 시간 로깅
                                if stt_complete_time:
                                    total_delay = llm_end_time - stt_complete_time
                                    logger.info(f"⏱️ [전체 지연] 최종 인식 → LLM 완료: {total_delay:.2f}초 (LLM 응답 생성: {llm_duration:.2f}초)")
                                
                                # AI 응답을 대화 세션에 추가 (안전하게)
                                try:
                                    if ai_response and ai_response.strip():
                                        # conversation_sessions에 여전히 존재하는지 확인
                                        if call_sid in conversation_sessions:
                                            conversation_sessions[call_sid].append({"role": "assistant", "content": ai_response})
                                        
                                        # 대화 히스토리 관리
                                        if call_sid in conversation_sessions and len(conversation_sessions[call_sid]) > 20:
                                            conversation_sessions[call_sid] = conversation_sessions[call_sid][-20:]
                                    
                                    total_cycle_time = time.time() - cycle_start
                                    logger.info(f"⏱️  전체 응답 사이클: {total_cycle_time:.2f}초")
                                    logger.info(f"{'='*60}\n\n")
                                except KeyError:
                                    # 세션이 이미 삭제된 경우 (통화 종료)
                                    logger.info("⚠️  세션이 이미 삭제됨 (통화 종료 중)")
                                    break
                                except Exception as e:
                                    logger.error(f"❌ 응답 저장 오류: {e}")
                                
                            elif text:
                                # 부분 결과를 LLM에 백그라운드 전송
                                llm_collector.add_partial(text)
                                logger.debug(f"📝 [RTZR 부분] {text}")
                    
                    except Exception as e:
                        logger.error(f"❌ RTZR 처리 오류: {e}")
                        import traceback
                        logger.error(traceback.format_exc())
                
                # RTZR 스트리밍 태스크 시작 (백그라운드)
                rtzr_task = asyncio.create_task(process_rtzr_results())
                
            # ========== 2. 오디오 데이터 수신 및 RTZR로 전송 ==========
            elif event_type == 'media':
                if rtzr_stt and rtzr_stt.is_active:
                    # ✅ AI 응답 중이면 오디오 무시 (에코 방지)
                    if rtzr_stt.is_bot_speaking:
                        continue
                    
                    # ✅ AI 응답 종료 후 1초 대기 중이면 무시
                    if rtzr_stt.bot_silence_delay > 0:
                        rtzr_stt.bot_silence_delay -= 1
                        continue
                    
                    # Base64 디코딩 (Twilio는 mulaw 8kHz로 전송)
                    audio_payload = base64.b64decode(data['media']['payload'])
                    
                    # RTZR로 오디오 청크 전송
                    await rtzr_stt.add_audio_chunk(audio_payload)
                        
            # ========== 3. 스트림 종료 ==========
            elif event_type == 'stop':
                logger.info(f"\n{'='*60}")
                logger.info(f"📞 Twilio 통화 종료 - Call: {call_sid}")
                logger.info(f"{'='*60}")
                
                # ✅ RTZR 백그라운드 태스크 취소
                if 'rtzr_task' in locals() and rtzr_task:
                    logger.info("🛑 RTZR 백그라운드 태스크 취소 중...")
                    rtzr_task.cancel()
                    try:
                        await asyncio.wait_for(rtzr_task, timeout=2.0)
                    except (asyncio.CancelledError, asyncio.TimeoutError):
                        logger.info("✅ RTZR 백그라운드 태스크 종료 완료")
                
                # RTZR 스트리밍 종료
                if rtzr_stt:
                    await rtzr_stt.end_streaming()
                    logger.info("🛑 RTZR 스트리밍 종료")
                
                # ✅ 대화 세션을 DB에 저장 (함수 호출)
                if call_sid in conversation_sessions:
                    conversation = conversation_sessions[call_sid]
                    
                    # 대화 내용 출력
                    if conversation:
                        logger.info(f"\n📋 전체 대화 내용:")
                        logger.info(f"─" * 60)
                        for msg in conversation:
                            role = "👤 사용자" if msg['role'] == 'user' else "🤖 AI"
                            logger.info(f"{role}: {msg['content']}")
                        logger.info(f"─" * 60)
                    
                    await save_conversation_to_db(call_sid, conversation)
                
                logger.info(f"┌{'─'*58}┐")
                logger.info(f"│ ✅ Twilio 통화 정리 완료                               │")
                logger.info(f"└{'─'*58}┘\n")
                break
                
    except Exception as e:
        logger.error(f"❌ Twilio WebSocket 오류: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
    finally:
        # ✅ 연결 종료 시 항상 DB 저장 (핵심!)
        # 사용자가 직접 전화를 끊어도 대화 내용 보존
        if call_sid and call_sid in conversation_sessions:
            try:
                conversation = conversation_sessions[call_sid]
                await save_conversation_to_db(call_sid, conversation)
                logger.info(f"🔄 Finally 블록에서 DB 저장 완료: {call_sid}")
            except Exception as e:
                logger.error(f"❌ Finally 블록 DB 저장 실패: {e}")
        
        # 정리 작업 (메모리에서 제거)
        if call_sid and call_sid in active_connections:
            del active_connections[call_sid]
        if call_sid and call_sid in active_tts_completions:
            del active_tts_completions[call_sid]
            logger.debug(f"🗑️ TTS 추적 정보 삭제: {call_sid}")
        if call_sid and call_sid in conversation_sessions:
            del conversation_sessions[call_sid]
        
        logger.info(f"🧹 WebSocket 정리 완료: {call_sid}")


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
    
    # 통화 상태에 따른 DB 업데이트
    try:
        from app.models.call import CallLog, CallStatus as CallStatusEnum
        db = next(get_db())
        
        call_log = db.query(CallLog).filter(CallLog.call_id == CallSid).first()
        
        if call_log:
            if CallStatus == 'answered':
                # 통화 연결 시 시작 시간 설정
                if not call_log.call_start_time:
                    call_log.call_start_time = datetime.utcnow()
                    call_log.call_status = CallStatusEnum.ANSWERED
                    db.commit()
                    logger.info(f"✅ 통화 시작 시간 설정: {CallSid}")
            
            elif CallStatus == 'completed':
                # 통화 종료 시 종료 시간 설정
                call_log.call_end_time = datetime.utcnow()
                call_log.call_status = CallStatusEnum.COMPLETED
                
                # 통화 시간 계산
                if call_log.call_start_time:
                    duration = (call_log.call_end_time - call_log.call_start_time).total_seconds()
                    call_log.call_duration = int(duration)
                    logger.info(f"✅ 통화 종료 시간 설정: {CallSid}, 지속시간: {duration}초")
                
                db.commit()
                
                # ✅ 통화 종료 시 DB 저장 (백업용 - 중복 방지 로직 포함)
                if CallSid in conversation_sessions:
                    try:
                        conversation = conversation_sessions[CallSid]
                        await save_conversation_to_db(CallSid, conversation)
                        logger.info(f"💾 콜백에서 통화 기록 저장 완료: {CallSid}")
                    except Exception as e:
                        logger.error(f"❌ 콜백 DB 저장 실패: {e}")
                
                # 세션 정리
                if CallSid in conversation_sessions:
                    del conversation_sessions[CallSid]
                if CallSid in active_connections:
                    del active_connections[CallSid]
        
        db.close()
        
    except Exception as e:
        logger.error(f"❌ 통화 상태 업데이트 실패: {e}")
        if 'db' in locals():
            db.close()
    
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
