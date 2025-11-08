"""
기본 엔드포인트 라우터
"""
from fastapi import APIRouter
from app.config import settings, is_development
from app.database import test_db_connection

router = APIRouter()


@router.get("/", tags=["Root"])
async def root():
    """루트 엔드포인트"""
    return {
        "message": "🏠 Welcome to Grandby API",
        "version": settings.APP_VERSION,
        "docs": "/docs" if is_development() else "disabled",
    }


@router.get("/health", tags=["Health"])
async def health_check():
    """헬스 체크 엔드포인트 (Docker, Kubernetes용)"""
    db_status = "healthy" if test_db_connection() else "unhealthy"
    
    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
    }

