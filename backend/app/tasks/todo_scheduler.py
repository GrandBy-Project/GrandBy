"""
TODO 반복 일정 자동 생성 작업
Celery Beat에서 매일 자정에 실행
"""

from celery import shared_task
from datetime import date, datetime
from sqlalchemy.orm import Session
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
        
        now = datetime.now()
        # 10분 후 ~ 20분 후 시간대 (10분 주기로 실행되므로)
        start_time = now + timedelta(minutes=10)
        end_time = now + timedelta(minutes=20)
        
        # PENDING 상태의 TODO 중 시작 시간이 10~20분 사이인 것 조회
        upcoming_todos = db.query(Todo).filter(
            Todo.status == TodoStatus.PENDING,
            Todo.start_time.isnot(None),
            Todo.start_time >= start_time,
            Todo.start_time < end_time
        ).all()
        
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

