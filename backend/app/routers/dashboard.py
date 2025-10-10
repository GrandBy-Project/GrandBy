"""
보호자 대시보드 API 라우터
어르신 종합 정보 조회
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db

router = APIRouter()


@router.get("/{elderly_id}")
async def get_dashboard(elderly_id: str, db: Session = Depends(get_db)):
    """
    보호자 대시보드 - 어르신 종합 정보
    TODO: 통화 기록, 감정 상태, TODO 이행률, 최근 일기 등 반환
    """
    return {
        "elderly_id": elderly_id,
        "recent_calls": [],
        "emotion_stats": {},
        "todo_completion_rate": 0,
        "recent_diaries": [],
        "message": "Not Implemented - 실제 데이터는 각 서비스에서 조회"
    }


@router.get("/{elderly_id}/emotions")
async def get_emotion_stats(elderly_id: str, db: Session = Depends(get_db)):
    """
    감정 분석 통계
    TODO: 최근 7일간의 감정 분석 결과 반환
    """
    return {"message": "Not Implemented"}


@router.get("/{elderly_id}/stats")
async def get_stats(elderly_id: str, db: Session = Depends(get_db)):
    """
    통계 정보
    TODO: 통화 횟수, 일기 작성 수, TODO 이행률 등
    """
    return {"message": "Not Implemented"}

