"""
건강 관련 Pydantic 스키마
"""

from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List


class HealthDataCreate(BaseModel):
    """건강 데이터 생성"""
    step_count: int = Field(0, ge=0, description="걸음 수")
    distance: float = Field(0.0, ge=0.0, description="거리 (미터)")


class HealthDataUpdate(BaseModel):
    """건강 데이터 수정"""
    step_count: Optional[int] = Field(None, ge=0, description="걸음 수")
    distance: Optional[float] = Field(None, ge=0.0, description="거리 (미터)")


class HealthDataResponse(BaseModel):
    """건강 데이터 응답"""
    health_id: str
    user_id: str
    date: date
    step_count: int
    distance: float
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HealthDataStatsResponse(BaseModel):
    """건강 데이터 통계 응답"""
    date: date
    step_count: int
    distance: float


class HealthDataRangeResponse(BaseModel):
    """건강 데이터 기간별 조회 응답"""
    start_date: date
    end_date: date
    total_steps: int
    total_distance: float
    average_steps: float
    average_distance: float
    daily_data: List[HealthDataStatsResponse]

