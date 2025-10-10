"""
TODO 관리 데이터베이스 모델
"""

from sqlalchemy import Column, String, Date, Time, DateTime, ForeignKey, Text, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid

from app.database import Base


class CreatorType(str, enum.Enum):
    """TODO 생성자 유형"""
    CAREGIVER = "caregiver"  # 보호자
    AI = "ai"  # AI 자동 추출
    ELDERLY = "elderly"  # 어르신 직접


class TodoStatus(str, enum.Enum):
    """TODO 상태"""
    PENDING = "pending"  # 대기 중
    COMPLETED = "completed"  # 완료
    CANCELLED = "cancelled"  # 취소됨


class Todo(Base):
    """TODO 모델"""
    __tablename__ = "todos"
    
    # Primary Key
    todo_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Keys
    elderly_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)  # 담당자 (어르신)
    creator_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)  # 생성자
    call_id = Column(String(36), ForeignKey("call_logs.call_id"), nullable=True)  # 연관된 통화 (AI 추출 시)
    
    # 내용
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    
    # 일정
    due_date = Column(Date, nullable=False)
    due_time = Column(Time, nullable=True)
    
    # 생성 정보
    creator_type = Column(SQLEnum(CreatorType), nullable=False)
    
    # 상태
    status = Column(SQLEnum(TodoStatus), default=TodoStatus.PENDING)
    
    # AI 생성 TODO 확인 여부
    is_confirmed = Column(Boolean, default=True)  # 보호자가 만든 것은 기본 true, AI는 false
    
    # 타임스탬프
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    elderly = relationship("User", foreign_keys=[elderly_id], back_populates="assigned_todos")
    creator = relationship("User", foreign_keys=[creator_id], back_populates="created_todos")
    
    def __repr__(self):
        return f"<Todo {self.title} ({self.status})>"

