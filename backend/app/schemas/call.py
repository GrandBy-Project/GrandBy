"""
AI 통화 관련 Pydantic 스키마
"""

from pydantic import BaseModel
from datetime import datetime, time
from typing import Optional, List
from app.models.call import CallStatus, CallFrequency, EmotionType


class CallLogResponse(BaseModel):
    """통화 기록 응답"""
    call_id: str
    elderly_id: str
    call_status: CallStatus
    call_start_time: Optional[datetime]
    call_end_time: Optional[datetime]
    call_duration: Optional[int]
    audio_file_url: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


class CallSettingsCreate(BaseModel):
    """통화 설정 생성"""
    call_time: str  # "09:30" 형식
    frequency: CallFrequency = CallFrequency.DAILY
    is_active: bool = True


class CallSettingsUpdate(BaseModel):
    """통화 설정 업데이트"""
    frequency: CallFrequency
    call_time: time
    is_active: bool = True


class CallSettingsResponse(BaseModel):
    """통화 설정 응답"""
    setting_id: str
    elderly_id: str
    call_time: time
    frequency: CallFrequency
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class CallTranscriptResponse(BaseModel):
    """통화 텍스트 응답"""
    transcript_id: str
    speaker: str
    text: str
    timestamp: Optional[float]
    created_at: datetime
    
    class Config:
        from_attributes = True


class EmotionLogResponse(BaseModel):
    """감정 분석 응답"""
    emotion_id: str
    emotion_type: EmotionType
    emotion_score: float
    detected_keywords: Optional[str]
    analyzed_at: datetime
    
    class Config:
        from_attributes = True

