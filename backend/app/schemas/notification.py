"""
알림 관련 Pydantic 스키마
"""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.notification import NotificationType


class NotificationResponse(BaseModel):
    """알림 응답"""
    notification_id: str
    user_id: str
    type: NotificationType
    title: str
    message: str
    related_id: Optional[str]
    is_read: bool
    is_pushed: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

