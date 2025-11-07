"""
다이어리 관련 데이터베이스 모델
Diary, DiaryPhoto, DiaryComment
"""

from sqlalchemy import Column, String, Date, DateTime, ForeignKey, Text, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid
from pytz import timezone, UTC

from app.database import Base

# 한국 시간대 (KST, UTC+9)
KST = timezone('Asia/Seoul')

def kst_now():
    """
    현재 한국 시간(KST)을 반환 (naive datetime)
    UTC 시간을 가져온 후 KST로 변환하여 시스템 시간대와 무관하게 작동
    SQLAlchemy의 DateTime 컬럼에서 사용
    """
    # UTC 시간을 가져온 후 KST로 변환 (시스템 시간대와 무관)
    utc_now = datetime.now(UTC)
    kst_time = utc_now.astimezone(KST)
    # naive datetime으로 반환 (SQLAlchemy용)
    return kst_time.replace(tzinfo=None)


class AuthorType(str, enum.Enum):
    """작성자 유형"""
    ELDERLY = "elderly"  # 어르신
    CAREGIVER = "caregiver"  # 보호자
    AI = "ai"  # AI 자동 생성


class DiaryStatus(str, enum.Enum):
    """다이어리 상태"""
    DRAFT = "draft"  # 임시 저장
    PUBLISHED = "published"  # 발행됨


class Diary(Base):
    """다이어리 모델"""
    __tablename__ = "diaries"
    
    # Primary Key
    diary_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Keys
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)  # 소유자 (어르신)
    author_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)  # 작성자
    call_id = Column(String(36), ForeignKey("call_logs.call_id"), nullable=True)  # 연관된 통화
    
    # 내용
    date = Column(Date, nullable=False)  # 일기 날짜
    title = Column(String(200), nullable=True)  # 제목 추가
    content = Column(Text, nullable=False)
    mood = Column(String(50), nullable=True)  # 기분 추가
    
    # 작성 정보
    author_type = Column(SQLEnum(AuthorType), nullable=False)
    is_auto_generated = Column(Boolean, default=False)
    
    # 상태
    status = Column(SQLEnum(DiaryStatus), default=DiaryStatus.PUBLISHED)
    
    # 타임스탬프 (한국 시간 KST)
    created_at = Column(DateTime, default=kst_now)
    updated_at = Column(DateTime, default=kst_now, onupdate=kst_now)
    
    # Relationships
    author = relationship("User", foreign_keys=[author_id], back_populates="diaries")
    photos = relationship("DiaryPhoto", back_populates="diary", cascade="all, delete-orphan")
    comments = relationship("DiaryComment", back_populates="diary", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Diary {self.diary_id} on {self.date}>"


class DiaryPhoto(Base):
    """다이어리 사진 모델"""
    __tablename__ = "diary_photos"
    
    # Primary Key
    photo_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Keys
    diary_id = Column(String(36), ForeignKey("diaries.diary_id"), nullable=False)
    uploaded_by = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    
    # 사진 정보
    photo_url = Column(String(500), nullable=False)  # S3 URL
    
    # 타임스탬프 (한국 시간 KST)
    created_at = Column(DateTime, default=kst_now)
    
    # Relationships
    diary = relationship("Diary", back_populates="photos")
    
    def __repr__(self):
        return f"<DiaryPhoto {self.photo_id}>"


class DiaryComment(Base):
    """다이어리 댓글 모델"""
    __tablename__ = "diary_comments"
    
    # Primary Key
    comment_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Keys
    diary_id = Column(String(36), ForeignKey("diaries.diary_id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    
    # 내용
    content = Column(Text, nullable=False)
    
    # 읽음 여부
    is_read = Column(Boolean, default=False)
    
    # 타임스탬프 (한국 시간 KST)
    created_at = Column(DateTime, default=kst_now)
    
    # Relationships
    diary = relationship("Diary", back_populates="comments")
    
    def __repr__(self):
        return f"<DiaryComment {self.comment_id}>"

