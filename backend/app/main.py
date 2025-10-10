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

