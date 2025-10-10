"""
사용자 관리 API 라우터
사용자 연결, 프로필 등
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.user import ConnectionCreate, ConnectionResponse, UserResponse

router = APIRouter()


@router.get("/connections", response_model=List[ConnectionResponse])
async def get_connections(db: Session = Depends(get_db)):
    """
    연결된 사용자 목록 조회
    TODO: 현재 사용자의 연결 목록 반환
    """
    # TODO: 인증 미들웨어 구현 후 current_user 가져오기
    return []


@router.post("/connections", response_model=ConnectionResponse)
async def create_connection(connection_data: ConnectionCreate, db: Session = Depends(get_db)):
    """
    연결 요청 생성
    TODO: 보호자가 어르신에게 연결 요청
    """
    # TODO: 구현 필요
    raise HTTPException(status_code=501, detail="Not Implemented")


@router.patch("/connections/{connection_id}/accept")
async def accept_connection(connection_id: str, db: Session = Depends(get_db)):
    """
    연결 수락
    TODO: 어르신이 보호자 연결 요청 수락
    """
    # TODO: 구현 필요
    raise HTTPException(status_code=501, detail="Not Implemented")


@router.delete("/connections/{connection_id}")
async def delete_connection(connection_id: str, db: Session = Depends(get_db)):
    """
    연결 해제
    TODO: 연결 삭제
    """
    # TODO: 구현 필요
    raise HTTPException(status_code=501, detail="Not Implemented")

