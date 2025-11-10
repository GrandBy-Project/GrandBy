"""
다이어리 API 라우터
일기 CRUD, 댓글, 사진 업로드
"""

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from sqlalchemy.orm import Session, aliased
from sqlalchemy import and_, func
from typing import List, Optional
from datetime import date as date_type
from app.database import get_db
from app.schemas.diary import DiaryCreate, DiaryUpdate, DiaryResponse, DiaryCommentCreate, DiaryCommentResponse
from app.models.diary import Diary, AuthorType, DiaryComment, DiaryPhoto
from app.routers.auth import get_current_user
from app.models.user import User, UserRole, UserConnection, ConnectionStatus
from app.utils.image import save_diary_image
import logging
import uuid

logger = logging.getLogger(__name__)

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
        
        # 연결된 어르신의 다이어리 조회 (활성화된 사용자만)
        # 일기 소유자(user_id)와 작성자(author_id) 모두 활성화되어 있어야 함
        owner = aliased(User)
        author = aliased(User)
        query = db.query(Diary).join(
            owner, Diary.user_id == owner.user_id
        ).join(
            author, Diary.author_id == author.user_id
        ).filter(
            and_(
                Diary.user_id == elderly_id,
                owner.is_active == True,
                author.is_active == True
            )
        )
    else:
        # 기본: 본인의 다이어리 조회
        # 소유자(user_id)는 current_user이므로 이미 get_current_user에서 활성화 체크 완료
        # 작성자(author_id)만 활성화 체크 필요
        author = aliased(User)
        query = db.query(Diary).join(
            author, Diary.author_id == author.user_id
        ).filter(
            and_(
                Diary.user_id == current_user.user_id,
                author.is_active == True
            )
        )
    
    # 날짜 필터링
    if start_date:
        query = query.filter(Diary.date >= start_date)
    if end_date:
        query = query.filter(Diary.date <= end_date)
    
    diaries = query.order_by(Diary.created_at.desc()).offset(skip).limit(limit).all()
    
    # 댓글 개수 및 사진 목록 계산
    if diaries:
        diary_ids = [diary.diary_id for diary in diaries]
        
        # 각 다이어리의 댓글 개수를 한 번에 조회
        comment_counts = db.query(
            DiaryComment.diary_id,
            func.count(DiaryComment.comment_id).label('count')
        ).filter(
            DiaryComment.diary_id.in_(diary_ids)
        ).group_by(DiaryComment.diary_id).all()
        
        # 딕셔너리로 변환하여 빠른 조회
        count_dict = {diary_id: count for diary_id, count in comment_counts}
        
        # 각 다이어리의 사진 목록을 한 번에 조회
        photos_list = db.query(DiaryPhoto).filter(
            DiaryPhoto.diary_id.in_(diary_ids)
        ).order_by(DiaryPhoto.created_at.asc()).all()
        
        # 다이어리별로 사진 그룹화
        photos_dict: dict[str, list] = {}
        for photo in photos_list:
            if photo.diary_id not in photos_dict:
                photos_dict[photo.diary_id] = []
            photos_dict[photo.diary_id].append(photo)
        
        from app.schemas.diary import DiaryPhotoResponse
        
        # 각 다이어리에 댓글 개수 및 사진 목록 추가하여 DiaryResponse 생성
        result = []
        for diary in diaries:
            comment_count = count_dict.get(diary.diary_id, 0)
            
            # 사진 목록 생성
            diary_photos = photos_dict.get(diary.diary_id, [])
            photos_response = [
                DiaryPhotoResponse(
                    photo_id=photo.photo_id,
                    photo_url=photo.photo_url,
                    created_at=photo.created_at
                )
                for photo in diary_photos
            ]
            
            diary_dict = {
                "diary_id": diary.diary_id,
                "user_id": diary.user_id,
                "author_id": diary.author_id,
                "author_name": diary.author.name if getattr(diary, "author", None) else None,
                "date": diary.date,
                "title": diary.title,
                "content": diary.content,
                "mood": diary.mood,
                "author_type": diary.author_type,
                "is_auto_generated": diary.is_auto_generated,
                "status": diary.status,
                "created_at": diary.created_at,
                "updated_at": diary.updated_at,
                "comment_count": comment_count,
                "photos": photos_response,
            }
            result.append(DiaryResponse(**diary_dict))
        
        return result
    
    return []


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
    
    # DiaryResponse 생성 (새로 생성된 다이어리는 댓글과 사진이 없으므로 comment_count = 0, photos = [])
    result = []
    for diary in created_diaries:
        diary_dict = {
            "diary_id": diary.diary_id,
            "user_id": diary.user_id,
            "author_id": diary.author_id,
            "author_name": diary.author.name if getattr(diary, "author", None) else current_user.name,
            "date": diary.date,
            "title": diary.title,
            "content": diary.content,
            "mood": diary.mood,
            "author_type": diary.author_type,
            "is_auto_generated": diary.is_auto_generated,
            "status": diary.status,
            "created_at": diary.created_at,
            "updated_at": diary.updated_at,
            "comment_count": 0,  
            "photos": [],  
        }
        result.append(DiaryResponse(**diary_dict))
    
    return result


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
    has_permission = False
    if diary.user_id == current_user.user_id:
        # 본인의 일기
        has_permission = True
    elif current_user.role == UserRole.CAREGIVER:
        # 보호자인 경우: 연결된 어르신의 일기인지 확인
        connection = db.query(UserConnection).filter(
            and_(
                UserConnection.caregiver_id == current_user.user_id,
                UserConnection.elderly_id == diary.user_id,
                UserConnection.status == ConnectionStatus.ACTIVE
            )
        ).first()
        
        if connection:
            has_permission = True
    
    if not has_permission:
        raise HTTPException(
            status_code=403,
            detail="해당 일기를 조회할 권한이 없습니다."
        )
    
    # 댓글 개수 계산
    comment_count = db.query(func.count(DiaryComment.comment_id)).filter(
        DiaryComment.diary_id == diary_id
    ).scalar() or 0
    
    # 사진 목록 조회
    photos = db.query(DiaryPhoto).filter(
        DiaryPhoto.diary_id == diary_id
    ).order_by(DiaryPhoto.created_at.asc()).all()
    
    from app.schemas.diary import DiaryPhotoResponse
    photos_list = [
        DiaryPhotoResponse(
            photo_id=photo.photo_id,
            photo_url=photo.photo_url,
            created_at=photo.created_at
        )
        for photo in photos
    ]
    
    # DiaryResponse 생성
    diary_dict = {
        "diary_id": diary.diary_id,
        "user_id": diary.user_id,
        "author_id": diary.author_id,
        "author_name": diary.author.name if getattr(diary, "author", None) else None,
        "date": diary.date,
        "title": diary.title,
        "content": diary.content,
        "mood": diary.mood,
        "author_type": diary.author_type,
        "is_auto_generated": diary.is_auto_generated,
        "status": diary.status,
        "created_at": diary.created_at,
        "updated_at": diary.updated_at,
        "comment_count": comment_count,
        "photos": photos_list,
    }
    
    return DiaryResponse(**diary_dict)


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
        diary.status = diary_data.status
    
    db.commit()
    db.refresh(diary)
    
    # 댓글 개수 계산
    comment_count = db.query(func.count(DiaryComment.comment_id)).filter(
        DiaryComment.diary_id == diary_id
    ).scalar() or 0
    
    # 사진 목록 조회
    photos = db.query(DiaryPhoto).filter(
        DiaryPhoto.diary_id == diary_id
    ).order_by(DiaryPhoto.created_at.asc()).all()
    
    from app.schemas.diary import DiaryPhotoResponse
    photos_list = [
        DiaryPhotoResponse(
            photo_id=photo.photo_id,
            photo_url=photo.photo_url,
            created_at=photo.created_at
        )
        for photo in photos
    ]
    
    # DiaryResponse 생성
    diary_dict = {
        "diary_id": diary.diary_id,
        "user_id": diary.user_id,
        "author_id": diary.author_id,
        "author_name": diary.author.name if getattr(diary, "author", None) else None,
        "date": diary.date,
        "title": diary.title,
        "content": diary.content,
        "mood": diary.mood,
        "author_type": diary.author_type,
        "is_auto_generated": diary.is_auto_generated,
        "status": diary.status,
        "created_at": diary.created_at,
        "updated_at": diary.updated_at,
        "comment_count": comment_count,
        "photos": photos_list,
    }
    
    return DiaryResponse(**diary_dict)


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


@router.post("/{diary_id}/photos")
async def upload_diary_photo(
    diary_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    일기 사진 업로드
    
    - 본인이 작성했거나 본인 일기장에 있는 일기에만 사진 업로드 가능
    - 최대 5MB
    - JPG, PNG, WEBP 지원
    - 자동 리사이징 (최대 1920px, 비율 유지)
    """
    # 일기 존재 여부 및 권한 확인
    diary = db.query(Diary).filter(Diary.diary_id == diary_id).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    
    # 권한 확인: 본인이 작성했거나 본인 일기장에 있는 일기만 사진 업로드 가능
    has_permission = False
    if diary.user_id == current_user.user_id:
        # 본인의 일기
        has_permission = True
    elif current_user.role == UserRole.CAREGIVER:
        # 보호자인 경우: 연결된 어르신의 일기인지 확인
        connection = db.query(UserConnection).filter(
            and_(
                UserConnection.caregiver_id == current_user.user_id,
                UserConnection.elderly_id == diary.user_id,
                UserConnection.status == ConnectionStatus.ACTIVE
            )
        ).first()
        if connection:
            has_permission = True
    
    if not has_permission:
        raise HTTPException(
            status_code=403,
            detail="해당 일기에 사진을 업로드할 권한이 없습니다."
        )
    
    try:
        # 이미지 저장
        photo_url = await save_diary_image(file, diary_id, current_user.user_id)
        
        # DiaryPhoto 레코드 생성
        new_photo = DiaryPhoto(
            photo_id=str(uuid.uuid4()),
            diary_id=diary_id,
            uploaded_by=current_user.user_id,
            photo_url=photo_url
        )
        db.add(new_photo)
        db.commit()
        db.refresh(new_photo)
        
        logger.info(f"✅ 일기 사진 업로드 완료: diary_id={diary_id}, photo_id={new_photo.photo_id}")
        
        return {
            "photo_id": new_photo.photo_id,
            "photo_url": photo_url,
            "diary_id": diary_id,
            "uploaded_by": current_user.user_id,
            "created_at": new_photo.created_at.isoformat() if new_photo.created_at else None
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 일기 사진 업로드 실패: {e}")
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"사진 업로드 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/{diary_id}/comments", response_model=List[DiaryCommentResponse])
async def get_comments(
    diary_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    댓글 목록 조회
    특정 일기의 댓글 목록 조회
    """
    # 일기 존재 여부 확인
    diary = db.query(Diary).filter(Diary.diary_id == diary_id).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    
    # 권한 확인 (본인의 일기 또는 연결된 어르신의 일기)
    has_permission = False
    
    if diary.user_id == current_user.user_id:
        has_permission = True
    elif current_user.role == UserRole.CAREGIVER:
        connection = db.query(UserConnection).filter(
            and_(
                UserConnection.caregiver_id == current_user.user_id,
                UserConnection.elderly_id == diary.user_id,
                UserConnection.status == ConnectionStatus.ACTIVE
            )
        ).first()
        if connection:
            has_permission = True
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="댓글을 조회할 권한이 없습니다.")
    
    # 댓글 조회 (유저 정보 포함)
    comments = db.query(DiaryComment, User).join(
        User, DiaryComment.user_id == User.user_id
    ).filter(
        DiaryComment.diary_id == diary_id
    ).order_by(DiaryComment.created_at.asc()).all()
    
    # 응답 데이터 구성
    result = []
    for comment, user in comments:
        result.append({
            "comment_id": comment.comment_id,
            "user_id": comment.user_id,
            "content": comment.content,
            "is_read": comment.is_read,
            "created_at": comment.created_at,
            "user_name": user.name,
            "user_role": user.role.value
        })
    
    return result


@router.post("/{diary_id}/comments", response_model=DiaryCommentResponse)
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
    # 일기 존재 여부 확인
    diary = db.query(Diary).filter(Diary.diary_id == diary_id).first()
    
    if not diary:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없습니다.")
    
    # 권한 확인 (본인의 일기 또는 연결된 어르신의 일기)
    has_permission = False
    
    if diary.user_id == current_user.user_id:
        has_permission = True
    elif current_user.role == UserRole.CAREGIVER:
        connection = db.query(UserConnection).filter(
            and_(
                UserConnection.caregiver_id == current_user.user_id,
                UserConnection.elderly_id == diary.user_id,
                UserConnection.status == ConnectionStatus.ACTIVE
            )
        ).first()
        if connection:
            has_permission = True
    
    if not has_permission:
        raise HTTPException(status_code=403, detail="댓글을 작성할 권한이 없습니다.")
    
    # 댓글 생성
    new_comment = DiaryComment(
        diary_id=diary_id,
        user_id=current_user.user_id,
        content=comment_data.content,
        is_read=False
    )
    
    db.add(new_comment)
    db.commit()
    db.refresh(new_comment)
    
    # 유저 정보 조회
    user = db.query(User).filter(User.user_id == current_user.user_id).first()
    
    # 🔔 댓글 작성 알림 전송 (비동기)
    try:
        import logging
        from app.services.notification_service import NotificationService
        logger = logging.getLogger(__name__)
        
        await NotificationService.notify_diary_comment_created(
            db=db,
            diary_id=diary_id,
            comment_author_id=current_user.user_id,
            comment_author_name=current_user.name,
            diary_title=diary.title
        )
        logger.info(f"📤 일기 댓글 작성 알림 전송 완료: {diary_id}")
    except Exception as notify_error:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"⚠️ 일기 댓글 작성 알림 전송 실패 (댓글은 생성됨): {str(notify_error)}")
    
    return {
        "comment_id": new_comment.comment_id,
        "user_id": new_comment.user_id,
        "content": new_comment.content,
        "is_read": new_comment.is_read,
        "created_at": new_comment.created_at,
        "user_name": user.name,
        "user_role": user.role.value
    }


@router.delete("/{diary_id}/comments/{comment_id}")
async def delete_comment(
    diary_id: str,
    comment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    댓글 삭제
    본인이 작성한 댓글만 삭제 가능
    """
    comment = db.query(DiaryComment).filter(
        DiaryComment.comment_id == comment_id,
        DiaryComment.diary_id == diary_id
    ).first()
    
    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    
    # 본인이 작성한 댓글만 삭제 가능
    if comment.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="본인이 작성한 댓글만 삭제할 수 있습니다.")
    
    db.delete(comment)
    db.commit()
    
    return {"message": "댓글이 삭제되었습니다."}