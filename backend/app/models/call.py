"""
AI 통화 관련 데이터베이스 모델
CallLog, CallSettings, CallTranscript, EmotionLog
"""

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Enum as SQLEnum, Text, Float, Time, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
import uuid

from app.database import Base
from app.utils.datetime_utils import kst_now


class CallStatus(str, enum.Enum):
    """통화 상태"""
    INITIATED = "initiated"  # 발신 시도
    RINGING = "ringing"  # 벨 울림
    ANSWERED = "answered"  # 수신
    COMPLETED = "completed"  # 완료
    MISSED = "missed"  # 부재중
    REJECTED = "rejected"  # 거절
    FAILED = "failed"  # 실패


class CallFrequency(str, enum.Enum):
    """통화 빈도"""
    DAILY = "daily"  # 매일
    WEEKLY_3 = "weekly_3"  # 주 3회
    WEEKLY_5 = "weekly_5"  # 주 5회
    CUSTOM = "custom"  # 사용자 정의


class EmotionType(str, enum.Enum):
    """감정 유형"""
    POSITIVE = "positive"  # 긍정적
    NEUTRAL = "neutral"  # 중립적
    NEGATIVE = "negative"  # 부정적


class CallLog(Base):
    """통화 기록 모델"""
    __tablename__ = "call_logs"
    
    # Primary Key
    call_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Key
    elderly_id = Column(String(36), ForeignKey("users.user_id"), nullable=False)
    
    # 통화 정보
    call_status = Column(SQLEnum(CallStatus), nullable=False)
    call_start_time = Column(DateTime, nullable=True)
    call_end_time = Column(DateTime, nullable=True)
    call_duration = Column(Integer, nullable=True)  # 초 단위
    
    # 파일 저장 (S3 URL)
    audio_file_url = Column(String(500), nullable=True)
    
    # 대화 요약 (LLM 생성)
    conversation_summary = Column(Text, nullable=True)
    
    # Twilio 관련
    twilio_call_sid = Column(String(100), nullable=True, unique=True)
    
    # 타임스탬프 (한국 시간 KST)
    created_at = Column(DateTime, default=kst_now)
    
    # Relationships
    elderly = relationship("User", back_populates="call_logs")
    transcripts = relationship("CallTranscript", back_populates="call")
    emotions = relationship("EmotionLog", back_populates="call")
    
    def __repr__(self):
        return f"<CallLog {self.call_id} ({self.call_status})>"


class CallSettings(Base):
    """통화 설정 모델"""
    __tablename__ = "call_settings"
    
    # Primary Key
    setting_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Key
    elderly_id = Column(String(36), ForeignKey("users.user_id"), unique=True, nullable=False)
    
    # 통화 빈도 및 시간
    frequency = Column(SQLEnum(CallFrequency), default=CallFrequency.DAILY)
    call_time = Column(Time, nullable=False)  # HH:MM:SS
    
    # 활성화 여부
    is_active = Column(Boolean, default=True)
    
    # 타임스탬프 (한국 시간 KST)
    created_at = Column(DateTime, default=kst_now)
    updated_at = Column(DateTime, default=kst_now, onupdate=kst_now)
    
    def __repr__(self):
        return f"<CallSettings for {self.elderly_id}>"


class CallTranscript(Base):
    """통화 텍스트 변환 모델 (STT 결과)"""
    __tablename__ = "call_transcripts"
    
    # Primary Key
    transcript_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Key
    call_id = Column(String(36), ForeignKey("call_logs.call_id"), nullable=False)
    
    # 전사 내용
    speaker = Column(String(20), nullable=False)  # 'AI' or 'ELDERLY'
    text = Column(Text, nullable=False)
    
    # 타임스탬프 (통화 내 시간)
    timestamp = Column(Float, nullable=True)  # 초 단위
    
    # 생성 시간 (한국 시간 KST)
    created_at = Column(DateTime, default=kst_now)
    
    # Relationships
    call = relationship("CallLog", back_populates="transcripts")
    
    def __repr__(self):
        return f"<CallTranscript {self.transcript_id} ({self.speaker})>"


class EmotionLog(Base):
    """감정 분석 기록 모델"""
    __tablename__ = "emotion_logs"
    
    # Primary Key
    emotion_id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    
    # Foreign Key
    call_id = Column(String(36), ForeignKey("call_logs.call_id"), nullable=False)
    
    # 감정 정보
    emotion_type = Column(SQLEnum(EmotionType), nullable=False)
    emotion_score = Column(Float, nullable=False)  # 0.0 ~ 1.0
    
    # 감지된 키워드 (JSON)
    detected_keywords = Column(Text, nullable=True)  # JSON 형식
    
    # 분석 시간 (한국 시간 KST)
    analyzed_at = Column(DateTime, default=kst_now)
    
    # Relationships
    call = relationship("CallLog", back_populates="emotions")
    
    def __repr__(self):
        return f"<EmotionLog {self.emotion_type} ({self.emotion_score:.2f})>"

