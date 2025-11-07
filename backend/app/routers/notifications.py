"""
알림 API 라우터
알림 조회, 읽음 처리
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.utils.datetime_utils import kst_now
from app.schemas.notification import NotificationResponse
from app.models.notification import Notification
from app.models.user import User
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    알림 목록 조회
    
    - 현재 사용자의 알림 목록 반환
    - 최신순으로 정렬
    """
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.user_id
    ).order_by(Notification.created_at.desc()).all()
    
    return [NotificationResponse.from_orm(n) for n in notifications]


@router.patch("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    알림 읽음 처리
    """
    notification = db.query(Notification).filter(
        Notification.notification_id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="알림을 찾을 수 없습니다."
        )
    
    # 본인의 알림인지 확인
    if notification.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인의 알림만 읽음 처리할 수 있습니다."
        )
    
    # 읽음 처리
    notification.is_read = True
    notification.read_at = kst_now()
    db.commit()
    
    return {"message": "알림을 읽음으로 표시했습니다."}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    알림 삭제
    """
    notification = db.query(Notification).filter(
        Notification.notification_id == notification_id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="알림을 찾을 수 없습니다."
        )
    
    # 본인의 알림인지 확인
    if notification.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인의 알림만 삭제할 수 있습니다."
        )
    
    db.delete(notification)
    db.commit()
    
    return {"message": "알림이 삭제되었습니다."}

