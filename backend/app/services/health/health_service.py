"""
건강 데이터 서비스 로직
걸음 수, 거리 등 건강 데이터 관리
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import date, datetime, timedelta
from typing import List, Optional
import uuid

from app.models.health import HealthData
from app.models.user import User, UserRole
from app.schemas.health import (
    HealthDataCreate,
    HealthDataUpdate,
    HealthDataResponse,
    HealthDataStatsResponse,
    HealthDataRangeResponse
)
from fastapi import HTTPException, status


class HealthService:
    """건강 데이터 비즈니스 로직"""
    
    @staticmethod
    def create_or_update_health_data(
        db: Session,
        user_id: str,
        target_date: date,
        health_data: HealthDataCreate
    ) -> HealthData:
        """
        건강 데이터 생성 또는 업데이트 (날짜별로 하나만 존재)
        
        Args:
            db: DB 세션
            user_id: 사용자 ID
            target_date: 대상 날짜
            health_data: 건강 데이터
        
        Returns:
            생성 또는 업데이트된 건강 데이터
        """
        # 기존 데이터 확인
        existing = db.query(HealthData).filter(
            and_(
                HealthData.user_id == user_id,
                HealthData.date == target_date
            )
        ).first()
        
        if existing:
            # 업데이트
            if health_data.step_count is not None:
                existing.step_count = health_data.step_count
            if health_data.distance is not None:
                existing.distance = health_data.distance
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing
        else:
            # 생성
            new_health_data = HealthData(
                health_id=str(uuid.uuid4()),
                user_id=user_id,
                date=target_date,
                step_count=health_data.step_count,
                distance=health_data.distance,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(new_health_data)
            db.commit()
            db.refresh(new_health_data)
            return new_health_data
    
    @staticmethod
    def get_health_data_by_date(
        db: Session,
        user_id: str,
        target_date: date
    ) -> Optional[HealthData]:
        """
        특정 날짜의 건강 데이터 조회
        
        Args:
            db: DB 세션
            user_id: 사용자 ID
            target_date: 대상 날짜
        
        Returns:
            건강 데이터 또는 None
        """
        return db.query(HealthData).filter(
            and_(
                HealthData.user_id == user_id,
                HealthData.date == target_date
            )
        ).first()
    
    @staticmethod
    def get_health_data_range(
        db: Session,
        user_id: str,
        start_date: date,
        end_date: date
    ) -> HealthDataRangeResponse:
        """
        기간별 건강 데이터 조회 및 통계
        
        Args:
            db: DB 세션
            user_id: 사용자 ID
            start_date: 시작 날짜
            end_date: 종료 날짜
        
        Returns:
            기간별 건강 데이터 및 통계
        """
        # 기간 내 모든 데이터 조회
        health_data_list = db.query(HealthData).filter(
            and_(
                HealthData.user_id == user_id,
                HealthData.date >= start_date,
                HealthData.date <= end_date
            )
        ).order_by(HealthData.date.asc()).all()
        
        # 일별 데이터
        daily_data = [
            HealthDataStatsResponse(
                date=data.date,
                step_count=data.step_count,
                distance=data.distance
            )
            for data in health_data_list
        ]
        
        # 통계 계산
        total_steps = sum(data.step_count for data in health_data_list)
        total_distance = sum(data.distance for data in health_data_list)
        day_count = len(health_data_list) if health_data_list else 1
        
        return HealthDataRangeResponse(
            start_date=start_date,
            end_date=end_date,
            total_steps=total_steps,
            total_distance=total_distance,
            average_steps=round(total_steps / day_count, 1),
            average_distance=round(total_distance / day_count, 2),
            daily_data=daily_data
        )
    
    @staticmethod
    def get_today_health_data(
        db: Session,
        user_id: str
    ) -> Optional[HealthData]:
        """
        오늘의 건강 데이터 조회
        
        Args:
            db: DB 세션
            user_id: 사용자 ID
        
        Returns:
            오늘의 건강 데이터 또는 None
        """
        today = date.today()
        return HealthService.get_health_data_by_date(db, user_id, today)
    
    @staticmethod
    def verify_user_access(
        db: Session,
        current_user: User,
        target_user_id: str
    ) -> bool:
        """
        사용자가 대상 사용자의 건강 데이터에 접근할 수 있는지 확인
        
        Args:
            db: DB 세션
            current_user: 현재 사용자
            target_user_id: 대상 사용자 ID
        
        Returns:
            접근 가능 여부
        """
        # 본인 데이터는 항상 접근 가능
        if current_user.user_id == target_user_id:
            return True
        
        # 보호자는 연결된 어르신의 데이터만 접근 가능
        if current_user.role == UserRole.CAREGIVER:
            from app.models.user import UserConnection, ConnectionStatus
            connection = db.query(UserConnection).filter(
                and_(
                    UserConnection.caregiver_id == current_user.user_id,
                    UserConnection.elderly_id == target_user_id,
                    UserConnection.status == ConnectionStatus.ACTIVE
                )
            ).first()
            return connection is not None
        
        return False

