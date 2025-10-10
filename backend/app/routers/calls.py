"""
AI 통화 API 라우터
통화 기록, 통화 설정, 트랜스크립트 조회
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.call import CallLogResponse, CallSettingsUpdate, CallTranscriptResponse

router = APIRouter()


@router.get("/", response_model=List[CallLogResponse])
async def get_call_logs(db: Session = Depends(get_db)):
    """
    통화 기록 목록 조회
    TODO: 현재 사용자의 통화 기록 반환
    """
    return []


@router.get("/{call_id}", response_model=CallLogResponse)
async def get_call_log(call_id: str, db: Session = Depends(get_db)):
    """
    통화 상세 정보 조회
    TODO: 특정 통화 기록 반환
    """
    return None


@router.get("/{call_id}/transcript", response_model=List[CallTranscriptResponse])
async def get_call_transcript(call_id: str, db: Session = Depends(get_db)):
    """
    통화 텍스트 변환 내용 조회
    TODO: STT 결과 반환
    """
    return []


@router.get("/settings", response_model=dict)
async def get_call_settings(db: Session = Depends(get_db)):
    """
    통화 설정 조회
    TODO: 어르신의 통화 설정 반환
    """
    return {"message": "Not Implemented"}


@router.put("/settings", response_model=dict)
async def update_call_settings(settings: CallSettingsUpdate, db: Session = Depends(get_db)):
    """
    통화 설정 변경
    TODO: 통화 빈도, 시간 등 변경
    """
    return {"message": "Not Implemented"}

