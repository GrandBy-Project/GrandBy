"""
알림 API 라우터
알림 조회, 읽음 처리
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.notification import NotificationResponse

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(db: Session = Depends(get_db)):
    """
    알림 목록 조회
    TODO: 현재 사용자의 알림 목록 반환
    """
    return []


@router.patch("/{notification_id}/read")
async def mark_as_read(notification_id: str, db: Session = Depends(get_db)):
    """
    알림 읽음 처리
    TODO: 알림을 읽음으로 표시
    """
    return {"message": "Marked as read"}


@router.delete("/{notification_id}")
async def delete_notification(notification_id: str, db: Session = Depends(get_db)):
    """
    알림 삭제
    TODO: 알림 삭제
    """
    return {"message": "Deleted"}

