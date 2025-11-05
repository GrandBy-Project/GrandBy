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
    title: Optional[str] = None
    content: str
    mood: Optional[str] = None
    status: DiaryStatus = DiaryStatus.PUBLISHED

class DiaryUpdate(BaseModel):
    """다이어리 수정"""
    title: Optional[str] = None
    content: Optional[str] = None
    mood: Optional[str] = None
    status: Optional[DiaryStatus] = None


class DiaryPhotoResponse(BaseModel):
    """다이어리 사진 응답"""
    photo_id: str
    photo_url: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class DiaryResponse(BaseModel):
    """다이어리 응답"""
    diary_id: str
    user_id: str
    author_id: str
    date: date
    title: Optional[str] = None
    content: str
    mood: Optional[str] = None
    author_type: AuthorType
    is_auto_generated: bool
    status: DiaryStatus
    created_at: datetime
    updated_at: datetime
    comment_count: int = 0  # 댓글 개수
    photos: List[DiaryPhotoResponse] = []  # 사진 목록
    
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
    user_name: str  # 유저 이름 추가
    user_role: str  # 유저 역할 추가
    
    class Config:
        from_attributes = True

