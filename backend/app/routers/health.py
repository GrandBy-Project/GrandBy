"""
건강 데이터 관리 API 라우터
걸음 수, 거리 등 건강 데이터 CRUD
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date, datetime, timedelta
from app.database import get_db
from app.schemas.health import (
    HealthDataCreate,
    HealthDataUpdate,
    HealthDataResponse,
    HealthDataStatsResponse,
    HealthDataRangeResponse
)
from app.services.health.health_service import HealthService
from app.models.user import User

# get_current_user import
import sys
sys.path.append('..')
from app.routers.auth import get_current_user

router = APIRouter()


@router.post("/", response_model=HealthDataResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_health_data(
    health_data: HealthDataCreate,
    target_date: Optional[date] = Query(None, description="대상 날짜 (기본값: 오늘)"),
    elderly_id: Optional[str] = Query(None, description="어르신 ID (보호자용)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    건강 데이터 생성 또는 업데이트 (오늘 또는 특정 날짜)
    - 어르신: 본인 데이터만 생성 가능
    - 보호자: 연결된 어르신의 데이터 생성 가능
    """
    # 대상 사용자 결정
    target_user_id = elderly_id if elderly_id else current_user.user_id
    
    # 접근 권한 확인
    if not HealthService.verify_user_access(db, current_user, target_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 사용자의 건강 데이터에 접근할 권한이 없습니다."
        )
    
    # 날짜 설정 (기본값: 오늘)
    if target_date is None:
        target_date = date.today()
    
    # 데이터 생성 또는 업데이트
    result = HealthService.create_or_update_health_data(
        db=db,
        user_id=target_user_id,
        target_date=target_date,
        health_data=health_data
    )
    
    return result


@router.get("/", response_model=Optional[HealthDataResponse])
async def get_health_data(
    target_date: Optional[date] = Query(None, description="조회할 날짜 (기본값: 오늘)"),
    elderly_id: Optional[str] = Query(None, description="어르신 ID (보호자용)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    건강 데이터 조회 (오늘 또는 특정 날짜)
    - 어르신: 본인 데이터만 조회 가능
    - 보호자: 연결된 어르신의 데이터 조회 가능
    """
    # 대상 사용자 결정
    target_user_id = elderly_id if elderly_id else current_user.user_id
    
    # 접근 권한 확인
    if not HealthService.verify_user_access(db, current_user, target_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 사용자의 건강 데이터에 접근할 권한이 없습니다."
        )
    
    # 날짜 설정 (기본값: 오늘)
    if target_date is None:
        target_date = date.today()
    
    # 데이터 조회
    health_data = HealthService.get_health_data_by_date(
        db=db,
        user_id=target_user_id,
        target_date=target_date
    )
    
    return health_data


@router.get("/range", response_model=HealthDataRangeResponse)
async def get_health_data_range(
    start_date: date = Query(..., description="시작 날짜"),
    end_date: date = Query(..., description="종료 날짜"),
    elderly_id: Optional[str] = Query(None, description="어르신 ID (보호자용)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    기간별 건강 데이터 조회 및 통계
    - 어르신: 본인 데이터만 조회 가능
    - 보호자: 연결된 어르신의 데이터 조회 가능
    """
    # 날짜 유효성 검사
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="시작 날짜가 종료 날짜보다 늦을 수 없습니다."
        )
    
    # 기간 제한 (최대 1년)
    if (end_date - start_date).days > 365:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="조회 기간은 최대 1년입니다."
        )
    
    # 대상 사용자 결정
    target_user_id = elderly_id if elderly_id else current_user.user_id
    
    # 접근 권한 확인
    if not HealthService.verify_user_access(db, current_user, target_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 사용자의 건강 데이터에 접근할 권한이 없습니다."
        )
    
    # 데이터 조회
    result = HealthService.get_health_data_range(
        db=db,
        user_id=target_user_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return result


@router.get("/today", response_model=Optional[HealthDataResponse])
async def get_today_health_data(
    elderly_id: Optional[str] = Query(None, description="어르신 ID (보호자용)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    오늘의 건강 데이터 조회
    - 어르신: 본인 데이터만 조회 가능
    - 보호자: 연결된 어르신의 데이터 조회 가능
    """
    # 대상 사용자 결정
    target_user_id = elderly_id if elderly_id else current_user.user_id
    
    # 접근 권한 확인
    if not HealthService.verify_user_access(db, current_user, target_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 사용자의 건강 데이터에 접근할 권한이 없습니다."
        )
    
    # 데이터 조회
    health_data = HealthService.get_today_health_data(
        db=db,
        user_id=target_user_id
    )
    
    return health_data


@router.put("/", response_model=HealthDataResponse)
async def update_health_data(
    health_data: HealthDataUpdate,
    target_date: Optional[date] = Query(None, description="대상 날짜 (기본값: 오늘)"),
    elderly_id: Optional[str] = Query(None, description="어르신 ID (보호자용)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    건강 데이터 업데이트 (부분 업데이트)
    - 어르신: 본인 데이터만 업데이트 가능
    - 보호자: 연결된 어르신의 데이터 업데이트 가능
    """
    # 대상 사용자 결정
    target_user_id = elderly_id if elderly_id else current_user.user_id
    
    # 접근 권한 확인
    if not HealthService.verify_user_access(db, current_user, target_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="해당 사용자의 건강 데이터에 접근할 권한이 없습니다."
        )
    
    # 날짜 설정 (기본값: 오늘)
    if target_date is None:
        target_date = date.today()
    
    # 기존 데이터 조회
    existing = HealthService.get_health_data_by_date(
        db=db,
        user_id=target_user_id,
        target_date=target_date
    )
    
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 날짜의 건강 데이터를 찾을 수 없습니다."
        )
    
    # 업데이트
    if health_data.step_count is not None:
        existing.step_count = health_data.step_count
    if health_data.distance is not None:
        existing.distance = health_data.distance
    existing.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(existing)
    
    return existing

