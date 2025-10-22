"""
사용자 관련 데이터베이스 모델
User, UserConnection, UserSettings
"""

from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum, Integer, Date
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid

from app.database import Base


class UserRole(str, enum.Enum):
    """사용자 역할"""
    ELDERLY = "elderly"  # 어르신
    CAREGIVER = "caregiver"  # 보호자
    ADMIN = "admin"  # 관리자


class AuthProvider(str, enum.Enum):
    """인증 제공자"""
    EMAIL = "email"  # 이메일
    GOOGLE = "google"  # Google OAuth
    KAKAO = "kakao"  # Kakao OAuth


class Gender(str, enum.Enum):
    """성별"""
    MALE = "male"  # 남성
    FEMALE = "female"  # 여성


class ConnectionStatus(str, enum.Enum):
    """연결 상태"""
    PENDING = "pending"  # 대기 중
    ACTIVE = "active"  # 활성
    REJECTED = "rejected"  # 거절됨


class User(Base):
    """사용자 모델"""
    __tablename__ = "users"
    
    # Primary Key
    user_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # 기본 정보
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # 소셜 로그인은 NULL 가능
    name = Column(String(100), nullable=False)
    phone_number = Column(String(20), nullable=True)
    birth_date = Column(Date, nullable=True)  # 생년월일
    gender = Column(SQLEnum(Gender), nullable=True)  # 성별
    
    # 역할 및 인증
    role = Column(SQLEnum(UserRole), nullable=False)
    auth_provider = Column(SQLEnum(AuthProvider), default=AuthProvider.EMAIL)
    
    # 프로필
    profile_image_url = Column(String(500), nullable=True)  # 프로필 이미지
    
    # 푸시 알림
    push_token = Column(String(255), nullable=True, index=True)
    push_token_updated_at = Column(DateTime, nullable=True)
    
    # 계정 상태
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # 타임스탬프
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)  # Soft Delete용
    
    # Relationships
    # 보호자로서의 연결 (caregiver -> elderly)
    caregiver_connections = relationship(
        "UserConnection",
        foreign_keys="UserConnection.caregiver_id",
        back_populates="caregiver"
    )
    
    # 어르신으로서의 연결 (elderly <- caregiver)
    elderly_connections = relationship(
        "UserConnection",
        foreign_keys="UserConnection.elderly_id",
        back_populates="elderly"
    )
    
    # 사용자 설정
    settings = relationship("UserSettings", back_populates="user", uselist=False)
    
    # 통화 기록
    call_logs = relationship("CallLog", back_populates="elderly")
    
    # 다이어리 (작성자로서)
    diaries = relationship("Diary", foreign_keys="Diary.author_id", back_populates="author")
    
    # TODO (작성자)
    created_todos = relationship("Todo", foreign_keys="Todo.creator_id", back_populates="creator")
    
    # TODO (담당자)
    assigned_todos = relationship("Todo", foreign_keys="Todo.elderly_id", back_populates="elderly")
    
    # 알림
    notifications = relationship("Notification", back_populates="user")
    
    def __repr__(self):
        return f"<User {self.email} ({self.role})>"


class UserConnection(Base):
    """보호자-어르신 연결 모델"""
    __tablename__ = "user_connections"
    
    # Primary Key
    connection_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Keys
    caregiver_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    elderly_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    
    # 연결 상태
    status = Column(SQLEnum(ConnectionStatus), default=ConnectionStatus.PENDING)
    
    # 타임스탬프
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    caregiver = relationship("User", foreign_keys=[caregiver_id], back_populates="caregiver_connections")
    elderly = relationship("User", foreign_keys=[elderly_id], back_populates="elderly_connections")
    
    def __repr__(self):
        return f"<UserConnection {self.caregiver_id} -> {self.elderly_id} ({self.status})>"


class UserSettings(Base):
    """사용자 설정 모델"""
    __tablename__ = "user_settings"
    
    # Primary Key
    setting_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Key
    user_id = Column(String(36), ForeignKey("users.user_id"), unique=True, nullable=False)
    
    # 기능 활성화
    auto_diary_enabled = Column(Boolean, default=True)
    push_notification_enabled = Column(Boolean, default=True)
    
    # 언어 설정
    language_preference = Column(String(10), default="ko")
    
    # 타임스탬프
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="settings")
    
    def __repr__(self):
        return f"<UserSettings for {self.user_id}>"

