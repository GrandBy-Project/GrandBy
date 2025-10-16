"""
사용자 관리 API 라우터
사용자 연결, 프로필 등
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List
from datetime import datetime, timedelta
import uuid

from app.database import get_db
from app.schemas.user import (
    ConnectionCreate, ConnectionResponse, UserResponse,
    ElderlySearchResult, ConnectionListResponse, ConnectionWithUserInfo,
    ConnectionCancelRequest
)
from app.models.user import User, UserConnection, UserRole, ConnectionStatus
from app.models.notification import Notification, NotificationType
from app.routers.auth import get_current_user

router = APIRouter()


# ==================== 어르신 검색 ====================
@router.get("/search", response_model=List[ElderlySearchResult])
async def search_elderly(
    query: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    어르신 검색 (이메일 또는 전화번호)
    
    - **query**: 이메일 또는 전화번호
    - 보호자만 사용 가능
    - 본인은 제외
    - elderly role만 검색
    """
    # 보호자만 검색 가능
    if current_user.role != UserRole.CAREGIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="보호자만 어르신을 검색할 수 있습니다."
        )
    
    # 쿼리 정제
    query = query.strip()
    
    # 이메일 또는 전화번호로 검색
    elderly_users = db.query(User).filter(
        and_(
            User.role == UserRole.ELDERLY,
            User.user_id != current_user.user_id,  # 본인 제외
            or_(
                User.email.ilike(f"%{query}%"),
                User.phone_number.ilike(f"%{query}%")
            )
        )
    ).limit(10).all()
    
    # 각 사용자에 대해 연결 상태 확인
    results = []
    for elderly in elderly_users:
        # 기존 연결 확인
        existing_connection = db.query(UserConnection).filter(
            and_(
                UserConnection.caregiver_id == current_user.user_id,
                UserConnection.elderly_id == elderly.user_id
            )
        ).first()
        
        results.append(ElderlySearchResult(
            user_id=elderly.user_id,
            name=elderly.name,
            email=elderly.email,
            phone_number=elderly.phone_number,
            is_already_connected=existing_connection is not None,
            connection_status=existing_connection.status if existing_connection else None
        ))
    
    return results


# ==================== 연결 요청 생성 ====================
@router.post("/connections", response_model=ConnectionResponse, status_code=status.HTTP_201_CREATED)
async def create_connection(
    connection_data: ConnectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    연결 요청 생성
    
    - **elderly_phone_or_email**: 어르신의 이메일 또는 전화번호
    - 보호자만 실행 가능
    - 중복 요청 방지
    - 어르신에게 알림 생성
    """
    # 보호자만 요청 가능
    if current_user.role != UserRole.CAREGIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="보호자만 연결 요청을 보낼 수 있습니다."
        )
    
    # 어르신 찾기
    query = connection_data.elderly_phone_or_email.strip()
    elderly = db.query(User).filter(
        and_(
            User.role == UserRole.ELDERLY,
            or_(
                User.email == query,
                User.phone_number == query
            )
        )
    ).first()
    
    if not elderly:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 정보로 등록된 어르신을 찾을 수 없습니다."
        )
    
    # 본인에게 요청하는 경우 방지
    if elderly.user_id == current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="본인에게는 연결 요청을 보낼 수 없습니다."
        )
    
    # 기존 연결 확인
    existing_connection = db.query(UserConnection).filter(
        and_(
            UserConnection.caregiver_id == current_user.user_id,
            UserConnection.elderly_id == elderly.user_id
        )
    ).first()
    
    if existing_connection:
        # 이미 활성 연결
        if existing_connection.status == ConnectionStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 연결된 어르신입니다."
            )
        
        # 대기 중인 요청
        if existing_connection.status == ConnectionStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 연결 요청을 보냈습니다. 어르신의 수락을 기다려주세요."
            )
        
        # 거절된 경우 - 24시간 후 재요청 가능
        if existing_connection.status == ConnectionStatus.REJECTED:
            time_since_rejection = datetime.utcnow() - existing_connection.updated_at
            if time_since_rejection < timedelta(hours=24):
                remaining_hours = 24 - int(time_since_rejection.total_seconds() / 3600)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"거절 후 24시간이 지나야 재요청 가능합니다. (약 {remaining_hours}시간 후)"
                )
            
            # 24시간 지났으면 기존 연결을 PENDING으로 변경
            existing_connection.status = ConnectionStatus.PENDING
            existing_connection.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing_connection)
            
            # 알림 생성
            notification = Notification(
                notification_id=str(uuid.uuid4()),
                user_id=elderly.user_id,
                type=NotificationType.CONNECTION_REQUEST,
                title="새로운 연결 요청",
                message=f"{current_user.name}님이 다시 연결을 요청했습니다.",
                related_id=existing_connection.connection_id,
                is_read=False,
                is_pushed=False
            )
            db.add(notification)
            db.commit()
            
            return ConnectionResponse.from_orm(existing_connection)
    
    # 새 연결 요청 생성
    new_connection = UserConnection(
        connection_id=str(uuid.uuid4()),
        caregiver_id=current_user.user_id,
        elderly_id=elderly.user_id,
        status=ConnectionStatus.PENDING
    )
    db.add(new_connection)
    db.flush()
    
    # 어르신에게 알림 생성
    notification = Notification(
        notification_id=str(uuid.uuid4()),
        user_id=elderly.user_id,
        type=NotificationType.CONNECTION_REQUEST,
        title="새로운 연결 요청",
        message=f"{current_user.name}님({current_user.email})이 보호자 연결을 요청했습니다.",
        related_id=new_connection.connection_id,
        is_read=False,
        is_pushed=False
    )
    db.add(notification)
    
    db.commit()
    db.refresh(new_connection)
    
    return ConnectionResponse.from_orm(new_connection)


# ==================== 연결 목록 조회 ====================
@router.get("/connections", response_model=ConnectionListResponse)
async def get_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    내 연결 목록 조회
    
    - 보호자: 내가 요청한 연결들 (caregiver_connections)
    - 어르신: 나에게 온 연결 요청들 (elderly_connections)
    """
    active_list = []
    pending_list = []
    rejected_list = []
    
    if current_user.role == UserRole.CAREGIVER:
        # 보호자: 내가 보낸 연결 요청들
        connections = db.query(UserConnection).filter(
            UserConnection.caregiver_id == current_user.user_id
        ).all()
        
        for conn in connections:
            elderly = db.query(User).filter(User.user_id == conn.elderly_id).first()
            if not elderly:
                continue
            
            conn_info = ConnectionWithUserInfo(
                connection_id=conn.connection_id,
                status=conn.status,
                created_at=conn.created_at,
                updated_at=conn.updated_at,
                user_id=elderly.user_id,
                name=elderly.name,
                email=elderly.email,
                phone_number=elderly.phone_number
            )
            
            if conn.status == ConnectionStatus.ACTIVE:
                active_list.append(conn_info)
            elif conn.status == ConnectionStatus.PENDING:
                pending_list.append(conn_info)
            elif conn.status == ConnectionStatus.REJECTED:
                rejected_list.append(conn_info)
    
    elif current_user.role == UserRole.ELDERLY:
        # 어르신: 나에게 온 연결 요청들
        connections = db.query(UserConnection).filter(
            UserConnection.elderly_id == current_user.user_id
        ).all()
        
        for conn in connections:
            caregiver = db.query(User).filter(User.user_id == conn.caregiver_id).first()
            if not caregiver:
                continue
            
            conn_info = ConnectionWithUserInfo(
                connection_id=conn.connection_id,
                status=conn.status,
                created_at=conn.created_at,
                updated_at=conn.updated_at,
                user_id=caregiver.user_id,
                name=caregiver.name,
                email=caregiver.email,
                phone_number=caregiver.phone_number
            )
            
            if conn.status == ConnectionStatus.ACTIVE:
                active_list.append(conn_info)
            elif conn.status == ConnectionStatus.PENDING:
                pending_list.append(conn_info)
            elif conn.status == ConnectionStatus.REJECTED:
                rejected_list.append(conn_info)
    
    return ConnectionListResponse(
        active=active_list,
        pending=pending_list,
        rejected=rejected_list
    )


# ==================== 연결 수락 ====================
@router.patch("/connections/{connection_id}/accept", response_model=ConnectionResponse)
async def accept_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    연결 수락
    
    - 어르신만 실행 가능
    - PENDING → ACTIVE 변경
    - 보호자에게 알림 생성
    """
    # 어르신만 수락 가능
    if current_user.role != UserRole.ELDERLY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="어르신만 연결 요청을 수락할 수 있습니다."
        )
    
    # 연결 요청 찾기
    connection = db.query(UserConnection).filter(
        UserConnection.connection_id == connection_id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="연결 요청을 찾을 수 없습니다."
        )
    
    # 본인에게 온 요청인지 확인
    if connection.elderly_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인에게 온 요청만 수락할 수 있습니다."
        )
    
    # 이미 수락된 경우
    if connection.status == ConnectionStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 수락된 연결입니다."
        )
    
    # PENDING이 아닌 경우
    if connection.status != ConnectionStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="수락 대기 중인 요청이 아닙니다."
        )
    
    # 연결 수락
    connection.status = ConnectionStatus.ACTIVE
    connection.updated_at = datetime.utcnow()
    
    # 보호자에게 알림 생성
    caregiver = db.query(User).filter(User.user_id == connection.caregiver_id).first()
    if caregiver:
        notification = Notification(
            notification_id=str(uuid.uuid4()),
            user_id=caregiver.user_id,
            type=NotificationType.CONNECTION_ACCEPTED,
            title="연결 수락됨",
            message=f"{current_user.name}님이 연결 요청을 수락했습니다.",
            related_id=connection.connection_id,
            is_read=False,
            is_pushed=False
        )
        db.add(notification)
    
    db.commit()
    db.refresh(connection)
    
    return ConnectionResponse.from_orm(connection)


# ==================== 연결 거절 ====================
@router.patch("/connections/{connection_id}/reject", response_model=ConnectionResponse)
async def reject_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    연결 거절
    
    - 어르신만 실행 가능
    - PENDING → REJECTED 변경
    """
    # 어르신만 거절 가능
    if current_user.role != UserRole.ELDERLY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="어르신만 연결 요청을 거절할 수 있습니다."
        )
    
    # 연결 요청 찾기
    connection = db.query(UserConnection).filter(
        UserConnection.connection_id == connection_id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="연결 요청을 찾을 수 없습니다."
        )
    
    # 본인에게 온 요청인지 확인
    if connection.elderly_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인에게 온 요청만 거절할 수 있습니다."
        )
    
    # PENDING이 아닌 경우
    if connection.status != ConnectionStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="수락 대기 중인 요청이 아닙니다."
        )
    
    # 연결 거절
    connection.status = ConnectionStatus.REJECTED
    connection.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(connection)
    
    return ConnectionResponse.from_orm(connection)


# ==================== 연결 취소 (보호자) ====================
@router.delete("/connections/{connection_id}/cancel")
async def cancel_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    연결 요청 취소
    
    - 보호자만 실행 가능
    - PENDING 상태에서만 취소 가능
    - 연결을 DB에서 삭제
    """
    # 연결 찾기
    connection = db.query(UserConnection).filter(
        UserConnection.connection_id == connection_id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="연결을 찾을 수 없습니다."
        )
    
    # 보호자 본인의 요청인지 확인
    if connection.caregiver_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인이 보낸 요청만 취소할 수 있습니다."
        )
    
    # PENDING 상태에서만 취소 가능
    if connection.status != ConnectionStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="대기 중인 요청만 취소할 수 있습니다."
        )
    
    # 연결 요청 삭제
    db.delete(connection)
    
    # 관련 알림도 삭제 (선택사항)
    db.query(Notification).filter(
        Notification.related_id == connection_id
    ).delete()
    
    db.commit()
    
    return {"message": "연결 요청이 취소되었습니다."}


# ==================== 연결 해제 ====================
@router.delete("/connections/{connection_id}")
async def delete_connection(
    connection_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    연결 해제
    
    - 보호자 또는 어르신 모두 실행 가능
    - ACTIVE 상태에서만 해제 가능
    - 연결을 DB에서 삭제
    """
    # 연결 찾기
    connection = db.query(UserConnection).filter(
        UserConnection.connection_id == connection_id
    ).first()
    
    if not connection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="연결을 찾을 수 없습니다."
        )
    
    # 권한 확인 (보호자 또는 어르신 본인)
    if connection.caregiver_id != current_user.user_id and connection.elderly_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인의 연결만 해제할 수 있습니다."
        )
    
    # ACTIVE 상태에서만 해제 가능
    if connection.status != ConnectionStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="활성 연결만 해제할 수 있습니다."
        )
    
    # 연결 해제
    db.delete(connection)
    db.commit()
    
    return {"message": "연결이 해제되었습니다."}


# ==================== 연결된 어르신 목록 (보호자용) ====================
@router.get("/connected-elderly", response_model=List[UserResponse])
async def get_connected_elderly(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    연결된 어르신 목록 조회
    
    - 보호자만 사용 가능
    - ACTIVE 상태인 연결만 반환
    - Todo, Diary 등에서 어르신 선택 시 사용
    """
    # 보호자만 조회 가능
    if current_user.role != UserRole.CAREGIVER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="보호자만 연결된 어르신 목록을 조회할 수 있습니다."
        )
    
    # 활성 연결 조회
    connections = db.query(UserConnection).filter(
        and_(
            UserConnection.caregiver_id == current_user.user_id,
            UserConnection.status == ConnectionStatus.ACTIVE
        )
    ).all()
    
    # 어르신 정보 수집
    elderly_list = []
    for conn in connections:
        elderly = db.query(User).filter(User.user_id == conn.elderly_id).first()
        if elderly:
            elderly_list.append(UserResponse.from_orm(elderly))
    
    return elderly_list

