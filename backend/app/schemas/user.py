"""
사용자 관련 Pydantic 스키마
"""

from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional
from app.models.user import UserRole, AuthProvider, ConnectionStatus


class UserBase(BaseModel):
    """사용자 기본 스키마"""
    email: EmailStr
    name: str
    role: UserRole
    phone_number: Optional[str] = None


class UserCreate(UserBase):
    """회원가입 요청"""
    password: str
    auth_provider: AuthProvider = AuthProvider.EMAIL


class UserLogin(BaseModel):
    """로그인 요청"""
    email: EmailStr
    password: str


class UserResponse(UserBase):
    """사용자 응답"""
    user_id: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    """JWT 토큰 응답"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class ConnectionCreate(BaseModel):
    """연결 요청 생성"""
    elderly_phone_or_email: str


class ConnectionResponse(BaseModel):
    """연결 응답"""
    connection_id: str
    caregiver_id: str
    elderly_id: str
    status: ConnectionStatus
    created_at: datetime
    
    class Config:
        from_attributes = True


class CallScheduleUpdate(BaseModel):
    """자동 통화 스케줄 설정 업데이트"""
    auto_call_enabled: bool
    scheduled_call_time: Optional[str] = None  # HH:MM 형식 (예: "14:30")


class CallScheduleResponse(BaseModel):
    """자동 통화 스케줄 설정 응답"""
    auto_call_enabled: bool
    scheduled_call_time: Optional[str] = None
    
    class Config:
        from_attributes = True

