"""
TODO 반복 일정 자동 생성 작업
Celery Beat에서 매일 자정에 실행
"""

from celery import shared_task
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import SessionLocal
from app.services.todo.todo_service import TodoService
import logging

logger = logging.getLogger(__name__)


@shared_task(name="app.tasks.todo_scheduler.generate_daily_recurring_todos")
def generate_daily_recurring_todos():
    """
    매일 자정에 실행되어 오늘의 반복 TODO 생성
    
    Returns:
        생성된 TODO 수
    """
    db: Session = SessionLocal()
    try:
        today = date.today()
        logger.info(f"📅 반복 TODO 생성 시작: {today}")
        
        created_count = TodoService.generate_recurring_todos(
            db=db,
            target_date=today
        )
        
        logger.info(f"✅ 반복 TODO {created_count}개 생성 완료")
        
        return {
            "date": str(today),
            "created_count": created_count,
            "status": "success"
        }
    
    except Exception as e:
        logger.error(f"❌ 반복 TODO 생성 실패: {str(e)}")
        return {
            "date": str(date.today()),
            "created_count": 0,
            "status": "error",
            "error": str(e)
        }
    
    finally:
        db.close()


@shared_task(name="app.tasks.todo_scheduler.send_todo_reminders")
def send_todo_reminders():
    """
    다가오는 TODO 리마인더 알림 전송 (10분 전)
    매 10분마다 실행
    """
    from app.models.todo import Todo, TodoStatus
    from app.models.user import User
    from app.services.notification_service import NotificationService
    from datetime import datetime, timedelta
    import asyncio
    
    def run_async(coro):
        """비동기 함수를 동기적으로 실행"""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    
    db: Session = SessionLocal()
    try:
        logger.info("⏰ TODO 리마인더 체크 시작")
        
        # KST 시간대 사용
        import pytz
        kst = pytz.timezone('Asia/Seoul')
        now = datetime.now(kst)
        today = now.date()
        
        # 10분 전 리마인더 윈도우 (현재 시간 기준으로 10분 전 ~ 현재 시간)
        reminder_start = now - timedelta(minutes=10)
        reminder_end = now
        
        # 오늘 날짜의 PENDING 상태 TODO 조회
        upcoming_todos = db.query(Todo).filter(
            Todo.status == TodoStatus.PENDING,
            Todo.due_date == today,
            Todo.due_time.isnot(None)
        ).all()
        
        # 시간 필터링 (정확히 10분 전에 알림 전송)
        from app.models.notification import Notification, NotificationType
        filtered_todos = []
        for todo in upcoming_todos:
            # due_date + due_time을 KST datetime으로 결합
            todo_datetime = kst.localize(datetime.combine(todo.due_date, todo.due_time))
            
            # TODO 시간까지 남은 시간 계산
            time_diff = todo_datetime - now
            minutes_until_due = time_diff.total_seconds() / 60
            
            # 정확히 10분 전에 알림 전송 (9.5분 ~ 10.5분 사이의 윈도우)
            # 이미 알림을 보낸 TODO는 제외 (중복 방지)
            if 9.5 <= minutes_until_due <= 10.5:
                # 이미 이 TODO에 대한 리마인더 알림이 전송되었는지 확인
                existing_notification = db.query(Notification).filter(
                    and_(
                        Notification.related_id == todo.todo_id,
                        Notification.type == NotificationType.TODO_REMINDER,
                        Notification.is_pushed == True
                    )
                ).first()
                
                # 알림을 아직 보내지 않은 TODO만 추가
                if not existing_notification:
                    filtered_todos.append(todo)
                    logger.info(f"📋 리마인더 대상: {todo.title} (남은 시간: {minutes_until_due:.1f}분)")
                else:
                    logger.debug(f"⏭️ 이미 알림 전송됨: {todo.title}")
        
        upcoming_todos = filtered_todos
        
        logger.info(f"📋 알림 대상 TODO: {len(upcoming_todos)}개")
        
        sent_count = 0
        for todo in upcoming_todos:
            try:
                # 어르신 정보 조회
                elderly = db.query(User).filter(User.user_id == todo.elderly_id).first()
                if not elderly:
                    continue
                
                # 리마인더 알림 전송
                success = run_async(
                    NotificationService.notify_todo_reminder(
                        db=db,
                        user_id=todo.elderly_id,
                        todo_title=todo.title,
                        todo_id=todo.todo_id,
                        minutes_before=10
                    )
                )
                
                if success:
                    sent_count += 1
                    logger.info(f"✅ 리마인더 전송 완료: {todo.title} → {elderly.name}")
            
            except Exception as e:
                logger.error(f"Failed to send reminder for todo {todo.todo_id}: {str(e)}")
                continue
        
        logger.info(f"✅ TODO 리마인더 전송 완료: {sent_count}/{len(upcoming_todos)}개")
        
        return {
            "status": "success",
            "total": len(upcoming_todos),
            "sent": sent_count
        }
    
    except Exception as e:
        logger.error(f"❌ TODO 리마인더 실패: {str(e)}")
        return {"status": "error", "error": str(e)}
    
    finally:
        db.close()


@shared_task(name="app.tasks.todo_scheduler.check_overdue_todos")
def check_overdue_todos():
    """
    미완료 TODO 체크 및 알림 전송
    매일 밤 9시 실행
    """
    from app.models.todo import Todo, TodoStatus
    from app.models.user import User
    from app.services.notification_service import NotificationService
    from datetime import datetime
    import asyncio
    
    def run_async(coro):
        """비동기 함수를 동기적으로 실행"""
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    
    db: Session = SessionLocal()
    try:
        today = date.today()
        logger.info(f"🔔 미완료 TODO 체크 시작: {today}")
        
        # 오늘 날짜의 PENDING 상태 TODO를 어르신별로 그룹화
        incomplete_todos = db.query(Todo).filter(
            Todo.status == TodoStatus.PENDING,
            Todo.due_date == today
        ).all()
        
        logger.info(f"📋 미완료 TODO: {len(incomplete_todos)}개")
        
        # 어르신별로 미완료 TODO 개수 집계
        elderly_todo_counts = {}
        for todo in incomplete_todos:
            if todo.elderly_id not in elderly_todo_counts:
                elderly_todo_counts[todo.elderly_id] = 0
            elderly_todo_counts[todo.elderly_id] += 1
        
        # 각 어르신에게 알림 전송
        sent_count = 0
        for elderly_id, count in elderly_todo_counts.items():
            try:
                elderly = db.query(User).filter(User.user_id == elderly_id).first()
                if not elderly:
                    continue
                
                # 미완료 알림 전송
                success = run_async(
                    NotificationService.notify_todo_incomplete(
                        db=db,
                        user_id=elderly_id,
                        incomplete_count=count
                    )
                )
                
                if success:
                    sent_count += 1
                    logger.info(f"✅ 미완료 알림 전송: {elderly.name} ({count}개)")
            
            except Exception as e:
                logger.error(f"Failed to send incomplete notification to {elderly_id}: {str(e)}")
                continue
        
        logger.info(f"✅ 미완료 TODO 체크 완료: {sent_count}/{len(elderly_todo_counts)}명")
        
        return {
            "status": "success",
            "total_users": len(elderly_todo_counts),
            "sent": sent_count,
            "total_todos": len(incomplete_todos)
        }
    
    except Exception as e:
        logger.error(f"❌ 미완료 TODO 체크 실패: {str(e)}")
        return {"status": "error", "error": str(e)}
    
    finally:
        db.close()


@shared_task(name="app.tasks.todo_scheduler.cleanup_old_todos")
def cleanup_old_todos():
    """
    오래된 TODO 정리 (완료된 TODO 1개월 이상)
    매주 일요일 자정 실행
    
    TODO: 데이터 보관 정책 구현
    """
    db: Session = SessionLocal()
    try:
        logger.info("🗑️ 오래된 TODO 정리 시작")
        
        # TODO: 1개월 이상 지난 COMPLETED TODO 소프트 삭제 또는 아카이빙
        
        logger.info("✅ 오래된 TODO 정리 완료")
        
        return {"status": "success", "message": "정리 완료"}
    
    except Exception as e:
        logger.error(f"❌ 오래된 TODO 정리 실패: {str(e)}")
        return {"status": "error", "error": str(e)}
    
    finally:
        db.close()

