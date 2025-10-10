"""
TODO 관리 API 라우터
TODO CRUD, 완료 처리
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.todo import TodoCreate, TodoUpdate, TodoResponse

router = APIRouter()


@router.get("/", response_model=List[TodoResponse])
async def get_todos(db: Session = Depends(get_db)):
    """
    TODO 목록 조회
    TODO: 현재 사용자의 TODO 목록 반환
    """
    return []


@router.post("/", response_model=TodoResponse)
async def create_todo(todo_data: TodoCreate, db: Session = Depends(get_db)):
    """
    TODO 생성
    TODO: 새 TODO 생성
    """
    return None


@router.put("/{todo_id}", response_model=TodoResponse)
async def update_todo(todo_id: str, todo_data: TodoUpdate, db: Session = Depends(get_db)):
    """
    TODO 수정
    TODO: TODO 내용 수정
    """
    return None


@router.patch("/{todo_id}/complete")
async def complete_todo(todo_id: str, db: Session = Depends(get_db)):
    """
    TODO 완료 처리
    TODO: TODO 상태를 COMPLETED로 변경
    """
    return {"message": "Completed"}


@router.delete("/{todo_id}")
async def delete_todo(todo_id: str, db: Session = Depends(get_db)):
    """
    TODO 삭제
    TODO: TODO 삭제
    """
    return {"message": "Deleted"}

