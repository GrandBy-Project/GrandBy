"""
사용자 관련 Pydantic 스키마
"""

from pydantic import BaseModel, EmailStr, validator
from datetime import datetime, date
from typing import Optional
from app.models.user import UserRole, AuthProvider, ConnectionStatus, Gender


class UserBase(BaseModel):
    """사용자 기본 스키마"""
    email: EmailStr
    name: str
    role: UserRole
    phone_number: Optional[str] = None


class UserCreate(UserBase):
    """회원가입 요청"""
    password: str
    birth_date: date  # 필수
    gender: Gender  # 필수
    auth_provider: AuthProvider = AuthProvider.EMAIL
    
    @validator('birth_date')
    def validate_birth_date(cls, v):
        """생년월일 유효성 검증"""
        today = date.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        
        if age < 14:
            raise ValueError('만 14세 이상만 가입 가능합니다')
        if age > 120:
            raise ValueError('올바른 생년월일을 입력해주세요')
        if v > today:
            raise ValueError('미래 날짜는 입력할 수 없습니다')
        
        return v


class UserLogin(BaseModel):
    """로그인 요청"""
    email: EmailStr
    password: str


class UserResponse(UserBase):
    """사용자 응답"""
    user_id: str
    is_active: bool
    created_at: datetime
    birth_date: Optional[date] = None
    gender: Optional[Gender] = None
    profile_image_url: Optional[str] = None
    
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
    elderly_phone_or_email: str  # 이메일 또는 전화번호


class ConnectionResponse(BaseModel):
    """연결 응답 (기본)"""
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

class ElderlySearchResult(BaseModel):
    """어르신 검색 결과"""
    user_id: str
    name: str
    email: str
    phone_number: Optional[str]
    is_already_connected: bool  # 이미 연결되었는지
    connection_status: Optional[ConnectionStatus] = None  # 연결 상태 (있으면)
    
    class Config:
        from_attributes = True


class ConnectionWithUserInfo(BaseModel):
    """사용자 정보 포함 연결 응답"""
    connection_id: str
    status: ConnectionStatus
    created_at: datetime
    updated_at: datetime
    
    # 상대방 정보
    user_id: str
    name: str
    email: str
    phone_number: Optional[str]
    
    class Config:
        from_attributes = True


class ConnectionListResponse(BaseModel):
    """연결 목록 응답"""
    active: list[ConnectionWithUserInfo]  # 활성 연결
    pending: list[ConnectionWithUserInfo]  # 대기 중 (보호자: 내가 보낸 요청, 어르신: 받은 요청)
    rejected: list[ConnectionWithUserInfo]  # 거절됨


class ConnectionCancelRequest(BaseModel):
    """연결 취소 요청"""
    reason: Optional[str] = None  # 취소 사유 (선택)

