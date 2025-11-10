"""
TODO 서비스 로직
보호자가 어르신에게 TODO 할당 및 관리
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict
import uuid
import logging
from app.utils.datetime_utils import kst_now

from app.models.todo import Todo, TodoStatus, CreatorType, RecurringType
from app.models.user import User, UserRole, UserConnection, ConnectionStatus
from app.schemas.todo import (
    TodoCreate, 
    TodoUpdate, 
    TodoResponse, 
    TodoStatsResponse,
    TodoDetailedStatsResponse,
    CategoryStatsResponse
)
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


class TodoService:
    """TODO 비즈니스 로직"""
    
    @staticmethod
    def create_todo(
        db: Session,
        todo_data: TodoCreate,
        creator_id: str
    ) -> Todo:
        """
        TODO 생성 (보호자가 어르신에게 할당)
        
        Args:
            db: DB 세션
            todo_data: TODO 생성 데이터
            creator_id: 생성자 ID (보호자)
        
        Returns:
            생성된 TODO
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"🔍 TODO 생성 시작 - Creator ID: {creator_id}")
        logger.info(f"🔍 TODO 데이터: {todo_data.dict()}")
        
        # 생성자 확인
        creator = db.query(User).filter(User.user_id == creator_id).first()
        logger.info(f"🔍 생성자 조회 결과: {creator}")
        
        if not creator:
            logger.error(f"❌ 생성자 없음: {creator_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="생성자를 찾을 수 없습니다."
            )
        
        # 어르신 확인
        elderly = db.query(User).filter(User.user_id == todo_data.elderly_id).first()
        logger.info(f"🔍 어르신 조회 결과: {elderly}")
        
        if not elderly:
            logger.error(f"❌ 어르신 없음: {todo_data.elderly_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="해당 어르신을 찾을 수 없습니다."
            )
            
        if elderly.role != UserRole.ELDERLY:
            logger.error(f"❌ 어르신 역할 아님: {elderly.role}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="해당 어르신을 찾을 수 없습니다."
            )
        
        # 권한 및 creator_type 결정
        if creator.role == UserRole.CAREGIVER:
            # 보호자는 어르신에게 TODO 할당 가능 (연결 확인 필요)
            connection = db.query(UserConnection).filter(
                and_(
                    UserConnection.caregiver_id == creator_id,
                    UserConnection.elderly_id == todo_data.elderly_id,
                    UserConnection.status == ConnectionStatus.ACTIVE
                )
            ).first()
            
            if not connection:
                logger.error(f"❌ 연결되지 않은 어르신: {todo_data.elderly_id}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="해당 어르신과 연결되어 있지 않습니다."
                )
            
            creator_type_value = CreatorType.CAREGIVER
            logger.info(f"✅ 보호자가 TODO 생성 (연결 확인 완료)")
        elif creator.role == UserRole.ELDERLY and creator.user_id == todo_data.elderly_id:
            # 어르신은 본인 일정만 생성 가능
            creator_type_value = CreatorType.ELDERLY
            logger.info(f"✅ 어르신이 본인 일정 생성")
        else:
            logger.error(f"❌ 권한 없음: {creator.role}, 대상: {todo_data.elderly_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="권한이 없습니다."
            )
        
        # due_time 문자열을 time 객체로 변환
        due_time_obj = None
        if todo_data.due_time:
            try:
                from datetime import time
                due_time_obj = time.fromisoformat(todo_data.due_time)
                logger.info(f"🔍 시간 변환 성공: {todo_data.due_time} -> {due_time_obj}")
            except ValueError as e:
                logger.error(f"❌ 시간 변환 실패: {todo_data.due_time} - {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"잘못된 시간 형식입니다: {todo_data.due_time}"
                )
        
        # 과거 날짜 검증
        today = date.today()
        if todo_data.due_date < today:
            logger.error(f"❌ 과거 날짜로 할일 생성 시도: {todo_data.due_date} (오늘: {today})")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="과거 날짜로는 할일을 생성할 수 없습니다. 오늘 또는 미래 날짜를 선택해주세요."
            )
        
        logger.info(f"✅ 날짜 검증 통과: {todo_data.due_date} (오늘: {today})")
        
        # 데이터 일관성 검증
        # 반복 일정인 경우 필요한 필드 검증
        if todo_data.is_recurring:
            if not todo_data.recurring_type:
                logger.error(f"❌ 반복 일정인데 recurring_type이 없음")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="반복 일정인 경우 반복 유형을 지정해야 합니다."
                )
            
            if todo_data.recurring_type == RecurringType.WEEKLY:
                if not todo_data.recurring_days or len(todo_data.recurring_days) == 0:
                    logger.error(f"❌ 주간 반복인데 recurring_days가 없음")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="주간 반복 일정인 경우 반복 요일을 지정해야 합니다."
                    )
            
            if todo_data.recurring_type == RecurringType.MONTHLY:
                if not todo_data.recurring_day_of_month:
                    logger.error(f"❌ 월간 반복인데 recurring_day_of_month가 없음")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="월간 반복 일정인 경우 반복 날짜를 지정해야 합니다."
                    )
        else:
            # 반복 일정이 아닌데 반복 관련 필드가 있으면 경고 (무시)
            if todo_data.recurring_type or todo_data.recurring_days or todo_data.recurring_day_of_month:
                logger.warning(f"⚠️ 반복 일정이 아닌데 반복 관련 필드가 있음 (무시됨)")
        
        # TODO 생성
        logger.info(f"🔨 TODO 객체 생성 시작")
        logger.info(f"   - is_recurring 값: {todo_data.is_recurring} (타입: {type(todo_data.is_recurring)})")
        logger.info(f"   - is_shared_with_caregiver 값: {todo_data.is_shared_with_caregiver} (타입: {type(todo_data.is_shared_with_caregiver)})")
        
        # 출처별 공유 기본값 설정
        # - 보호자 할당: 항상 공유 (True)
        # - AI 추출: 기본 비공유 (False), 사용자가 선택 가능
        # - 어르신 직접 등록: 기본 비공유 (False), 사용자가 선택 가능
        if creator_type_value == CreatorType.CAREGIVER:
            # 보호자가 할당한 TODO는 항상 공유
            final_shared_status = True
            logger.info(f"   - 보호자 할당 TODO: 항상 공유 (True)")
        else:
            # AI 추출 또는 어르신 직접 등록: 사용자가 명시적으로 전달한 값 사용
            # (스키마 기본값이 True이므로, False로 명시적으로 전달해야 함)
            final_shared_status = todo_data.is_shared_with_caregiver
            logger.info(f"   - {creator_type_value.value} 생성 TODO: 공유 상태 = {final_shared_status}")
        
        # 반복 일정 템플릿의 경우, due_date는 항상 recurring_start_date와 같아야 함
        # 템플릿은 시작일에 생성되어야 하고, 이후 날짜의 개별 TODO는 Celery Beat가 생성
        recurring_start_date = todo_data.recurring_start_date or todo_data.due_date
        template_due_date = recurring_start_date if todo_data.is_recurring else todo_data.due_date
        
        logger.info(f"   - 반복 일정 여부: {todo_data.is_recurring}")
        logger.info(f"   - 사용자 선택 날짜 (due_date): {todo_data.due_date}")
        logger.info(f"   - 반복 시작일 (recurring_start_date): {recurring_start_date}")
        logger.info(f"   - 템플릿 due_date: {template_due_date}")
        
        new_todo = Todo(
            todo_id=str(uuid.uuid4()),
            elderly_id=todo_data.elderly_id,
            creator_id=creator_id,
            title=todo_data.title,
            description=todo_data.description,
            category=todo_data.category,
            due_date=template_due_date,  # 반복 일정 템플릿은 시작일에 생성
            due_time=due_time_obj,  # 변환된 time 객체 사용
            creator_type=creator_type_value,  # 동적으로 설정된 creator_type 사용
            status=TodoStatus.PENDING,
            is_confirmed=True,
            # 공유 설정 (출처별 기본값 적용)
            is_shared_with_caregiver=final_shared_status,
            # 반복 일정 설정
            is_recurring=todo_data.is_recurring,
            recurring_type=todo_data.recurring_type,
            recurring_interval=todo_data.recurring_interval,
            recurring_days=todo_data.recurring_days,
            recurring_day_of_month=todo_data.recurring_day_of_month,
            recurring_start_date=recurring_start_date,
            recurring_end_date=todo_data.recurring_end_date,
        )
        
        logger.info(f"🔨 TODO 객체 생성 완료")
        logger.info(f"   - 생성된 객체의 is_recurring: {new_todo.is_recurring}")
        logger.info(f"   - 생성된 객체의 is_shared_with_caregiver: {new_todo.is_shared_with_caregiver}")
        
        db.add(new_todo)
        logger.info(f"💾 DB에 추가 완료, commit 전")
        
        db.commit()
        logger.info(f"💾 DB commit 완료")
        
        db.refresh(new_todo)
        logger.info(f"🔄 DB refresh 완료")
        logger.info(f"   - refresh 후 is_recurring: {new_todo.is_recurring}")
        logger.info(f"   - refresh 후 is_shared_with_caregiver: {new_todo.is_shared_with_caregiver}")
        logger.info(f"   - refresh 후 due_date: {new_todo.due_date}")
        
        # DB에서 직접 다시 조회해서 확인
        verify_todo = db.query(Todo).filter(Todo.todo_id == new_todo.todo_id).first()
        if verify_todo:
            logger.info(f"✅ DB에서 직접 조회 성공:")
            logger.info(f"   - 제목: {verify_todo.title}")
            logger.info(f"   - is_recurring: {verify_todo.is_recurring} (타입: {type(verify_todo.is_recurring)})")
            logger.info(f"   - is_shared_with_caregiver: {verify_todo.is_shared_with_caregiver}")
            logger.info(f"   - due_date: {verify_todo.due_date}")
        else:
            logger.error(f"❌ DB에서 직접 조회 실패! TODO ID: {new_todo.todo_id}")
        
        # 반복 일정인 경우, 오늘 날짜와 사용자가 선택한 날짜가 반복 조건에 맞으면 즉시 개별 TODO 생성
        if new_todo.is_recurring:
            today = date.today()
            user_selected_date = todo_data.due_date  # 사용자가 선택한 날짜 (템플릿의 due_date와 다를 수 있음)
            start_date = new_todo.recurring_start_date or new_todo.due_date
            
            created_today = False
            created_selected = False
            
            # 오늘 날짜가 반복 조건에 맞으면 생성
            if today >= start_date:
                should_create_today = TodoService._should_create_recurring_todo(new_todo, today)
                if should_create_today:
                    existing_today = db.query(Todo).filter(
                        and_(
                            Todo.parent_recurring_id == new_todo.todo_id,
                            Todo.due_date == today
                        )
                    ).first()
                    
                    if not existing_today:
                        today_todo = Todo(
                            todo_id=str(uuid.uuid4()),
                            elderly_id=new_todo.elderly_id,
                            creator_id=new_todo.creator_id,
                            title=new_todo.title,
                            description=new_todo.description,
                            category=new_todo.category,
                            due_date=today,
                            due_time=new_todo.due_time,
                            creator_type=new_todo.creator_type,
                            status=TodoStatus.PENDING,
                            is_confirmed=True,
                            is_recurring=False,
                            parent_recurring_id=new_todo.todo_id,
                            is_shared_with_caregiver=new_todo.is_shared_with_caregiver,
                        )
                        db.add(today_todo)
                        created_today = True
                        logger.info(f"✅ 반복 일정 생성 시 오늘 날짜({today})의 개별 TODO 즉시 생성됨")
            
            # 사용자가 선택한 날짜가 오늘 이후이고 반복 조건에 맞으면 생성
            if user_selected_date > today and user_selected_date >= start_date:
                should_create_selected = TodoService._should_create_recurring_todo(new_todo, user_selected_date)
                if should_create_selected:
                    existing_selected = db.query(Todo).filter(
                        and_(
                            Todo.parent_recurring_id == new_todo.todo_id,
                            Todo.due_date == user_selected_date
                        )
                    ).first()
                    
                    if not existing_selected:
                        selected_todo = Todo(
                            todo_id=str(uuid.uuid4()),
                            elderly_id=new_todo.elderly_id,
                            creator_id=new_todo.creator_id,
                            title=new_todo.title,
                            description=new_todo.description,
                            category=new_todo.category,
                            due_date=user_selected_date,
                            due_time=new_todo.due_time,
                            creator_type=new_todo.creator_type,
                            status=TodoStatus.PENDING,
                            is_confirmed=True,
                            is_recurring=False,
                            parent_recurring_id=new_todo.todo_id,
                            is_shared_with_caregiver=new_todo.is_shared_with_caregiver,
                        )
                        db.add(selected_todo)
                        created_selected = True
                        logger.info(f"✅ 반복 일정 생성 시 선택한 날짜({user_selected_date})의 개별 TODO 즉시 생성됨")
            
            # 변경사항이 있으면 commit
            if created_today or created_selected:
                db.commit()
        
        # TODO: 알림 전송 (나중에 구현)
        # NotificationService.send_todo_assigned(elderly_id, new_todo)
        
        return new_todo
    
    @staticmethod
    def get_todos_by_date(
        db: Session,
        elderly_id: str,
        target_date: date,
        status_filter: Optional[TodoStatus] = None,
        shared_only: bool = False
    ) -> List[Todo]:
        """
        날짜별 TODO 조회 (반복 일정 자동 생성 포함)

        Args:
            db: DB 세션
            elderly_id: 어르신 ID
            target_date: 조회할 날짜
            status_filter: 상태 필터 (optional)
            shared_only: 공유된 TODO만 (optional)

        Returns:
            TODO 목록
        """
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info(f"🔍 get_todos_by_date 호출:")
        logger.info(f"   - elderly_id: {elderly_id}")
        logger.info(f"   - target_date: {target_date}")
        logger.info(f"   - status_filter: {status_filter}")
        logger.info(f"   - shared_only: {shared_only}")
        
        # ⚠️ 반복 일정 자동 생성 제거
        # 반복 일정은 Celery Beat의 generate_recurring_todos()가 매일 자정에 생성하므로
        # 조회 시마다 생성하면 중복 생성 및 성능 문제 발생 가능
        # 필요시 generate_recurring_todos()를 수동 호출하거나 스케줄러를 더 자주 실행
        
        # 반복 일정 템플릿 제외 (is_recurring=True이고 parent_recurring_id=NULL인 것은 템플릿)
        # 실제 할일만 조회: is_recurring=False이거나, 생성된 개별 TODO (parent_recurring_id가 있음)
        query = db.query(Todo).filter(
            and_(
                Todo.elderly_id == elderly_id,
                Todo.due_date == target_date,
                # 반복 일정 템플릿 제외
                or_(
                    Todo.is_recurring == False,
                    Todo.is_recurring.is_(None),
                    Todo.parent_recurring_id.isnot(None)  # 생성된 개별 TODO (원본 템플릿이 아님)
                )
            )
        )
        
        # 공유 필터 (보호자용)
        if shared_only:
            logger.info(f"   - 공유 필터 적용: is_shared_with_caregiver == True")
            query = query.filter(Todo.is_shared_with_caregiver == True)
        
        if status_filter:
            logger.info(f"   - 상태 필터 적용: {status_filter}")
            query = query.filter(Todo.status == status_filter)
        
        # 쿼리 실행 전 전체 할일 개수 확인
        all_todos_count = db.query(Todo).filter(
            Todo.elderly_id == elderly_id,
            Todo.due_date == target_date
        ).count()
        logger.info(f"   - 필터 전 전체 할일 개수: {all_todos_count}개")
        
        result = query.order_by(Todo.status.asc(), Todo.due_time.asc()).all()
        logger.info(f"   - 최종 조회 결과: {len(result)}개")
        
        for todo in result:
            logger.info(f"      - {todo.title} (is_recurring={todo.is_recurring}, is_shared={todo.is_shared_with_caregiver})")
        
        return result
    
    @staticmethod
    def get_todos_by_date_range(
        db: Session,
        elderly_id: str,
        start_date: date,
        end_date: date,
        status_filter: Optional[TodoStatus] = None,
        shared_only: bool = False
    ) -> List[Todo]:
        """
        날짜 범위별 TODO 조회
        
        Args:
            db: DB 세션
            elderly_id: 어르신 ID
            start_date: 시작 날짜
            end_date: 종료 날짜
            status_filter: 상태 필터 (optional)
            shared_only: 공유된 TODO만 (optional)
        
        Returns:
            TODO 목록
        """
        # ⚠️ 반복 일정 자동 생성 제거
        # 반복 일정은 Celery Beat의 generate_recurring_todos()가 매일 자정에 생성하므로
        # 조회 시마다 생성하면 중복 생성 및 성능 문제 발생 가능
        # 필요시 generate_recurring_todos()를 수동 호출하거나 스케줄러를 더 자주 실행
        
        # 반복 일정 템플릿 제외 (is_recurring=True이고 parent_recurring_id=NULL인 것은 템플릿)
        # 실제 할일만 조회: is_recurring=False이거나, 생성된 개별 TODO (parent_recurring_id가 있음)
        query = db.query(Todo).filter(
            and_(
                Todo.elderly_id == elderly_id,
                Todo.due_date >= start_date,
                Todo.due_date <= end_date,
                # 반복 일정 템플릿 제외
                or_(
                    Todo.is_recurring == False,
                    Todo.is_recurring.is_(None),
                    Todo.parent_recurring_id.isnot(None)  # 생성된 개별 TODO (원본 템플릿이 아님)
                )
            )
        )
        
        # 공유 필터 (보호자용)
        if shared_only:
            query = query.filter(Todo.is_shared_with_caregiver == True)
        
        if status_filter:
            query = query.filter(Todo.status == status_filter)
        
        return query.order_by(Todo.due_date.asc(), Todo.due_time.asc()).all()
    
    @staticmethod
    def complete_todo(
        db: Session,
        todo_id: str,
        user_id: str
    ) -> Todo:
        """
        TODO 완료 처리 (어르신만 가능)
        
        Args:
            db: DB 세션
            todo_id: TODO ID
            user_id: 사용자 ID (어르신)
        
        Returns:
            업데이트된 TODO
        """
        todo = db.query(Todo).filter(Todo.todo_id == todo_id).first()
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="TODO를 찾을 수 없습니다."
            )
        
        # 권한 확인 (본인의 TODO만 완료 가능)
        if todo.elderly_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="본인의 TODO만 완료할 수 있습니다."
            )
        
        # 완료 처리
        todo.status = TodoStatus.COMPLETED
        todo.completed_at = kst_now()
        todo.updated_at = kst_now()
        
        db.commit()
        db.refresh(todo)
        
        # TODO: 알림 전송 (보호자에게)
        # NotificationService.send_todo_completed(todo.creator_id, todo)
        
        return todo
    
    @staticmethod
    def cancel_todo(
        db: Session,
        todo_id: str,
        user_id: str
    ) -> Todo:
        """
        TODO 완료 취소 (어르신만 가능)
        
        Args:
            db: DB 세션
            todo_id: TODO ID
            user_id: 사용자 ID (어르신)
        
        Returns:
            업데이트된 TODO
        """
        todo = db.query(Todo).filter(Todo.todo_id == todo_id).first()
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="TODO를 찾을 수 없습니다."
            )
        
        # 권한 확인
        if todo.elderly_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="본인의 TODO만 취소할 수 있습니다."
            )
        
        # 취소 처리 (완료 상태만 취소 가능)
        if todo.status != TodoStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="완료된 TODO만 취소할 수 있습니다."
            )
        
        todo.status = TodoStatus.PENDING
        todo.completed_at = None
        todo.updated_at = kst_now()
        
        db.commit()
        db.refresh(todo)
        
        return todo
    
    @staticmethod
    def update_todo(
        db: Session,
        todo_id: str,
        todo_update: TodoUpdate,
        user_id: str
    ) -> Todo:
        """
        TODO 수정 (보호자만 가능)
        
        Args:
            db: DB 세션
            todo_id: TODO ID
            todo_update: 수정 데이터
            user_id: 사용자 ID (보호자)
        
        Returns:
            업데이트된 TODO
        """
        todo = db.query(Todo).filter(Todo.todo_id == todo_id).first()
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="TODO를 찾을 수 없습니다."
            )
        
        # 권한 확인 (생성자 또는 본인만 수정 가능)
        if todo.creator_id != user_id and todo.elderly_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="TODO를 수정할 권한이 없습니다."
            )
        
        # 어르신이 완료한 TODO는 보호자가 수정 불가
        if todo.status == TodoStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="완료된 TODO는 수정할 수 없습니다."
            )
        
        # 업데이트 (None이 아닌 값만)
        update_data = todo_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(todo, key, value)
        
        todo.updated_at = kst_now()
        
        db.commit()
        db.refresh(todo)
        
        return todo
    
    @staticmethod
    def get_todo_by_id(
        db: Session,
        todo_id: str,
        user_id: str,
        user_role: UserRole
    ) -> Todo:
        """
        TODO 상세 조회
        
        Args:
            db: DB 세션
            todo_id: TODO ID
            user_id: 사용자 ID
            user_role: 사용자 역할 (ELDERLY 또는 CAREGIVER)
        
        Returns:
            TODO 객체
        """
        todo = db.query(Todo).filter(Todo.todo_id == todo_id).first()
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="TODO를 찾을 수 없습니다."
            )
        
        # 권한 확인
        if user_role == UserRole.ELDERLY:
            # 어르신인 경우: 본인의 TODO만 조회 가능
            if todo.elderly_id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="본인의 TODO만 조회할 수 있습니다."
                )
        else:
            # 보호자인 경우: 공유된 TODO만 조회 가능
            if not todo.is_shared_with_caregiver:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="공유된 TODO만 조회할 수 있습니다."
                )
        
        return todo
    
    @staticmethod
    def delete_todo(
        db: Session,
        todo_id: str,
        user_id: str,
        delete_future: bool = False
    ) -> Dict[str, any]:
        """
        TODO 삭제 (보호자만 가능)
        
        Args:
            db: DB 세션
            todo_id: TODO ID
            user_id: 사용자 ID (보호자)
            delete_future: 이후 반복 일정도 모두 삭제할지 여부
        
        Returns:
            삭제된 TODO 수
        """
        todo = db.query(Todo).filter(Todo.todo_id == todo_id).first()
        if not todo:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="TODO를 찾을 수 없습니다."
            )
        
        # 권한 확인 (생성자 또는 본인만 삭제 가능)
        if todo.creator_id != user_id and todo.elderly_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="TODO를 삭제할 권한이 없습니다."
            )
        
        deleted_count = 1
        
        # 생성된 개별 반복 일정인 경우 (parent_recurring_id가 있음)
        if todo.parent_recurring_id:
            # 생성된 개별 TODO 삭제
            parent_template_id = todo.parent_recurring_id
            
            if delete_future:
                # 이후 모든 생성된 개별 TODO 삭제 (원본 템플릿은 유지)
                future_todos = db.query(Todo).filter(
                    and_(
                        Todo.parent_recurring_id == parent_template_id,
                        Todo.due_date >= todo.due_date
                    )
                ).all()
                
                deleted_count = len(future_todos)
                for future_todo in future_todos:
                    db.delete(future_todo)
            else:
                # 오늘 것만 삭제
                db.delete(todo)
        
        # 원본 반복 일정 템플릿인 경우 (is_recurring=True이고 parent_recurring_id=NULL)
        elif todo.is_recurring:
            if delete_future:
                # 원본 템플릿과 모든 생성된 개별 TODO 삭제
                # 1. 원본 템플릿 삭제
                db.delete(todo)
                
                # 2. 이 템플릿에서 생성된 모든 개별 TODO 삭제
                generated_todos = db.query(Todo).filter(
                    Todo.parent_recurring_id == todo.todo_id
                ).all()
                
                deleted_count = 1 + len(generated_todos)
                for generated_todo in generated_todos:
                    db.delete(generated_todo)
            else:
                # 원본 템플릿은 오늘 이후의 생성된 TODO만 삭제
                # (오늘 이전의 생성된 TODO는 유지, 템플릿은 유지)
                future_generated_todos = db.query(Todo).filter(
                    and_(
                        Todo.parent_recurring_id == todo.todo_id,
                        Todo.due_date >= date.today()
                    )
                ).all()
                
                deleted_count = len(future_generated_todos)
                for future_todo in future_generated_todos:
                    db.delete(future_todo)
                
                # 원본 템플릿은 유지 (삭제 안 함)
                deleted_count = len(future_generated_todos)
        
        else:
            # 일반 TODO 삭제 (반복 일정 아님)
            db.delete(todo)
        
        db.commit()
        
        return {
            "message": "TODO가 삭제되었습니다.",
            "deleted_count": deleted_count
        }
    
    @staticmethod
    def get_todo_stats(
        db: Session,
        elderly_id: str,
        start_date: date,
        end_date: date,
        shared_only: bool = False
    ) -> TodoStatsResponse:
        """
        TODO 통계 조회
        
        Args:
            db: DB 세션
            elderly_id: 어르신 ID
            start_date: 시작 날짜
            end_date: 종료 날짜
            shared_only: 공유된 TODO만 (보호자용, 기본값: False)
        
        Returns:
            TODO 통계
        """
        # 반복 일정 템플릿 제외하고 실제 할일만 조회
        query = db.query(Todo).filter(
            and_(
                Todo.elderly_id == elderly_id,
                Todo.due_date >= start_date,
                Todo.due_date <= end_date,
                # 반복 일정 템플릿 제외: parent_recurring_id가 있거나 is_recurring이 False인 것만
                or_(
                    Todo.is_recurring == False,
                    Todo.parent_recurring_id.isnot(None)  # 생성된 개별 TODO (원본 템플릿이 아님)
                )
            )
        )
        
        # 공유 필터 (보호자용)
        if shared_only:
            query = query.filter(Todo.is_shared_with_caregiver == True)
        
        todos = query.all()
        
        total = len(todos)
        completed = sum(1 for t in todos if t.status == TodoStatus.COMPLETED)
        pending = sum(1 for t in todos if t.status == TodoStatus.PENDING)
        cancelled = sum(1 for t in todos if t.status == TodoStatus.CANCELLED)
        
        completion_rate = completed / total if total > 0 else 0.0
        
        return TodoStatsResponse(
            total=total,
            completed=completed,
            pending=pending,
            cancelled=cancelled,
            completion_rate=completion_rate
        )
    
    @staticmethod
    def get_detailed_stats(
        db: Session,
        elderly_id: str,
        start_date: date,
        end_date: date,
        shared_only: bool = False
    ) -> TodoDetailedStatsResponse:
        """
        TODO 상세 통계 조회 (카테고리별 포함)
        
        Args:
            db: DB 세션
            elderly_id: 어르신 ID
            start_date: 시작 날짜
            end_date: 종료 날짜
            shared_only: 공유된 TODO만 (보호자용, 기본값: False)
        
        Returns:
            TODO 상세 통계 (카테고리별 포함)
        """
        from app.models.todo import TodoCategory
        
        # 전체 TODO 조회 (반복 일정 템플릿 제외)
        query = db.query(Todo).filter(
            and_(
                Todo.elderly_id == elderly_id,
                Todo.due_date >= start_date,
                Todo.due_date <= end_date,
                # 반복 일정 템플릿 제외: parent_recurring_id가 있거나 is_recurring이 False인 것만
                or_(
                    Todo.is_recurring == False,
                    Todo.parent_recurring_id.isnot(None)  # 생성된 개별 TODO (원본 템플릿이 아님)
                )
            )
        )
        
        # 공유 필터 (보호자용)
        if shared_only:
            query = query.filter(Todo.is_shared_with_caregiver == True)
        
        todos = query.all()
        
        # 전체 통계 계산
        total = len(todos)
        completed = sum(1 for t in todos if t.status == TodoStatus.COMPLETED)
        pending = sum(1 for t in todos if t.status == TodoStatus.PENDING)
        cancelled = sum(1 for t in todos if t.status == TodoStatus.CANCELLED)
        completion_rate = completed / total if total > 0 else 0.0
        
        # 카테고리별 통계 계산
        category_stats = []
        for category in TodoCategory:
            category_todos = [t for t in todos if t.category == category]
            cat_total = len(category_todos)
            
            if cat_total > 0:
                cat_completed = sum(1 for t in category_todos if t.status == TodoStatus.COMPLETED)
                cat_pending = sum(1 for t in category_todos if t.status == TodoStatus.PENDING)
                cat_cancelled = sum(1 for t in category_todos if t.status == TodoStatus.CANCELLED)
                cat_completion_rate = cat_completed / cat_total if cat_total > 0 else 0.0
                
                category_stats.append(CategoryStatsResponse(
                    category=category.value,
                    total=cat_total,
                    completed=cat_completed,
                    pending=cat_pending,
                    cancelled=cat_cancelled,
                    completion_rate=cat_completion_rate
                ))
        
        return TodoDetailedStatsResponse(
            total=total,
            completed=completed,
            pending=pending,
            cancelled=cancelled,
            completion_rate=completion_rate,
            by_category=category_stats
        )
    
    @staticmethod
    def generate_recurring_todos(
        db: Session,
        target_date: date
    ) -> int:
        """
        반복 일정 자동 생성 (Celery Beat에서 매일 자정에 실행)
        
        Args:
            db: DB 세션
            target_date: 생성할 날짜
        
        Returns:
            생성된 TODO 수
        """
        # 활성화된 반복 일정 조회
        recurring_todos = db.query(Todo).filter(
            and_(
                Todo.is_recurring == True,
                Todo.parent_recurring_id == None,  # 원본 반복 설정만
                or_(
                    Todo.recurring_end_date == None,  # 종료일 없음
                    Todo.recurring_end_date >= target_date  # 종료일이 아직 안 지남
                )
            )
        ).all()
        
        created_count = 0
        
        for recurring_todo in recurring_todos:
            # 반복 조건 확인 (조건에 맞지 않으면 스킵)
            should_create = TodoService._should_create_recurring_todo(
                recurring_todo, target_date
            )
            
            if not should_create:
                continue
            
            # 이미 생성된 TODO가 있는지 확인 (더 엄격한 체크)
            # elderly_id도 포함하여 동일한 어르신의 동일한 반복 일정 중복 방지
            existing = db.query(Todo).filter(
                and_(
                    Todo.parent_recurring_id == recurring_todo.todo_id,
                    Todo.due_date == target_date,
                    Todo.elderly_id == recurring_todo.elderly_id  # elderly_id도 체크
                )
            ).first()
            
            if existing:
                logger.debug(f"⏭️  이미 생성된 TODO 스킵: {recurring_todo.title} ({target_date})")
                continue  # 이미 생성됨
            
            # 새 TODO 생성
            try:
                new_todo = Todo(
                    todo_id=str(uuid.uuid4()),
                    elderly_id=recurring_todo.elderly_id,
                    creator_id=recurring_todo.creator_id,
                    title=recurring_todo.title,
                    description=recurring_todo.description,
                    category=recurring_todo.category,
                    due_date=target_date,
                    due_time=recurring_todo.due_time,
                    creator_type=recurring_todo.creator_type,
                    status=TodoStatus.PENDING,
                    is_confirmed=True,
                    is_recurring=False,  # 생성된 TODO는 반복 아님
                    parent_recurring_id=recurring_todo.todo_id,  # 원본 ID 연결
                    is_shared_with_caregiver=recurring_todo.is_shared_with_caregiver,  # 공유 설정 복사
                )
                
                db.add(new_todo)
                # 각 TODO마다 즉시 flush하여 중복 방지 (동시성 문제 해결)
                db.flush()
                created_count += 1
                logger.debug(f"✅ 반복 TODO 생성: {recurring_todo.title} ({target_date})")
            
            except Exception as e:
                # 중복 생성 시도 시 무시 (다른 프로세스가 이미 생성했을 수 있음)
                db.rollback()
                logger.warning(f"⚠️  TODO 생성 중 오류 (무시): {recurring_todo.title} ({target_date}) - {str(e)}")
                # 다시 중복 체크
                existing_retry = db.query(Todo).filter(
                    and_(
                        Todo.parent_recurring_id == recurring_todo.todo_id,
                        Todo.due_date == target_date,
                        Todo.elderly_id == recurring_todo.elderly_id
                    )
                ).first()
                if existing_retry:
                    logger.debug(f"⏭️  재확인 결과 이미 존재함: {recurring_todo.title} ({target_date})")
                    continue
                # 실제 오류인 경우 재시도
                raise
        
        db.commit()
        
        return created_count
    
    @staticmethod
    def _should_create_recurring_todo(todo: Todo, target_date: date) -> bool:
        """
        반복 일정 생성 조건 확인
        
        Args:
            todo: 원본 반복 TODO
            target_date: 생성할 날짜
        
        Returns:
            생성 여부
        """
        # 시작일 체크
        if todo.recurring_start_date and target_date < todo.recurring_start_date:
            return False
        
        # 종료일 체크
        if todo.recurring_end_date and target_date > todo.recurring_end_date:
            return False
        
        # 반복 유형별 로직
        if todo.recurring_type == RecurringType.DAILY:
            # 매일 또는 N일마다
            start_date = todo.recurring_start_date or todo.due_date  # None이면 due_date 사용
            days_diff = (target_date - start_date).days
            if days_diff < 0:
                return False  # 시작일 이전이면 생성 안 함
            return days_diff % todo.recurring_interval == 0
        
        elif todo.recurring_type == RecurringType.WEEKLY:
            # 매주 특정 요일
            if not todo.recurring_days:
                return False
            weekday = target_date.weekday()  # 0=월요일, 6=일요일
            return weekday in todo.recurring_days
        
        elif todo.recurring_type == RecurringType.MONTHLY:
            # 매월 특정 일
            if not todo.recurring_day_of_month:
                return False
            return target_date.day == todo.recurring_day_of_month
        
        return False

