"""
TODO 관련 Pydantic 스키마
"""

from pydantic import BaseModel, Field
from datetime import date, time, datetime
from typing import Optional, List
from app.models.todo import CreatorType, TodoStatus, TodoCategory, RecurringType


class TodoCreate(BaseModel):
    """TODO 생성"""
    elderly_id: str
    title: str
    description: Optional[str] = None
    category: Optional[TodoCategory] = None
    due_date: date
    due_time: Optional[str] = None  # 문자열로 받아서 내부에서 time 객체로 변환
    
    # 반복 일정 설정
    is_recurring: bool = False
    recurring_type: Optional[RecurringType] = None
    recurring_interval: int = 1
    recurring_days: Optional[List[int]] = None  # [0,1,2,3,4,5,6] (월~일)
    recurring_day_of_month: Optional[int] = Field(None, ge=1, le=31)
    recurring_start_date: Optional[date] = None
    recurring_end_date: Optional[date] = None


class TodoUpdate(BaseModel):
    """TODO 수정"""
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[TodoCategory] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    status: Optional[TodoStatus] = None
    
    # 반복 일정 수정
    is_recurring: Optional[bool] = None
    recurring_type: Optional[RecurringType] = None
    recurring_interval: Optional[int] = None
    recurring_days: Optional[List[int]] = None
    recurring_day_of_month: Optional[int] = Field(None, ge=1, le=31)
    recurring_end_date: Optional[date] = None


class TodoResponse(BaseModel):
    """TODO 응답"""
    todo_id: str
    elderly_id: str
    creator_id: str
    title: str
    description: Optional[str]
    category: Optional[TodoCategory]
    due_date: date
    due_time: Optional[time]
    
    # 반복 일정 정보
    is_recurring: bool
    recurring_type: Optional[RecurringType]
    recurring_interval: Optional[int]
    recurring_days: Optional[List[int]] = None
    recurring_day_of_month: Optional[int] = None
    recurring_start_date: Optional[date] = None
    recurring_end_date: Optional[date] = None
    parent_recurring_id: Optional[str] = None
    
    creator_type: CreatorType
    status: TodoStatus
    is_confirmed: bool
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class TodoStatsResponse(BaseModel):
    """TODO 통계 응답"""
    total: int
    completed: int
    pending: int
    cancelled: int
    completion_rate: float  # 0.0 ~ 1.0

