"""
TODO 관리 API 라우터
TODO CRUD, 완료 처리
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta
from app.database import get_db
from app.schemas.todo import (
    TodoCreate, 
    TodoUpdate, 
    TodoResponse, 
    TodoStatsResponse,
    TodoDetailedStatsResponse
)
from app.services.todo.todo_service import TodoService
from app.models.user import User, UserRole
from app.models.todo import TodoStatus

# get_current_user import (auth.py에서)
import sys
sys.path.append('..')
from app.routers.auth import get_current_user

router = APIRouter()


@router.get("/", response_model=List[TodoResponse])
async def get_todos(
    elderly_id: Optional[str] = Query(None, description="어르신 ID (보호자용)"),
    date_filter: Optional[str] = Query("today", description="yesterday, today, tomorrow"),
    status: Optional[TodoStatus] = Query(None, description="상태 필터"),
    shared_only: bool = Query(False, description="공유된 TODO만 (보호자용)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    TODO 목록 조회
    
    - **어르신**: 본인의 TODO만 조회 (모두 볼 수 있음)
    - **보호자**: elderly_id 지정, shared_only=true면 공유된 TODO만
    - **date_filter**: yesterday, today, tomorrow
    - **status**: pending, completed, cancelled
    - **shared_only**: true면 is_shared_with_caregiver=true인 것만
    """
    # 날짜 계산
    today = date.today()
    date_map = {
        "yesterday": today - timedelta(days=1),
        "today": today,
        "tomorrow": today + timedelta(days=1)
    }
    target_date = date_map.get(date_filter, today)
    
    # 어르신인 경우 본인 ID 사용
    if current_user.role == UserRole.ELDERLY:
        target_elderly_id = current_user.user_id
    else:
        # 보호자인 경우 elderly_id 필수
        if not elderly_id:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="보호자는 elderly_id를 지정해야 합니다."
            )
        target_elderly_id = elderly_id
    
    import logging
    logger = logging.getLogger(__name__)
    
    effective_shared_only = False
    if current_user.role == UserRole.CAREGIVER:
        effective_shared_only = True

    logger.info(f"📥 get_todos API 호출:")
    logger.info(f"   - current_user: {current_user.user_id} ({current_user.role})")
    logger.info(f"   - elderly_id 파라미터: {elderly_id}")
    logger.info(f"   - target_elderly_id: {target_elderly_id}")
    logger.info(f"   - date_filter: {date_filter}")
    logger.info(f"   - target_date: {target_date}")
    logger.info(f"   - 요청 shared_only: {shared_only}")
    logger.info(f"   - 적용 shared_only: {effective_shared_only}")
    
    todos = TodoService.get_todos_by_date(
        db=db,
        elderly_id=target_elderly_id,
        target_date=target_date,
        status_filter=status,
        shared_only=effective_shared_only
    )
    
    logger.info(f"📤 get_todos API 응답: {len(todos)}개")
    
    return todos


@router.get("/range", response_model=List[TodoResponse])
async def get_todos_by_range(
    elderly_id: Optional[str] = Query(None, description="어르신 ID (보호자용)"),
    start_date: date = Query(..., description="시작 날짜"),
    end_date: date = Query(..., description="종료 날짜"),
    status: Optional[TodoStatus] = Query(None, description="상태 필터"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    날짜 범위별 TODO 조회 (캘린더용)
    
    - **start_date**: 시작 날짜 (YYYY-MM-DD)
    - **end_date**: 종료 날짜 (YYYY-MM-DD)
    """
    # 어르신인 경우 본인 ID 사용
    if current_user.role == UserRole.ELDERLY:
        target_elderly_id = current_user.user_id
    else:
        if not elderly_id:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="보호자는 elderly_id를 지정해야 합니다."
            )
        target_elderly_id = elderly_id
    
    shared_only = False
    if current_user.role == UserRole.CAREGIVER:
        shared_only = True
    
    todos = TodoService.get_todos_by_date_range(
        db=db,
        elderly_id=target_elderly_id,
        start_date=start_date,
        end_date=end_date,
        status_filter=status,
        shared_only=shared_only
    )
    
    return todos


@router.get("/stats/detailed", response_model=TodoDetailedStatsResponse)
async def get_detailed_todo_stats(
    elderly_id: Optional[str] = Query(None, description="어르신 ID (보호자용)"),
    period: str = Query("week", description="week, month, last_month"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    TODO 상세 통계 조회 (카테고리별 포함)
    
    - **period**: week (7일), month (이번 달), last_month (지난 달)
    - **보호자**: 공유된 TODO만 통계에 포함 (shared_only=True 자동 적용)
    - **어르신**: 본인의 모든 TODO 통계 (shared_only=False)
    """
    # 어르신인 경우 본인 ID 사용
    if current_user.role == UserRole.ELDERLY:
        target_elderly_id = current_user.user_id
        shared_only = False  # 어르신은 모든 할일 볼 수 있음
    else:
        if not elderly_id:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="보호자는 elderly_id를 지정해야 합니다."
            )
        target_elderly_id = elderly_id
        shared_only = True  # 보호자는 공유된 할일만 볼 수 있음
    
    # 기간 계산
    today = date.today()
    if period == "week":
        # 이번 주의 일요일 계산 (일요일 = 6)
        days_since_sunday = (today.weekday() + 1) % 7  # 0=월요일 -> 1, 6=일요일 -> 0
        if days_since_sunday == 0:
            # 오늘이 일요일이면 이번 주 시작
            start_date = today
        else:
            # 가장 가까운 일요일 찾기
            start_date = today - timedelta(days=days_since_sunday)
        end_date = today
    elif period == "last_month":
        # 지난 달의 1일부터 마지막 날까지
        from calendar import monthrange
        if today.month == 1:
            # 1월이면 전년 12월
            start_date = date(today.year - 1, 12, 1)
            end_date = date(today.year - 1, 12, 31)
        else:
            # 지난 달의 1일
            start_date = date(today.year, today.month - 1, 1)
            # 지난 달의 마지막 날 계산
            last_day = monthrange(today.year, today.month - 1)[1]
            end_date = date(today.year, today.month - 1, last_day)
    else:  # month (이번 달)
        # 이번 달의 1일
        start_date = date(today.year, today.month, 1)
        end_date = today
    
    stats = TodoService.get_detailed_stats(
        db=db,
        elderly_id=target_elderly_id,
        start_date=start_date,
        end_date=end_date,
        shared_only=shared_only
    )
    
    return stats


@router.get("/stats", response_model=TodoStatsResponse)
async def get_todo_stats(
    elderly_id: Optional[str] = Query(None, description="어르신 ID (보호자용)"),
    period: str = Query("week", description="week, month"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    TODO 통계 조회
    
    - **period**: week (7일), month (30일)
    - **보호자**: 공유된 TODO만 통계에 포함 (shared_only=True 자동 적용)
    - **어르신**: 본인의 모든 TODO 통계 (shared_only=False)
    """
    # 어르신인 경우 본인 ID 사용
    if current_user.role == UserRole.ELDERLY:
        target_elderly_id = current_user.user_id
        shared_only = False  # 어르신은 모든 할일 볼 수 있음
    else:
        if not elderly_id:
            from fastapi import HTTPException, status
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="보호자는 elderly_id를 지정해야 합니다."
            )
        target_elderly_id = elderly_id
        shared_only = True  # 보호자는 공유된 할일만 볼 수 있음
    
    # 기간 계산
    today = date.today()
    if period == "week":
        # 이번 주의 일요일 계산 (일요일 = 6)
        days_since_sunday = (today.weekday() + 1) % 7  # 0=월요일 -> 1, 6=일요일 -> 0
        if days_since_sunday == 0:
            # 오늘이 일요일이면 이번 주 시작
            start_date = today
        else:
            # 가장 가까운 일요일 찾기
            start_date = today - timedelta(days=days_since_sunday)
    else:  # month
        # 이번 달의 1일
        start_date = date(today.year, today.month, 1)
    
    stats = TodoService.get_todo_stats(
        db=db,
        elderly_id=target_elderly_id,
        start_date=start_date,
        end_date=today,
        shared_only=shared_only
    )
    
    return stats


@router.get("/{todo_id}", response_model=TodoResponse)
async def get_todo_by_id(
    todo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    TODO 상세 조회
    
    - **어르신**: 본인의 TODO만 조회 가능
    - **보호자**: 공유된 TODO만 조회 가능
    """
    todo = TodoService.get_todo_by_id(
        db=db,
        todo_id=todo_id,
        user_id=current_user.user_id,
        user_role=current_user.role
    )
    
    return todo


@router.post("/", response_model=TodoResponse)
async def create_todo(
    todo_data: TodoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    TODO 생성 (보호자 전용)
    
    - **elderly_id**: 담당 어르신 ID
    - **title**: 제목
    - **description**: 설명
    - **category**: medicine, exercise, meal, hospital, other
    - **due_date**: 날짜
    - **due_time**: 시간
    - **is_recurring**: 반복 여부
    - **recurring_type**: daily, weekly, monthly
    """
    import logging
    from app.services.notification_service import NotificationService
    logger = logging.getLogger(__name__)
    
    logger.info(f"📥 TODO 생성 요청 - 사용자: {current_user.user_id}, 역할: {current_user.role}")
    logger.info(f"📥 TODO 데이터: {todo_data.dict()}")
    
    try:
        todo = TodoService.create_todo(
            db=db,
            todo_data=todo_data,
            creator_id=current_user.user_id
        )
        
        logger.info(f"✅ TODO 생성 성공 - ID: {todo.todo_id}, Creator Type: {todo.creator_type}")
        
        # 🔔 새 TODO 생성 알림 전송 (비동기)
        try:
            from app.models.todo import CreatorType
            
            if todo.creator_type == CreatorType.ELDERLY:
                # 어르신이 직접 생성한 경우: 연결된 보호자들에게 알림
                await NotificationService.notify_todo_created_by_elderly(
                    db=db,
                    elderly_id=todo_data.elderly_id,
                    todo_title=todo_data.title,
                    todo_id=todo.todo_id,
                    elderly_name=current_user.name
                )
                logger.info(f"📤 어르신이 생성한 TODO 알림을 보호자들에게 전송 완료")
            else:
                # 보호자가 생성한 경우: 어르신에게 알림
                await NotificationService.notify_todo_created(
                    db=db,
                    user_id=todo_data.elderly_id,
                    todo_title=todo_data.title,
                    todo_id=todo.todo_id,
                    creator_name=current_user.name
                )
                logger.info(f"📤 보호자가 생성한 TODO 알림을 어르신에게 전송 완료")
        except Exception as notify_error:
            logger.error(f"⚠️ TODO 생성 알림 전송 실패 (TODO는 생성됨): {str(notify_error)}")
        
        return todo
        
    except Exception as e:
        logger.error(f"❌ TODO 생성 실패: {str(e)}")
        logger.error(f"❌ 에러 타입: {type(e).__name__}")
        raise


@router.put("/{todo_id}", response_model=TodoResponse)
async def update_todo(
    todo_id: str,
    todo_data: TodoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    TODO 수정 (보호자 전용)
    
    - 완료된 TODO는 수정 불가
    """
    todo = TodoService.update_todo(
        db=db,
        todo_id=todo_id,
        todo_update=todo_data,
        user_id=current_user.user_id
    )
    
    return todo


@router.patch("/{todo_id}/complete", response_model=TodoResponse)
async def complete_todo(
    todo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    TODO 완료 처리 (어르신 전용)
    """
    todo = TodoService.complete_todo(
        db=db,
        todo_id=todo_id,
        user_id=current_user.user_id
    )
    
    return todo


@router.patch("/{todo_id}/cancel", response_model=TodoResponse)
async def cancel_todo(
    todo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    TODO 완료 취소 (어르신 전용)
    
    - 완료 상태를 다시 대기 상태로 변경
    """
    todo = TodoService.cancel_todo(
        db=db,
        todo_id=todo_id,
        user_id=current_user.user_id
    )
    
    return todo


@router.delete("/{todo_id}")
async def delete_todo(
    todo_id: str,
    delete_future: bool = Query(False, description="이후 반복 일정도 삭제"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    TODO 삭제 (보호자 전용)
    
    - **delete_future**: false (오늘 것만), true (이후 모든 반복 일정)
    """
    result = TodoService.delete_todo(
        db=db,
        todo_id=todo_id,
        user_id=current_user.user_id,
        delete_future=delete_future
    )
    
    return result

