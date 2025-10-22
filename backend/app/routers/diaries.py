"""
다이어리 API 라우터
일기 CRUD, 댓글, 사진 업로드
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import date as date_type
from app.database import get_db
from app.schemas.diary import DiaryCreate, DiaryUpdate, DiaryResponse, DiaryCommentCreate
from app.models.diary import Diary, AuthorType
from app.routers.auth import get_current_user
from app.models.user import User, UserRole, UserConnection, ConnectionStatus

router = APIRouter()


@router.get("/", response_model=List[DiaryResponse])
async def get_diaries(
    skip: int = 0,
    limit: int = 100,
    start_date: Optional[date_type] = None,
    end_date: Optional[date_type] = None,
    elderly_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    다이어리 목록 조회
    - 어르신: 본인의 일기 목록 반환
    - 보호자: elderly_id 파라미터로 연결된 어르신의 일기 조회
    """
    
    # 보호자가 특정 어르신의 다이어리를 조회하는 경우
    if elderly_id and current_user.role == UserRole.CAREGIVER:
        # 연결 확인: 보호자와 어르신이 ACTIVE 상태로 연결되어 있는지
        connection = db.query(UserConnection).filter(
            and_(
                UserConnection.caregiver_id == current_user.user_id,
                UserConnection.elderly_id == elderly_id,
                UserConnection.status == ConnectionStatus.ACTIVE
            )
        ).first()
        
        if not connection:
            raise HTTPException(
                status_code=403,
                detail="해당 어르신과 연결되어 있지 않습니다."
            )
        
        # 연결된 어르신의 다이어리 조회
        query = db.query(Diary).filter(Diary.user_id == elderly_id)
    else:
        # 기본: 본인의 다이어리 조회
        query = db.query(Diary).filter(Diary.user_id == current_user.user_id)
    
    # 날짜 필터링
    if start_date:
        query = query.filter(Diary.date >= start_date)
    if end_date:
        query = query.filter(Diary.date <= end_date)
    
    diaries = query.order_by(Diary.created_at.desc()).offset(skip).limit(limit).all()
    return diaries


@router.post("/", response_model=List[DiaryResponse])
async def create_diary(
    diary_data: DiaryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    다이어리 작성
    - 어르신: 본인의 일기 작성
    - 보호자: 연결된 모든 어르신의 일기장에 일괄 추가
    """
    created_diaries = []
    
    # 보호자가 작성하는 경우 → 연결된 모든 어르신에게 복제
    if current_user.role == UserRole.CAREGIVER:
        # 연결된 모든 어르신 조회
        connections = db.query(UserConnection).filter(
            and_(
                UserConnection.caregiver_id == current_user.user_id,
                UserConnection.status == ConnectionStatus.ACTIVE
            )
        ).all()
        
        if not connections:
            raise HTTPException(
                status_code=400,
                detail="연결된 어르신이 없습니다. 먼저 어르신과 연결해주세요."
            )
        
        # 각 어르신마다 동일한 일기 생성
        for connection in connections:
            new_diary = Diary(
                user_id=connection.elderly_id,  # 각 어르신 ID (누구의 일기장)
                author_id=current_user.user_id,  # 보호자 ID (작성자)
                date=diary_data.date,
                title=diary_data.title,
                content=diary_data.content,
                mood=diary_data.mood,
                author_type=AuthorType.CAREGIVER,
                is_auto_generated=False,
                status=diary_data.status
            )
            db.add(new_diary)
            created_diaries.append(new_diary)
    
    else:
        # 어르신 본인의 일기 작성
        new_diary = Diary(
            user_id=current_user.user_id,
            author_id=current_user.user_id,
            date=diary_data.date,
            title=diary_data.title,
            content=diary_data.content,
            mood=diary_data.mood,
            author_type=AuthorType.ELDERLY,
            is_auto_generated=False,
            status=diary_data.status
        )
        db.add(new_diary)
        created_diaries.append(new_diary)
    
    db.commit()
    for diary in created_diaries:
        db.refresh(diary)
    
    return created_diaries


@router.get("/{diary_id}", response_model=DiaryResponse)
async def get_diary(
    diary_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    다이어리 상세 조회
    - 본인 또는 연결된 어르신의 일기 조회 가능
    """
    diary = db.query(Diary).filter(Diary.diary_id == diary_id).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    
    # 권한 확인
    if diary.user_id == current_user.user_id:
        # 본인의 일기
        return diary
    
    # 보호자인 경우: 연결된 어르신의 일기인지 확인
    if current_user.role == UserRole.CAREGIVER:
        connection = db.query(UserConnection).filter(
            and_(
                UserConnection.caregiver_id == current_user.user_id,
                UserConnection.elderly_id == diary.user_id,
                UserConnection.status == ConnectionStatus.ACTIVE
            )
        ).first()
        
        if connection:
            return diary
    
    raise HTTPException(
        status_code=403,
        detail="해당 일기를 조회할 권한이 없습니다."
    )


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
    임시 저장 상태에서 발행 상태로 변경 시 어르신 작성으로 설정
    """
    diary = db.query(Diary).filter(
        Diary.diary_id == diary_id,
        Diary.user_id == current_user.user_id
    ).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    
    # 수정 가능한 필드만 업데이트
    if diary_data.title is not None:
        diary.title = diary_data.title
    if diary_data.content is not None:
        diary.content = diary_data.content
    if diary_data.mood is not None:
        diary.mood = diary_data.mood
    if diary_data.status is not None:
        # 임시 저장 상태에서 발행 상태로 변경 시 어르신 작성으로 변경
        # is_auto_generated는 유지하여 AI 자동 생성 + 어르신 작성 배지 모두 표시
        from app.models.diary import DiaryStatus
        if (diary.status == DiaryStatus.DRAFT and 
            diary_data.status == DiaryStatus.PUBLISHED and
            current_user.role == UserRole.ELDERLY):
            diary.author_type = AuthorType.ELDERLY
            diary.author_id = current_user.user_id
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
    - 본인이 작성했거나 본인 일기장에 있는 일기 삭제 가능
    """
    diary = db.query(Diary).filter(Diary.diary_id == diary_id).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    
    # 권한 확인: 본인이 작성했거나 본인 일기장에 있는 일기만 삭제 가능
    if diary.author_id != current_user.user_id and diary.user_id != current_user.user_id:
        raise HTTPException(
            status_code=403,
            detail="본인이 작성하거나 본인 일기장에 있는 일기만 삭제할 수 있습니다."
        )
    
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