"""
사용자 관리 API 라우터
사용자 연결, 프로필, 자동 통화 스케줄 등
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.schemas.user import (
    ConnectionCreate,
    ConnectionResponse,
    UserResponse,
    CallScheduleUpdate,
    CallScheduleResponse
)
from app.models.user import User, UserSettings
from app.routers.auth import get_current_user
import re
import uuid
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/connections", response_model=List[ConnectionResponse])
async def get_connections(db: Session = Depends(get_db)):
    """
    연결된 사용자 목록 조회
    TODO: 현재 사용자의 연결 목록 반환
    """
    # TODO: 인증 미들웨어 구현 후 current_user 가져오기
    return []


@router.post("/connections", response_model=ConnectionResponse)
async def create_connection(connection_data: ConnectionCreate, db: Session = Depends(get_db)):
    """
    연결 요청 생성
    TODO: 보호자가 어르신에게 연결 요청
    """
    # TODO: 구현 필요
    raise HTTPException(status_code=501, detail="Not Implemented")


@router.patch("/connections/{connection_id}/accept")
async def accept_connection(connection_id: str, db: Session = Depends(get_db)):
    """
    연결 수락
    TODO: 어르신이 보호자 연결 요청 수락
    """
    # TODO: 구현 필요
    raise HTTPException(status_code=501, detail="Not Implemented")


@router.delete("/connections/{connection_id}")
async def delete_connection(connection_id: str, db: Session = Depends(get_db)):
    """
    연결 해제
    TODO: 연결 삭제
    """
    # TODO: 구현 필요
    raise HTTPException(status_code=501, detail="Not Implemented")


# ==================== 자동 통화 스케줄 설정 ====================

@router.get("/me/call-schedule", response_model=CallScheduleResponse)
async def get_call_schedule(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    현재 사용자의 자동 통화 스케줄 설정 조회
    
    Returns:
        CallScheduleResponse: 자동 통화 활성화 여부 및 예약 시간
    """
    try:
        # 사용자 설정 조회 또는 생성
        settings = db.query(UserSettings).filter(
            UserSettings.user_id == current_user.user_id
        ).first()
        
        if not settings:
            # 설정이 없으면 기본값으로 생성
            settings = UserSettings(
                setting_id=str(uuid.uuid4()),
                user_id=current_user.user_id,
                auto_call_enabled=False,
                scheduled_call_time=None
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
        
        return CallScheduleResponse(
            auto_call_enabled=settings.auto_call_enabled,
            scheduled_call_time=settings.scheduled_call_time
        )
        
    except Exception as e:
        logger.error(f"❌ 자동 통화 스케줄 조회 실패: {e}")
        raise HTTPException(status_code=500, detail="설정을 불러오는 중 오류가 발생했습니다.")


@router.put("/me/call-schedule", response_model=CallScheduleResponse)
async def update_call_schedule(
    schedule_data: CallScheduleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    현재 사용자의 자동 통화 스케줄 설정 업데이트
    
    Args:
        schedule_data: 자동 통화 활성화 여부 및 예약 시간 (HH:MM 형식)
    
    Returns:
        CallScheduleResponse: 업데이트된 설정
    """
    try:
        # 시간 형식 검증 (HH:MM)
        if schedule_data.auto_call_enabled and schedule_data.scheduled_call_time:
            time_pattern = re.compile(r'^([01]\d|2[0-3]):([0-5]\d)$')
            if not time_pattern.match(schedule_data.scheduled_call_time):
                raise HTTPException(
                    status_code=400,
                    detail="시간 형식이 올바르지 않습니다. HH:MM 형식으로 입력해주세요. (예: 14:30)"
                )
        
        # 자동 통화를 활성화하는데 시간이 없으면 에러
        if schedule_data.auto_call_enabled and not schedule_data.scheduled_call_time:
            raise HTTPException(
                status_code=400,
                detail="자동 통화를 활성화하려면 통화 시간을 설정해야 합니다."
            )
        
        # 사용자 설정 조회 또는 생성
        settings = db.query(UserSettings).filter(
            UserSettings.user_id == current_user.user_id
        ).first()
        
        if not settings:
            settings = UserSettings(
                setting_id=str(uuid.uuid4()),
                user_id=current_user.user_id
            )
            db.add(settings)
        
        # 설정 업데이트
        settings.auto_call_enabled = schedule_data.auto_call_enabled
        settings.scheduled_call_time = schedule_data.scheduled_call_time
        
        db.commit()
        db.refresh(settings)
        
        logger.info(f"✅ 자동 통화 스케줄 업데이트 완료: {current_user.user_id} - {schedule_data.scheduled_call_time} (활성화: {schedule_data.auto_call_enabled})")
        
        return CallScheduleResponse(
            auto_call_enabled=settings.auto_call_enabled,
            scheduled_call_time=settings.scheduled_call_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ 자동 통화 스케줄 업데이트 실패: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="설정을 저장하는 중 오류가 발생했습니다.")

