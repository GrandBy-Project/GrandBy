"""
다이어리 관련 Pydantic 스키마
"""

from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional, List
from app.models.diary import AuthorType, DiaryStatus


class DiaryCreate(BaseModel):
    """다이어리 생성"""
    date: date
    content: str
    status: DiaryStatus = DiaryStatus.DRAFT


class DiaryUpdate(BaseModel):
    """다이어리 수정"""
    content: Optional[str] = None
    status: Optional[DiaryStatus] = None


class DiaryResponse(BaseModel):
    """다이어리 응답"""
    diary_id: str
    user_id: str
    author_id: str
    date: date
    content: str
    author_type: AuthorType
    is_auto_generated: bool
    status: DiaryStatus
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class DiaryCommentCreate(BaseModel):
    """댓글 생성"""
    content: str


class DiaryCommentResponse(BaseModel):
    """댓글 응답"""
    comment_id: str
    user_id: str
    content: str
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

