"""
다이어리 API 라우터
일기 CRUD, 댓글, 사진 업로드
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.diary import DiaryCreate, DiaryUpdate, DiaryResponse, DiaryCommentCreate

router = APIRouter()


@router.get("/", response_model=List[DiaryResponse])
async def get_diaries(db: Session = Depends(get_db)):
    """
    다이어리 목록 조회
    TODO: 현재 사용자의 일기 목록 반환
    """
    return []


@router.post("/", response_model=DiaryResponse)
async def create_diary(diary_data: DiaryCreate, db: Session = Depends(get_db)):
    """
    다이어리 작성
    TODO: 새 일기 생성
    """
    return None


@router.get("/{diary_id}", response_model=DiaryResponse)
async def get_diary(diary_id: str, db: Session = Depends(get_db)):
    """
    다이어리 상세 조회
    TODO: 특정 일기 반환
    """
    return None


@router.put("/{diary_id}", response_model=DiaryResponse)
async def update_diary(diary_id: str, diary_data: DiaryUpdate, db: Session = Depends(get_db)):
    """
    다이어리 수정
    TODO: 일기 내용 수정
    """
    return None


@router.delete("/{diary_id}")
async def delete_diary(diary_id: str, db: Session = Depends(get_db)):
    """
    다이어리 삭제
    TODO: 일기 삭제
    """
    return {"message": "Deleted"}


@router.post("/{diary_id}/comments")
async def create_comment(diary_id: str, comment_data: DiaryCommentCreate, db: Session = Depends(get_db)):
    """
    댓글 작성
    TODO: 일기에 댓글 추가
    """
    return {"message": "Not Implemented"}

