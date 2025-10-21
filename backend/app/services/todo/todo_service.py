"""
TODO 서비스 로직
보호자가 어르신에게 TODO 할당 및 관리
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from datetime import date, datetime, timedelta
from typing import List, Optional, Dict
import uuid

from app.models.todo import Todo, TodoStatus, CreatorType, RecurringType
from app.models.user import User, UserRole
from app.schemas.todo import (
    TodoCreate, 
    TodoUpdate, 
    TodoResponse, 
    TodoStatsResponse,
    TodoDetailedStatsResponse,
    CategoryStatsResponse
)
from fastapi import HTTPException, status


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
            # 보호자는 어르신에게 TODO 할당 가능
            creator_type_value = CreatorType.CAREGIVER
            logger.info(f"✅ 보호자가 TODO 생성")
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
        
        # TODO 생성
        new_todo = Todo(
            todo_id=str(uuid.uuid4()),
            elderly_id=todo_data.elderly_id,
            creator_id=creator_id,
            title=todo_data.title,
            description=todo_data.description,
            category=todo_data.category,
            due_date=todo_data.due_date,
            due_time=due_time_obj,  # 변환된 time 객체 사용
            creator_type=creator_type_value,  # 동적으로 설정된 creator_type 사용
            status=TodoStatus.PENDING,
            is_confirmed=True,
            # 공유 설정
            is_shared_with_caregiver=todo_data.is_shared_with_caregiver,
            # 반복 일정 설정
            is_recurring=todo_data.is_recurring,
            recurring_type=todo_data.recurring_type,
            recurring_interval=todo_data.recurring_interval,
            recurring_days=todo_data.recurring_days,
            recurring_day_of_month=todo_data.recurring_day_of_month,
            recurring_start_date=todo_data.recurring_start_date or todo_data.due_date,
            recurring_end_date=todo_data.recurring_end_date,
        )
        
        db.add(new_todo)
        db.commit()
        db.refresh(new_todo)
        
        # TODO: 알림 전송 (나중에 구현)
        # NotificationService.send_todo_assigned(elderly_id, new_todo)
        
        return new_todo
    
    @staticmethod
    def get_todos_by_date(
        db: Session,
        elderly_id: str,
        target_date: date,
        status_filter: Optional[TodoStatus] = None
    ) -> List[Todo]:
        """
        날짜별 TODO 조회
        
        Args:
            db: DB 세션
            elderly_id: 어르신 ID
            target_date: 조회할 날짜
            status_filter: 상태 필터 (optional)
        
        Returns:
            TODO 목록
        """
        query = db.query(Todo).filter(
            and_(
                Todo.elderly_id == elderly_id,
                Todo.due_date == target_date
            )
        )
        
        if status_filter:
            query = query.filter(Todo.status == status_filter)
        
        return query.order_by(Todo.status.asc(), Todo.due_time.asc()).all()
    
    @staticmethod
    def get_todos_by_date_range(
        db: Session,
        elderly_id: str,
        start_date: date,
        end_date: date,
        status_filter: Optional[TodoStatus] = None
    ) -> List[Todo]:
        """
        날짜 범위별 TODO 조회
        
        Args:
            db: DB 세션
            elderly_id: 어르신 ID
            start_date: 시작 날짜
            end_date: 종료 날짜
            status_filter: 상태 필터 (optional)
        
        Returns:
            TODO 목록
        """
        query = db.query(Todo).filter(
            and_(
                Todo.elderly_id == elderly_id,
                Todo.due_date >= start_date,
                Todo.due_date <= end_date
            )
        )
        
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
        todo.completed_at = datetime.utcnow()
        todo.updated_at = datetime.utcnow()
        
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
        todo.updated_at = datetime.utcnow()
        
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
        
        todo.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(todo)
        
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
        
        # 반복 일정인 경우
        if todo.parent_recurring_id or todo.is_recurring:
            parent_id = todo.parent_recurring_id or todo.todo_id
            
            if delete_future:
                # 이후 모든 반복 일정 삭제
                future_todos = db.query(Todo).filter(
                    and_(
                        or_(
                            Todo.parent_recurring_id == parent_id,
                            Todo.todo_id == parent_id
                        ),
                        Todo.due_date >= todo.due_date
                    )
                ).all()
                
                deleted_count = len(future_todos)
                for future_todo in future_todos:
                    db.delete(future_todo)
            else:
                # 오늘 것만 삭제
                db.delete(todo)
        else:
            # 일반 TODO 삭제
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
        end_date: date
    ) -> TodoStatsResponse:
        """
        TODO 통계 조회
        
        Args:
            db: DB 세션
            elderly_id: 어르신 ID
            start_date: 시작 날짜
            end_date: 종료 날짜
        
        Returns:
            TODO 통계
        """
        todos = db.query(Todo).filter(
            and_(
                Todo.elderly_id == elderly_id,
                Todo.due_date >= start_date,
                Todo.due_date <= end_date
            )
        ).all()
        
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
        end_date: date
    ) -> TodoDetailedStatsResponse:
        """
        TODO 상세 통계 조회 (카테고리별 포함)
        
        Args:
            db: DB 세션
            elderly_id: 어르신 ID
            start_date: 시작 날짜
            end_date: 종료 날짜
        
        Returns:
            TODO 상세 통계 (카테고리별 포함)
        """
        from app.models.todo import TodoCategory
        
        # 전체 TODO 조회
        todos = db.query(Todo).filter(
            and_(
                Todo.elderly_id == elderly_id,
                Todo.due_date >= start_date,
                Todo.due_date <= end_date
            )
        ).all()
        
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
            # 이미 생성된 TODO가 있는지 확인
            existing = db.query(Todo).filter(
                and_(
                    Todo.parent_recurring_id == recurring_todo.todo_id,
                    Todo.due_date == target_date
                )
            ).first()
            
            if existing:
                continue  # 이미 생성됨
            
            # 반복 조건 확인
            should_create = TodoService._should_create_recurring_todo(
                recurring_todo, target_date
            )
            
            if should_create:
                # 새 TODO 생성
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
                )
                
                db.add(new_todo)
                created_count += 1
        
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
            days_diff = (target_date - todo.recurring_start_date).days
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

