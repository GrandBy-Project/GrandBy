"""
Grandby FastAPI Application
메인 애플리케이션 진입점
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.config import settings, is_development
from app.database import test_db_connection

# 로거 설정
logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)


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

# ==================== AI 챗봇 서비스 ====================
# STT, LLM, TTS 서비스 import
from app.services.ai_call.stt_service import STTService
from app.services.ai_call.llm_service import LLMService
from app.services.ai_call.tts_service import TTSService
from fastapi import UploadFile, File, Form
from typing import Optional
import time
import os

# 서비스 인스턴스 생성 (앱 시작 시 한 번만 초기화)
stt_service = STTService()
llm_service = LLMService()
tts_service = TTSService()

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

