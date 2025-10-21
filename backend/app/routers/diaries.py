"""
다이어리 API 라우터
일기 CRUD, 댓글, 사진 업로드
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date as date_type
from app.database import get_db
from app.schemas.diary import DiaryCreate, DiaryUpdate, DiaryResponse, DiaryCommentCreate
from app.models.diary import Diary, AuthorType
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter()


@router.get("/", response_model=List[DiaryResponse])
async def get_diaries(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date_type] = None,
    end_date: Optional[date_type] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    다이어리 목록 조회
    현재 사용자의 일기 목록 반환
    """
    query = db.query(Diary).filter(Diary.user_id == current_user.user_id)
    
    if start_date:
        query = query.filter(Diary.date >= start_date)
    if end_date:
        query = query.filter(Diary.date <= end_date)
    
    diaries = query.order_by(Diary.date.desc()).offset(skip).limit(limit).all()
    return diaries


@router.post("/", response_model=DiaryResponse)
async def create_diary(
    diary_data: DiaryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    다이어리 작성
    새 일기 생성
    """
    # 새 다이어리 생성
    new_diary = Diary(
        user_id=current_user.user_id,
        author_id=current_user.user_id,
        date=diary_data.date,
        # title=diary_data.title,
        content=diary_data.content,
        # mood=diary_data.mood,
        author_type=AuthorType.ELDERLY if current_user.role == "elderly" else AuthorType.CAREGIVER,
        is_auto_generated=False,
        status=diary_data.status
    )
    
    db.add(new_diary)
    db.commit()
    db.refresh(new_diary)
    
    return new_diary


@router.get("/by-call/{call_id}", response_model=DiaryResponse)
async def get_diary_by_call(
    call_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    통화 ID로 일기 조회
    """
    diary = db.query(Diary).filter(
        Diary.call_id == call_id,
        Diary.user_id == current_user.user_id
    ).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="해당 통화로 생성된 일기를 찾을 수 없습니다.")
    
    return diary


@router.get("/{diary_id}", response_model=DiaryResponse)
async def get_diary(
    diary_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    다이어리 상세 조회
    특정 일기 반환
    """
    diary = db.query(Diary).filter(
        Diary.diary_id == diary_id,
        Diary.user_id == current_user.user_id
    ).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    
    return diary


@router.put("/{diary_id}", response_model=DiaryResponse)
async def update_diary(
    diary_id: str,
    diary_data: DiaryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    다이어리 수정
    일기 내용 수정
    """
    diary = db.query(Diary).filter(
        Diary.diary_id == diary_id,
        Diary.user_id == current_user.user_id
    ).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    
    # 수정 가능한 필드만 업데이트
    # if diary_data.title is not None:
        # diary.title = diary_data.title
    if diary_data.content is not None:
        diary.content = diary_data.content
    # if diary_data.mood is not None:
        # diary.mood = diary_data.mood
    if diary_data.status is not None:
        diary.status = diary_data.status
    
    db.commit()
    db.refresh(diary)
    
    return diary


@router.delete("/{diary_id}")
async def delete_diary(
    diary_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    다이어리 삭제
    일기 삭제
    """
    diary = db.query(Diary).filter(
        Diary.diary_id == diary_id,
        Diary.user_id == current_user.user_id
    ).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    
    db.delete(diary)
    db.commit()
    
    return {"message": "일기가 삭제되었습니다."}


@router.post("/{diary_id}/comments")
async def create_comment(
    diary_id: str,
    comment_data: DiaryCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    댓글 작성
    일기에 댓글 추가
    """
    # TODO: DiaryComment 모델 임포트 및 구현
    return {"message": "Not Implemented Yet"}


@router.get("/{diary_id}/suggested-todos")
async def get_suggested_todos(
    diary_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    일기에서 감지된 TODO 추천 목록 조회
    
    일기가 AI로 생성되었고 통화 기록이 있는 경우,
    통화 내용에서 감지된 할 일 목록을 반환합니다.
    
    Returns:
        {
            "diary_id": "...",
            "suggested_todos": [
                {
                    "title": "병원 가기",
                    "description": "내과 진료",
                    "due_date": "2025-10-21",
                    "priority": "high",
                    ...
                }
            ]
        }
    """
    from app.models.call import CallLog, CallTranscript
    from app.services.diary.conversation_analyzer import ConversationAnalyzer
    from app.services.diary.todo_extractor import TodoExtractor
    
    # 1. 일기 조회
    diary = db.query(Diary).filter(
        Diary.diary_id == diary_id,
        Diary.user_id == current_user.user_id
    ).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    
    # 2. AI 생성 일기가 아니거나 통화 기록이 없으면 빈 리스트 반환
    if not diary.is_auto_generated or not diary.call_id:
        return {
            "diary_id": diary_id,
            "suggested_todos": []
        }
    
    # 3. 통화 내용 분석
    analyzer = ConversationAnalyzer()
    structured_data = analyzer.analyze_conversation(diary.call_id, db)
    
    # 4. TODO 추출
    todo_extractor = TodoExtractor()
    suggested_todos = todo_extractor.extract_and_create_todos(
        structured_data=structured_data,
        elderly=current_user,
        creator=current_user,
        db=db
    )
    
    return {
        "diary_id": diary_id,
        "diary_date": diary.date.isoformat(),
        "suggested_todos": suggested_todos
    }


@router.post("/{diary_id}/accept-todos")
async def accept_suggested_todos(
    diary_id: str,
    selected_todos: List[int],  # 선택된 TODO 인덱스 리스트
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    감지된 TODO를 실제로 등록
    
    사용자가 추천된 TODO 중 일부를 선택하면,
    해당 TODO를 실제 TODO 테이블에 등록합니다.
    
    Request Body:
        [0, 2, 3]  # 0번, 2번, 3번 TODO 선택
    
    Returns:
        {
            "success": true,
            "created_todos_count": 3,
            "created_todos": [...]
        }
    """
    from app.models.call import CallLog
    from app.services.diary.conversation_analyzer import ConversationAnalyzer
    from app.services.diary.todo_extractor import TodoExtractor
    from app.models.todo import Todo
    
    # 1. 일기 조회
    diary = db.query(Diary).filter(
        Diary.diary_id == diary_id,
        Diary.user_id == current_user.user_id
    ).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    
    if not diary.is_auto_generated or not diary.call_id:
        raise HTTPException(status_code=400, detail="AI 생성 일기가 아닙니다.")
    
    # 2. 통화 내용 재분석
    analyzer = ConversationAnalyzer()
    structured_data = analyzer.analyze_conversation(diary.call_id, db)
    
    # 3. TODO 추출
    todo_extractor = TodoExtractor()
    suggestions = todo_extractor.extract_and_create_todos(
        structured_data=structured_data,
        elderly=current_user,
        creator=current_user,
        db=db
    )
    
    # 4. 선택된 TODO만 실제로 생성
    created_todos = todo_extractor.create_todos_from_suggestions(
        suggestions=suggestions,
        selected_indices=selected_todos,
        db=db
    )
    
    return {
        "success": True,
        "created_todos_count": len(created_todos),
        "created_todos": [
            {
                "todo_id": todo.todo_id,
                "title": todo.title,
                "due_date": todo.due_date.isoformat() if todo.due_date else None,
                "priority": todo.priority.value
            }
            for todo in created_todos
        ]
    }