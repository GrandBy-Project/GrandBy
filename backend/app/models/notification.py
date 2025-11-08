"""
알림 관련 데이터베이스 모델
"""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid

from app.database import Base
from app.utils.datetime_utils import kst_now


class NotificationType(str, enum.Enum):
    """알림 유형"""
    DIARY_CREATED = "diary_created"  # 다이어리 생성됨
    TODO_REMINDER = "todo_reminder"  # TODO 리마인더
    CONNECTION_REQUEST = "connection_request"  # 연결 요청
    CONNECTION_ACCEPTED = "connection_accepted"  # 연결 수락됨
    EMOTION_ALERT = "emotion_alert"  # 감정 경고
    CALL_MISSED = "call_missed"  # 부재중 전화
    COMMENT_ADDED = "comment_added"  # 댓글 추가됨
    CALL_SCHEDULE_UPDATED = "call_schedule_updated"  # 자동 통화 스케줄 업데이트


class Notification(Base):
    """알림 모델"""
    __tablename__ = "notifications"
    
    # Primary Key
    notification_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Key
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    
    # 알림 정보
    type = Column(SQLEnum(NotificationType), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    
    # 관련 리소스 ID (다형성)
    related_id = Column(String(36), nullable=True)  # diary_id, todo_id, call_id 등
    
    # 상태
    is_read = Column(Boolean, default=False)
    is_pushed = Column(Boolean, default=False)  # 푸시 알림 발송 여부
    
    # 타임스탬프 (한국 시간 KST)
    created_at = Column(DateTime, default=kst_now)
    read_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="notifications")
    
    def __repr__(self):
        return f"<Notification {self.type} for {self.user_id}>"

