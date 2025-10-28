"""
Cartesia TTS API 라우터
클라이언트가 안전하게 Cartesia TTS를 사용할 수 있도록 Access Token을 제공
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import httpx
import logging
from app.config import settings
from app.routers.auth import get_current_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cartesia", tags=["Cartesia TTS"])


class AccessTokenRequest(BaseModel):
    """Access Token 요청 모델"""
    grants: dict = {"tts": True}
    expires_in: int = 60  # 기본 1분


class AccessTokenResponse(BaseModel):
    """Access Token 응답 모델"""
    token: str
    expires_in: int
    grants: dict


@router.post("/access-token", response_model=AccessTokenResponse)
async def create_access_token(
    request: AccessTokenRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Cartesia Access Token 생성
    
    클라이언트가 Cartesia TTS API를 직접 호출할 수 있도록
    제한된 권한의 Access Token을 생성합니다.
    
    Args:
        request: Access Token 요청 (grants, expires_in)
        current_user: 현재 인증된 사용자
    
    Returns:
        AccessTokenResponse: 생성된 Access Token 정보
    """
    try:
        if not settings.CARTESIA_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="Cartesia API 키가 설정되지 않았습니다"
            )
        
        logger.info(f"🔑 사용자 {current_user.id}의 Cartesia Access Token 생성 요청")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                "https://api.cartesia.ai/access-token",
                headers={
                    "Content-Type": "application/json",
                    "Cartesia-Version": "2025-04-16",
                    "Authorization": f"Bearer {settings.CARTESIA_API_KEY}",
                },
                json={
                    "grants": request.grants,
                    "expires_in": request.expires_in,
                }
            )
            
            response.raise_for_status()
            data = response.json()
            
            logger.info(f"✅ Access Token 생성 완료 (만료: {request.expires_in}초)")
            
            return AccessTokenResponse(
                token=data["token"],
                expires_in=request.expires_in,
                grants=request.grants
            )
            
    except httpx.HTTPStatusError as e:
        logger.error(f"❌ Cartesia Access Token 생성 실패: HTTP {e.response.status_code}")
        logger.error(f"응답: {e.response.text}")
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Cartesia API 오류: {e.response.text}"
        )
    except httpx.TimeoutException:
        logger.error("❌ Cartesia Access Token 생성 타임아웃")
        raise HTTPException(
            status_code=504,
            detail="Cartesia API 응답 시간 초과"
        )
    except Exception as e:
        logger.error(f"❌ Access Token 생성 중 오류: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Access Token 생성 실패: {str(e)}"
        )


@router.get("/voices")
async def get_available_voices(current_user: User = Depends(get_current_user)):
    """
    사용 가능한 음성 목록 조회
    
    Args:
        current_user: 현재 인증된 사용자
    
    Returns:
        dict: 사용 가능한 음성 목록
    """
    try:
        logger.info(f"🎤 사용자 {current_user.id}의 음성 목록 조회 요청")
        
        # Cartesia에서 지원하는 한국어 음성들
        korean_voices = [
            {
                "id": "304fdbd8-65e6-40d6-ab78-f9d18b9efdf9",
                "name": "Jihyun - Anchorwoman",
                "language": "ko-KR",
                "gender": "female",
                "description": "자연스럽고 전문적인 여성 앵커 목소리"
            }
        ]
        
        return {
            "voices": korean_voices,
            "default_voice": "304fdbd8-65e6-40d6-ab78-f9d18b9efdf9",
            "model": settings.CARTESIA_TTS_MODEL
        }
        
    except Exception as e:
        logger.error(f"❌ 음성 목록 조회 실패: {type(e).__name__}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"음성 목록 조회 실패: {str(e)}"
        )
