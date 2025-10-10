"""
TODO 관련 Pydantic 스키마
"""

from pydantic import BaseModel
from datetime import date, time, datetime
from typing import Optional
from app.models.todo import CreatorType, TodoStatus


class TodoCreate(BaseModel):
    """TODO 생성"""
    elderly_id: str
    title: str
    description: Optional[str] = None
    due_date: date
    due_time: Optional[time] = None


class TodoUpdate(BaseModel):
    """TODO 수정"""
    title: Optional[str] = None
    description: Optional[str] = None
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    status: Optional[TodoStatus] = None


class TodoResponse(BaseModel):
    """TODO 응답"""
    todo_id: str
    elderly_id: str
    creator_id: str
    title: str
    description: Optional[str]
    due_date: date
    due_time: Optional[time]
    creator_type: CreatorType
    status: TodoStatus
    is_confirmed: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

