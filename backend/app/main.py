"""
Grandby FastAPI Application
메인 애플리케이션 진입점
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import time
from pathlib import Path

from app.routers import (
    auth,
    users,
    calls,
    diaries,
    todos,
    notifications,
    dashboard,
    root,
    legal,
    twilio
)
from app.config import settings, is_development
from app.database import test_db_connection

# 로거 설정 (시간 포함)
logging.basicConfig(
    level=settings.LOG_LEVEL,
    format='%(asctime)s.%(msecs)03d - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
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


# # ==================== Middleware ====================

# # CORS 설정
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=settings.cors_origins_list,
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )


# # 요청 로깅 Middleware
# @app.middleware("http")
# async def log_requests(request: Request, call_next):
#     """모든 HTTP 요청 로깅 (응답 크기 및 로딩 시간 포함)"""
#     start_time = time.perf_counter()
    
#     # 요청 시작 로깅
#     logger.info(f"📥 {request.method} {request.url.path}")
    
#     # 응답 처리
#     response = await call_next(request)
    
#     # 로딩 시간 계산 (밀리초)
#     elapsed_time = (time.perf_counter() - start_time) * 1000
    
#     # 응답 크기 측정
#     response_size = None
#     if "content-length" in response.headers:
#         # Content-Length 헤더가 있으면 사용
#         try:
#             response_size = int(response.headers["content-length"])
#         except (ValueError, TypeError):
#             response_size = None
#     else:
#         # Content-Length 헤더가 없으면 응답 본문 읽기 (스트리밍 응답이 아닌 경우에만)
#         try:
#             body = b""
#             async for chunk in response.body_iterator:
#                 body += chunk
#             response_size = len(body)
            
#             # 응답 본문을 다시 스트림으로 변환
#             from starlette.responses import Response
#             response = Response(
#                 content=body,
#                 status_code=response.status_code,
#                 headers=dict(response.headers),
#                 media_type=getattr(response, 'media_type', None) or response.headers.get('content-type', 'application/json')
#             )
#         except Exception as e:
#             # 응답 본문 읽기 실패 시 크기 측정 건너뛰기
#             logger.debug(f"⚠️ 응답 크기 측정 실패 (스트리밍 응답일 수 있음): {e}")
#             response_size = None
    
#     # 크기를 읽기 쉬운 형식으로 변환
#     size_str = ""
#     if response_size is not None:
#         if response_size < 1024:
#             size_str = f"{response_size}B"
#         elif response_size < 1024 * 1024:
#             size_str = f"{response_size / 1024:.2f}KB"
#         else:
#             size_str = f"{response_size / (1024 * 1024):.2f}MB"
    
#     # 응답 로깅 (상태 코드, 크기, 시간)
#     logger.info(
#         f"📤 {request.method} {request.url.path} - "
#         f"{response.status_code} | "
#         f"{size_str} | "
#         f"{elapsed_time:.2f}ms"
#     )
    
#     return response


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

# 기본 엔드포인트
app.include_router(root.router)

# 법적 페이지
app.include_router(legal.router)

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

# Twilio 관련 엔드포인트
app.include_router(twilio.router)


# ==================== Startup Message ====================
if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=is_development(),
        log_level=settings.LOG_LEVEL.lower()
    )
